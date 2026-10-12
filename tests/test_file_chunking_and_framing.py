"""
Unit and integration tests for:
1. WebSocket Gateway payload size (>= 105 MB) and 64 KB chunk streaming (handle_file_chunk)
2. Incremental SHA-256 calculation compliance and verification
3. TCP socket length-prefixed (!I) binary framing compliance
4. File input element ID compatibility
"""

import hashlib
import os
import struct
import socket
import tempfile
import unittest

from web_app.app import app, socketio, file_registry, active_chunk_transfers
from shared.constants import MAX_WS_PAYLOAD, MSG_FILE_CHUNK, HEADER_SIZE
from shared.protocol import send_frame, recv_frame, recv_exact, compute_file_sha256


class TestFileChunkingAndFraming(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_01_websocket_max_payload_configured(self):
        """Ensure WebSocket server explicitly accommodates at least 105 MB payload limit."""
        self.assertGreaterEqual(MAX_WS_PAYLOAD, 105 * 1024 * 1024)
        # Verify socketio engineio server max_http_buffer_size
        server_max_buf = socketio.server.eio.max_http_buffer_size
        self.assertIsNotNone(server_max_buf)
        self.assertGreaterEqual(server_max_buf, 105 * 1024 * 1024)

    def test_02_websocket_file_chunk_streaming_assembly(self):
        """Test streaming a file in 64 KB chunks over socketio, verifying backpressure ACK and SHA-256."""
        socketio_client = socketio.test_client(self.app)
        self.assertTrue(socketio_client.is_connected())

        transfer_id = "test_chunk_transfer_001"
        filename = "chunked_test.bin"
        # 160 KB total data (three 64 KB chunks: 64 KB, 64 KB, 32 KB)
        test_data = os.urandom(160 * 1024)
        expected_sha = hashlib.sha256(test_data).hexdigest()

        chunk_size = 64 * 1024
        total_chunks = 3

        for i in range(total_chunks):
            start = i * chunk_size
            end = min(start + chunk_size, len(test_data))
            chunk_bytes = test_data[start:end]

            # Emit chunk with callback
            received_ack = socketio_client.emit("file_chunk", {
                "type": "file_chunk",
                "transfer_id": transfer_id,
                "chunk_index": i,
                "total_chunks": total_chunks,
                "filename": filename,
                "filesize": len(test_data),
                "sha256": expected_sha,
                "data": chunk_bytes
            }, callback=True)

            self.assertIsNotNone(received_ack)
            self.assertEqual(received_ack.get("status"), "ok")
            self.assertEqual(received_ack.get("chunk_index"), i)
            if i == total_chunks - 1:
                self.assertTrue(received_ack.get("is_complete"))

        # Verify assembly in file_registry
        self.assertIn(transfer_id, file_registry)
        record = file_registry[transfer_id]
        self.assertEqual(record["filesize"], len(test_data))
        self.assertEqual(record["sha256"], expected_sha)
        self.assertTrue(os.path.exists(record["filepath"]))

        # Verify content on disk
        with open(record["filepath"], "rb") as f:
            written_bytes = f.read()
        self.assertEqual(written_bytes, test_data)

        socketio_client.disconnect()

    def test_03_tcp_framing_send_recv_exact_4byte_header(self):
        """Test send_frame and recv_frame adhere to '!I' 4-byte header and prevent boundary issues."""
        server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_sock.bind(("127.0.0.1", 0))
        server_sock.listen(1)
        port = server_sock.getsockname()[1]

        client_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client_sock.connect(("127.0.0.1", port))
        conn, _ = server_sock.accept()

        try:
            sample_payload = b"TCP_FRAMING_CHUNK_PAYLOAD_TEST_DATA" * 100
            send_frame(client_sock, sample_payload)

            # 1. Receiver reads full 4-byte length header
            header = recv_exact(conn, HEADER_SIZE)
            self.assertEqual(len(header), 4)
            length = struct.unpack("!I", header)[0]
            self.assertEqual(length, len(sample_payload))

            # 2. Receiver loops until complete chunk buffer is received
            received_data = recv_exact(conn, length)
            self.assertEqual(received_data, sample_payload)

            # 3. Test recv_frame wrapper
            send_frame(client_sock, b"SECOND_FRAME_DATA")
            second_recv = recv_frame(conn)
            self.assertEqual(second_recv, b"SECOND_FRAME_DATA")
        finally:
            client_sock.close()
            conn.close()
            server_sock.close()

    def test_04_html_file_input_element_attributes(self):
        """Verify the file input element in index.html has id='file-upload' and class='hidden'."""
        with open("web_app/templates/index.html", "r", encoding="utf-8") as f:
            html = f.read()

        self.assertIn('id="file-upload"', html)
        self.assertIn('class="hidden"', html)


if __name__ == "__main__":
    unittest.main()
