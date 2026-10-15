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
        from web_app.app import ip_connection_limiter
        ip_connection_limiter.reset("127.0.0.1")

    def test_01_index_route(self):
        """GET / should return backend active JSON status for Render health check."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data.get("status"), "NetChat Backend Active")

        # /app renders the HTML UI
        res_app = self.client.get("/app")
        self.assertEqual(res_app.status_code, 200)
        self.assertIn(b"NetChat Live - Server Based Chatting Platform", res_app.data)
        self.assertNotIn(b"Computer Networks Lab", res_app.data)

    def test_01b_pwa_metadata_and_endpoints(self):
        """PWA manifest, service worker, and icon endpoints should return 200 with valid metadata."""
        # 1. Manifest
        res_manifest = self.client.get("/manifest.json")
        self.assertEqual(res_manifest.status_code, 200)
        manifest_data = json.loads(res_manifest.data)
        self.assertEqual(manifest_data.get("name"), "NetChat Live - Server Based Chatting Platform")
        self.assertEqual(manifest_data.get("short_name"), "NetChat Live")
        self.assertEqual(manifest_data.get("display"), "standalone")
        self.assertEqual(manifest_data.get("theme_color"), "#09090b")
        self.assertEqual(manifest_data.get("background_color"), "#09090b")

        # 2. Service Worker
        res_sw = self.client.get("/sw.js")
        self.assertEqual(res_sw.status_code, 200)
        self.assertIn(b"self.skipWaiting()", res_sw.data)
        self.assertIn(b"clients.claim()", res_sw.data)
        self.assertIn(b"fetch(event.request)", res_sw.data)
        self.assertEqual(res_sw.headers.get("Service-Worker-Allowed"), "/")

        # 3. Icons
        res_icon192 = self.client.get("/icons/icon-192.png")
        self.assertEqual(res_icon192.status_code, 200)
        self.assertTrue(res_icon192.data.startswith(b"\x89PNG"))

        res_icon512 = self.client.get("/icons/icon-512.png")
        self.assertEqual(res_icon512.status_code, 200)
        self.assertTrue(res_icon512.data.startswith(b"\x89PNG"))

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

    def test_06_room_peers_scoped_isolation(self):
        """Test that peer lists and updates are strictly isolated per room."""
        from web_app.app import socketio, room_members, socket_to_room

        c1 = socketio.test_client(self.app)
        c2 = socketio.test_client(self.app)
        c3 = socketio.test_client(self.app)
        c4 = socketio.test_client(self.app)

        # Clear initial connect messages
        for c in (c1, c2, c3, c4):
            c.get_received()

        # madhu and madhav join 'room1'
        c1.emit("join_room", {"room_id": "room1", "username": "madhu"})
        c2.emit("join_room", {"room_id": "room1", "username": "madhav"})

        # tanu1 and tanu2 join 'room2'
        c3.emit("join_room", {"room_id": "room2", "username": "tanu1"})
        c4.emit("join_room", {"room_id": "room2", "username": "tanu2"})

        rec_c1 = c1.get_received()
        rec_c2 = c2.get_received()
        rec_c3 = c3.get_received()
        rec_c4 = c4.get_received()

        # Check room_peers_update events
        peers_c1_updates = [m["args"][0] for m in rec_c1 if m["name"] == "room_peers_update"]
        peers_c2_updates = [m["args"][0] for m in rec_c2 if m["name"] == "room_peers_update"]
        peers_c3_updates = [m["args"][0] for m in rec_c3 if m["name"] == "room_peers_update"]
        peers_c4_updates = [m["args"][0] for m in rec_c4 if m["name"] == "room_peers_update"]

        # Latest peers for c1 and c2 must only be madhu and madhav
        latest_c1_peers = sorted(peers_c1_updates[-1]["peers"])
        latest_c2_peers = sorted(peers_c2_updates[-1]["peers"])
        self.assertEqual(latest_c1_peers, ["madhav", "madhu"])
        self.assertEqual(latest_c2_peers, ["madhav", "madhu"])
        self.assertEqual(peers_c1_updates[-1]["room_id"], "room1")

        # Latest peers for c3 and c4 must only be tanu1 and tanu2
        latest_c3_peers = sorted(peers_c3_updates[-1]["peers"])
        latest_c4_peers = sorted(peers_c4_updates[-1]["peers"])
        self.assertEqual(latest_c3_peers, ["tanu1", "tanu2"])
        self.assertEqual(latest_c4_peers, ["tanu1", "tanu2"])
        self.assertEqual(peers_c3_updates[-1]["room_id"], "room2")

        # None of c1's updates should contain tanu1 or tanu2
        for upd in peers_c1_updates:
            self.assertNotIn("tanu1", upd["peers"])
            self.assertNotIn("tanu2", upd["peers"])

        # None of c3's updates should contain madhu or madhav
        for upd in peers_c3_updates:
            self.assertNotIn("madhu", upd["peers"])
            self.assertNotIn("madhav", upd["peers"])

        # Disconnect madhav (c2) from room1
        c2.disconnect()

        # c1 should receive room_peers_update showing only madhu
        rec_c1_after = c1.get_received()
        disconnect_upd = [m["args"][0] for m in rec_c1_after if m["name"] == "room_peers_update"]
        self.assertTrue(len(disconnect_upd) >= 1)
        self.assertEqual(disconnect_upd[-1]["peers"], ["madhu"])

        # c3 and c4 in room2 should NOT have received any updates about c2 leaving
        rec_c3_after = c3.get_received()
        rec_c4_after = c4.get_received()
        self.assertEqual(len([m for m in rec_c3_after if m["name"] == "room_peers_update"]), 0)
        self.assertEqual(len([m for m in rec_c4_after if m["name"] == "room_peers_update"]), 0)

        # Disconnect remaining
        c1.disconnect()
        self.assertNotIn("room1", room_members)
        self.assertIn("room2", room_members)

        c3.disconnect()
        c4.disconnect()
        self.assertNotIn("room2", room_members)

    def test_07_typing_indicators_per_room(self):
        """Test user_typing and user_stop_typing events are scoped strictly to the room."""
        from web_app.app import socketio

        c1 = socketio.test_client(self.app)
        c2 = socketio.test_client(self.app)
        c3 = socketio.test_client(self.app)

        c1.emit("join_room", {"room_id": "typing_vault", "username": "Alice"})
        c2.emit("join_room", {"room_id": "typing_vault", "username": "Bob"})
        c3.emit("join_room", {"room_id": "other_vault", "username": "Charlie"})

        # Clear join messages
        c1.get_received()
        c2.get_received()
        c3.get_received()

        # Alice starts typing in 'typing_vault'
        c1.emit("user_typing", {"room_id": "typing_vault", "username": "Alice"})

        rec_c1 = c1.get_received()
        rec_c2 = c2.get_received()
        rec_c3 = c3.get_received()

        # Sender should NOT receive own typing event
        typing_c1 = [m for m in rec_c1 if m["name"] == "user_typing"]
        self.assertEqual(len(typing_c1), 0)

        # Peer in same room receives user_typing
        typing_c2 = [m for m in rec_c2 if m["name"] == "user_typing"]
        self.assertEqual(len(typing_c2), 1)
        self.assertEqual(typing_c2[0]["args"][0]["username"], "Alice")
        self.assertEqual(typing_c2[0]["args"][0]["room_id"], "typing_vault")

        # Peer in different room should NOT receive it
        typing_c3 = [m for m in rec_c3 if m["name"] == "user_typing"]
        self.assertEqual(len(typing_c3), 0)

        # Alice stops typing
        c1.emit("user_stop_typing", {"room_id": "typing_vault", "username": "Alice"})

        rec_c2_stop = c2.get_received()
        rec_c3_stop = c3.get_received()

        stop_c2 = [m for m in rec_c2_stop if m["name"] == "user_stop_typing"]
        self.assertEqual(len(stop_c2), 1)
        self.assertEqual(stop_c2[0]["args"][0]["username"], "Alice")

        stop_c3 = [m for m in rec_c3_stop if m["name"] == "user_stop_typing"]
        self.assertEqual(len(stop_c3), 0)

        c1.disconnect()
        c2.disconnect()
        c3.disconnect()

    def test_08_typing_and_stop_typing_events(self):
        """Test SocketIO typing and stop_typing event routing (room-scoped, omitting sender)."""
        from web_app.app import socketio
        c1 = socketio.test_client(self.app)
        c2 = socketio.test_client(self.app)
        c3 = socketio.test_client(self.app)

        c1.emit("join_room", {"room_id": "typing_room", "username": "Alice"})
        c2.emit("join_room", {"room_id": "typing_room", "username": "Bob"})
        c3.emit("join_room", {"room_id": "other_room", "username": "Charlie"})

        c1.get_received()
        c2.get_received()
        c3.get_received()

        # Alice starts typing via 'typing' event
        c1.emit("typing", {"room_id": "typing_room", "username": "Alice"})

        rec_c1 = c1.get_received()
        rec_c2 = c2.get_received()
        rec_c3 = c3.get_received()

        # Alice should NOT receive own typing event
        self.assertEqual(len([m for m in rec_c1 if m["name"] == "typing"]), 0)

        # Bob in same room receives typing event
        typing_c2 = [m for m in rec_c2 if m["name"] == "typing"]
        self.assertEqual(len(typing_c2), 1)
        self.assertEqual(typing_c2[0]["args"][0]["username"], "Alice")
        self.assertEqual(typing_c2[0]["args"][0]["room_id"], "typing_room")

        # Charlie in other room should NOT receive it
        self.assertEqual(len([m for m in rec_c3 if m["name"] == "typing"]), 0)

        # Alice stops typing via 'stop_typing' event
        c1.emit("stop_typing", {"room_id": "typing_room", "username": "Alice"})

        rec_c2_stop = c2.get_received()
        stop_c2 = [m for m in rec_c2_stop if m["name"] == "stop_typing"]
        self.assertEqual(len(stop_c2), 1)
        self.assertEqual(stop_c2[0]["args"][0]["username"], "Alice")

        c1.disconnect()
        c2.disconnect()
        c3.disconnect()

    def test_09_message_reply_passthrough(self):
        """Test that send_message cleanly relays id and reply_to dictionary without alteration."""
        from web_app.app import socketio
        c1 = socketio.test_client(self.app)
        c2 = socketio.test_client(self.app)

        c1.emit("join_room", {"room_id": "reply_room", "username": "Alice"})
        c2.emit("join_room", {"room_id": "reply_room", "username": "Bob"})

        c1.get_received()
        c2.get_received()

        reply_meta = {
            "id": "orig-msg-12345",
            "sender": "Bob",
            "snippet": "Hello Alice, how are you?"
        }

        c1.emit("send_message", {
            "id": "reply-msg-67890",
            "room_id": "reply_room",
            "username": "Alice",
            "payload": "CIPHERTEXT_BLOB_BASE64",
            "reply_to": reply_meta
        })

        rec_c2 = c2.get_received()
        msg_c2 = [m for m in rec_c2 if m["name"] == "receive_message" and m["args"][0].get("type") == "encrypted"]

        self.assertEqual(len(msg_c2), 1)
        delivered = msg_c2[0]["args"][0]
        self.assertEqual(delivered["id"], "reply-msg-67890")
        self.assertEqual(delivered["sender"], "Alice")
        self.assertEqual(delivered["reply_to"], reply_meta)
        self.assertEqual(delivered["payload"], "CIPHERTEXT_BLOB_BASE64")

        c1.disconnect()
        c2.disconnect()

    def test_10_create_room_and_join_room_workflows(self):
        """Test create_room and join_room separate validated workflows and SocketIO callbacks."""
        from web_app.app import socketio, room_records, room_members

        c1 = socketio.test_client(self.app)
        c2 = socketio.test_client(self.app)
        c3 = socketio.test_client(self.app)

        # 1. c1 creates room "secret_vault" with pin "pin-1234"
        res1 = c1.emit("create_room", {
            "room_id": "secret_vault",
            "pin": "pin-1234",
            "username": "Alice"
        }, callback=True)
        self.assertEqual(res1.get("status"), "success")
        self.assertEqual(res1.get("room_id"), "secret_vault")

        # 2. c2 attempts to create the same room -> must fail with "Room already exists"
        res2 = c2.emit("create_room", {
            "room_id": "secret_vault",
            "pin": "pin-9999",
            "username": "Bob"
        }, callback=True)
        self.assertEqual(res2.get("status"), "error")
        self.assertEqual(res2.get("message"), "Room already exists")

        # 3. c2 attempts to join non-existent room with a pin -> must fail with "Room not found"
        res_nonexistent = c2.emit("join_room", {
            "room_id": "non_existent_room",
            "pin": "pin-5555",
            "username": "Bob"
        }, callback=True)
        self.assertEqual(res_nonexistent.get("status"), "error")
        self.assertEqual(res_nonexistent.get("message"), "Room not found")

        # 4. c2 attempts to join "secret_vault" with invalid PIN -> must fail with "Invalid PIN"
        res_bad_pin = c2.emit("join_room", {
            "room_id": "secret_vault",
            "pin": "wrong-pin",
            "username": "Bob"
        }, callback=True)
        self.assertEqual(res_bad_pin.get("status"), "error")
        self.assertEqual(res_bad_pin.get("message"), "Invalid PIN")

        # 5. c2 joins "secret_vault" with correct PIN -> success
        res_join_ok = c2.emit("join_room", {
            "room_id": "secret_vault",
            "pin": "pin-1234",
            "username": "Bob"
        }, callback=True)
        self.assertEqual(res_join_ok.get("status"), "success")
        self.assertEqual(res_join_ok.get("room_id"), "secret_vault")

        # 6. Verify ephemeral zero-retention cleanup on disconnect
        self.assertIn("secret_vault", room_records)
        c1.disconnect()
        c2.disconnect()
        c3.disconnect()

        self.assertNotIn("secret_vault", room_members)
        self.assertNotIn("secret_vault", room_records)

    def test_12_backend_peer_tracking_update_peers(self):
        """Test backend peer tracking in room_users and update_peers event emissions."""
        from web_app.app import socketio, room_users

        c1 = socketio.test_client(self.app)
        c2 = socketio.test_client(self.app)
        c1.get_received()
        c2.get_received()

        # 1. c1 creates room "peer_room"
        res1 = c1.emit("create_room", {
            "room_id": "peer_room",
            "pin": "pin-9876",
            "username": "Alice"
        }, callback=True)
        self.assertEqual(res1.get("status"), "success")

        # Verify room_users contains Alice with socket_id and username
        self.assertIn("peer_room", room_users)
        self.assertEqual(len(room_users["peer_room"]), 1)
        self.assertEqual(room_users["peer_room"][0]["username"], "Alice")
        self.assertTrue(bool(room_users["peer_room"][0]["socket_id"]))

        # Check c1 received update_peers
        rec_c1 = c1.get_received()
        upd_events = [m for m in rec_c1 if m["name"] == "update_peers"]
        self.assertTrue(len(upd_events) >= 1)
        self.assertEqual(len(upd_events[-1]["args"][0]), 1)
        self.assertEqual(upd_events[-1]["args"][0][0]["username"], "Alice")

        # 2. c2 joins "peer_room"
        res2 = c2.emit("join_room", {
            "room_id": "peer_room",
            "pin": "pin-9876",
            "username": "Bob"
        }, callback=True)
        self.assertEqual(res2.get("status"), "success")

        self.assertEqual(len(room_users["peer_room"]), 2)
        user_names = [u["username"] for u in room_users["peer_room"]]
        self.assertIn("Alice", user_names)
        self.assertIn("Bob", user_names)

        # Check c1 and c2 both received update_peers with 2 users
        rec_c1_2 = c1.get_received()
        rec_c2_2 = c2.get_received()
        c1_upd = [m for m in rec_c1_2 if m["name"] == "update_peers"]
        c2_upd = [m for m in rec_c2_2 if m["name"] == "update_peers"]
        self.assertTrue(len(c1_upd) >= 1)
        self.assertTrue(len(c2_upd) >= 1)
        self.assertEqual(len(c1_upd[-1]["args"][0]), 2)
        self.assertEqual(len(c2_upd[-1]["args"][0]), 2)

        # 3. c2 disconnects
        c2.disconnect()
        rec_c1_3 = c1.get_received()
        c1_upd_after_dc = [m for m in rec_c1_3 if m["name"] == "update_peers"]
        self.assertTrue(len(c1_upd_after_dc) >= 1)
        self.assertEqual(len(c1_upd_after_dc[-1]["args"][0]), 1)
        self.assertEqual(c1_upd_after_dc[-1]["args"][0][0]["username"], "Alice")
        self.assertEqual(len(room_users["peer_room"]), 1)

        # 4. c1 disconnects -> room_users purged
        c1.disconnect()
        self.assertNotIn("peer_room", room_users)

    def test_room_scoped_username_uniqueness(self):
        """Test that usernames must be unique per room (case-insensitive) and emit join_error on conflict."""
        from web_app.app import socketio
        c1 = socketio.test_client(self.app)
        c2 = socketio.test_client(self.app)
        c3 = socketio.test_client(self.app)
        c1.get_received()
        c2.get_received()
        c3.get_received()

        # Alice creates room "unique_vault"
        res1 = c1.emit("create_room", {
            "room_id": "unique_vault",
            "pin": "pass123",
            "username": "Alice"
        }, callback=True)
        self.assertEqual(res1.get("status"), "success")

        # c2 tries to join "unique_vault" as "alice" (case-insensitive duplicate)
        res2 = c2.emit("join_room", {
            "room_id": "unique_vault",
            "pin": "pass123",
            "username": "alice"
        }, callback=True)
        self.assertEqual(res2.get("status"), "error")
        self.assertIn("Username is already taken in this room", res2.get("message", ""))

        # Verify join_error event was received by c2
        rec_c2 = c2.get_received()
        join_errs = [m for m in rec_c2 if m["name"] == "join_error"]
        self.assertTrue(len(join_errs) >= 1)
        self.assertIn("Username is already taken in this room", join_errs[0]["args"][0]["message"])

        # c2 tries to join as "  ALICE  " (whitespace + case-insensitive)
        res2_ws = c2.emit("join_room", {
            "room_id": "unique_vault",
            "pin": "pass123",
            "username": "  ALICE  "
        }, callback=True)
        self.assertEqual(res2_ws.get("status"), "error")

        # c2 joins as "Bob" -> succeeds
        res2_bob = c2.emit("join_room", {
            "room_id": "unique_vault",
            "pin": "pass123",
            "username": "Bob"
        }, callback=True)
        self.assertEqual(res2_bob.get("status"), "success")

        # c3 creates/joins a different room "other_vault" as "Alice" -> succeeds (room-scoped)
        res3 = c3.emit("create_room", {
            "room_id": "other_vault",
            "pin": "pass456",
            "username": "Alice"
        }, callback=True)
        self.assertEqual(res3.get("status"), "success")

        c1.disconnect()
        c2.disconnect()
        c3.disconnect()


if __name__ == "__main__":
    unittest.main()

