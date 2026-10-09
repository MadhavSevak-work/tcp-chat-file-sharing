# Academic Project Report

**Project Title:** Design and Implementation of a TCP-Based Multi-Client Chat and File Sharing System  
**Subject:** Computer Networks (CN)  
**Target Degree:** Bachelor of Technology / Bachelor of Engineering in Computer Science and Engineering  
**Team Size:** 5 Students  
**Environment:** Windows 11, Visual Studio Code, Python 3.14  

---

## 1. Project Title
**Design and Implementation of a TCP-Based Multi-Client Chat and File Sharing System**

---

## 2. Abstract
Local area communication in institutional environments often requires reliable real-time messaging and seamless file exchange without dependency on commercial cloud ecosystems or third-party servers. This project presents the design and implementation of a multithreaded desktop application developed entirely in Python using standard socket programming and Tkinter graphical user interface frameworks. The system operates on a centralized client-server model over the Transmission Control Protocol (TCP/IP). To address the fundamental TCP stream framing problem, a 4-byte big-endian length-prefixed framing protocol is developed, preventing packet coalescing and fragmentation issues. A dual-port architecture separates control and real-time chat signaling (Port 5000) from high-throughput chunked file streaming (Port 5001), eliminating Head-of-Line blocking. Cryptographic integrity is guaranteed via end-to-end SHA-256 checksums, and defensive path validation prevents directory traversal attacks. Comprehensive automated and manual testing confirms 100% test pass rates and stable concurrent operation across multiple clients.

---

## 3. Introduction
Computer networking revolves around the transmission of structured data across interconnected computational nodes. At the core of the Internet protocol suite lies the Transmission Control Protocol (TCP), which guarantees reliable, ordered, and error-checked delivery of octets between running applications. Understanding how sockets operate, how threads coordinate shared resources, and how custom application-layer protocols are framed over raw byte streams is fundamental to network engineering.

This project delivers a complete, software-only desktop communication system designed for educational and local area network (LAN) environments. The application demonstrates real client-server interactions, multi-user concurrency, targeted private messaging, and chunk-based file transfer with cryptographic validation.

---

## 4. Problem Statement
Many introductory computer networking projects rely on artificial simulations, static mockups, or third-party cloud APIs (such as Firebase or WebSockets frameworks) that conceal the underlying Transport Layer mechanisms. Furthermore, simple socket implementations often commit critical networking mistakes:
1. Assuming a single `socket.send()` corresponds to a single `socket.recv()`, leading to protocol corruption when packets coalesce.
2. Mixing raw file bytes directly with chat messages on the same socket stream, causing client freezes and parser crashes.
3. Performing blocking socket operations directly on the GUI main thread, resulting in frozen user interfaces.
4. Lacking data integrity verification during file transfer, allowing corrupted or incomplete files to be saved.

There is a distinct need for a clean, standards-compliant, and software-only system that demonstrates real socket programming while solving framing, concurrency, and integrity challenges correctly.

---

## 5. Objectives
1. Implement a robust TCP server using Python's `socket` and `threading` libraries capable of serving multiple concurrent clients.
2. Solve the TCP byte-stream framing problem using a reliable 4-byte big-endian length-prefix mechanism.
3. Develop an asynchronous desktop graphical user interface using Python's `tkinter` and `ttk` with a modern dark theme.
4. Enable real-time public group chat, targeted private messaging, and live online user presence synchronization.
5. Implement a secondary TCP file relay mechanism capable of transferring files in 64 KB chunks without blocking chat signaling.
6. Verify file integrity using end-to-end SHA-256 hashing and protect file operations against path traversal vulnerabilities.
7. Validate system reliability with an automated unit and integration test suite achieving 100% coverage.

---

## 6. Scope
- **Operational Scope:** Localhost loopback testing and Local Area Network (LAN) / Wi-Fi deployments within university laboratories or small office networks.
- **Protocol Scope:** Transport Layer (TCP) and custom Application Layer wire protocol over IPv4 sockets.
- **Hardware Scope:** Any standard PC running Windows, Linux, or macOS with Python 3. No specialized networking hardware or paid cloud subscriptions required.
- **Security Boundary:** Designed as an educational system. Data is transmitted as plain JSON and binary streams without TLS encryption.

---

## 7. Existing System vs. Proposed System

| Parameter | Existing Educational Projects | Proposed System |
| :--- | :--- | :--- |
| **Networking Model** | Single client or simulated loops | Real multi-client TCP socket server with threading |
| **Stream Framing** | Delimiter-based (newlines) or unframed | Strict 4-byte binary length prefix (`!I`) |
| **File Transfer** | Absent or loads entire file in RAM | Chunked 64 KB streaming on dedicated File Relay port |
| **Data Integrity** | None (blind write) | Full SHA-256 pre-computation and post-verification |
| **GUI Responsiveness** | UI freezes during network I/O | Non-blocking background worker threads with `queue.Queue` |
| **Presence Tracking** | Static or manual refresh | Real-time push notifications (`USER_LIST` broadcasts) |
| **Path Traversal Protection** | Vulnerable to arbitrary filenames | Defensive sanitization via `sanitize_filename()` |

