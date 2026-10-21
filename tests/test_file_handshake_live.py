import socketio
import time
import sys

sio1 = socketio.Client()
sio2 = socketio.Client()

events1 = []
events2 = []

@sio1.on("file-offer")
def on_offer1(data):
    print("[Client1] Received file-offer:", data)
    events1.append(("file-offer", data))

@sio1.on("file-accept")
def on_accept1(data):
    print("[Client1] Received file-accept:", data)
    events1.append(("file-accept", data))

@sio1.on("file-decline")
def on_decline1(data):
    print("[Client1] Received file-decline:", data)
    events1.append(("file-decline", data))

@sio2.on("file-offer")
def on_offer2(data):
    print("[Client2] Received file-offer:", data)
    events2.append(("file-offer", data))

@sio2.on("file-accept")
def on_accept2(data):
    print("[Client2] Received file-accept:", data)
    events2.append(("file-accept", data))

@sio2.on("file-decline")
def on_decline2(data):
    print("[Client2] Received file-decline:", data)
    events2.append(("file-decline", data))

try:
    print("[*] Connecting clients to http://127.0.0.1:5050...")
    sio1.connect("http://127.0.0.1:5050")
    sio2.connect("http://127.0.0.1:5050")
    print(f"[*] Client 1 SID: {sio1.get_sid()}, Client 2 SID: {sio2.get_sid()}")

    # Client 1 creates room
    def cb1(res):
        print("[Client1] create_room response:", res)
    sio1.emit("create_room", {"room_id": "live-test-room", "pin": "TestPin@123", "username": "Alice"}, callback=cb1)
    time.sleep(1)

    # Client 2 joins room
    def cb2(res):
        print("[Client2] join_room response:", res)
    sio2.emit("join_room", {"room_id": "live-test-room", "pin": "TestPin@123", "username": "Bob"}, callback=cb2)
    time.sleep(1)

    # Alice sends file-offer
    offer = {
        "type": "file-offer",
        "fileName": "demo_report.pdf",
        "fileSize": 2048,
        "fileId": "demo-file-001",
        "senderNickname": "Alice",
        "senderId": sio1.get_sid(),
        "targetSid": sio2.get_sid(),
        "roomId": "live-test-room"
    }
    print("[*] Alice emitting file-offer...")
    sio1.emit("file-offer", offer)
    time.sleep(1)

    assert len(events2) > 0, "Bob did not receive file-offer!"
    print("[OK] Bob received file-offer successfully!")

    # Bob accepts
    accept = {
        "type": "file-accept",
        "fileId": "demo-file-001",
        "senderId": sio1.get_sid(),
        "targetSid": sio1.get_sid(),
        "roomId": "live-test-room"
    }
    print("[*] Bob emitting file-accept...")
    sio2.emit("file-accept", accept)
    time.sleep(1)

    accept_evs = [e for e in events1 if e[0] == "file-accept"]
    assert len(accept_evs) > 0, "Alice did not receive file-accept!"
    print("[OK] Alice received file-accept successfully!")

    # Bob declines a second offer
    offer2 = {
        "type": "file-offer",
        "fileName": "large_video.mp4",
        "fileSize": 10485760,
        "fileId": "demo-file-002",
        "senderNickname": "Alice",
        "senderId": sio1.get_sid(),
        "targetSid": sio2.get_sid(),
        "roomId": "live-test-room"
    }
    sio1.emit("file-offer", offer2)
    time.sleep(1)

    decline = {
        "type": "file-decline",
        "fileId": "demo-file-002",
        "senderId": sio1.get_sid(),
        "targetSid": sio1.get_sid(),
        "roomId": "live-test-room"
    }
    sio2.emit("file-decline", decline)
    time.sleep(1)

    decline_evs = [e for e in events1 if e[0] == "file-decline"]
    assert len(decline_evs) > 0, "Alice did not receive file-decline!"
    print("[OK] Alice received file-decline successfully!")

    print("[SUCCESS] All socket signaling relays work perfectly!")

finally:
    sio1.disconnect()
    sio2.disconnect()
