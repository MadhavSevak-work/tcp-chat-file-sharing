"""
File Transfer Relay Server.

Handles high-throughput, chunk-based binary file transmission over a dedicated TCP port.
By decoupling file transfer from the chat message socket, large file transfers do NOT
block or introduce jitter into real-time conversation messages.

Workflow:
1. Sender and Receiver agree on a file transfer via the chat protocol (signaling).
2. Chat server creates a TransferSession with a unique transfer_id.
3. Sender connects to the File Port and sends: {"action": "upload", "transfer_id": "..."}
4. Receiver connects to the File Port and sends: {"action": "download", "transfer_id": "..."}
5. Once both sockets are established, the relay server streams binary chunks (64 KB)
   directly from Sender -> Receiver until EOF or total bytes reached.
6. Sockets are gracefully closed, releasing resources.
"""

import socket
import threading
import time
import logging
from typing import Dict, Optional

from shared.constants import BUFFER_SIZE, CHUNK_SIZE, SOCKET_TIMEOUT
from shared.protocol import send_msg, recv_msg, ConnectionClosedError, ProtocolError


class TransferSession:
    def __init__(self, transfer_id: str, sender: str, recipient: str, filename: str, filesize: int, sha256: str):
        self.transfer_id = transfer_id
        self.sender = sender
        self.recipient = recipient
        self.filename = filename
        self.filesize = filesize
        self.sha256 = sha256
        self.created_at = time.time()

        self.sender_sock: Optional[socket.socket] = None
        self.receiver_sock: Optional[socket.socket] = None
        self.both_connected_event = threading.Event()
        self.is_completed = False
        self.is_aborted = False