---

## 8. Hardware and Software Requirements

### Hardware Requirements:
- **Processor:** Intel Core i3 / AMD Ryzen 3 or higher.
- **RAM:** Minimum 2 GB (4 GB recommended).
- **Network Interface Card (NIC):** Standard 10/100/1000 Mbps Ethernet adapter or 802.11 b/g/n Wi-Fi card.
- **Storage:** Less than 50 MB for source code and runtime logs.

### Software Requirements:
- **Operating System:** Windows 10/11, macOS, or Ubuntu Linux.
- **Runtime Environment:** Python 3.8+ (Tested on Python 3.14).
- **Standard Libraries:** `socket`, `threading`, `tkinter`, `ttk`, `json`, `struct`, `hashlib`, `os`, `pathlib`, `logging`, `unittest`.
- **Third-Party Dependencies:** None (Zero external dependencies).

---

## 9. System Architecture
The application adheres to a centralized client-server architecture:
- **Central TCP Server:** Operates two listener sockets simultaneously:
  - Port 5000: Primary Chat and Signaling Listener.
  - Port 5001: Dedicated Binary File Relay Listener.
- **Client Nodes:** Connect to the server over TCP. The client software maintains two background worker threads:
  - A persistent receiver thread listening on Port 5000 for incoming chat messages and system events.
  - On-demand file transfer worker threads connecting to Port 5001 when a file transfer session is triggered.

---

## 10. Data-Flow Diagram (DFD)

### Level-0 DFD (Context Diagram):
```
[Client User] <---> (Desktop Client GUI) <=== TCP Sockets ===> (Central TCP Server) <---> [Other Peers]
```

### Level-1 DFD:
```
           +---------------------------------------------+
           |                Client Node                  |
           |  [UI Layer] <--> [Event Queue] <--> [Net]   |
           +----------------------+----------------------+
                                  |
                   [TCP Sockets - IPv4 / Ports 5000 & 5001]
                                  |
           +----------------------+----------------------+
           |                Server Node                  |
           |                                             |
           |  [Chat Listener 5000]   [Relay Listener 5001]
           |           |                       |         |
           |  [Client Registry]      [Transfer Sessions] |
           +---------------------------------------------+
```

---

## 11. Client-Server Sequence Diagrams
*(Refer to `docs/architecture.md` for complete sequence diagrams covering connection handshakes, group/private routing, and chunked file transfer with checksum validation.)*

---

## 12. Protocol Design
*(Refer to `docs/protocol.md` for complete schema definitions of `CONNECT`, `CONNECT_ACK`, `CHAT`, `PRIVATE_CHAT`, `USER_LIST`, `FILE_OFFER`, `FILE_ACCEPT`, `FILE_READY`, and raw chunk streaming.)*

---

## 13. Algorithms and Implementation

### Algorithm 1: Length-Prefixed Message Framing (Send)
```
Input: socket sock, dictionary payload, optional lock
1. Serialize payload to UTF-8 JSON bytes.
2. Calculate byte length L = len(json_bytes).
3. If L > MAX_MESSAGE_SIZE, raise ProtocolError.
4. Pack length prefix into 4 bytes: header = struct.pack("!I", L).
5. If lock provided:
     with lock: sock.sendall(header + json_bytes)
   Else:
     sock.sendall(header + json_bytes)
```

### Algorithm 2: Length-Prefixed Message Framing (Receive)
```
Input: socket sock
1. Read exactly 4 bytes from sock -> header. If EOF, return None.
2. Unpack payload length L = struct.unpack("!I", header)[0].
3. If L > MAX_MESSAGE_SIZE, raise ProtocolError.
4. Loop until exactly L bytes are read from sock -> payload_bytes.
5. Decode payload_bytes as UTF-8 string.
6. Parse JSON and return resulting dictionary.
```

### Algorithm 3: Chunked File Transfer with SHA-256 Validation
```
Sender:
1. Open file at local_path in binary read mode ("rb").
2. Compute SHA-256 incrementally: hasher.update(chunk).
3. Send FILE_OFFER with filename, filesize, sha256.
4. Upon receiving FILE_READY, connect to Port 5001.
5. Stream file in 64 KB chunks until all bytes sent.

Receiver:
1. Prompt user with FileOfferDialog.
2. If accepted, send FILE_ACCEPT and connect to Port 5001.
3. Open "<destination_path>.part" in binary write mode ("wb").
4. Read 64 KB chunks from socket, write to disk, update local hasher.
5. When total bytes received == filesize:
     computed_hash = hasher.hexdigest()
     If computed_hash == expected_hash:
       Rename "<destination_path>.part" to "<destination_path>".
       Notify user of successful verified transfer.
     Else:
       Delete "<destination_path>.part" and raise IntegrityError.
```

