"""
Unit tests for WebRTC Signaling Router in Flask-SocketIO backend.
Verifies zero-retention relay for offers, answers, candidates, and multi-peer room calling events.
"""

import unittest
from web_app.app import app, socketio


class TestWebRTCSignalingRouter(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config["TESTING"] = True

    def setUp(self):
        self.client1 = socketio.test_client(app)
        self.client2 = socketio.test_client(app)
        self.assertTrue(self.client1.is_connected())
        self.assertTrue(self.client2.is_connected())

        # Peer 1 creates room
        res1 = self.client1.emit("create_room", {
            "room_id": "rtc-test-room",
            "pin": "9999",
            "username": "Peer1"
        }, callback=True)
        self.assertEqual(res1.get("status"), "success")
        self.p1_sid = res1["users"][0]["socket_id"]

        # Peer 2 joins room
        res2 = self.client2.emit("join_room", {
            "room_id": "rtc-test-room",
            "pin": "9999",
            "username": "Peer2"
        }, callback=True)
        self.assertEqual(res2.get("status"), "success")
        p2_user = [u for u in res2["users"] if u["username"] == "Peer2"][0]
        self.p2_sid = p2_user["socket_id"]

        # Drain initial join events
        self.client1.get_received()
        self.client2.get_received()

    def tearDown(self):
        if self.client1.is_connected():
            self.client1.disconnect()
        if self.client2.is_connected():
            self.client2.disconnect()

    def test_webrtc_offer_and_answer_routing(self):
        # Peer 1 sends offer targeted to Peer 2
        dummy_sdp = {"type": "offer", "sdp": "v=0\r\no=dummy 123 1 IN IP4 127.0.0.1"}
        self.client1.emit("webrtc_offer", {
            "target_sid": self.p2_sid,
            "room_id": "rtc-test-room",
            "offer": dummy_sdp,
            "type": "audio"
        })

        # Peer 2 receives offer
        received_p2 = self.client2.get_received()
        offer_events = [e for e in received_p2 if e["name"] == "webrtc_offer"]
        self.assertEqual(len(offer_events), 1)
        self.assertEqual(offer_events[0]["args"][0]["sender_sid"], self.p1_sid)
        self.assertEqual(offer_events[0]["args"][0]["offer"], dummy_sdp)
        self.assertEqual(offer_events[0]["args"][0]["type"], "audio")

        # Peer 2 replies with answer targeted to Peer 1
        dummy_answer = {"type": "answer", "sdp": "v=0\r\no=dummy 456 1 IN IP4 127.0.0.1"}
        self.client2.emit("webrtc_answer", {
            "target_sid": self.p1_sid,
            "room_id": "rtc-test-room",
            "answer": dummy_answer,
            "type": "audio"
        })

        # Peer 1 receives answer
        received_p1 = self.client1.get_received()
        answer_events = [e for e in received_p1 if e["name"] == "webrtc_answer"]
        self.assertEqual(len(answer_events), 1)
        self.assertEqual(answer_events[0]["args"][0]["sender_sid"], self.p2_sid)
        self.assertEqual(answer_events[0]["args"][0]["answer"], dummy_answer)

    def test_webrtc_ice_candidate_relay(self):
        candidate = {"candidate": "candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host", "sdpMid": "0"}
        self.client1.emit("webrtc_ice_candidate", {
            "target_sid": self.p2_sid,
            "room_id": "rtc-test-room",
            "candidate": candidate
        })

        received_p2 = self.client2.get_received()
        cand_events = [e for e in received_p2 if e["name"] == "webrtc_ice_candidate"]
        self.assertEqual(len(cand_events), 1)
        self.assertEqual(cand_events[0]["args"][0]["sender_sid"], self.p1_sid)
        self.assertEqual(cand_events[0]["args"][0]["candidate"], candidate)

    def test_multi_peer_call_lifecycle_events(self):
        # Peer 1 broadcasts call_started
        self.client1.emit("call_started", {
            "room_id": "rtc-test-room",
            "call_type": "audio"
        })

        recv2 = self.client2.get_received()
        start_events = [e for e in recv2 if e["name"] == "call_started"]
        self.assertEqual(len(start_events), 1)
        self.assertEqual(start_events[0]["args"][0]["call_type"], "audio")
        self.assertEqual(start_events[0]["args"][0]["sender_sid"], self.p1_sid)

        # Peer 2 joins call
        self.client2.emit("call_user_joined", {
            "room_id": "rtc-test-room",
            "call_type": "audio"
        })

        recv1 = self.client1.get_received()
        join_events = [e for e in recv1 if e["name"] == "call_user_joined"]
        self.assertEqual(len(join_events), 1)
        self.assertEqual(join_events[0]["args"][0]["sender_sid"], self.p2_sid)

        # Peer 2 leaves call
        self.client2.emit("call_user_left", {
            "room_id": "rtc-test-room"
        })

        recv1 = self.client1.get_received()
        left_events = [e for e in recv1 if e["name"] == "call_user_left"]
        self.assertEqual(len(left_events), 1)
        self.assertEqual(left_events[0]["args"][0]["sender_sid"], self.p2_sid)

    def test_file_handshake_routing(self):
        # Peer 1 sends file-offer to Peer 2
        offer_data = {
            "type": "file-offer",
            "fileName": "sample_project.zip",
            "fileSize": 1048576,
            "fileId": "test-file-123",
            "senderNickname": "Peer1",
            "senderId": self.p1_sid,
            "targetSid": self.p2_sid,
            "roomId": "rtc-test-room"
        }
        self.client1.emit("file-offer", offer_data)

        recv2 = self.client2.get_received()
        offer_events = [e for e in recv2 if e["name"] == "file-offer"]
        self.assertEqual(len(offer_events), 1)
        self.assertEqual(offer_events[0]["args"][0]["fileId"], "test-file-123")
        self.assertEqual(offer_events[0]["args"][0]["fileName"], "sample_project.zip")

        # Peer 2 accepts file offer
        accept_data = {
            "type": "file-accept",
            "fileId": "test-file-123",
            "senderId": self.p1_sid,
            "targetSid": self.p1_sid,
            "roomId": "rtc-test-room"
        }
        self.client2.emit("file-accept", accept_data)

        recv1 = self.client1.get_received()
        accept_events = [e for e in recv1 if e["name"] == "file-accept"]
        self.assertEqual(len(accept_events), 1)
        self.assertEqual(accept_events[0]["args"][0]["fileId"], "test-file-123")

        # Peer 2 declines another file offer
        decline_data = {
            "type": "file-decline",
            "fileId": "test-file-456",
            "senderId": self.p1_sid,
            "targetSid": self.p1_sid,
            "roomId": "rtc-test-room"
        }
        self.client2.emit("file-decline", decline_data)

        recv1 = self.client1.get_received()
        decline_events = [e for e in recv1 if e["name"] == "file-decline"]
        self.assertEqual(len(decline_events), 1)
        self.assertEqual(decline_events[0]["args"][0]["fileId"], "test-file-456")


if __name__ == "__main__":
    unittest.main()
