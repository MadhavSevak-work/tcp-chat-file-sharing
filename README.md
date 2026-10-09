# TCP-Based Multi-Client Chat and File Sharing System

[![Python Version](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()
[![Build Status](https://img.shields.io/badge/Tests-16%20Passed%20(100%25)-brightgreen.svg)]()

> A robust, software-only desktop application demonstrating real-world TCP/IP socket programming, multithreading, byte-stream message framing, and chunked binary file transfer with SHA-256 integrity verification.

Developed as a major college project for the **Computer Networks (CN)** curriculum.

---

## 📸 Overview & Key Features

* **Centralized Client-Server Architecture:** Central server managing concurrent TCP client connections with thread-safe client registry.
* **Reliable TCP Message Framing:** Eliminates TCP packet coalescing and fragmentation using strict 4-byte big-endian length-prefixed headers (`!I`).
* **Real-Time Group & Private Messaging:** Public group chat broadcast plus targeted direct messaging (whispers) between online users.
* **Dedicated File Relay System (Port 5001):** Decouples heavy file streaming from chat messaging, completely avoiding Head-of-Line (HoL) blocking.
* **Chunked Binary File Transfer:** Streams files in 64 KB chunks, supporting files up to 100 MB without high memory consumption.
* **Cryptographic Data Integrity:** Pre-computes and verifies **SHA-256 checksums** for 100% corruption-free file delivery.
* **Live Transfer Progress:** Real-time progress bars showing percentage, bytes transferred, and cancellation support.
* **Defensive Security & Validation:** Input regex validation, case-insensitive duplicate username rejection, and path traversal protection (`sanitize_filename`).
* **Modern Dark-Themed Desktop UI:** Beautiful charcoal theme built with pure Python `tkinter` and `ttk`. Completely non-blocking UI powered by background worker threads and thread-safe queues.
* **Zero External Dependencies:** Built 100% using the Python Standard Library. Runs out-of-the-box without `pip install` requirements!

---

## 📁 Project Structure

```
cn_project/
├── run_server.py                # Server launcher script (TCP Sockets)
├── run_client.py                # Desktop Client GUI launcher script (Tkinter)
├── run_demo_3clients.py         # Instant 3-client presentation launcher (Alice, Bob, Charlie)
├── run_web.py                   # NEW: Web Gateway launcher script (Flask-SocketIO on Port 5050)
├── requirements.txt             # Dependencies documentation
├── .gitignore                   # Git hygiene and exclusion rules
│
├── shared/                      # Shared networking & protocol module
│   ├── __init__.py
│   ├── constants.py             # Port defaults, buffer sizes, protocol codes
│   └── protocol.py              # Framing, send/recv_exact, validation, SHA-256
│
├── server/                      # Server subsystem (Layer 4 TCP)
│   ├── __init__.py
│   ├── main.py                  # Server CLI argument parsing and entry point
│   ├── logger.py                # Thread-safe logging to console & logs/server.log
│   ├── server_core.py           # Client registry, broadcast & private routing
│   ├── client_handler.py        # Dedicated client socket worker thread
│   └── file_transfer.py         # Dedicated File Relay server (Port 5001)
│
├── client/                      # Desktop Client subsystem (Tkinter/ttk)
│   ├── __init__.py
│   ├── main.py                  # GUI entry point
│   ├── network.py               # Background TCP connection manager & queue
│   ├── file_transfer.py         # Chunked upload/download worker with SHA-256
│   ├── dialogs.py               # Custom modal dialogs (Offer, Accept, Send)
│   ├── ui.py                    # Tkinter/ttk dark theme desktop interface
│   └── terminal_client.py       # Headless CLI client for terminal testing
│
├── web_app/                     # NEW: Modern Web Application & Gateway
│   ├── __init__.py
│   ├── app.py                   # Flask server, WebSocket routes, secure file endpoints
│   ├── gateway.py               # Web-to-TCP Protocol Gateway (translates WebSockets <-> TCP sockets)
│   ├── uploads/                 # Uploaded file transfer store
│   ├── templates/
│   │   └── index.html           # Single-page modern dark-theme dashboard
│   └── static/
│       ├── css/style.css        # Responsive dark-theme styling
│       └── js/app.js            # Client-side Socket.IO controller & diagnostics
│
├── tests/                       # Automated test suite (20 Tests - 100% Pass)
│   ├── test_protocol.py         # Framing, coalescing, and validation tests
│   ├── test_file_transfer.py    # Chunking, hash checks, and sanitization
│   ├── test_server_integration.py # Multi-client live socket integration tests
│   ├── test_reliability.py      # Malformed inputs, hard resets, shutdown tests
│   └── test_web_app.py          # NEW: Flask web endpoints & file transfer tests
│
└── docs/                        # Complete University Documentation Package
    ├── architecture.md          # Architecture diagrams & concurrency analysis
    ├── protocol.md              # Application wire protocol specifications
    ├── test_cases.md            # Test matrix and manual verification steps
    ├── viva_questions.md        # 25 Viva Q&A with simple CN explanations
    └── project_report.md        # Complete 20-section academic project report
```

---

## 🚀 Quickstart Guide

### Prerequisites
- Python 3.8 or higher installed on your computer.
- Standard installation includes Tkinter. (No third-party packages needed!)

---

## 🧪 Demonstration Modes

### Mode A: Single-Computer Demonstration (Localhost)

1. **Start the TCP Server:**
   Open a terminal in the project directory and run:
   ```bash
   python run_server.py
   ```
   *The server starts listening on `127.0.0.1:5000` (Chat) and `127.0.0.1:5001` (File Relay).*

2. **Launch 3 Client Instances Instantly:**
   Open a second terminal and run:
   ```bash
   python run_demo_3clients.py
   ```
   *This automatically opens 3 separate client windows prefilled with usernames **Alice**, **Bob**, and **Charlie**.*

3. **Interact:**
   - Click **⚡ Connect** on each window.
   - Send public messages from Alice — Bob and Charlie receive them instantly.
   - Double-click on "Bob" in Alice's user list to switch to **Private Chat** mode.
   - Click **📎 File** to send a file to Bob. Bob will see a popup with file metadata, choose a save folder, and click **Accept & Save**. Both users will see live progress bars and a SHA-256 verification confirmation!

---

### Mode B: Local Wi-Fi Network Demonstration (2+ Computers)

To run the chat and file-sharing system across separate computers connected to the same Wi-Fi router or mobile hotspot:

#### 1. On the Server Computer:
1. Open PowerShell / Command Prompt and find your local IPv4 address:
   ```powershell
   ipconfig
   ```
   *Look for `IPv4 Address` under your active Wi-Fi adapter (e.g., `192.168.1.45`).*

2. Start the server bound to all network interfaces (`0.0.0.0`):
   ```bash
   python run_server.py --host 0.0.0.0 --port 5000 --file-port 5001
   ```

3. **Allow Windows Firewall (if prompted):**
   - When Windows Defender Firewall prompts, check both **Private** and **Public** networks and click **Allow access**.
   - Or run in administrator PowerShell:
     ```powershell
     netsh advfirewall firewall add rule name="TCP Chat Server" dir=in action=allow protocol=TCP localport=5000,5001
     ```

#### 2. On the Client Computer(s):
1. Launch the client application:
   ```bash
   python run_client.py
   ```
2. In the top bar, enter:
   - **Host IP:** The server computer's IPv4 address (e.g., `192.168.1.45`)
   - **Port:** `5000`
   - **Username:** A unique nickname (e.g., `LabStudent2`)
3. Click **⚡ Connect**. You can now exchange real-time messages and transfer files across physical computers over the air!

---

### Mode C: Modern Web Browser Demonstration (WebSockets & HTTP Gateway)

Run both the TCP server and the modern web application to chat through any web browser:

1. **Start the TCP Server:**
   ```bash
   python run_server.py
   ```

2. **Start the Web Gateway:**
   In another terminal, run:
   ```bash
   python run_web.py --port 5050
   ```

3. **Open the Website in your Browser:**
   Navigate to **`http://localhost:5050`** (or `http://<your-wifi-ip>:5050` from mobile or other laptops).
   - Enter a username (e.g., `WebAlice`) and click **Connect to Network**.
   - Enjoy the dark-theme dashboard, real-time chat, private messaging, and file sharing with live SHA-256 validation!
   - Click **📊 Diagnostics** to inspect live ping latency, WebSocket transport status, and connection telemetry.

4. **Cross-Client Demonstration (Desktop + Web):**
   - Open a desktop client window (`python run_client.py --username DesktopBob`).
   - Open a browser window (`http://localhost:5050` as `WebAlice`).
   - Send messages between `DesktopBob` and `WebAlice` — both receive messages in real time in the exact same chat room!

---

## 🧪 Running Automated Tests

Run all 16 automated tests from the root directory:

```bash
python -m unittest discover tests -v
```

### Test Coverage Highlights:
- **`test_protocol.py`:** Loopback framing, 3 back-to-back coalesced messages de-framing, unicode/emojis, username regex validation, and directory traversal sanitization.
- **`test_file_transfer.py`:** Incremental SHA-256 hashing, path character cleaning, and max size constraints.
- **`test_server_integration.py`:** Case-insensitive duplicate username rejection, multi-client group broadcasts, isolated private whispers, and full 256 KB binary transfer through File Relay with SHA-256 hash validation.
- **`test_reliability.py`:** Malformed JSON stream resilience, abrupt client TCP resets (RST), and graceful server shutdown notifications.

---

## 📚 College Project Documentation & Viva Preparation

Comprehensive academic documentation is located in the [`docs/`](file:///e:/antigravity%20projects/cn_project/docs) directory:
- [Architecture & Sequence Diagrams](file:///e:/antigravity%20projects/cn_project/docs/architecture.md)
- [Application Wire Protocol Specification](file:///e:/antigravity%20projects/cn_project/docs/protocol.md)
- [Test Cases & Results Matrix](file:///e:/antigravity%20projects/cn_project/docs/test_cases.md)
- [25 Viva Questions & Answers](file:///e:/antigravity%20projects/cn_project/docs/viva_questions.md)
- [Complete 20-Section Academic Project Report](file:///e:/antigravity%20projects/cn_project/docs/project_report.md)

---

## 🛠️ Git Repository Setup Instructions

To initialize Git and create your first commit locally:

```bash
# 1. Initialize git repository
git init

# 2. Add all files (respecting .gitignore)
git add .

# 3. Create your first commit
git commit -m "Initial commit: TCP Multi-Client Chat and File Sharing System"
```

*(Note: Never publish or push to remote repositories without team and mentor consent).*

---

## 👥 Authors & Team Contributions
Developed by a team of 5 Computer Science & Engineering students for the **Computer Networks (CN)** curriculum:
* Socket Programming & Protocol Architecture
* Multithreaded Concurrency & Server Core
* Desktop GUI & Event Decoupling (Tkinter/ttk)
* File Relay Streaming & Cryptographic Checksum Engine
* Testing, Quality Assurance & Academic Documentation
