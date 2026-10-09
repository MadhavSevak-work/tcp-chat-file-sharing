# Computer Networks Project Viva Questions & Answers

**Project Title:** Design and Implementation of a TCP-Based Multi-Client Chat and File Sharing System  
**Audience:** Undergraduate Students appearing for Computer Networks (CN) Lab Exam / Project Defense  

---

### Q1: What is a Socket in computer networking?
**Answer:** A socket is a software endpoint for network communication. Defined by the combination of an **IP Address** and a **Port Number** (along with the transport protocol like TCP or UDP), a socket enables bidirectional communication between two processes across a network. In Python, sockets are created using the `socket.socket(socket.AF_INET, socket.SOCK_STREAM)` API.

---

### Q2: Why did you choose TCP instead of UDP for this project?
**Answer:** TCP (Transmission Control Protocol) is **connection-oriented**, **reliable**, and guarantees **in-order delivery** through sequence numbers, acknowledgments, and retransmissions. 
In a chat and file-sharing system:
- Messages must not be lost or scrambled.
- A single corrupted or missing byte in a file (such as a PDF or executable) invalidates the entire file.
UDP is connectionless and does not guarantee delivery or packet order, making it suitable for live video/audio streaming, but inappropriate for reliable file transfer and messaging unless custom reliability protocols are implemented on top.

---

### Q3: Explain the TCP 3-Way Handshake mechanism.
**Answer:** Before any data can be exchanged over TCP, a connection must be established using three control segments:
1. **SYN (Synchronize):** The client sends a segment with the SYN flag set and an initial sequence number ($ISN_c$) to request a connection.
2. **SYN-ACK (Synchronize-Acknowledgment):** The server replies with SYN and ACK flags set, acknowledging $ISN_c + 1$ and providing its own sequence number ($ISN_s$).
3. **ACK (Acknowledgment):** The client sends an ACK segment confirming $ISN_s + 1$.  
Once completed, the socket transitions to the `ESTABLISHED` state and application data transfer begins.

---

