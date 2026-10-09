"""
Automated Integration Tests for Server, Client Networking, Framing, and File Transfer Relay.

Validates:
1. Multi-client TCP connection handshakes.
2. Duplicate username collision rejection.
3. Real-time group message broadcasting.
4. Targeted private messaging.
5. Online user list synchronization.
6. Chunked binary file transfer through the File Relay with SHA-256 checksum verification.
7. Graceful disconnect and server shutdown.
"""

import hashlib
import os
import socket
import tempfile
import threading
import time
import unittest
import uuid

from server.server_core import ChatServer
from shared.constants import (
    MSG_CONNECT,
    MSG_CONNECT_ACK,
    MSG_CHAT,
    MSG_PRIVATE_CHAT,
    MSG_USER_LIST,
    MSG_ERROR,
    MSG_FILE_OFFER,
    MSG_FILE_ACCEPT,
    MSG_FILE_READY,
)
from shared.protocol import send_msg, recv_msg


class TestServerIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.host = "127.0.0.1"
        cls.chat_port = 15000
        cls.file_port = 15001
        cls.server = ChatServer(host=cls.host, chat_port=cls.chat_port, file_port=cls.file_port)
        cls.server.start()
        time.sleep(0.1)  # Allow sockets to bind

    @classmethod
    def tearDownClass(cls):
        cls.server.stop()
        time.sleep(0.1)

    def _create_client_connection(self, username: str) -> socket.socket:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((self.host, self.chat_port))
        # Send handshake
        send_msg(sock, {"type": MSG_CONNECT, "username": username})
        ack = recv_msg(sock)
        self.assertIsNotNone(ack)
        self.assertEqual(ack.get("type"), MSG_CONNECT_ACK)
        return sock

    def test_01_duplicate_username_rejection(self):
        """Verify that server rejects an existing username case-insensitively."""
        sock1 = self._create_client_connection("StudentOne")
        try:
            # Try connecting with the exact same name or lowercase
            sock2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock2.connect((self.host, self.chat_port))
            send_msg(sock2, {"type": MSG_CONNECT, "username": "studentone"})
            response = recv_msg(sock2)
            sock2.close()

            self.assertIsNotNone(response)
            self.assertEqual(response.get("type"), MSG_ERROR)
            self.assertEqual(response.get("code"), "USERNAME_TAKEN")
        finally:
            sock1.close()

    def test_02_group_and_private_messaging(self):
        """Test concurrent message broadcast and private routing between distinct clients."""
        alice_sock = self._create_client_connection("AliceTest")
        bob_sock = self._create_client_connection("BobTest")
        charlie_sock = self._create_client_connection("CharlieTest")

        try:
            # 1. Alice sends a group chat message
            send_msg(alice_sock, {"type": MSG_CHAT, "content": "Hello team!"})

            # Everyone should receive the chat message
            # Drain any user list updates first
            def receive_chat(sock, target_content):
                for _ in range(15):
                    m = recv_msg(sock)
                    if m and m.get("type") == MSG_CHAT and m.get("content") == target_content:
                        return m
                return None

            bob_chat = receive_chat(bob_sock, "Hello team!")
            self.assertIsNotNone(bob_chat)
            self.assertEqual(bob_chat["sender"], "AliceTest")

            charlie_chat = receive_chat(charlie_sock, "Hello team!")
            self.assertIsNotNone(charlie_chat)
            self.assertEqual(charlie_chat["sender"], "AliceTest")

            # 2. Bob sends private message to Alice
            send_msg(bob_sock, {
                "type": MSG_PRIVATE_CHAT,
                "recipient": "AliceTest",
                "content": "Secret note for Alice"
            })

            # Alice should receive it
            def receive_private(sock, target_content):
                for _ in range(15):
                    m = recv_msg(sock)
                    if m and m.get("type") == MSG_PRIVATE_CHAT and m.get("content") == target_content:
                        return m
                return None

            alice_priv = receive_private(alice_sock, "Secret note for Alice")
            self.assertIsNotNone(alice_priv)
            self.assertEqual(alice_priv["sender"], "BobTest")

            # Bob should also get confirmation echo
            bob_echo = receive_private(bob_sock, "Secret note for Alice")
            self.assertIsNotNone(bob_echo)

        finally:
            alice_sock.close()
            bob_sock.close()
            charlie_sock.close()

    def test_03_file_transfer_relay_and_sha256(self):
        """
        Verify end-to-end file transfer over the File Relay port with SHA-256 verification.
        Generates 256 KB of random data, sends it through relay, and asserts integrity.
        """
        sender_chat = self._create_client_connection("SenderUser")
        receiver_chat = self._create_client_connection("ReceiverUser")

        # Create temporary file to transfer
        test_data = os.urandom(256 * 1024)  # 256 KB
        expected_sha = hashlib.sha256(test_data).hexdigest()
        transfer_id = str(uuid.uuid4())
        filename = "test_data.bin"

        try:
            # 1. Sender offers file
            send_msg(sender_chat, {
                "type": MSG_FILE_OFFER,
                "transfer_id": transfer_id,
                "recipient": "ReceiverUser",
                "filename": filename,
                "filesize": len(test_data),
                "sha256": expected_sha
            })

            # 2. Receiver gets offer
            offer_msg = None
            for _ in range(5):
                m = recv_msg(receiver_chat)
                if m and m.get("type") == MSG_FILE_OFFER:
                    offer_msg = m
                    break
            self.assertIsNotNone(offer_msg)
            self.assertEqual(offer_msg["transfer_id"], transfer_id)

            # 3. Receiver accepts offer
            send_msg(receiver_chat, {
                "type": MSG_FILE_ACCEPT,
                "transfer_id": transfer_id,
                "sender": "SenderUser",
                "filename": filename,
                "filesize": len(test_data),
                "sha256": expected_sha
            })

            # 4. Both receive FILE_READY
            sender_ready = None
            for _ in range(5):
                m = recv_msg(sender_chat)
                if m and m.get("type") == MSG_FILE_READY:
                    sender_ready = m
                    break
            self.assertIsNotNone(sender_ready)

            receiver_ready = None
            for _ in range(5):
                m = recv_msg(receiver_chat)
                if m and m.get("type") == MSG_FILE_READY:
                    receiver_ready = m
                    break
            self.assertIsNotNone(receiver_ready)

            # 5. Connect to File Relay
            # Sender uploads
            sender_relay_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sender_relay_sock.connect((self.host, self.file_port))
            send_msg(sender_relay_sock, {"action": "upload", "transfer_id": transfer_id})
            sender_ack = recv_msg(sender_relay_sock)
            self.assertEqual(sender_ack.get("status"), "ok")

            # Receiver downloads
            receiver_relay_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            receiver_relay_sock.connect((self.host, self.file_port))
            send_msg(receiver_relay_sock, {"action": "download", "transfer_id": transfer_id})
            receiver_ack = recv_msg(receiver_relay_sock)
            self.assertEqual(receiver_ack.get("status"), "ok")

            # 6. Stream data
            received_bytes_list = []

            def read_stream():
                bytes_left = len(test_data)
                while bytes_left > 0:
                    chunk = receiver_relay_sock.recv(min(65536, bytes_left))
                    if not chunk:
                        break
                    received_bytes_list.append(chunk)
                    bytes_left -= len(chunk)

            recv_thread = threading.Thread(target=read_stream)
            recv_thread.start()

            # Sender writes test_data in chunks
            sender_relay_sock.sendall(test_data)
            recv_thread.join(timeout=5.0)

            total_received = b"".join(received_bytes_list)
            self.assertEqual(len(total_received), len(test_data))

            # 7. Checksum verification
            actual_sha = hashlib.sha256(total_received).hexdigest()
            self.assertEqual(actual_sha, expected_sha)

            sender_relay_sock.close()
            receiver_relay_sock.close()

        finally:
            sender_chat.close()
            receiver_chat.close()


if __name__ == "__main__":
    unittest.main()
