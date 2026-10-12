"""
ClientHandler module.

Runs in a dedicated thread for each connected TCP client.
Receives, validates, and routes messages according to the application protocol.
Ensures thread-safe writes to the client's socket and handles disconnections gracefully.
"""

import socket
import threading
import time
import logging
from typing import Optional, TYPE_CHECKING

from shared.constants import (
    MSG_CONNECT,
    MSG_CONNECT_ACK,
    MSG_DISCONNECT,
    MSG_CHAT,
    MSG_PRIVATE_CHAT,
    MSG_SYSTEM,
    MSG_ERROR,
    MSG_FILE_OFFER,
    MSG_FILE_ACCEPT,
    MSG_FILE_REJECT,
    MSG_FILE_READY,
    MSG_FILE_CANCEL,
    MSG_FILE_CHUNK,
    MAX_FILE_SIZE,
)
from shared.protocol import (
    send_msg,
    recv_msg,
    validate_username,
    sanitize_filename,
    ConnectionClosedError,
    ProtocolError,
)

if TYPE_CHECKING:
    from server.server_core import ChatServer


class ClientHandler(threading.Thread):
    def __init__(self, server: "ChatServer", client_sock: socket.socket, client_addr: tuple, logger: logging.Logger):
        super().__init__(daemon=True)
        self.server = server
        self.socket = client_sock
        self.address = client_addr
        self.logger = logger
        self.username: Optional[str] = None
        self.write_lock = threading.Lock()
        self.is_running = True
        self.connected_at = time.time()
        self.name = f"Handler-{client_addr[0]}:{client_addr[1]}"

    def send_payload(self, payload: dict) -> bool:
        """
        Thread-safely send a framed JSON payload to this client.
        Returns True on success, False if connection is broken.
        """
        try:
            send_msg(self.socket, payload, lock=self.write_lock)
            return True
        except (ConnectionClosedError, OSError) as e:
            if self.is_running and self.server.is_running:
                self.logger.warning(f"Failed to send message to {self.username or self.address}: {e}")
            return False

    def run(self) -> None:
        self.logger.info(f"Incoming connection from {self.address}")
        try:
            # 1. Connection Handshake
            if not self._handle_handshake():
                return

            # 2. Continuous Message Loop
            while self.is_running and self.server.is_running:
                try:
                    message = recv_msg(self.socket)
                except ConnectionClosedError:
                    self.logger.info(f"Client {self.username} closed the connection.")
                    break
                except ProtocolError as pe:
                    self.logger.warning(f"Protocol error from {self.username}: {pe}")
                    self.send_payload({"type": MSG_ERROR, "message": str(pe)})
                    continue

                if message is None:
                    # EOF encountered
                    break

                self._process_message(message)

        except Exception as e:
            self.logger.error(f"Unexpected error handling client {self.username or self.address}: {e}")
        finally:
            self._cleanup()

    def _handle_handshake(self) -> bool:
        """Authenticates and registers client username."""
        try:
            init_msg = recv_msg(self.socket)
        except Exception as e:
            self.logger.warning(f"Error during handshake from {self.address}: {e}")
            self.close()
            return False

        if not init_msg:
            self.close()
            return False

        if init_msg.get("type") != MSG_CONNECT:
            self.send_payload({"type": MSG_ERROR, "message": "Expected CONNECT message."})
            self.close()
            return False

        raw_username = init_msg.get("username", "")
        valid, val_result = validate_username(raw_username)
        if not valid:
            self.send_payload({
                "type": MSG_ERROR,
                "code": "INVALID_USERNAME",
                "message": val_result
            })
            self.close()
            return False

        username = val_result
        # Attempt to register on the central server
        registered, reg_msg = self.server.register_client(username, self)
        if not registered:
            self.send_payload({
                "type": MSG_ERROR,
                "code": "USERNAME_TAKEN",
                "message": reg_msg
            })
            self.close()
            return False

        self.username = username
        self.name = f"Handler-{username}"

        # Send ACK with file relay port and current users
        self.send_payload({
            "type": MSG_CONNECT_ACK,
            "username": self.username,
            "file_port": self.server.file_port,
            "message": f"Welcome to the server, {self.username}!"
        })

        # Now notify the room and broadcast current user list
        self.server.notify_user_joined(self.username)

        self.logger.info(f"User '{self.username}' successfully registered from {self.address}.")
        return True

    def _process_message(self, msg: dict) -> None:
        """Dispatches incoming message based on its 'type' attribute."""
        msg_type = msg.get("type")
        timestamp = time.strftime("%H:%M:%S")

        # Rate limit incoming messages to max 5 per second
        if msg_type in (MSG_CHAT, MSG_PRIVATE_CHAT):
            now = time.time()
            if not hasattr(self, "message_times"):
                self.message_times = []
            self.message_times = [t for t in self.message_times if now - t < 1.0]
            if len(self.message_times) >= 5:
                self.send_payload({
                    "type": MSG_ERROR,
                    "message": "Rate limit exceeded. Please wait."
                })
                return
            self.message_times.append(now)

        if msg_type == MSG_CHAT:
            content = msg.get("content", "").strip()
            if not content:
                return
            # Broadcast to all users
            self.server.broadcast({
                "type": MSG_CHAT,
                "sender": self.username,
                "content": content,
                "timestamp": timestamp,
            })

        elif msg_type == MSG_PRIVATE_CHAT:
            recipient = msg.get("recipient", "").strip()
            content = msg.get("content", "").strip()
            if not content or not recipient:
                return

            if recipient == self.username:
                self.send_payload({
                    "type": MSG_ERROR,
                    "message": "Cannot send private message to yourself."
                })
                return

            success = self.server.send_private(self.username, recipient, {
                "type": MSG_PRIVATE_CHAT,
                "sender": self.username,
                "recipient": recipient,
                "content": content,
                "timestamp": timestamp,
            })
            if not success:
                self.send_payload({
                    "type": MSG_ERROR,
                    "message": f"User '{recipient}' is not online."
                })

        elif msg_type == MSG_DISCONNECT:
            self.logger.info(f"User '{self.username}' sent DISCONNECT.")
            self.is_running = False

        elif msg_type == MSG_FILE_OFFER:
            self._handle_file_offer(msg)

        elif msg_type == MSG_FILE_ACCEPT:
            self._handle_file_accept(msg)

        elif msg_type == MSG_FILE_REJECT:
            self._handle_file_reject(msg)

        elif msg_type == MSG_FILE_CANCEL:
            self._handle_file_cancel(msg)

        elif msg_type in (MSG_FILE_CHUNK, "file_chunk"):
            self._handle_file_chunk(msg)

        else:
            self.logger.warning(f"Unrecognized message type '{msg_type}' from {self.username}")
            self.send_payload({
                "type": MSG_ERROR,
                "message": f"Unrecognized message type: '{msg_type}'"
            })

    def _handle_file_chunk(self, msg: dict) -> None:
        """Forwards framed file chunk to the specified recipient or fans out to all active peers."""
        recipient = msg.get("recipient", "").strip()
        target = msg.get("target", "").strip()
        is_broadcast = (
            recipient == "__BROADCAST__"
            or recipient.lower() in ("__broadcast__", "all")
            or target.lower() == "all"
            or bool(msg.get("is_broadcast"))
        )

        if is_broadcast:
            # Relay chunk frame directly to all active peer connections (excluding sender)
            self.server.broadcast(msg, exclude_user=self.username)
            return

        if not recipient:
            return
        target_client = self.server.get_client(recipient)
        if target_client:
            target_client.send_payload(msg)


    def _handle_file_offer(self, msg: dict) -> None:
        recipient = msg.get("recipient", "").strip()
        target = msg.get("target", "").strip()
        filename = sanitize_filename(msg.get("filename", ""))
        filesize = msg.get("filesize", msg.get("size", 0))
        sha256 = msg.get("sha256", "")
        transfer_id = msg.get("transfer_id", "")
        is_broadcast = (
            recipient == "__BROADCAST__"
            or recipient.lower() in ("__broadcast__", "all")
            or target.lower() == "all"
            or bool(msg.get("is_broadcast"))
        )

        if not filename or not transfer_id or filesize <= 0 or (not recipient and not is_broadcast):
            self.send_payload({"type": MSG_ERROR, "message": "Invalid file offer parameters."})
            return

        if filesize > MAX_FILE_SIZE:
            self.send_payload({
                "type": MSG_ERROR,
                "message": f"File exceeds maximum allowed size ({MAX_FILE_SIZE // (1024*1024)} MB)."
            })
            return

        if not is_broadcast and recipient.lower() == self.username.lower():
            self.send_payload({"type": MSG_ERROR, "message": "Cannot send file to yourself."})
            return

        if is_broadcast:
            # Fan-out offer to all active peer connections in the room (excluding sender)
            offer_payload = {
                "type": MSG_FILE_OFFER,
                "sender": self.username,
                "is_broadcast": True,
                "filename": filename,
                "size": filesize,
                "filesize": filesize,
                "sha256": sha256,
                "transfer_id": transfer_id,
                "timestamp": time.strftime("%H:%M:%S")
            }
            self.server.broadcast(offer_payload, exclude_user=self.username)
            return

        target_client = self.server.get_client(recipient)
        if not target_client:
            self.send_payload({"type": MSG_ERROR, "message": f"Recipient '{recipient}' is not online."})
            return

        # Forward file offer to recipient
        target_client.send_payload({
            "type": MSG_FILE_OFFER,
            "transfer_id": transfer_id,
            "sender": self.username,
            "filename": filename,
            "filesize": filesize,
            "size": filesize,
            "sha256": sha256,
            "timestamp": time.strftime("%H:%M:%S")
        })

    def _handle_file_accept(self, msg: dict) -> None:
        transfer_id = msg.get("transfer_id")
        sender_username = msg.get("sender")
        filename = msg.get("filename")
        filesize = msg.get("filesize")
        sha256 = msg.get("sha256")

        sender_client = self.server.get_client(sender_username)
        if not sender_client:
            self.send_payload({"type": MSG_ERROR, "message": f"Sender '{sender_username}' is no longer online."})
            return

        # Register session in File Relay server
        self.server.file_relay.register_transfer(
            transfer_id=transfer_id,
            sender=sender_username,
            recipient=self.username,
            filename=filename,
            filesize=filesize,
            sha256=sha256
        )

        # Notify both sender and recipient that transfer is ready
        ready_payload = {
            "type": MSG_FILE_READY,
            "transfer_id": transfer_id,
            "file_port": self.server.file_port,
            "filename": filename,
            "filesize": filesize,
            "sha256": sha256,
            "sender": sender_username,
            "recipient": self.username,
        }
        sender_client.send_payload(ready_payload)
        self.send_payload(ready_payload)

    def _handle_file_reject(self, msg: dict) -> None:
        transfer_id = msg.get("transfer_id")
        sender_username = msg.get("sender")
        sender_client = self.server.get_client(sender_username)
        if sender_client:
            sender_client.send_payload({
                "type": MSG_FILE_REJECT,
                "transfer_id": transfer_id,
                "recipient": self.username,
                "filename": msg.get("filename", "")
            })

    def _handle_file_cancel(self, msg: dict) -> None:
        transfer_id = msg.get("transfer_id")
        other_user = msg.get("other_user")
        if transfer_id:
            self.server.file_relay.cancel_transfer(transfer_id, f"Cancelled by {self.username}")
        if other_user:
            target = self.server.get_client(other_user)
            if target:
                target.send_payload({
                    "type": MSG_FILE_CANCEL,
                    "transfer_id": transfer_id,
                    "by": self.username
                })

    def close(self) -> None:
        """Closes the client connection."""
        self.is_running = False
        try:
            self.socket.shutdown(socket.SHUT_RDWR)
        except Exception:
            pass
        try:
            self.socket.close()
        except Exception:
            pass

    def _cleanup(self) -> None:
        """Ensures client is unregistered from server registry."""
        self.close()
        if self.username:
            self.server.unregister_client(self.username)