### Q4: What is the "TCP Framing Problem" and how did you solve it?
**Answer:** TCP is a **stream-oriented protocol**, not a message-oriented protocol. It treats data as a continuous stream of bytes. Senders may send multiple messages that get glued together into one buffer (**packet coalescing** due to Nagle's algorithm), or a single message may be split across multiple packets (**packet fragmentation**).
**Our Solution:** We implemented **Length-Prefixed Framing**. Every message is preceded by a fixed 4-byte header containing a 32-bit unsigned big-endian integer representing the exact byte length of the UTF-8 JSON payload. The receiver always reads exactly 4 bytes first, unpacks the length, and then loops calling `recv()` until exactly that many payload bytes are collected before parsing.

---

### Q5: What does "Big-Endian" / "Network Byte Order" mean?
**Answer:** Different computer architectures store multibyte numbers differently in memory:
- **Little-Endian (x86/x64):** Least significant byte (LSB) first.
- **Big-Endian (Network Byte Order):** Most significant byte (MSB) first.
To prevent endianness mismatches between different client devices, the Internet standard specifies that protocol headers over TCP/IP must use **Network Byte Order (Big-Endian)**. In Python, we enforce this using `struct.pack("!I", length)`.

---

### Q6: How does the server handle multiple clients at the same time?
**Answer:** The server uses **Multithreading** (`threading.Thread`).
- The main thread creates the server socket, binds it, and runs an `accept()` loop.
- When a client connects, `server_socket.accept()` returns a new dedicated client socket and address tuple.
- The server spawns a dedicated worker thread (`ClientHandler`) for that client, allowing hundreds of clients to send and receive messages concurrently without blocking one another.

---

### Q7: Why are two separate TCP ports (Port 5000 and Port 5001) used in this project?
**Answer:**
- **Port 5000 (Chat Signaling Port):** Handles lightweight JSON control messages (presence, chat messages, direct whispers, and file transfer invitations).
- **Port 5001 (File Relay Port):** Handles heavy binary file data streaming in 64 KB chunks.
**Reason:** Decoupling bulk data transmission from messaging eliminates **Head-of-Line (HoL) blocking**. If file transfer were sent across the chat stream, transferring a 50 MB file would saturate the connection and freeze real-time chat messages for that user.

---

### Q8: What is the purpose of SHA-256 in file transfer?
**Answer:** SHA-256 (Secure Hash Algorithm 256-bit) is a cryptographic hash function that produces a unique 64-character hexadecimal digest for any file.
- Before sending, the sender computes the SHA-256 hash of the file.
- After receiving the entire file, the recipient calculates the hash of the downloaded bytes.
- If the two hashes match, it mathematically proves that the file was transferred with **100% data integrity** and was neither corrupted by network noise nor truncated by a broken connection.

---

### Q9: Why is the file transferred in chunks rather than reading the entire file at once?
**Answer:** If a user sends a 500 MB or 1 GB file, loading the entire file into memory using `file.read()` would consume hundreds of megabytes of RAM, risking an **Out-Of-Memory (OOM) crash** on low-spec systems.
By reading and streaming in fixed **64 KB chunks** (`CHUNK_SIZE = 65536`), memory usage remains constant (a few kilobytes), and we can update progress bars accurately in real time.

---

### Q10: How does the system prevent Path Traversal attacks?
**Answer:** When an incoming file offer arrives, a malicious client could send a filename like `../../Windows/System32/evil.bat`. If saved blindly, it could overwrite critical system files.
Our `sanitize_filename()` function strips all directory paths using `os.path.basename()` and sanitizes illegal operating system characters, ensuring that files can only be saved to the user's chosen folder.

---

### Q11: What is the difference between IP address and Port number?
**Answer:**
- **IP Address (Network Layer / Layer 3):** Identifies a specific host device on a network (e.g., `192.168.1.15`).
- **Port Number (Transport Layer / Layer 4):** Identifies a specific running process or service on that host (e.g., Port `5000` for Chat Server, Port `80` for HTTP).

---

### Q12: What does IP `127.0.0.1` represent? What about `0.0.0.0`?
**Answer:**
- **`127.0.0.1` (Loopback Address):** Routes network traffic internally within the same machine via the loopback virtual network interface without sending packets out onto a physical network card.
- **`0.0.0.0` (In-Addr Any / Wildcard Bind):** Tells the operating system to bind and listen on **all available network interfaces** on the computer (both local loopback and the physical Wi-Fi/Ethernet adapters), enabling other computers on the LAN to connect.

---

### Q13: How does the Tkinter GUI stay responsive while networking is happening?
**Answer:** Tkinter is single-threaded; running blocking calls like `socket.recv()` or `socket.connect()` on the Tkinter main thread would freeze the UI and cause Windows to show "(Not Responding)".
**Solution:**
1. All networking operations run inside background daemon threads.
2. Incoming events are placed into a thread-safe `queue.Queue`.
3. The Tkinter main thread periodically polls the queue using `root.after(50, poll_function)` to safely update GUI widgets without blocking.

---

### Q14: How does the server prevent duplicate usernames?
**Answer:** The server maintains an internal registry dictionary `self.clients` protected by a `threading.RLock()`. When a client sends a `CONNECT` message with a username, the server performs a case-insensitive lookup. If the name already exists, the server responds with an `ERROR` (`code: USERNAME_TAKEN`) and closes the connection without corrupting the active session.

---

### Q15: What happens when a client disconnects unexpectedly (e.g., process killed or network cable pulled)?
**Answer:**
1. In TCP, an abrupt termination sends a `RST` (Reset) packet or triggers a socket EOF.
2. The server's `recv()` call returns empty bytes (`b""`) or raises `ConnectionResetError` (WinError 10054 on Windows).
3. The server catches this inside a `try...finally` block in `ClientHandler.run()`.
4. It safely removes the client from `self.clients`, closes the socket, broadcasts an updated `USER_LIST` to all remaining clients, and announces `'User' has left the room`.

---

### Q16: What is a Race Condition, and where could one occur in this project?
**Answer:** A race condition occurs when two or more threads attempt to read and write shared data simultaneously, producing nondeterministic bugs depending on thread execution order.
In this project, a race condition could occur if two clients registered the same username at the exact same millisecond, or if multiple threads attempted to write to the same client's socket at the same time. We prevented this using:
- `self.clients_lock` (`threading.RLock`) for the client directory.
- `self.write_lock` (`threading.Lock`) for each client socket.

---

### Q17: What is the maximum number of clients this server can handle?
**Answer:** On standard operating systems, each client connection consumes one socket file descriptor and one Python thread. Standard Python threading can comfortably support hundreds of concurrent clients. For tens of thousands of concurrent connections (the C10K problem), an asynchronous event-driven I/O model like `asyncio` or `epoll`/`select` would be required. For college campus/lab environments, multithreading is ideal, clear, and robust.

---

### Q18: What is MTU and how does it relate to socket buffer sizes?
**Answer:** **MTU (Maximum Transmission Unit)** is the largest packet size that can be transmitted over a physical network link without fragmentation (standard Ethernet MTU is 1500 bytes, containing 20 bytes IP header, 20 bytes TCP header, and up to 1460 bytes payload, known as MSS — Maximum Segment Size). 
Our application uses buffer sizes of 4096 bytes for messages and 65,536 bytes (64 KB) for file chunks, which the TCP transport layer automatically segments into MTU-compliant IP packets.

---

### Q19: How do you connect two different laptops on the same Wi-Fi network?
**Answer:**
1. Find the server computer's IPv4 address using `ipconfig` on Windows (e.g., `192.168.1.45`).
2. Run the server bound to `0.0.0.0` or the LAN IP:
   `python run_server.py --host 0.0.0.0 --port 5000`
3. Ensure Windows Firewall permits incoming TCP traffic on ports 5000 and 5001.
4. On the second laptop, launch the client and enter the server's LAN IP (`192.168.1.45`) and Port `5000`.

---

### Q20: What is the difference between TCP FIN and TCP RST?
**Answer:**
- **FIN (Finish):** Used in a graceful, orderly connection shutdown (the 4-way termination handshake). Each side confirms all buffered data has been sent and received.
- **RST (Reset):** Used in an abnormal, abrupt termination. It indicates that the connection encountered an unrecoverable error, a crashed process, or a connection attempt to a closed port.

---

### Q21: What is Nagle's Algorithm?
**Answer:** Nagle's algorithm is a TCP optimization designed to reduce network congestion by combining small outgoing packets into a single segment until an ACK is received from the previous packet. While beneficial for bandwidth efficiency, it can introduce small latency delays for real-time interactive applications.

---

### Q22: What does the SO_REUSEADDR socket option do?
**Answer:** When a server terminates, its TCP port often lingers in the `TIME_WAIT` state for 1 to 2 minutes to ensure late packets are cleared. Setting `setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)` allows the server to immediately rebind to the same port upon restarting without getting "Address already in use" errors.

---

### Q23: Why do we use atomic renaming (`.part` to final file name) during file download?
**Answer:** If a file transfer is interrupted midway (due to network failure or user cancellation), a partially written file on disk could be mistaken for a complete, valid document. By saving to `<filename>.part` and only renaming it after complete reception and SHA-256 verification, incomplete files never overwrite or corrupt existing data.

---

### Q24: Is this system encrypted?
**Answer:** No, this is an educational LAN application that transmits plain JSON and raw binary chunks over cleartext TCP sockets. For production security, the sockets would be wrapped with **TLS/SSL** using Python's `ssl` module (`ssl.wrap_socket`), providing encryption, certificate verification, and protection against packet eavesdropping.

---

### Q25: What are the main limitations and future improvements for this system?
**Answer:**
- **Limitations:** Lack of TLS encryption, messages are not stored in a persistent database (transient session), and file transfers rely on a centralized server relay.
- **Future Improvements:** Adding end-to-end encryption with AES-GCM/RSA, SQLite chat history persistence, voice/audio streaming using UDP, and direct WebRTC/P2P hole-punching for files.

---

### Q26: Can a web browser directly open raw TCP sockets? Why is a Gateway needed?
**Answer:** No. For security reasons (to prevent malicious website scripts from scanning internal networks or attacking arbitrary TCP ports), standard browser JavaScript APIs do not allow opening raw Layer 4 TCP sockets. Browsers can only open HTTP requests, WebSockets, or WebRTC datachannels. 
To connect web browsers to a raw TCP server, we build a **Web-to-TCP Protocol Gateway** (using Flask-SocketIO). The browser connects to the Gateway via WebSockets, and the Gateway opens an authentic Layer 4 TCP socket to the central ChatServer on the browser's behalf.

---

### Q27: What is the difference between WebSockets and raw TCP Sockets?
**Answer:**
- **Raw TCP Socket (Transport Layer - Layer 4):** Operates on an unstructured byte stream. Application protocols must define their own message framing (like our 4-byte length prefix) to determine message boundaries.
- **WebSocket (Application Layer - Layer 7):** Begins with an HTTP handshake (`Upgrade: websocket`) over TCP port 80/443 and switches to a framed, full-duplex protocol defined by RFC 6455. The browser automatically frames messages into discrete frames with masking keys.

---

### Q28: How do the Desktop Client (Tkinter) and Web Client (Browser) chat with each other?
**Answer:** Through the Central TCP Server:
1. The Desktop Client connects directly to `127.0.0.1:5000` via raw TCP socket.
2. The Web Gateway connects to `127.0.0.1:5000` via raw TCP socket for each browser user.
3. Both connections are registered in the server's central `self.clients` registry.
4. When either client sends a message, the server broadcasts it across all TCP sockets. The Gateway receives it on its TCP socket and immediately emits it over WebSocket to the browser. Both clients see each other in the exact same room!

---

### Q29: How does file transfer work on the Web Client compared to the Desktop Client?
**Answer:**
- On the **Web Client**, the browser uploads the file via an HTTP multipart `POST /api/upload` endpoint. The Flask backend validates file size, sanitizes the filename, computes the SHA-256 hash, and saves it. The Gateway then sends a framed `FILE_OFFER` over TCP so all peers (web and desktop) receive the invitation. When accepted, the recipient downloads it via `GET /api/download/<transfer_id>`.
- On the **Desktop Client**, files are streamed in 64 KB binary chunks directly through the secondary TCP File Relay port (Port 5001).

---

### Q30: How is round-trip latency measured in the Web Interface?
**Answer:** The browser emits a `ping_measure` event containing its client timestamp (`Date.now()`). The Flask server immediately echoes back a `pong_measure` response. The client subtracts the sent timestamp from the current time:
$$\text{Latency} = \text{Date.now()} - \text{client\_timestamp}$$
This real-time latency is displayed in milliseconds on the diagnostics badge and telemetry panel.

