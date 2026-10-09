"""
Unit tests for protocol framing, serialization, and stream reconstruction.
"""

import socket
import threading
import unittest
from shared.protocol import (
    send_msg,
    recv_msg,
    ProtocolError,
    ConnectionClosedError,
    validate_username,
    sanitize_filename,
)


class TestProtocolFraming(unittest.TestCase):
    def test_single_message_loopback(self):
        """Test sending and receiving a standard dictionary payload over loopback sockets."""
        server_sock, client_sock = socket.socketpair()
        try:
            test_payload = {"type": "CHAT", "sender": "Alice", "content": "Hello World!", "room": "all"}
            send_msg(client_sock, test_payload)
            received = recv_msg(server_sock)
            self.assertEqual(received, test_payload)
        finally:
            server_sock.close()
            client_sock.close()

    def test_multiple_messages_coalesced(self):
        """
        Verify that multiple messages sent back-to-back are correctly
        demuxed/separated by recv_msg based on the 4-byte header length.
        """
        server_sock, client_sock = socket.socketpair()
        try:
            msg1 = {"type": "CHAT", "content": "First"}
            msg2 = {"type": "CHAT", "content": "Second"}
            msg3 = {"type": "CHAT", "content": "Third"}

            # Send all three consecutively
            send_msg(client_sock, msg1)
            send_msg(client_sock, msg2)
            send_msg(client_sock, msg3)

            # Receive one by one
            rec1 = recv_msg(server_sock)
            rec2 = recv_msg(server_sock)
            rec3 = recv_msg(server_sock)

            self.assertEqual(rec1, msg1)
            self.assertEqual(rec2, msg2)
            self.assertEqual(rec3, msg3)
        finally:
            server_sock.close()
            client_sock.close()

    def test_unicode_and_special_characters(self):
        """Ensure emojis, non-ASCII characters, and formatting pass through UTF-8 cleanly."""
        server_sock, client_sock = socket.socketpair()
        try:
            payload = {"type": "CHAT", "content": "Networks: TCP/IP 🌐 ✨ — नमस्ते | こんにちは | Bonjour"}
            send_msg(client_sock, payload)
            rec = recv_msg(server_sock)
            self.assertEqual(rec, payload)
        finally:
            server_sock.close()
            client_sock.close()

    def test_graceful_close(self):
        """Closing client socket should return None on recv_msg."""
        server_sock, client_sock = socket.socketpair()
        try:
            client_sock.close()
            rec = recv_msg(server_sock)
            self.assertIsNone(rec)
        finally:
            server_sock.close()


class TestValidation(unittest.TestCase):
    def test_valid_usernames(self):
        valid_cases = ["Alice", "bob_123", "user-net", "student.5"]
        for u in valid_cases:
            is_valid, msg = validate_username(u)
            self.assertTrue(is_valid, f"Expected {u} to be valid, got {msg}")

    def test_invalid_usernames(self):
        invalid_cases = [
            ("", "too short"),
            ("a", "too short"),
            ("A" * 25, "too long"),
            ("alice space", "contains spaces"),
            ("admin", "reserved name"),
            ("Server", "reserved name"),
            ("system", "reserved name"),
            ("user@domain", "special character @"),
            ("user#1", "special character #"),
        ]
        for u, reason in invalid_cases:
            is_valid, msg = validate_username(u)
            self.assertFalse(is_valid, f"Expected {u} to be invalid ({reason})")

    def test_filename_sanitization(self):
        test_cases = [
            ("../../etc/passwd", "passwd"),
            (r"..\..\Windows\System32\cmd.exe", "cmd.exe"),
            ("presentation:final?.pdf", "presentationfinal.pdf"),
            ("clean_doc.txt", "clean_doc.txt"),
            ("", "received_file"),
        ]
        for raw, expected in test_cases:
            cleaned = sanitize_filename(raw)
            self.assertEqual(cleaned, expected)


if __name__ == "__main__":
    unittest.main()
