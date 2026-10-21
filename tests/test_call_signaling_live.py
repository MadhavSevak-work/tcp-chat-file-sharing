import unittest
import socketio
import time

SERVER_URL = "http://127.0.0.1:5050"

class TestCallSignalingLive(unittest.TestCase):
    def test_call_user_handshake(self):
        sio_a = socketio.Client()
        sio_b = socketio.Client()

        received_incoming_call = []
        received_call_accepted = []
        received_end_call = []

        @sio_b.on("incoming-call")
        def on_incoming_call(data):
            received_incoming_call.append(data)

        @sio_a.on("call-accepted")
        def on_call_accepted(data):
            received_call_accepted.append(data)

        @sio_b.on("end-call")
        def on_end_call(data):
            received_end_call.append(data)

        try:
            sio_a.connect(SERVER_URL)
            sio_b.connect(SERVER_URL)
            time.sleep(0.5)

            room_id = f"test-call-room-{int(time.time())}"
            sio_a.emit("join-room", {"roomId": room_id, "nickname": "CallerAlice"})
            time.sleep(0.5)
            sio_b.emit("join-room", {"roomId": room_id, "nickname": "ReceiverBob"})
            time.sleep(0.5)

            # 1. CallerAlice calls the room
            sio_a.emit("call-user", {
                "roomId": room_id,
                "callType": "video",
                "callerName": "CallerAlice",
                "callerId": sio_a.sid,
                "offer": {"type": "offer", "sdp": "fake-sdp-offer"}
            })
            time.sleep(1.0)

            self.assertTrue(len(received_incoming_call) >= 1, "ReceiverBob did not receive incoming-call")
            call_data = received_incoming_call[0]
            self.assertEqual(call_data.get("callerName"), "CallerAlice")
            self.assertEqual(call_data.get("callType"), "video")
            caller_sid = call_data.get("callerId")
            self.assertTrue(bool(caller_sid))

            # 2. ReceiverBob accepts call
            sio_b.emit("call-accepted", {
                "to": caller_sid,
                "callerId": caller_sid,
                "answer": {"type": "answer", "sdp": "fake-sdp-answer"},
                "receiverName": "ReceiverBob"
            })
            time.sleep(1.0)

            self.assertTrue(len(received_call_accepted) >= 1, "CallerAlice did not receive call-accepted")
            accepted_data = received_call_accepted[0]
            self.assertEqual(accepted_data.get("receiverName"), "ReceiverBob")

            # 3. CallerAlice ends call
            sio_a.emit("end-call", {
                "roomId": room_id,
                "to": sio_b.sid
            })
            time.sleep(1.0)

            self.assertTrue(len(received_end_call) >= 1, "ReceiverBob did not receive end-call")

            print("[SUCCESS] Live WebRTC call signaling handshake verified end-to-end!")

        finally:
            if sio_a.connected:
                sio_a.disconnect()
            if sio_b.connected:
                sio_b.disconnect()

if __name__ == "__main__":
    unittest.main()
