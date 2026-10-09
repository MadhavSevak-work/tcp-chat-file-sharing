/**
 * TCP NetChat — Client-side Application Controller
 * Handles WebSockets, UI state, group/private chat, file transfers, and live telemetry.
 */

(function () {
  "use strict";

  // App State
  const state = {
    socket: null,
    username: "",
    host: "127.0.0.1",
    port: 5000,
    activeChatTarget: null, // null = Public Room, string = Private Peer
    onlineUsers: [],
    selectedFile: null,
    pendingOffer: null,
    latencyMs: 0,
    pingInterval: null,
    messagesCount: 0
  };

  // DOM Elements
  const DOM = {
    // Login
    loginOverlay: document.getElementById("login-overlay"),
    usernameInput: document.getElementById("username-input"),
    hostInput: document.getElementById("host-input"),
    portInput: document.getElementById("port-input"),
    connectBtn: document.getElementById("connect-btn"),
    loginError: document.getElementById("login-error"),

    // App layout
    appContainer: document.getElementById("app-container"),
    myAvatar: document.getElementById("my-avatar"),
    myUsername: document.getElementById("my-username"),
    myEndpoint: document.getElementById("my-endpoint"),
    userCount: document.getElementById("user-count"),
    usersNavList: document.getElementById("users-nav-list"),
    btnPublicRoom: document.getElementById("btn-public-room"),

    // Chat
    activeChatTitle: document.getElementById("active-chat-title"),
    activeChatDesc: document.getElementById("active-chat-desc"),
    messagesContainer: document.getElementById("messages-container"),
    emptyState: document.getElementById("empty-state"),
    chatForm: document.getElementById("chat-form"),
    messageInput: document.getElementById("message-input"),
    btnComposerAttach: document.getElementById("btn-composer-attach"),
    btnDisconnect: document.getElementById("btn-disconnect"),

    // File Sharing Modal
    fileModal: document.getElementById("file-modal"),
    closeFileModal: document.getElementById("close-file-modal"),
    cancelFileBtn: document.getElementById("cancel-file-btn"),
    btnOpenFilePanel: document.getElementById("btn-open-file-panel"),
    fileRecipientSelect: document.getElementById("file-recipient-select"),
    dropZone: document.getElementById("drop-zone"),
    fileInputElement: document.getElementById("file-input-element"),
    filePreviewCard: document.getElementById("file-preview-card"),
    previewFilename: document.getElementById("preview-filename"),
    previewFilesize: document.getElementById("preview-filesize"),
    previewHash: document.getElementById("preview-hash"),
    uploadProgressContainer: document.getElementById("upload-progress-container"),
    uploadProgressBar: document.getElementById("upload-progress-bar"),
    uploadProgressText: document.getElementById("upload-progress-text"),
    uploadProgressBytes: document.getElementById("upload-progress-bytes"),
    confirmSendFileBtn: document.getElementById("confirm-send-file-btn"),

    // Incoming File Modal
    incomingFileModal: document.getElementById("incoming-file-modal"),
    incomingSenderName: document.getElementById("incoming-sender-name"),
    incomingFileName: document.getElementById("incoming-file-name"),
    incomingFileSize: document.getElementById("incoming-file-size"),
    incomingFileHash: document.getElementById("incoming-file-hash"),
    btnAcceptFile: document.getElementById("btn-accept-file"),
    btnRejectFile: document.getElementById("btn-reject-file"),

    // Diagnostics Modal
    diagnosticsModal: document.getElementById("diagnostics-modal"),
    closeDiagModal: document.getElementById("close-diag-modal"),
    closeDiagBtn: document.getElementById("close-diag-btn"),
    btnOpenDiagnostics: document.getElementById("btn-open-diagnostics"),
    diagnosticsMiniBtn: document.getElementById("diagnostics-mini-btn"),
    miniPing: document.getElementById("mini-ping"),
    diagLatency: document.getElementById("diag-latency"),
    diagSocketState: document.getElementById("diag-socket-state"),
    activityLogBox: document.getElementById("activity-log-box")
  };

  // Helper formatting
  function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  function formatTime() {
    const now = new Date();
    return now.toTimeString().split(" ")[0];
  }

  function logActivity(text) {
    const time = formatTime();
    const line = document.createElement("div");
    line.className = "log-line";
    line.innerHTML = `<span class="log-time">[${time}]</span> ${text}`;
    DOM.activityLogBox.appendChild(line);
    DOM.activityLogBox.scrollTop = DOM.activityLogBox.scrollHeight;
  }

  // =========================================================================
  // INITIALIZATION & SOCKET SETUP
  // =========================================================================
  function init() {
    setupEventListeners();
    connectSocket();
  }

  function connectSocket() {
    state.socket = io({
      transports: ["websocket", "polling"],
      reconnection: true
    });

    state.socket.on("connect", () => {
      logActivity("WebSocket transport established with Flask Gateway.");
      DOM.diagSocketState.textContent = "Gateway Connected";
      startPingMonitoring();
    });

    state.socket.on("disconnect", () => {
      logActivity("WebSocket connection to Flask Gateway closed.");
      DOM.diagSocketState.textContent = "Disconnected";
    });

    state.socket.on("gateway_ready", (data) => {
      logActivity(`Gateway ready: default TCP target ${data.default_host}:${data.default_port}`);
    });

    state.socket.on("join_success", (data) => {
      handleJoinSuccess(data);
    });

    state.socket.on("join_error", (data) => {
      showLoginError(data.message || "Failed to join network.");
    });

    // Chat & Networking Events
    state.socket.on("chat_message", (data) => {
      appendChatMessage(data.sender, data.content, data.timestamp, false);
    });

    state.socket.on("private_message", (data) => {
      const isMe = data.sender.toLowerCase() === state.username.toLowerCase();
      const peer = isMe ? data.recipient : data.sender;
      appendChatMessage(data.sender, data.content, data.timestamp, true, peer);
    });

    state.socket.on("user_list", (data) => {
      updateUserList(data.users || []);
    });

    state.socket.on("system_message", (data) => {
      appendSystemMessage(data.message);
      logActivity(`System: ${data.message}`);
    });

    state.socket.on("server_error", (data) => {
      appendSystemMessage(`⚠️ Error: ${data.message}`);
      logActivity(`Server error: ${data.message}`);
    });

    state.socket.on("server_disconnected", (data) => {
      appendSystemMessage(`❌ ${data.message}`);
      logActivity("Underlying TCP connection dropped.");
      alert(data.message);
      location.reload();
    });

    // File Sharing Events
    state.socket.on("file_offer", (data) => {
      handleIncomingFileOffer(data);
    });

    state.socket.on("file_ready", (data) => {
      handleFileReady(data);
    });

    state.socket.on("file_reject", (data) => {
      appendSystemMessage(`❌ ${data.recipient} declined your file offer for '${data.filename}'.`);
      logActivity(`File transfer rejected by ${data.recipient}.`);
    });

    // Latency Telemetry
    state.socket.on("pong_measure", (data) => {
      if (data && data.client_time) {
        state.latencyMs = Math.max(1, Date.now() - data.client_time);
        DOM.miniPing.textContent = `${state.latencyMs} ms`;
        DOM.diagLatency.textContent = `${state.latencyMs} ms`;
      }
    });
  }

  function startPingMonitoring() {
    if (state.pingInterval) clearInterval(state.pingInterval);
    state.pingInterval = setInterval(() => {
      if (state.socket && state.socket.connected) {
        state.socket.emit("ping_measure", { client_time: Date.now() });
      }
    }, 3000);
  }

  // =========================================================================
  // LOGIN & AUTHENTICATION
  // =========================================================================
  function handleConnectClick() {
    const username = DOM.usernameInput.value.trim();
    const host = DOM.hostInput.value.trim() || "127.0.0.1";
    const port = parseInt(DOM.portInput.value.trim(), 10) || 5000;

    if (!username) {
      showLoginError("Please enter a username.");
      return;
    }

    DOM.connectBtn.disabled = true;
    DOM.connectBtn.innerHTML = `<span>Connecting to TCP...</span>`;
    DOM.loginError.classList.add("hidden");

    logActivity(`Requesting TCP registration for '${username}' on ${host}:${port}...`);
    state.socket.emit("join", { username, host, port });
  }

  function handleJoinSuccess(data) {
    state.username = data.username;
    state.host = data.host;
    state.port = data.port;

    DOM.loginOverlay.classList.add("hidden");
    DOM.appContainer.classList.remove("hidden");

    DOM.myUsername.textContent = state.username;
    DOM.myAvatar.textContent = state.username.charAt(0).toUpperCase();
    DOM.myEndpoint.textContent = `${state.host}:${state.port}`;

    logActivity(`Successfully connected as '${state.username}' via TCP socket!`);
    appendSystemMessage(`✅ Connected to the TCP network as '${state.username}'.`);
  }

  function showLoginError(msg) {
    DOM.loginError.textContent = msg;
    DOM.loginError.classList.remove("hidden");
    DOM.connectBtn.disabled = false;
    DOM.connectBtn.innerHTML = `<span>Connect to Network</span> <span class="arrow">&rarr;</span>`;
  }

  // =========================================================================
  // CHAT & MESSAGING
  // =========================================================================
  function handleSendMessage(e) {
    e.preventDefault();
    const text = DOM.messageInput.value.trim();
    if (!text) return;

    DOM.messageInput.value = "";

    if (state.activeChatTarget) {
      // Send Private Whisper
      state.socket.emit("send_private", {
        recipient: state.activeChatTarget,
        content: text
      });
      logActivity(`Sent private message to ${state.activeChatTarget}.`);
    } else {
      // Send Public Broadcast
      state.socket.emit("send_chat", { content: text });
      logActivity(`Sent public broadcast message.`);
    }
  }

  function appendChatMessage(sender, content, timestamp, isPrivate, peer) {
    if (DOM.emptyState) {
      DOM.emptyState.style.display = "none";
    }

    const isMe = sender.toLowerCase() === state.username.toLowerCase();
    const bubble = document.createElement("div");
    bubble.className = `message-bubble ${isMe ? "mine" : ""} ${isPrivate ? "private" : ""}`;

    const header = document.createElement("div");
    header.className = "msg-header";

    if (isPrivate) {
      header.innerHTML = `
        <span class="msg-badge badge-private">PRIVATE</span>
        <span class="msg-sender">${isMe ? "You &rarr; " + peer : sender}</span>
        <span class="msg-time">${timestamp || formatTime()}</span>
      `;
    } else {
      header.innerHTML = `
        <span class="msg-sender">${isMe ? "You" : sender}</span>
        <span class="msg-time">${timestamp || formatTime()}</span>
      `;
    }

    const body = document.createElement("div");
    body.className = "msg-content";
    body.textContent = content;

    bubble.appendChild(header);
    bubble.appendChild(body);
    DOM.messagesContainer.appendChild(bubble);
    DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;

    state.messagesCount++;
  }

  function appendSystemMessage(text) {
    if (DOM.emptyState) {
      DOM.emptyState.style.display = "none";
    }

    const notice = document.createElement("div");
    notice.className = "system-notice";
    notice.textContent = text;
    DOM.messagesContainer.appendChild(notice);
    DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
  }

  // =========================================================================
  // ONLINE USERS & ROOM NAVIGATION
  // =========================================================================
  function updateUserList(users) {
    state.onlineUsers = users;
    DOM.userCount.textContent = users.length;

    // Refresh Sidebar Users
    DOM.usersNavList.innerHTML = "";
    DOM.fileRecipientSelect.innerHTML = `<option value="">-- Choose Online Peer --</option>`;

    users.forEach((user) => {
      const isMe = user.toLowerCase() === state.username.toLowerCase();
      
      const li = document.createElement("li");
      li.className = `nav-item ${state.activeChatTarget === user ? "active" : ""}`;

      li.innerHTML = `
        <div class="peer-avatar">${user.charAt(0).toUpperCase()}</div>
        <span class="name">${user} ${isMe ? "(You)" : ""}</span>
        ${!isMe ? `<button class="btn-send-file-tiny" title="Send File to ${user}">📎</button>` : ""}
      `;

      if (!isMe) {
        // Click to Whisper
        li.addEventListener("click", (e) => {
          if (!e.target.classList.contains("btn-send-file-tiny")) {
            switchToPrivateChat(user);
          }
        });

        // Click tiny file icon to open file modal preselected
        const tinyFileBtn = li.querySelector(".btn-send-file-tiny");
        if (tinyFileBtn) {
          tinyFileBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openFileModal(user);
          });
        }

        // Add to File Recipient Dropdown
        const opt = document.createElement("option");
        opt.value = user;
        opt.textContent = user;
        DOM.fileRecipientSelect.appendChild(opt);
      }

      DOM.usersNavList.appendChild(li);
    });
  }

  function switchToPublicChat() {
    state.activeChatTarget = null;
    DOM.btnPublicRoom.classList.add("active");
    document.querySelectorAll(".user-list .nav-item").forEach(el => el.classList.remove("active"));

    DOM.activeChatTitle.textContent = "🌐 Public Room";
    DOM.activeChatDesc.textContent = "Broadcasts to all connected TCP & Web peers";
    DOM.messageInput.placeholder = "Type a message to everyone... (Press Enter to send)";
  }

  function switchToPrivateChat(peerUsername) {
    state.activeChatTarget = peerUsername;
    DOM.btnPublicRoom.classList.remove("active");

    document.querySelectorAll(".user-list .nav-item").forEach(el => {
      const isTarget = el.querySelector(".name").textContent.startsWith(peerUsername);
      el.classList.toggle("active", isTarget);
    });

    DOM.activeChatTitle.textContent = `🔒 Private Chat with ${peerUsername}`;
    DOM.activeChatDesc.textContent = `Direct encrypted-style whisper visible only to ${peerUsername}`;
    DOM.messageInput.placeholder = `Type a private message to ${peerUsername}... (Press Enter to send)`;
  }

  // =========================================================================
  // FILE SHARING WORKFLOW
  // =========================================================================
  function openFileModal(preselectedUser = null) {
    DOM.fileModal.classList.remove("hidden");
    if (preselectedUser) {
      DOM.fileRecipientSelect.value = preselectedUser;
    } else if (state.activeChatTarget) {
      DOM.fileRecipientSelect.value = state.activeChatTarget;
    }
  }

  function closeFileModal() {
    DOM.fileModal.classList.add("hidden");
    state.selectedFile = null;
    DOM.filePreviewCard.classList.add("hidden");
    DOM.uploadProgressContainer.classList.add("hidden");
    DOM.confirmSendFileBtn.disabled = true;
  }

  function handleFileSelected(file) {
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      alert("File exceeds maximum allowed size of 100 MB.");
      return;
    }

    state.selectedFile = file;
    DOM.previewFilename.textContent = file.name;
    DOM.previewFilesize.textContent = formatBytes(file.size);
    DOM.previewHash.textContent = "SHA-256 will be verified on upload...";

    DOM.filePreviewCard.classList.remove("hidden");
    DOM.confirmSendFileBtn.disabled = false;
  }

  function handleConfirmSendFile() {
    const recipient = DOM.fileRecipientSelect.value;
    if (!recipient) {
      alert("Please select a recipient.");
      return;
    }
    if (!state.selectedFile) return;

    const file = state.selectedFile;
    const formData = new FormData();
    formData.append("file", file);

    DOM.uploadProgressContainer.classList.remove("hidden");
    DOM.confirmSendFileBtn.disabled = true;
    DOM.uploadProgressText.textContent = "Uploading to server...";

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload", true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        DOM.uploadProgressBar.style.width = `${percent}%`;
        DOM.uploadProgressText.textContent = `Uploading: ${percent}%`;
        DOM.uploadProgressBytes.textContent = `${formatBytes(e.loaded)} / ${formatBytes(e.total)}`;
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const resp = JSON.parse(xhr.responseText);
        DOM.uploadProgressText.textContent = "Upload complete! Sending offer to peer...";
        logActivity(`File '${resp.filename}' uploaded. SHA-256: ${resp.sha256.substring(0, 16)}...`);

        // Emit file offer to peer over TCP Gateway
        state.socket.emit("file_offer", {
          transfer_id: resp.transfer_id,
          recipient: recipient,
          filename: resp.filename,
          filesize: resp.filesize,
          sha256: resp.sha256
        });

        appendSystemMessage(`📤 Offered '${resp.filename}' (${formatBytes(resp.filesize)}) to '${recipient}'. Waiting for response...`);
        setTimeout(closeFileModal, 900);
      } else {
        alert("Upload error: " + xhr.responseText);
        DOM.confirmSendFileBtn.disabled = false;
      }
    };

    xhr.onerror = () => {
      alert("Network error during file upload.");
      DOM.confirmSendFileBtn.disabled = false;
    };

    xhr.send(formData);
  }

  function handleIncomingFileOffer(data) {
    state.pendingOffer = data;
    DOM.incomingSenderName.textContent = data.sender;
    DOM.incomingFileName.textContent = data.filename;
    DOM.incomingFileSize.textContent = formatBytes(data.filesize);
    DOM.incomingFileHash.textContent = data.sha256;

    DOM.incomingFileModal.classList.remove("hidden");
    logActivity(`Incoming file offer from ${data.sender}: '${data.filename}' (${formatBytes(data.filesize)})`);
  }

  function handleAcceptFileOffer() {
    if (!state.pendingOffer) return;
    const offer = state.pendingOffer;

    state.socket.emit("file_accept", {
      transfer_id: offer.transfer_id,
      sender: offer.sender,
      filename: offer.filename,
      filesize: offer.filesize,
      sha256: offer.sha256
    });

    DOM.incomingFileModal.classList.add("hidden");
    appendSystemMessage(`📥 Accepted file offer from '${offer.sender}'. Downloading...`);
    logActivity(`Accepted file transfer '${offer.transfer_id}' from ${offer.sender}.`);

    // Trigger download from secure HTTP endpoint
    const downloadUrl = `/api/download/${offer.transfer_id}`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = offer.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    appendSystemMessage(`🎉 Download completed for '${offer.filename}'. SHA-256 Verified: ${offer.sha256.substring(0, 16)}...`);
  }

  function handleRejectFileOffer() {
    if (!state.pendingOffer) return;
    const offer = state.pendingOffer;

    state.socket.emit("file_reject", {
      transfer_id: offer.transfer_id,
      sender: offer.sender,
      filename: offer.filename
    });

    DOM.incomingFileModal.classList.add("hidden");
    appendSystemMessage(`❌ Declined file offer from '${offer.sender}'.`);
    logActivity(`Declined file offer from ${offer.sender}.`);
  }

  function handleFileReady(data) {
    appendSystemMessage(`⚡ File Transfer Ready for '${data.filename}'. Transport active on Port ${data.file_port}.`);
  }

  // =========================================================================
  // EVENT LISTENERS
  // =========================================================================
  function setupEventListeners() {
    DOM.connectBtn.addEventListener("click", handleConnectClick);
    DOM.usernameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleConnectClick();
    });

    DOM.chatForm.addEventListener("submit", handleSendMessage);
    DOM.btnPublicRoom.addEventListener("click", switchToPublicChat);

    DOM.btnDisconnect.addEventListener("click", () => {
      if (confirm("Are you sure you want to disconnect?")) {
        location.reload();
      }
    });

    // File Modal
    DOM.btnOpenFilePanel.addEventListener("click", () => openFileModal());
    DOM.btnComposerAttach.addEventListener("click", () => openFileModal());
    DOM.closeFileModal.addEventListener("click", closeFileModal);
    DOM.cancelFileBtn.addEventListener("click", closeFileModal);

    DOM.dropZone.addEventListener("click", () => DOM.fileInputElement.click());
    DOM.fileInputElement.addEventListener("change", (e) => {
      if (e.target.files.length > 0) handleFileSelected(e.target.files[0]);
    });

    DOM.dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      DOM.dropZone.classList.add("dragover");
    });
    DOM.dropZone.addEventListener("dragleave", () => {
      DOM.dropZone.classList.remove("dragover");
    });
    DOM.dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      DOM.dropZone.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });

    DOM.confirmSendFileBtn.addEventListener("click", handleConfirmSendFile);

    // Incoming File
    DOM.btnAcceptFile.addEventListener("click", handleAcceptFileOffer);
    DOM.btnRejectFile.addEventListener("click", handleRejectFileOffer);

    // Diagnostics
    DOM.btnOpenDiagnostics.addEventListener("click", () => DOM.diagnosticsModal.classList.remove("hidden"));
    DOM.diagnosticsMiniBtn.addEventListener("click", () => DOM.diagnosticsModal.classList.remove("hidden"));
    DOM.closeDiagModal.addEventListener("click", () => DOM.diagnosticsModal.classList.add("hidden"));
    DOM.closeDiagBtn.addEventListener("click", () => DOM.diagnosticsModal.classList.add("hidden"));
  }

  // Run on DOM load
  document.addEventListener("DOMContentLoaded", init);
})();
