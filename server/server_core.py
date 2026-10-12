"""
Core TCP Chat Server implementation.

Manages network listener, thread-safe client registry, broadcast operations,
private message routing, and orchestrates the secondary File Relay server.
"""

import socket
import threading
import logging
from typing import Dict, List, Optional, Tuple

from server.client_handler import ClientHandler
from server.file_transfer import FileRelayServer
from shared.constants import (
    DEFAULT_HOST,
    DEFAULT_CHAT_PORT,
    DEFAULT_FILE_PORT,
    MSG_USER_LIST,
    MSG_SYSTEM,
)


class ChatServer:
    def __init__(self, host: str = DEFAULT_HOST, chat_port: int = DEFAULT_CHAT_PORT,
                 file_port: int = DEFAULT_FILE_PORT, logger: Optional[logging.Logger] = None):
        self.host = host
        self.chat_port = chat_port
        self.file_port = file_port
        self.logger = logger or logging.getLogger("TCPServer")

        # Central thread-safe client directory: username -> ClientHandler
        self.clients: Dict[str, ClientHandler] = {}
        self.clients_lock = threading.RLock()

        # Network listener
        self.server_socket: Optional[socket.socket] = None
        self.is_running = False

        # Integrated File Relay Server
        self.file_relay = FileRelayServer(self.host, self.file_port, self.logger)

    def start(self) -> None:
        """Binds sockets and starts listener threads."""
        # 1. Start File Relay Server
        self.file_relay.start()

        # 2. Start Chat Server
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind((self.host, self.chat_port))
        self.server_socket.listen(50)
        self.is_running = True

        self.logger.info("=" * 60)
        self.logger.info(f"TCP Chat Server listening on {self.host}:{self.chat_port}")
        self.logger.info(f"TCP File Relay listening on {self.host}:{self.file_port}")
        self.logger.info("Ready to accept incoming client connections...")
        self.logger.info("=" * 60)

        # Accept loop in dedicated thread or main thread
        accept_thread = threading.Thread(
            target=self._accept_loop,
            name="ChatServer-AcceptLoop",
            daemon=True
        )
        accept_thread.start()

    def _accept_loop(self) -> None:
        while self.is_running:
            try:
                client_sock, client_addr = self.server_socket.accept()
                handler = ClientHandler(self, client_sock, client_addr, self.logger)
                handler.start()
            except OSError:
                break
            except Exception as e:
                if self.is_running:
                    self.logger.error(f"Error in chat accept loop: {e}")

    def register_client(self, username: str, handler: ClientHandler) -> Tuple[bool, str]:
        """
        Thread-safely registers a client if the username is unique.
        Broadcasts an updated online user list on success.
        """
        with self.clients_lock:
            # Check for case-insensitive duplicate username
            for existing in self.clients:
                if existing.lower() == username.lower():
                    return False, f"Username '{username}' is already in use by an active client."

            self.clients[username] = handler
        self.logger.info(f"[Registry] User '{username}' connected. Total online: {len(self.clients)}")
        return True, "Registration successful."

    def notify_user_joined(self, username: str) -> None:
        """Broadcasts updated user list and entrance announcement after client ACK is sent."""
        self._broadcast_user_list()
        self.broadcast({
            "type": MSG_SYSTEM,
            "message": f"'{username}' has joined the room.",
            "event": "USER_JOINED",
            "username": username
        }, exclude_user=username)

    def unregister_client(self, username: str) -> None:
        """
        Thread-safely removes a client and notifies remaining participants.
        """
        removed = False
        with self.clients_lock:
            if username in self.clients:
                del self.clients[username]
                removed = True

        if removed:
            self.logger.info(f"[Registry] User '{username}' departed. Total online: {len(self.clients)}")
            self._broadcast_user_list()
            self.broadcast({
                "type": MSG_SYSTEM,
                "message": f"'{username}' has left the room.",
                "event": "USER_LEFT",
                "username": username
            })

    def get_client(self, username: str) -> Optional[ClientHandler]:
        """Finds a client handler by username (case-insensitive search)."""
        with self.clients_lock:
            for name, handler in self.clients.items():
                if name.lower() == username.lower():
                    return handler
        return None

    def get_online_users(self) -> List[str]:
        """Returns sorted list of usernames currently online."""
        with self.clients_lock:
            return sorted(list(self.clients.keys()), key=str.lower)

    def _broadcast_user_list(self) -> None:
        """Broadcasts current online users list to everyone."""
        users = self.get_online_users()
        self.broadcast({
            "type": MSG_USER_LIST,
            "users": users
        })

    def broadcast(self, payload: dict, exclude_user: Optional[str] = None) -> None:
        """
        Sends a payload to all connected clients except optional exclude_user.
        Snapshot pattern is used to prevent holding the lock during I/O.
        """
        with self.clients_lock:
            active_handlers = list(self.clients.items())

        for name, handler in active_handlers:
            if exclude_user and name.lower() == exclude_user.lower():
                continue
            handler.send_payload(payload)

    def send_private(self, sender: str, recipient: str, payload: dict) -> bool:
        """Delivers private message to recipient and confirms to sender."""
        target = self.get_client(recipient)
        sender_client = self.get_client(sender)

        if not target:
            return False

        # Deliver to recipient
        target.send_payload(payload)

        # Echo confirmation back to sender
        if sender_client and sender_client != target:
            sender_client.send_payload(payload)

        return True

    def stop(self) -> None:
        """Shuts down server, closing all sockets and cleaning up threads."""
        if not self.is_running:
            return

        self.logger.info("Initiating server shutdown sequence...")

        # 1. Inform clients while server is still officially active
        self.broadcast({
            "type": MSG_SYSTEM,
            "message": "The server is shutting down. Connection will be terminated.",
            "event": "SERVER_SHUTDOWN"
        })

        # Allow brief flush period for TCP buffers
        import time
        time.sleep(0.1)

        self.is_running = False

        # 2. Close all client connections
        with self.clients_lock:
            handlers = list(self.clients.values())
            self.clients.clear()

        for handler in handlers:
            handler.close()

        # 3. Stop file relay
        self.file_relay.stop()

        # 4. Close chat socket
        if self.server_socket:
            try:
                self.server_socket.close()
            except Exception:
                pass

        self.logger.info("TCP Chat Server cleanly shut down.")