---

## 14. Networking Concepts Used
1. **TCP/IP Protocol Suite:** Operates at Application (Layer 7) and Transport (Layer 4) layers.
2. **Socket Programming:** Creation, binding, listening, accepting, connecting, and closing stream sockets (`AF_INET`, `SOCK_STREAM`).
3. **Port Demultiplexing:** Distinct port allocation (5000 vs 5001) for service isolation.
4. **Byte-Stream Framing:** Overcoming packet coalescing and fragmentation with length-prefixed headers.
5. **Network Byte Order (Endianness):** Big-endian integer packing (`!I`) to ensure interoperability across architectures.
6. **Thread-Safe Shared State:** Mutex locks (`threading.Lock`, `threading.RLock`) preventing race conditions during socket writes and client lookups.
7. **Socket Buffering & Chunking:** Preventing RAM exhaustion by streaming in 64 KB buffers.
8. **Asynchronous UI Decoupling:** Decoupling network I/O from GUI rendering via thread-safe message queues.

---

## 15. Module Descriptions
- **`shared/constants.py`:** Central registry of port configurations, buffer constants, message types, and validation rules.
- **`shared/protocol.py`:** Low-level framing logic (`send_msg`, `recv_msg`, `recv_exact`), username regex validation, filename sanitization, and SHA-256 helpers.
- **`server/server_core.py`:** Central server orchestrator managing the client registry, group broadcasts, private whispers, and presence synchronization.
- **`server/client_handler.py`:** Dedicated thread worker for each connected client socket.
- **`server/file_transfer.py`:** Secondary TCP relay server coordinating binary file pipes between sender and receiver.
- **`server/logger.py`:** Thread-safe structured logging to console and persistent log files.
- **`client/network.py`:** Client-side networking manager running on background threads, pushing events to a queue.
- **`client/file_transfer.py`:** Background chunked upload and download workers with progress tracking and checksum validation.
- **`client/dialogs.py`:** Modal dialogs for file offer acceptance, destination picking, and peer selection.
- **`client/ui.py`:** Modern dark-theme desktop interface built with Tkinter and ttk.
- **`client/terminal_client.py`:** Lightweight CLI client for headless testing.

---

## 16. Test Cases and Actual Results
*(Refer to `docs/test_cases.md` for full test matrix. All 16 automated tests and 8 manual integration test cases executed with 100% success).*

---

## 17. Limitations
1. **Unencrypted Transport:** Sockets use cleartext TCP. Messages and file bytes could be inspected by network sniffers (e.g., Wireshark) on untrusted networks.
2. **Volatile Session Storage:** Chat messages and user history are held in volatile RAM and are cleared upon server shutdown.
3. **Server-Relayed Bandwidth:** File transfers pass through the central server rather than direct peer-to-peer (P2P) connections, placing the bandwidth burden on the server host.

---

## 18. Future Enhancements
1. **Transport Layer Security (TLS):** Wrap client-server sockets with `ssl.SSLContext` using self-signed or CA-signed certificates for military-grade encryption.
2. **Persistent Database:** Integrate SQLite with thread-safe connection pooling to store historical chat logs and user profiles.
3. **P2P File Transfer with NAT Traversal:** Implement STUN/TURN or direct LAN peer-to-peer file transfers to offload bandwidth from the server.
4. **Voice / Audio Messaging:** Integrate UDP sockets with Opus audio compression for real-time voice chat rooms.

---

## 19. Conclusion
The "Design and Implementation of a TCP-Based Multi-Client Chat and File Sharing System" successfully demonstrates the core principles of Computer Networks, socket programming, concurrent multi-threading, and protocol design. By establishing a rigorous length-prefixed framing format, decoupling chat signaling from binary file streams, and enforcing SHA-256 cryptographic verification, the project delivers a rock-solid, production-quality college project that functions seamlessly on both single-computer loopback configurations and local Wi-Fi networks.

---

## 20. References
1. Kurose, J. F., & Ross, K. W. (2021). *Computer Networking: A Top-Down Approach* (8th ed.). Pearson.
2. Stevens, W. R., Fenner, B., & Rudoff, A. M. (2004). *UNIX Network Programming, Volume 1: The Sockets Networking API* (3rd ed.). Addison-Wesley.
3. Python Software Foundation. (2026). *Socket — Low-level networking interface*. Python 3 Documentation. https://docs.python.org/3/library/socket.html
4. Postel, J. (1981). *Transmission Control Protocol*. RFC 793, Internet Engineering Task Force (IETF).
5. National Institute of Standards and Technology (NIST). (2015). *Secure Hash Standard (SHS)*. FIPS PUB 180-4.