class FileRelayServer:
    def __init__(self, host: str, port: int, logger: logging.Logger):
        self.host = host
        self.port = port
        self.logger = logger
        self.server_socket: Optional[socket.socket] = None
        self._is_running = False

        # Active transfer sessions indexed by transfer_id
        self.sessions: Dict[str, TransferSession] = {}
        self.lock = threading.Lock()

    def register_transfer(self, transfer_id: str, sender: str, recipient: str,
                          filename: str, filesize: int, sha256: str) -> None:
        """Called by ChatServer when a transfer offer is accepted."""
        with self.lock:
            session = TransferSession(transfer_id, sender, recipient, filename, filesize, sha256)
            self.sessions[transfer_id] = session
            self.logger.info(f"[FileRelay] Registered transfer session '{transfer_id}' "
                             f"({filename}, {filesize} bytes from {sender} to {recipient})")

    def cancel_transfer(self, transfer_id: str, reason: str = "Cancelled") -> None:
        """Aborts an in-progress or pending transfer session."""
        with self.lock:
            session = self.sessions.get(transfer_id)
            if session:
                session.is_aborted = True
                if session.sender_sock:
                    try:
                        session.sender_sock.close()
                    except Exception:
                        pass
                if session.receiver_sock:
                    try:
                        session.receiver_sock.close()
                    except Exception:
                        pass
                self.logger.warning(f"[FileRelay] Cancelled transfer '{transfer_id}': {reason}")
                self.sessions.pop(transfer_id, None)

    def start(self) -> None:
        """Starts the TCP listening loop for file transfer connections."""
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind((self.host, self.port))
        self.server_socket.listen(20)
        self._is_running = True
        self.logger.info(f"[FileRelay] Listening for file streams on {self.host}:{self.port}")

        listener_thread = threading.Thread(
            target=self._listen_loop,
            name="FileRelay-Listener",
            daemon=True
        )
        listener_thread.start()

    def _listen_loop(self) -> None:
        while self._is_running:
            try:
                client_sock, client_addr = self.server_socket.accept()
                threading.Thread(
                    target=self._handle_incoming_connection,
                    args=(client_sock, client_addr),
                    daemon=True
                ).start()
            except OSError:
                break
            except Exception as e:
                if self._is_running:
                    self.logger.error(f"[FileRelay] Accept error: {e}")

    def _handle_incoming_connection(self, client_sock: socket.socket, client_addr) -> None:
        client_sock.settimeout(SOCKET_TIMEOUT)
        try:
            handshake = recv_msg(client_sock)
            if not handshake or not isinstance(handshake, dict):
                client_sock.close()
                return

            action = handshake.get("action")
            transfer_id = handshake.get("transfer_id")

            with self.lock:
                session = self.sessions.get(transfer_id)

            if not session or session.is_aborted:
                send_msg(client_sock, {"status": "error", "message": "Unknown or expired transfer ID"})
                client_sock.close()
                return

            if action == "upload":
                session.sender_sock = client_sock
                send_msg(client_sock, {"status": "ok", "role": "sender"})
                self.logger.info(f"[FileRelay] Sender connected for transfer '{transfer_id}'")
            elif action == "download":
                session.receiver_sock = client_sock
                send_msg(client_sock, {"status": "ok", "role": "receiver"})
                self.logger.info(f"[FileRelay] Receiver connected for transfer '{transfer_id}'")
            else:
                send_msg(client_sock, {"status": "error", "message": "Invalid action"})
                client_sock.close()
                return

            # If both parties have arrived, trigger the relay stream
            if session.sender_sock and session.receiver_sock:
                session.both_connected_event.set()
                threading.Thread(
                    target=self._relay_stream,
                    args=(session,),
                    name=f"RelayWorker-{transfer_id[:8]}",
                    daemon=True
                ).start()

        except Exception as e:
            self.logger.error(f"[FileRelay] Handshake error from {client_addr}: {e}")
            try:
                client_sock.close()
            except Exception:
                pass

    def _relay_stream(self, session: TransferSession) -> None:
        """Pipes raw binary chunks from sender_sock to receiver_sock."""
        transfer_id = session.transfer_id
        self.logger.info(f"[FileRelay] Starting data stream for '{transfer_id}' ({session.filesize} bytes)...")

        # Disable timeouts during bulk data streaming
        session.sender_sock.settimeout(None)
        session.receiver_sock.settimeout(None)

        bytes_relayed = 0
        try:
            while bytes_relayed < session.filesize and not session.is_aborted:
                bytes_to_read = min(CHUNK_SIZE, session.filesize - bytes_relayed)
                chunk = session.sender_sock.recv(bytes_to_read)
                if not chunk:
                    raise ConnectionClosedError("Sender disconnected before sending entire file.")

                session.receiver_sock.sendall(chunk)
                bytes_relayed += len(chunk)

            if bytes_relayed >= session.filesize:
                session.is_completed = True
                self.logger.info(f"[FileRelay] Transfer '{transfer_id}' completed successfully: "
                                 f"{bytes_relayed}/{session.filesize} bytes transferred.")
            else:
                self.logger.warning(f"[FileRelay] Transfer '{transfer_id}' interrupted at "
                                    f"{bytes_relayed}/{session.filesize} bytes.")

        except Exception as e:
            self.logger.error(f"[FileRelay] Error streaming transfer '{transfer_id}': {e}")
            session.is_aborted = True
        finally:
            # Clean up sockets
            try:
                if session.sender_sock:
                    session.sender_sock.close()
            except Exception:
                pass
            try:
                if session.receiver_sock:
                    session.receiver_sock.close()
            except Exception:
                pass

            with self.lock:
                self.sessions.pop(transfer_id, None)

    def stop(self) -> None:
        """Stops the file relay server."""
        self._is_running = False
        if self.server_socket:
            try:
                self.server_socket.close()
            except Exception:
                pass
        with self.lock:
            for s in list(self.sessions.values()):
                self.cancel_transfer(s.transfer_id, "Server shutdown")
        self.logger.info("[FileRelay] File relay server stopped.")
