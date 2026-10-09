# Test Cases and Verification Results

**Project Title:** TCP-Based Multi-Client Chat and File Sharing System  
**Test Suite Coverage:** Unit Testing, Integration Testing, Reliability Testing, Manual End-to-End Testing  
**Total Automated Tests:** 16 Tests across 4 Test Suites  
**Automated Pass Rate:** 100% (16 Passed, 0 Failed, 0 Errors)  

---

## 1. Automated Test Suite Summary

Run the entire automated test suite from the project root using:
```bash
python -m unittest discover tests -v
```

### Automated Results Matrix:

| Test ID | Test Suite | Test Name | Purpose / Assertion | Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-A01** | `test_protocol.py` | `test_single_message_loopback` | Validates loopback send/recv framing | **PASS** |
| **TC-A02** | `test_protocol.py` | `test_multiple_messages_coalesced` | Tests TCP framing de-muxing of 3 batched messages | **PASS** |
| **TC-A03** | `test_protocol.py` | `test_unicode_and_special_characters` | Verifies UTF-8 multilingual & emoji encoding | **PASS** |
| **TC-A04** | `test_protocol.py` | `test_graceful_close` | Asserts EOF returns None instead of raising crash | **PASS** |
| **TC-A05** | `test_protocol.py` | `test_valid_usernames` | Tests valid alphanumeric & symbol usernames | **PASS** |
| **TC-A06** | `test_protocol.py` | `test_invalid_usernames` | Rejects reserved names, spaces, short/long names | **PASS** |
| **TC-A07** | `test_protocol.py` | `test_filename_sanitization` | Prevents directory traversal (`../../etc/passwd`) | **PASS** |
| **TC-A08** | `test_file_transfer.py` | `test_sha256_computation` | Computes incremental SHA-256 vs expected hash | **PASS** |
| **TC-A09** | `test_file_transfer.py` | `test_filename_sanitization_edge_cases` | Strips invalid Windows/POSIX path characters | **PASS** |
| **TC-A10** | `test_file_transfer.py` | `test_oversized_file_limit_constant` | Enforces 100 MB max file size limit constant | **PASS** |
| **TC-A11** | `test_server_integration.py` | `test_01_duplicate_username_rejection` | Duplicate username yields `USERNAME_TAKEN` error | **PASS** |
| **TC-A12** | `test_server_integration.py` | `test_02_group_and_private_messaging` | Broadcast to all + Private chat isolated delivery | **PASS** |
| **TC-A13** | `test_server_integration.py` | `test_03_file_transfer_relay_and_sha256` | 256 KB binary stream through relay with SHA-256 match | **PASS** |
| **TC-A14** | `test_reliability.py` | `test_malformed_json_resilience` | Bad JSON bytes handled without server crash | **PASS** |
| **TC-A15** | `test_reliability.py` | `test_abrupt_disconnect_handling` | Hard socket reset (RST) cleans up registry | **PASS** |
| **TC-A16** | `test_reliability.py` | `test_graceful_server_shutdown_notification` | Server stop emits `SERVER_SHUTDOWN` event | **PASS** |

---

## 2. Manual Integration Test Cases

### TC-M01: Single-Computer Multi-Client Setup
- **Precondition:** Server running via `python run_server.py`.
- **Steps:**
  1. Launch three client instances using `python run_demo_3clients.py` (Alice, Bob, Charlie).
  2. Click **Connect** on Alice, Bob, and Charlie.
- **Expected Result:**
  - Status indicator turns green on all 3 clients: `● Online (Alice)`, `● Online (Bob)`, `● Online (Charlie)`.
  - All 3 client windows display updated online lists showing `Online Users (3)`.
  - Server logs confirm: `User 'Alice' connected`, `User 'Bob' connected`, `User 'Charlie' connected`.
- **Actual Result:** Verified and working as expected.

