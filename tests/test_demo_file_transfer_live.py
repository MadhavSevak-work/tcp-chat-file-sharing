"""
Integration test for WebRTC / P2P direct demo file transfer live end-to-end.
Simulates Alice sending a demo file to Bob with the Accept/Decline handshake
and chunked packet stream.
"""

import time
import socketio
import unittest

class TestDemoFileTransferLive(unittest.TestCase):
    def test_full_file_transfer_handshake_and_stream(self):
        sio_alice = socketio.Client()
        sio_bob = socketio.Client()

        alice_received = []
        bob_received = []
        bob_chunks = []

        @sio_bob.on("file-offer")
        def on_bob_file_offer(data):
            bob_received.append(("file-offer", data))

        @sio_alice.on("file-accept")
        def on_alice_file_accept(data):
            alice_received.append(("file-accept", data))

        @sio_bob.on("p2p_direct_packet")
        def on_bob_packet(data):
            packet = data.get("packet")
            if isinstance(packet, (bytes, bytearray)):
                bob_chunks.append(bytes(packet))
            elif isinstance(packet, dict) and packet.get("type") in ("p2p_file_start", "p2p_file_complete"):
                bob_received.append((packet.get("type"), packet))

        # 1. Connect both clients
        sio_alice.connect("http://127.0.0.1:5050")
        sio_bob.connect("http://127.0.0.1:5050")
        self.assertTrue(sio_alice.connected)
        self.assertTrue(sio_bob.connected)

        alice_sid = sio_alice.get_sid()
        bob_sid = sio_bob.get_sid()
        room_id = "demo-room-transfer-live"

        # 2. Join room
        sio_alice.emit("create_room", {"username": "Alice", "room_id": room_id, "pin": "TestPin@123"})
        time.sleep(1)

        sio_bob.emit("join_room", {"username": "Bob", "room_id": room_id, "pin": "TestPin@123"})
        time.sleep(1)

        # 3. Alice selects a demo file and sends file-offer to Bob
        demo_filename = "demo_test_document.txt"
        demo_content = b"Antigravity NetChat Demo File Transfer Content! " * 20 # 940 bytes
        demo_filesize = len(demo_content)
        file_id = "demo-transfer-file-01"

        offer_payload = {
            "type": "file-offer",
            "fileName": demo_filename,
            "fileSize": demo_filesize,
            "fileId": file_id,
            "senderNickname": "Alice",
            "senderId": alice_sid,
            "targetSid": bob_sid,
            "roomId": room_id
        }

        sio_alice.emit("file-offer", offer_payload)
        time.sleep(1)

        # 4. Verify Bob received the file offer
        offers = [p for name, p in bob_received if name == "file-offer"]
        self.assertEqual(len(offers), 1)
        self.assertEqual(offers[0]["fileName"], demo_filename)
        self.assertEqual(offers[0]["fileSize"], demo_filesize)

        # 5. Bob clicks "Accept" -> emits file-accept
        accept_payload = {
            "type": "file-accept",
            "fileId": file_id,
            "senderId": alice_sid,
            "receiverId": bob_sid,
            "receiverNickname": "Bob",
            "targetSid": alice_sid,
            "roomId": room_id
        }
        sio_bob.emit("file-accept", accept_payload)
        time.sleep(1)

        # 6. Verify Alice received file-accept
        accepts = [p for name, p in alice_received if name == "file-accept"]
        self.assertEqual(len(accepts), 1)
        self.assertEqual(accepts[0]["fileId"], file_id)
        self.assertEqual(accepts[0]["receiverId"], bob_sid)

        # 7. Alice begins chunked transfer
        # Step A: send p2p_file_start
        sio_alice.emit("p2p_direct_packet", {
            "target_sid": bob_sid,
            "room_id": room_id,
            "packet": {
                "type": "p2p_file_start",
                "id": file_id,
                "name": demo_filename,
                "size": demo_filesize,
                "mime": "text/plain",
                "totalChunks": 2
            }
        })
        time.sleep(0.5)

        # Step B: send chunk 1 and chunk 2
        chunk1 = demo_content[:500]
        chunk2 = demo_content[500:]

        sio_alice.emit("p2p_direct_packet", {
            "target_sid": bob_sid,
            "room_id": room_id,
            "packet": chunk1
        })
        time.sleep(0.2)

        sio_alice.emit("p2p_direct_packet", {
            "target_sid": bob_sid,
            "room_id": room_id,
            "packet": chunk2
        })
        time.sleep(0.5)

        # Step C: send p2p_file_complete
        sio_alice.emit("p2p_direct_packet", {
            "target_sid": bob_sid,
            "room_id": room_id,
            "packet": {
                "type": "p2p_file_complete",
                "id": file_id
            }
        })
        time.sleep(1)

        # 8. Verify Bob received the full file
        start_packets = [p for name, p in bob_received if name == "p2p_file_start"]
        complete_packets = [p for name, p in bob_received if name == "p2p_file_complete"]
        self.assertEqual(len(start_packets), 1)
        self.assertEqual(len(complete_packets), 1)

        total_bytes_received = sum(len(c) for c in bob_chunks)
        self.assertEqual(total_bytes_received, demo_filesize)
        assembled_content = b"".join(bob_chunks)
        self.assertEqual(assembled_content, demo_content)

        sio_alice.disconnect()
        sio_bob.disconnect()
        print("[SUCCESS] Live end-to-end demo file transfer test completed perfectly!")

if __name__ == "__main__":
    unittest.main()
