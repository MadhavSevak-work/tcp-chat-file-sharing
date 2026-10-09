"""
Reliability and Resilience Automated Tests.
Validates:
- Malformed packets do not crash server.
- Abrupt disconnect does not corrupt server client list.
- Clean server shutdown notifies all clients.
"""

import socket
import struct
import time
import unittest

from server.server_core import ChatServer
from shared.constants import (
    MSG_CONNECT,
    MSG_CONNECT_ACK,
    MSG_ERROR,
    MSG_SYSTEM,
    MSG_USER_LIST,
)
from shared.protocol import send_msg, recv_msg


class TestServerReliability(unittest.TestCase):
    def setUp(self):
        self.host = "127.0.0.1"
        self.chat_port = 16000
        self.file_port = 16001
        self.server = ChatServer(host=self.host, chat_port=self.chat_port, file_port=self.file_port)
        self.server.start()
        time.sleep(0.1)

    def tearDown(self):
        self.server.stop()
        time.sleep(0.1)

    def test_malformed_json_resilience(self):
        """Send bad JSON raw bytes; verify server sends error and does NOT crash."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((self.host, self.chat_port))
        try:
            # First authenticate normally
            send_msg(sock, {"type": MSG_CONNECT, "username": "ResilienceUser"})
            ack = recv_msg(sock)
            self.assertEqual(ack.get("type"), MSG_CONNECT_ACK)

            # Drain initial user list message
            m1 = recv_msg(sock)
            if m1 and m1.get("type") == MSG_USER_LIST:
                pass

            # Send raw malformed payload: 4-byte length prefix + bad json text
            bad_data = b"NOT_VALID_JSON{:::}"
            header = struct.pack("!I", len(bad_data))
            sock.sendall(header + bad_data)

            # Server should catch ProtocolError and reply with MSG_ERROR, remaining active
            err_resp = None
            for _ in range(5):
                m = recv_msg(sock)
                if m and m.get("type") == MSG_ERROR:
                    err_resp = m
                    break

            self.assertIsNotNone(err_resp)
            self.assertTrue(self.server.is_running)

        finally:
            sock.close()

    def test_abrupt_disconnect_handling(self):
        """Simulate hard client reset (RST); server should cleanly unregister without crashing."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((self.host, self.chat_port))
        send_msg(sock, {"type": MSG_CONNECT, "username": "AbruptUser"})
        ack = recv_msg(sock)
        self.assertEqual(ack.get("type"), MSG_CONNECT_ACK)

        self.assertIn("AbruptUser", self.server.get_online_users())

        # Force hard close with SO_LINGER (sets RST packet)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack("ii", 1, 0))
        sock.close()

        # Give server time to detect closed socket
        time.sleep(0.2)
        self.assertNotIn("AbruptUser", self.server.get_online_users())
        self.assertTrue(self.server.is_running)

    def test_graceful_server_shutdown_notification(self):
        """When server stops, clients should receive SERVER_SHUTDOWN message."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((self.host, self.chat_port))
        try:
            send_msg(sock, {"type": MSG_CONNECT, "username": "ListenUser"})
            ack = recv_msg(sock)
            self.assertEqual(ack.get("type"), MSG_CONNECT_ACK)

            # Stop the server
            self.server.stop()

            # Client should receive shutdown broadcast or connection closure
            shutdown_event = None
            for _ in range(10):
                msg = recv_msg(sock)
                if msg is None:
                    break
                if msg.get("type") == MSG_SYSTEM and msg.get("event") == "SERVER_SHUTDOWN":
                    shutdown_event = msg
                    break

            self.assertIsNotNone(shutdown_event)
        finally:
            sock.close()


if __name__ == "__main__":
    unittest.main()