### TC-M02: Group Chat Broadcast
- **Precondition:** Alice, Bob, and Charlie connected.
- **Steps:**
  1. Alice types "Good morning team!" and presses Enter.
- **Expected Result:**
  - Alice sees: `[HH:MM:SS] You: Good morning team!`.
  - Bob sees: `[HH:MM:SS] Alice: Good morning team!`.
  - Charlie sees: `[HH:MM:SS] Alice: Good morning team!`.
- **Actual Result:** Verified and working as expected.

### TC-M03: Direct Private Messaging
- **Precondition:** Alice, Bob, and Charlie connected.
- **Steps:**
  1. In Alice's window, double-click on "Bob" in the online user list.
  2. Notice the chat header changes to `🔒 Private Chat with Bob`.
  3. Alice sends "Meet me after class."
- **Expected Result:**
  - Alice sees: `[HH:MM:SS] [PRIVATE] You -> Bob: Meet me after class.`.
  - Bob sees: `[HH:MM:SS] [PRIVATE] Alice (whisper): Meet me after class.`.
  - Charlie's screen displays **nothing**.
- **Actual Result:** Verified and working as expected.

### TC-M04: File Sharing with SHA-256 Verification
- **Precondition:** Alice and Bob connected.
- **Steps:**
  1. Alice clicks **📎 File** (or "Send File to User").
  2. Selects Bob as recipient.
  3. Browses for a sample file (e.g., `project_report.pdf`, 1.2 MB).
  4. Clicks **📤 Send Offer**.
  5. Bob receives an `Incoming File Transfer Request` popup showing filename, size, and SHA-256 checksum.
  6. Bob clicks **Accept & Save**, picking a destination folder.
- **Expected Result:**
  - Progress bar on both Alice and Bob advances smoothly in real time (`0% -> 100%`).
  - At 100%, Bob's client incrementally recalculates SHA-256 on the received bytes.
  - Checksum matches: popup appears stating `File received successfully! SHA-256 Checksum Verified`.
  - File is saved in destination folder with correct size and content.
- **Actual Result:** Verified and working as expected.

### TC-M05: Declined File Transfer
- **Precondition:** Alice and Bob connected.
- **Steps:**
  1. Alice offers a file to Bob.
  2. Bob clicks **Decline**.
- **Expected Result:**
  - Alice receives a system notification: `❌ User 'Bob' rejected your file offer for 'filename'`.
  - Alice's file transfer panel resets to `Offer Rejected`.
- **Actual Result:** Verified and working as expected.

### TC-M06: Duplicate Username Collision
- **Precondition:** Alice is connected.
- **Steps:**
  1. A new client attempts to connect with the username "alice" (case-insensitive test).
- **Expected Result:**
  - Connection is rejected.
  - Dialog appears: `Username 'alice' is already in use by an active client.`
  - The existing Alice remains connected with no interruption.
- **Actual Result:** Verified and working as expected.

### TC-M07: Client Disconnection & Presence Update
- **Precondition:** Alice, Bob, and Charlie connected.
- **Steps:**
  1. Charlie clicks **Disconnect** or closes window.
- **Expected Result:**
  - Server logs Charlie's departure.
  - Alice and Bob receive: `👋 'Charlie' has left the room.`.
  - Online user counter on Alice and Bob decrements to `Online Users (2)`.
  - Charlie is removed from the user lists on both active clients.
- **Actual Result:** Verified and working as expected.

### TC-M08: Server Shutdown with Connected Clients
- **Precondition:** Alice and Bob connected.
- **Steps:**
  1. Server is stopped via Ctrl+C.
- **Expected Result:**
  - Server sends graceful shutdown broadcast: `⚠️ The server is shutting down. Connection will be terminated.`.
  - Clients receive the message, turn status pill to `● Disconnected`, disable message controls, and enable Connect button.
  - Neither client freezes or throws unhandled exceptions.
- **Actual Result:** Verified and working as expected.
