"""
Web-to-TCP Protocol Gateway.

Bridges browser clients (connected via WebSockets / Flask-SocketIO)
to the backend TCP Server (connected via raw Layer 4 TCP Sockets with 4-byte length framing).

For each browser session (identified by SocketIO 'sid'), this gateway maintains
an authentic, dedicated TCP socket connected to the central ChatServer.
"""

import socket
import threading
import time
import logging
from typing import Dict, Optional, Callable, Any, Tuple

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

logger = logging.getLogger("WebGateway")


class TCPClientSession:
    """
    Manages a single browser user's dedicated TCP socket connection to the central ChatServer.
    """
    def __init__(self, sid: str, username: str, host: str, port: int, emit_callback: Callable[[str, dict], None]):
        self.sid = sid
        self.username = username
        self.host = host
        self.port = port
        self.emit_callback = emit_callback

        self.socket: Optional[socket.socket] = None
        self.write_lock = threading.Lock()
        self.is_connected = False
        self.file_port = DEFAULT_FILE_PORT
        self.recv_thread: Optional[threading.Thread] = None

        # Network statistics
        self.connected_at = time.time()
        self.messages_sent = 0
        self.messages_received = 0

    def connect(self) -> Tuple[bool, str]:
        """Performs raw TCP socket connection and CONNECT handshake with the ChatServer."""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(SOCKET_TIMEOUT)
            sock.connect((self.host, self.port))

            # Send framed CONNECT handshake
            send_msg(sock, {"type": MSG_CONNECT, "username": self.username})

            # Await framed CONNECT_ACK
            ack = recv_msg(sock)
            if not ack:
                sock.close()
                return False, "Server closed connection during handshake."

            if ack.get("type") == MSG_ERROR:
                err_msg = ack.get("message", "Registration rejected by server.")
                sock.close()
                return False, err_msg

            if ack.get("type") != MSG_CONNECT_ACK:
                sock.close()
                return False, f"Unexpected handshake response: {ack.get('type')}"

            # Successfully authenticated
            sock.settimeout(None)
            self.socket = sock
            self.is_connected = True
            self.file_port = ack.get("file_port", DEFAULT_FILE_PORT)

            # Spawn background listener thread for incoming TCP messages
            self.recv_thread = threading.Thread(
                target=self._receive_loop,
                name=f"GatewayTCP-{self.username}",
                daemon=True
            )
            self.recv_thread.start()

            return True, ack.get("message", "Connected successfully.")

        except ConnectionRefusedError:
            return False, f"TCP Connection refused. Chat Server is not running at {self.host}:{self.port}."
        except socket.timeout:
            return False, f"TCP Connection to {self.host}:{self.port} timed out."
        except Exception as e:
            return False, f"TCP Socket Error: {e}"

    def _receive_loop(self) -> None:
        """Continuously reads framed TCP messages from the server and forwards them to the browser."""
        while self.is_connected and self.socket:
            try:
                msg = recv_msg(self.socket)
            except ConnectionClosedError:
                break
            except ProtocolError as pe:
                self.emit_callback("network_error", {"message": f"Protocol error: {pe}"})
                continue
            except OSError:
                break

            if msg is None:
                break

            self.messages_received += 1
            msg_type = msg.get("type", "UNKNOWN")

            # Translate framed TCP packet into WebSocket event for the browser
            if msg_type == MSG_CHAT:
                self.emit_callback("chat_message", msg)
            elif msg_type == MSG_PRIVATE_CHAT:
                self.emit_callback("private_message", msg)
            elif msg_type == MSG_USER_LIST:
                self.emit_callback("user_list", msg)
            elif msg_type == MSG_SYSTEM:
                self.emit_callback("system_message", msg)
            elif msg_type == MSG_ERROR:
                self.emit_callback("server_error", msg)
            elif msg_type == MSG_FILE_OFFER:
                self.emit_callback("file_offer", msg)
            elif msg_type == MSG_FILE_READY:
                self.emit_callback("file_ready", msg)
            elif msg_type == MSG_FILE_REJECT:
                self.emit_callback("file_reject", msg)
            elif msg_type == MSG_FILE_CANCEL:
                self.emit_callback("file_cancel", msg)

        if self.is_connected:
            self.is_connected = False
            self.emit_callback("server_disconnected", {
                "message": "Connection to the underlying TCP Chat Server was terminated."
            })

        self.close()

    def send_chat(self, content: str) -> bool:
        """Forwards chat message to TCP server."""
        self.messages_sent += 1
        return self._send_payload({"type": MSG_CHAT, "content": content})

    def send_private(self, recipient: str, content: str) -> bool:
        """Forwards private message to TCP server."""
        self.messages_sent += 1
        return self._send_payload({
            "type": MSG_PRIVATE_CHAT,
            "recipient": recipient,
            "content": content
        })

    def send_file_offer(self, transfer_id: str, recipient: str, filename: str, filesize: int, sha256: str) -> bool:
        """Forwards file offer to TCP server."""
        self.messages_sent += 1
        return self._send_payload({
            "type": MSG_FILE_OFFER,
            "transfer_id": transfer_id,
            "recipient": recipient,
            "filename": filename,
            "filesize": filesize,
            "sha256": sha256
        })

    def send_file_accept(self, transfer_id: str, sender: str, filename: str, filesize: int, sha256: str) -> bool:
        """Forwards file accept to TCP server."""
        self.messages_sent += 1
        return self._send_payload({
            "type": MSG_FILE_ACCEPT,
            "transfer_id": transfer_id,
            "sender": sender,
            "filename": filename,
            "filesize": filesize,
            "sha256": sha256
        })

    def send_file_reject(self, transfer_id: str, sender: str, filename: str) -> bool:
        """Forwards file reject to TCP server."""
        self.messages_sent += 1
        return self._send_payload({
            "type": MSG_FILE_REJECT,
            "transfer_id": transfer_id,
            "sender": sender,
            "filename": filename
        })

    def _send_payload(self, payload: dict) -> bool:
        if not self.is_connected or not self.socket:
            return False
        try:
            send_msg(self.socket, payload, lock=self.write_lock)
            return True
        except Exception as e:
            logger.warning(f"Error sending payload to TCP server for {self.username}: {e}")
            return False

    def close(self) -> None:
        """Closes TCP socket cleanly."""
        self.is_connected = False
        if self.socket:
            try:
                self._send_payload({"type": MSG_DISCONNECT})
            except Exception:
                pass
            try:
                self.socket.shutdown(socket.SHUT_RDWR)
            except Exception:
                pass
            try:
                self.socket.close()
            except Exception:
                pass
            self.socket = None


class GatewayManager:
    """Maintains active TCPClientSession instances mapped by browser session ID (sid)."""
    def __init__(self):
        self.sessions: Dict[str, TCPClientSession] = {}
        self.lock = threading.Lock()

    def create_session(self, sid: str, username: str, host: str, port: int,
                       emit_callback: Callable[[str, dict], None]) -> Tuple[bool, str, Optional[TCPClientSession]]:
        with self.lock:
            # Check if this sid already has an active session
            if sid in self.sessions:
                self.sessions[sid].close()
                del self.sessions[sid]

            session = TCPClientSession(sid, username, host, port, emit_callback)
            success, msg = session.connect()
            if success:
                self.sessions[sid] = session
                return True, msg, session
            else:
                return False, msg, None

    def get_session(self, sid: str) -> Optional[TCPClientSession]:
        with self.lock:
            return self.sessions.get(sid)

    def remove_session(self, sid: str) -> None:
        with self.lock:
            session = self.sessions.pop(sid, None)
            if session:
                session.close()

    def get_stats(self) -> dict:
        with self.lock:
            active_count = len(self.sessions)
            users = [s.username for s in self.sessions.values()]
        return {
            "active_gateway_sessions": active_count,
            "web_users": users
        }
