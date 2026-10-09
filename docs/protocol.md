# Application Wire Protocol Specification (v1.0)

**Project:** TCP-Based Multi-Client Chat and File Sharing System  
**Layer:** Application Layer (Layer 7 over TCP Layer 4)  
**Encoding:** UTF-8 JSON with 4-Byte Binary Length-Prefixed Framing  

---

## 1. The Fundamental TCP Framing Problem

In TCP/IP, the Transmission Control Protocol provides an **unstructured, reliable, byte-stream abstraction**. Unlike UDP, which transmits discrete datagrams, TCP preserves byte order but does **not** preserve application message boundaries.

### Scenarios in Raw TCP:
1. **Packet Coalescing (Aggregation):** If a sender calls `send(msg1)` and `send(msg2)` in quick succession, Nagle's algorithm and OS buffering may combine them into a single TCP segment. A single `recv()` on the receiver reads both messages together.
2. **Packet Fragmentation:** If a sender transmits a message larger than the Path MTU (Maximum Transmission Unit, typically 1500 bytes for Ethernet) or socket buffer, the message arrives fragmented across multiple `recv()` calls.

### Our Solution: 4-Byte Big-Endian Length Prefix
Every application message is framed as:

```
+--------------------------+-------------------------------------------+
| Length Prefix (4 Bytes)  |         Payload (Length Bytes)            |
| uint32 (Network / Big-E) |           UTF-8 JSON String               |
+--------------------------+-------------------------------------------+
```

- **Header Format:** `struct.pack("!I", payload_len)`
  - `!` = Network Byte Order (Big-Endian)
  - `I` = 32-bit unsigned integer (supports payloads up to 4 GB, capped at 10 MB for safety)
- **Framing Algorithm:**
  1. The receiver calls `recv_exact(sock, 4)` until all 4 header bytes are collected.
  2. The header is unpacked using `struct.unpack("!I", header)[0]` to obtain `payload_len`.
  3. The receiver calls `recv_exact(sock, payload_len)` until exactly `payload_len` bytes are collected.
  4. The payload is decoded as UTF-8 and parsed using `json.loads()`.

---

## 2. Control & Chat Protocol Messages (Port 5000)

### 2.1 Handshake Messages

#### `CONNECT` (Client -> Server)
Sent immediately upon establishing TCP connection to register client username.
```json
{
  "type": "CONNECT",
  "username": "Alice"
}
```

#### `CONNECT_ACK` (Server -> Client)
Sent in response to successful registration.
```json
{
  "type": "CONNECT_ACK",
  "username": "Alice",
  "file_port": 5001,
  "message": "Welcome to the server, Alice!"
}
```

#### `ERROR` (Server -> Client)
Sent when an error or validation failure occurs.
```json
{
  "type": "ERROR",
  "code": "USERNAME_TAKEN",
  "message": "Username 'Alice' is already in use by an active client."
}
```

---

### 2.2 Messaging

#### `CHAT` (Client -> Server, Server -> Clients)
Public group chat broadcast to all connected users.
```json
{
  "type": "CHAT",
  "sender": "Alice",
  "content": "Hello everyone in Computer Networks lab!",
  "timestamp": "14:32:05"
}
```

#### `PRIVATE_CHAT` (Client -> Server, Server -> Sender & Recipient)
Targeted direct message delivered only to sender and recipient.
```json
{
  "type": "PRIVATE_CHAT",
  "sender": "Alice",
  "recipient": "Bob",
  "content": "Can you check the viva question answers?",
  "timestamp": "14:32:15"
}
```

---

### 2.3 Presence & Directory

#### `USER_LIST` (Server -> Clients)
Broadcast whenever a user connects or disconnects.
```json
{
  "type": "USER_LIST",
  "users": ["Alice", "Bob", "Charlie", "David", "Eve"]
}
```

#### `SYSTEM` (Server -> Clients)
System notifications such as user join/leave or server shutdown events.
```json
{
  "type": "SYSTEM",
  "message": "👉 'Bob' has joined the room.",
  "event": "USER_JOINED",
  "username": "Bob"
}
```

#### `DISCONNECT` (Client -> Server)
Graceful disconnection request.
```json
{
  "type": "DISCONNECT"
}
```

---

## 3. File Transfer Signaling Messages (Port 5000)

#### `FILE_OFFER` (Sender -> Server -> Recipient)
Proposes sending a file with precomputed metadata.
```json
{
  "type": "FILE_OFFER",
  "transfer_id": "b3f6d7c8-2b87-4d94-a16a-74d39e25db32",
  "sender": "Alice",
  "recipient": "Bob",
  "filename": "computer_networks_slides.pdf",
  "filesize": 2516582,
  "sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a"
}
```

#### `FILE_ACCEPT` (Recipient -> Server)
Recipient accepts the offer and provides save confirmation.
```json
{
  "type": "FILE_ACCEPT",
  "transfer_id": "b3f6d7c8-2b87-4d94-a16a-74d39e25db32",
  "sender": "Alice",
  "filename": "computer_networks_slides.pdf",
  "filesize": 2516582,
  "sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a"
}
```

#### `FILE_REJECT` (Recipient -> Server -> Sender)
Recipient declines the file offer.
```json
{
  "type": "FILE_REJECT",
  "transfer_id": "b3f6d7c8-2b87-4d94-a16a-74d39e25db32",
  "recipient": "Bob",
  "filename": "computer_networks_slides.pdf"
}
```

#### `FILE_READY` (Server -> Sender & Recipient)
Notifies both peers that the File Relay server is ready on Port 5001.
```json
{
  "type": "FILE_READY",
  "transfer_id": "b3f6d7c8-2b87-4d94-a16a-74d39e25db32",
  "file_port": 5001,
  "sender": "Alice",
  "recipient": "Bob",
  "filename": "computer_networks_slides.pdf",
  "filesize": 2516582,
  "sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a"
}
```

#### `FILE_CANCEL` (Client -> Server -> Peer)
Cancels an active or pending file transfer.
```json
{
  "type": "FILE_CANCEL",
  "transfer_id": "b3f6d7c8-2b87-4d94-a16a-74d39e25db32",
  "other_user": "Bob"
}
```

---

## 4. File Relay Streaming Protocol (Port 5001)

Once both parties receive `FILE_READY`:

1. **Sender Connection:**
   - Connects to `server_ip:5001`.
   - Sends Framed Handshake:
     ```json
     {"action": "upload", "transfer_id": "b3f6d7c8-2b87-4d94-a16a-74d39e25db32"}
     ```
   - Server responds: `{"status": "ok", "role": "sender"}`.

2. **Recipient Connection:**
   - Connects to `server_ip:5001`.
   - Sends Framed Handshake:
     ```json
     {"action": "download", "transfer_id": "b3f6d7c8-2b87-4d94-a16a-74d39e25db32"}
     ```
   - Server responds: `{"status": "ok", "role": "receiver"}`.

3. **Data Relaying:**
   - Once both sockets arrive, the server switches to raw stream forwarding mode.
   - Sender transmits raw binary chunks of size 65,536 bytes (64 KB).
   - Server relays each chunk directly to Recipient.
   - Recipient writes to `<destination_path>.part` and updates local progress.
   - When all `filesize` bytes are received, Recipient computes SHA-256 and compares it with the offer's checksum. If matched, the file is atomically renamed to its destination name.
