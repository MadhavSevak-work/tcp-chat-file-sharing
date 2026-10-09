"""
Client Network Manager.

Runs TCP network operations in background worker threads to keep the Tkinter GUI
fluid and 100% responsive. Incoming events and messages are queued into a thread-safe
queue.Queue, which the GUI consumes via Tkinter's root.after() event loop.
"""

import queue
import socket
import threading
from typing import Optional, Dict, Any, Tuple

from shared.constants import (
    DEFAULT_HOST,
    DEFAULT_CHAT_PORT,
    DEFAULT_FILE_PORT,
    MSG_CONNECT,
    MSG_CONNECT_ACK,
    MSG_DISCONNECT,
    MSG_CHAT,
    MSG_PRIVATE_CHAT,
    MSG_USER_LIST,
    MSG_SYSTEM,
    MSG_ERROR,
    MSG_FILE_OFFER,
    MSG_FILE_ACCEPT,
    MSG_FILE_REJECT,
    MSG_FILE_READY,
    MSG_FILE_CANCEL,
    SOCKET_TIMEOUT,
)
from shared.protocol import (
    send_msg,
    recv_msg,
    ConnectionClosedError,
    ProtocolError,
)


class NetworkEvent:
    def __init__(self, event_type: str, data: Optional[Dict[str, Any]] = None, message: str = ""):
        self.type = event_type
        self.data = data or {}
        self.message = message


class NetworkManager:
    def __init__(self, event_queue: queue.Queue):
        self.event_queue = event_queue
        self.socket: Optional[socket.socket] = None
        self.write_lock = threading.Lock()
        self.is_connected = False
        self.username: str = ""
        self.server_host: str = DEFAULT_HOST
        self.server_port: int = DEFAULT_CHAT_PORT
        self.file_port: int = DEFAULT_FILE_PORT
        self.recv_thread: Optional[threading.Thread] = None

    def connect(self, host: str, port: int, username: str) -> Tuple[bool, str]:
        """
        Initiates a TCP connection to the chat server and conducts the handshake.
        Runs synchronously on the calling thread (or background thread from GUI).
        """
        if self.is_connected:
            return False, "Already connected."

        self.server_host = host
        self.server_port = port
        self.username = username

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(SOCKET_TIMEOUT)
            sock.connect((host, port))

            # Send CONNECT handshake
            send_msg(sock, {"type": MSG_CONNECT, "username": username})

            # Await CONNECT_ACK
            ack = recv_msg(sock)
            if not ack:
                sock.close()
                return False, "Server closed connection during handshake."

            if ack.get("type") == MSG_ERROR:
                err_msg = ack.get("message", "Registration failed.")
                sock.close()
                return False, err_msg

            if ack.get("type") != MSG_CONNECT_ACK:
                sock.close()
                return False, f"Unexpected response during handshake: {ack.get('type')}"

            # Successfully authenticated
            sock.settimeout(None)  # Remove timeout for long-lived listener
            self.socket = sock
            self.is_connected = True
            self.file_port = ack.get("file_port", DEFAULT_FILE_PORT)

            # Post successful connection event
            self.event_queue.put(NetworkEvent(
                "CONNECTED",
                {"username": username, "file_port": self.file_port},
                ack.get("message", "Connected successfully.")
            ))

            # Launch background listener thread
            self.recv_thread = threading.Thread(
                target=self._receive_loop,
                name="Client-RecvLoop",
                daemon=True
            )
            self.recv_thread.start()

            return True, "Connected successfully."

        except ConnectionRefusedError:
            return False, f"Connection refused. Please check if server is running at {host}:{port}."
        except socket.timeout:
            return False, f"Connection to {host}:{port} timed out."
        except OSError as e:
            return False, f"Network error: {e}"
        except Exception as e:
            return False, f"Unexpected connection error: {e}"

    def _receive_loop(self) -> None:
        """Background thread continually receiving framed messages from the server."""
        while self.is_connected and self.socket:
            try:
                msg = recv_msg(self.socket)
            except ConnectionClosedError:
                break
            except ProtocolError as pe:
                self.event_queue.put(NetworkEvent("PROTOCOL_ERROR", message=str(pe)))
                continue
            except OSError:
                break

            if msg is None:
                break

            # Forward message to GUI event queue
            msg_type = msg.get("type", "UNKNOWN")
            self.event_queue.put(NetworkEvent(msg_type, msg))

        # Handle disconnection
        if self.is_connected:
            self.is_connected = False
            self.event_queue.put(NetworkEvent("DISCONNECTED", message="Lost connection to server."))

        self._cleanup()

    def send_chat(self, content: str) -> bool:
        """Sends a public room chat message."""
        return self._send_payload({
            "type": MSG_CHAT,
            "content": content
        })

    def send_private(self, recipient: str, content: str) -> bool:
        """Sends a targeted private chat message."""
        return self._send_payload({
            "type": MSG_PRIVATE_CHAT,
            "recipient": recipient,
            "content": content
        })

    def send_file_offer(self, transfer_id: str, recipient: str, filename: str, filesize: int, sha256: str) -> bool:
        """Initiates a file transfer proposal."""
        return self._send_payload({
            "type": MSG_FILE_OFFER,
            "transfer_id": transfer_id,
            "recipient": recipient,
            "filename": filename,
            "filesize": filesize,
            "sha256": sha256
        })

    def send_file_accept(self, transfer_id: str, sender: str, filename: str, filesize: int, sha256: str) -> bool:
        """Accepts an incoming file offer."""
        return self._send_payload({
            "type": MSG_FILE_ACCEPT,
            "transfer_id": transfer_id,
            "sender": sender,
            "filename": filename,
            "filesize": filesize,
            "sha256": sha256
        })

    def send_file_reject(self, transfer_id: str, sender: str, filename: str) -> bool:
        """Rejects an incoming file offer."""
        return self._send_payload({
            "type": MSG_FILE_REJECT,
            "transfer_id": transfer_id,
            "sender": sender,
            "filename": filename
        })

    def send_file_cancel(self, transfer_id: str, other_user: str) -> bool:
        """Cancels an in-progress transfer."""
        return self._send_payload({
            "type": MSG_FILE_CANCEL,
            "transfer_id": transfer_id,
            "other_user": other_user
        })

    def disconnect(self) -> None:
        """Gracefully disconnects from the server."""
        if not self.is_connected:
            return

        try:
            self._send_payload({"type": MSG_DISCONNECT})
        except Exception:
            pass

        self.is_connected = False
        self._cleanup()
        self.event_queue.put(NetworkEvent("DISCONNECTED", message="Disconnected by user."))

    def _send_payload(self, payload: dict) -> bool:
        if not self.is_connected or not self.socket:
            return False
        try:
            send_msg(self.socket, payload, lock=self.write_lock)
            return True
        except Exception:
            return False

    def _cleanup(self) -> None:
        if self.socket:
            try:
                self.socket.shutdown(socket.SHUT_RDWR)
            except Exception:
                pass
            try:
                self.socket.close()
            except Exception:
                pass
            self.socket = None
