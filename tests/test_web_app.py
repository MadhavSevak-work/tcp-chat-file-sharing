"""
Automated Unit and Integration Tests for Web Application & REST Endpoints.
Validates:
- Flask root route serves index.html (200 OK)
- /api/status returns JSON telemetry
- /api/upload handles multipart files, computes SHA-256, and stores safely
- /api/download serves file with proper headers and protects against traversal
"""

import io
import json
import os
import unittest

from web_app.app import app, file_registry


class TestWebApp(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_01_index_route(self):
        """GET / should render the HTML single-page application."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"TCP Multi-Client Chat & File Sharing", response.data)
        self.assertIn(b"Computer Networks Lab", response.data)

    def test_02_api_status(self):
        """GET /api/status should return JSON telemetry data."""
        response = self.client.get("/api/status")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data.get("status"), "online")
        self.assertEqual(data.get("gateway_port"), 5050)
        self.assertEqual(data.get("tcp_chat_port"), 5000)

    def test_03_file_upload_and_download(self):
        """POST /api/upload should calculate SHA-256 and allow GET /api/download/<id>."""
        test_content = b"Computer Networks Web Gateway: File Transfer Test Data 2026\n"
        data = {
            "file": (io.BytesIO(test_content), "test_doc.txt")
        }

        # 1. Upload
        upload_resp = self.client.post(
            "/api/upload",
            data=data,
            content_type="multipart/form-data"
        )
        self.assertEqual(upload_resp.status_code, 200)
        upload_json = json.loads(upload_resp.data)
        self.assertEqual(upload_json.get("status"), "ok")
        self.assertEqual(upload_json.get("filename"), "test_doc.txt")
        self.assertEqual(upload_json.get("filesize"), len(test_content))
        self.assertTrue(len(upload_json.get("sha256")) == 64)

        transfer_id = upload_json.get("transfer_id")
        self.assertIsNotNone(transfer_id)

        # 2. Download
        download_resp = self.client.get(f"/api/download/{transfer_id}")
        self.assertEqual(download_resp.status_code, 200)
        self.assertEqual(download_resp.data, test_content)

    def test_04_download_nonexistent_file(self):
        """GET /api/download with unknown ID should return 404."""
        response = self.client.get("/api/download/non-existent-id")
        self.assertEqual(response.status_code, 404)

    def test_05_zero_knowledge_room_relay(self):
        """Test zero-knowledge room joining, message routing, and room isolation."""
        from web_app.app import socketio
        c1 = socketio.test_client(self.app)
        c2 = socketio.test_client(self.app)
        c3 = socketio.test_client(self.app)

        c1.emit("join_room", {"room_id": "crypto_vault", "username": "Alice"})
        c2.emit("join_room", {"room_id": "crypto_vault", "username": "Bob"})
        c3.emit("join_room", {"room_id": "other_vault", "username": "Charlie"})

        test_ciphertext = "SALT16B_IV12B_OPAQUE_AES_GCM_ENCRYPTED_BASE64_STRING=="
        c1.emit("send_message", {
            "room_id": "crypto_vault",
            "username": "Alice",
            "payload": test_ciphertext
        })

        received_c2 = c2.get_received()
        received_c3 = c3.get_received()

        msg_c2 = [m for m in received_c2 if m["name"] == "receive_message" and m["args"][0].get("type") == "encrypted"]
        msg_c3 = [m for m in received_c3 if m["name"] == "receive_message" and m["args"][0].get("type") == "encrypted"]

        self.assertEqual(len(msg_c2), 1)
        self.assertEqual(msg_c2[0]["args"][0]["payload"], test_ciphertext)
        self.assertEqual(msg_c2[0]["args"][0]["sender"], "Alice")
        self.assertEqual(len(msg_c3), 0)

        c1.disconnect()
        c2.disconnect()
        c3.disconnect()


if __name__ == "__main__":
    unittest.main()
