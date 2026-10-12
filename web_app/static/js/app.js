/**
 * NetChat Live — Application Controller
 * Handles WebSockets, UI state, light/dark themes, responsive drawer/mobile navigation,
 * group/private chat, smart scrolling, file transfers, and live telemetry.
 */

(function () {
  "use strict";

  // Application State
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
    messagesCount: 0,
    theme: "dark",
    isConnected: false,
    connectionStatus: "disconnected" // "connected" | "connecting" | "disconnected"
  };

  // DOM Elements Cache
  const DOM = {
    // Theme toggles
    htmlRoot: document.documentElement,
    btnLoginThemeToggle: document.getElementById("btn-login-theme-toggle"),
    btnThemeToggle: document.getElementById("btn-theme-toggle"),

    // Login & Gateway
    loginOverlay: document.getElementById("login-overlay"),
    usernameInput: document.getElementById("username-input"),
    hostInput: document.getElementById("host-input"),
    portInput: document.getElementById("port-input"),
    connectBtn: document.getElementById("connect-btn"),
    loginError: document.getElementById("login-error"),
    gatewayDisplayName: document.getElementById("gateway-display-name"),
    gatewayDisplayEndpoint: document.getElementById("gateway-display-endpoint"),
    loginGatewayDot: document.getElementById("login-gateway-dot"),
    loginGatewayBadge: document.getElementById("login-gateway-badge"),
    btnToggleAdvanced: document.getElementById("btn-toggle-advanced"),
    advancedBody: document.getElementById("advanced-body"),
    advancedChevron: document.getElementById("advanced-chevron"),

    // App layout & Sidebar
    appContainer: document.getElementById("app-container"),
    sidebar: document.getElementById("sidebar"),
    sidebarBackdrop: document.getElementById("sidebar-backdrop"),
    sidebarCloseBtn: document.getElementById("sidebar-close-btn"),
    btnMobileMenu: document.getElementById("btn-mobile-menu"),
    sidebarStatusBadge: document.querySelector(".sidebar-brand .badge-status"),
    myAvatar: document.getElementById("my-avatar"),
    myUsername: document.getElementById("my-username"),
    myEndpoint: document.getElementById("my-endpoint"),
    userCount: document.getElementById("user-count"),
    mobileUserCount: document.getElementById("mobile-user-count"),
    usersNavList: document.getElementById("users-nav-list"),
    btnPublicRoom: document.getElementById("btn-public-room"),
    btnSidebarDisconnect: document.getElementById("btn-sidebar-disconnect"),
    btnDrawerShareFile: document.getElementById("btn-drawer-share-file"),
    btnDrawerDiagnostics: document.getElementById("btn-drawer-diagnostics"),
    btnDrawerTheme: document.getElementById("btn-drawer-theme"),
    drawerThemeLabel: document.getElementById("drawer-theme-label"),

    // Chat Header & Messages
    activeChatTitle: document.getElementById("active-chat-title"),
    activeChatDesc: document.getElementById("active-chat-desc"),
    headerChannelIcon: document.getElementById("header-channel-icon"),
    headerStatusPill: document.getElementById("header-status-pill"),
    headerStatusDot: document.getElementById("header-status-dot"),
    headerStatusText: document.getElementById("header-status-text"),
    headerLatencyText: document.getElementById("header-latency-text"),
    messagesContainer: document.getElementById("messages-container"),
    emptyState: document.getElementById("empty-state"),
    btnJumpLatest: document.getElementById("btn-jump-latest"),
    chatForm: document.getElementById("chat-form"),
    messageInput: document.getElementById("message-input"),
    btnComposerAttach: document.getElementById("btn-composer-attach"),
    btnDisconnect: document.getElementById("btn-disconnect"),

    // Mobile Bottom Tab Bar
    mobileTabBar: document.getElementById("mobile-tab-bar"),
    tabChat: document.getElementById("tab-chat"),
    tabPeers: document.getElementById("tab-peers"),
    tabShare: document.getElementById("tab-share"),
    tabDiag: document.getElementById("tab-diag"),

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

    // Diagnostics Modal & Telemetry
    diagnosticsModal: document.getElementById("diagnostics-modal"),
    closeDiagModal: document.getElementById("close-diag-modal"),
    closeDiagBtn: document.getElementById("close-diag-btn"),
    btnOpenDiagnostics: document.getElementById("btn-open-diagnostics"),
    diagnosticsMiniBtn: document.getElementById("diagnostics-mini-btn"),
    miniPing: document.getElementById("mini-ping"),
    miniTransport: document.getElementById("mini-transport"),
    miniTcpTarget: document.getElementById("mini-tcp-target"),
    diagLatency: document.getElementById("diag-latency"),
    diagTransport: document.getElementById("diag-transport"),
    diagSocketState: document.getElementById("diag-socket-state"),
    diagGatewayBadge: document.getElementById("diag-gateway-badge"),
    diagTcpHost: document.getElementById("diag-tcp-host"),
    diagFilePort: document.getElementById("diag-file-port"),
    diagGatewayHost: document.getElementById("diag-gateway-host"),
    diagPeerCount: document.getElementById("diag-peer-count"),
    activityLogBox: document.getElementById("activity-log-box"),

    // Desktop Right Panel Diagnostics
    rightPanel: document.getElementById("right-panel"),
    btnCloseRightPanel: document.getElementById("btn-close-right-panel"),
    rpStatus: document.getElementById("rp-status"),
    rpLatency: document.getElementById("rp-latency"),
    rpTransport: document.getElementById("rp-transport"),
    rpTcpHost: document.getElementById("rp-tcp-host"),
    rpFilePort: document.getElementById("rp-file-port"),
    rpPeerCount: document.getElementById("rp-peer-count"),
    rpActivityLog: document.getElementById("rp-activity-log")
  };

  // =========================================================================
  // UTILITY HELPERS
  // =========================================================================
  function escapeHtml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  const AVATAR_GRADIENTS = [
    "linear-gradient(135deg, #00A884, #005C4B)",
    "linear-gradient(135deg, #0284c7, #0369a1)",
    "linear-gradient(135deg, #059669, #047857)",
    "linear-gradient(135deg, #0d9488, #115e59)",
    "linear-gradient(135deg, #00A884, #0284c7)",
    "linear-gradient(135deg, #10b981, #059669)"
  ];

  function getAvatarGradient(name) {
    if (!name) return AVATAR_GRADIENTS[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % AVATAR_GRADIENTS.length;
    return AVATAR_GRADIENTS[idx];
  }

  function formatTime() {
    const now = new Date();
    return now.toTimeString().split(" ")[0];
  }

  function logActivity(text) {
    const time = formatTime();
    const lineHtml = `<div class="log-line"><span class="log-time">[${time}]</span> ${escapeHtml(text)}</div>`;
    if (DOM.activityLogBox) {
      DOM.activityLogBox.insertAdjacentHTML("beforeend", lineHtml);
      DOM.activityLogBox.scrollTop = DOM.activityLogBox.scrollHeight;
    }
    if (DOM.rpActivityLog) {
      DOM.rpActivityLog.insertAdjacentHTML("beforeend", lineHtml);
      DOM.rpActivityLog.scrollTop = DOM.rpActivityLog.scrollHeight;
    }
  }

  // =========================================================================
  // SINGLE SOURCE OF TRUTH: CONNECTION STATUS MANAGER
  // =========================================================================
  function setConnectionStatus(status, label) {
    state.connectionStatus = status; // "connected" | "connecting" | "disconnected"

    const isConnected = status === "connected";
    state.isConnected = isConnected;

    // Header Status Dot
    if (DOM.headerStatusDot) {
      DOM.headerStatusDot.className = "status-dot " + status;
    }

    // Header Status Text
    if (DOM.headerStatusText) {
      if (label) {
        DOM.headerStatusText.textContent = label;
      } else if (isConnected) {
        DOM.headerStatusText.textContent = "Connected";
      } else if (status === "connecting") {
        DOM.headerStatusText.textContent = "Connecting...";
      } else {
        DOM.headerStatusText.textContent = "Disconnected";
      }
    }

    // Header Latency Text
    if (DOM.headerLatencyText) {
      if (isConnected && state.latencyMs > 0) {
        DOM.headerLatencyText.textContent = `${state.latencyMs} ms`;
        DOM.headerLatencyText.classList.remove("hidden");
      } else {
        DOM.headerLatencyText.textContent = "";
        DOM.headerLatencyText.classList.add("hidden");
      }
    }

    // Right Panel Sync
    if (DOM.rpStatus) {
      DOM.rpStatus.textContent = isConnected ? "Connected" : (status === "connecting" ? "Connecting..." : "Disconnected");
      DOM.rpStatus.className = "val font-bold " + (isConnected ? "text-success" : (status === "connecting" ? "text-warning" : "text-muted"));
    }
    if (DOM.rpLatency) {
      DOM.rpLatency.textContent = (isConnected && state.latencyMs > 0) ? `${state.latencyMs} ms` : "-- ms";
    }

    // Sidebar status badge (CSS status dot + readable text)
    if (DOM.sidebarStatusBadge) {
      DOM.sidebarStatusBadge.className = "badge-status " + (isConnected ? "online" : (status === "connecting" ? "connecting" : "offline"));
      DOM.sidebarStatusBadge.innerHTML = `<span class="status-dot ${status}"></span><span class="badge-text">${isConnected ? "ONLINE" : (status === "connecting" ? "CONNECTING" : "OFFLINE")}</span>`;
    }

    // Header connection control (Unplug for disconnect, RefreshCw for reconnect)
    if (DOM.btnDisconnect) {
      if (isConnected) {
        DOM.btnDisconnect.innerHTML = `<svg class="svg-icon" aria-hidden="true"><use href="#icon-unplug"></use></svg>`;
        DOM.btnDisconnect.setAttribute("title", "Disconnect Session");
        DOM.btnDisconnect.setAttribute("aria-label", "Disconnect Session");
      } else {
        DOM.btnDisconnect.innerHTML = `<svg class="svg-icon" aria-hidden="true"><use href="#icon-refresh-cw"></use></svg>`;
        DOM.btnDisconnect.setAttribute("title", "Reconnect to Network");
        DOM.btnDisconnect.setAttribute("aria-label", "Reconnect to network");
      }
    }

    // Diagnostics modal badge
    if (DOM.diagGatewayBadge) {
      DOM.diagGatewayBadge.className = "badge " + (isConnected ? "badge-success" : "badge-secondary");
      DOM.diagGatewayBadge.textContent = isConnected ? "ACTIVE" : (status === "connecting" ? "CONNECTING" : "OFFLINE");
    }

    // Telemetry mini card values
    if (DOM.diagSocketState) {
      DOM.diagSocketState.textContent = isConnected ? "TCP Socket Active" : (status === "connecting" ? "Connecting" : "Disconnected");
    }
  }

  // =========================================================================
  // THEME MANAGEMENT (LIGHT & DARK MODE)
  // =========================================================================
  function initTheme() {
    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem("netchat_theme");
    } catch (e) {}

    if (savedTheme === "light" || savedTheme === "dark") {
      state.theme = savedTheme;
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      state.theme = "light";
    } else {
      state.theme = "dark";
    }

    applyTheme(state.theme);

    // Watch for OS preference changes if no manual preference saved
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        try {
          if (!localStorage.getItem("netchat_theme")) {
            applyTheme(e.matches ? "dark" : "light");
          }
        } catch (err) {}
      });
    }
  }

  function applyTheme(theme) {
    state.theme = theme;
    DOM.htmlRoot.setAttribute("data-theme", theme);
    
    try {
      localStorage.setItem("netchat_theme", theme);
    } catch (e) {}

    const label = theme === "light" ? "Switch to dark mode" : "Switch to light mode";
    if (DOM.btnThemeToggle) {
      DOM.btnThemeToggle.setAttribute("title", label);
      DOM.btnThemeToggle.setAttribute("aria-label", label);
    }
    if (DOM.btnLoginThemeToggle) {
      DOM.btnLoginThemeToggle.setAttribute("title", label);
      DOM.btnLoginThemeToggle.setAttribute("aria-label", label);
    }
    if (DOM.drawerThemeLabel) {
      DOM.drawerThemeLabel.textContent = theme === "light" ? "Dark Mode" : "Light Mode";
    }
  }

  function toggleTheme() {
    const nextTheme = state.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  }

  // =========================================================================
  // MOBILE NAVIGATION DRAWER & TABS
  // =========================================================================
  function openSidebar() {
    if (!DOM.sidebar) return;
    DOM.sidebar.classList.add("open");
    document.body.classList.add("drawer-open");
    if (DOM.sidebarBackdrop) {
      DOM.sidebarBackdrop.classList.remove("hidden");
      requestAnimationFrame(() => {
        DOM.sidebarBackdrop.classList.add("active");
      });
    }
    if (DOM.btnMobileMenu) {
      DOM.btnMobileMenu.setAttribute("aria-expanded", "true");
    }
  }

  function closeSidebar() {
    if (!DOM.sidebar) return;
    DOM.sidebar.classList.remove("open");
    document.body.classList.remove("drawer-open");
    if (DOM.sidebarBackdrop) {
      DOM.sidebarBackdrop.classList.remove("active");
      setTimeout(() => {
        if (!DOM.sidebar.classList.contains("open")) {
          DOM.sidebarBackdrop.classList.add("hidden");
        }
      }, 200);
    }
    if (DOM.btnMobileMenu) {
      DOM.btnMobileMenu.setAttribute("aria-expanded", "false");
    }
  }

  function setMobileActiveTab(tabName) {
    const tabs = [DOM.tabChat, DOM.tabPeers, DOM.tabShare, DOM.tabDiag];
    tabs.forEach((tab) => {
      if (tab) tab.classList.remove("active");
    });

    if (tabName === "chat" && DOM.tabChat) DOM.tabChat.classList.add("active");
    if (tabName === "peers" && DOM.tabPeers) DOM.tabPeers.classList.add("active");
    if (tabName === "share" && DOM.tabShare) DOM.tabShare.classList.add("active");
    if (tabName === "diag" && DOM.tabDiag) DOM.tabDiag.classList.add("active");
  }

  // =========================================================================
  // SMART CHAT SCROLLING
  // =========================================================================
  function isUserNearBottom() {
    if (!DOM.messagesContainer) return true;
    const threshold = 100;
    const position = DOM.messagesContainer.scrollHeight - DOM.messagesContainer.scrollTop - DOM.messagesContainer.clientHeight;
    return position <= threshold;
  }

  function scrollToBottom(smooth = false) {
    if (!DOM.messagesContainer) return;
    if (smooth) {
      DOM.messagesContainer.scrollTo({
        top: DOM.messagesContainer.scrollHeight,
        behavior: "smooth"
      });
    } else {
      DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
    }
    if (DOM.btnJumpLatest) {
      DOM.btnJumpLatest.classList.add("hidden");
    }
  }

  // =========================================================================
  // INITIALIZATION & SOCKET SETUP
  // =========================================================================
  function init() {
    initTheme();
    setConnectionStatus("disconnected", "Disconnected");

    // Detect environment host for user-facing connection banner
    const hostLabel = window.location.host || "netchat-live.onrender.com";
    if (DOM.gatewayDisplayEndpoint) {
      DOM.gatewayDisplayEndpoint.textContent = `Connected via ${hostLabel}`;
    }
    if (DOM.diagGatewayHost) {
      DOM.diagGatewayHost.textContent = hostLabel;
    }

    setupEventListeners();
    connectSocket();
  }

  function connectSocket() {
    state.socket = io({
      transports: ["websocket", "polling"],
      reconnection: true
    });

    state.socket.on("connect", () => {
      logActivity("WebSocket transport established with Gateway.");
      if (DOM.miniTransport) DOM.miniTransport.textContent = "WebSocket";
      if (DOM.diagTransport) DOM.diagTransport.textContent = "WebSocket";
      if (DOM.loginGatewayDot) DOM.loginGatewayDot.className = "status-dot connected";
      if (DOM.loginGatewayBadge) DOM.loginGatewayBadge.textContent = "READY";
      startPingMonitoring();
    });

    state.socket.on("disconnect", () => {
      logActivity("WebSocket connection to Gateway closed.");
      setConnectionStatus("disconnected", "Disconnected");
      if (DOM.loginGatewayDot) DOM.loginGatewayDot.className = "status-dot disconnected";
      if (DOM.loginGatewayBadge) DOM.loginGatewayBadge.textContent = "OFFLINE";
    });

    state.socket.on("connect_error", () => {
      setConnectionStatus("disconnected", "Disconnected");
    });

    state.socket.on("gateway_ready", (data) => {
      logActivity(`Gateway ready: default TCP target ${data.default_host}:${data.default_port}`);
      if (DOM.hostInput && !DOM.hostInput.value) DOM.hostInput.value = data.default_host;
      if (DOM.portInput && !DOM.portInput.value) DOM.portInput.value = data.default_port;
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
      appendSystemMessage(`Error: ${data.message}`);
      logActivity(`Server error: ${data.message}`);
    });

    state.socket.on("server_disconnected", (data) => {
      setConnectionStatus("disconnected", "Disconnected");
      appendSystemMessage(`Connection closed: ${data.message}`);
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
      appendSystemMessage(`${data.recipient} declined file offer for '${data.filename}'.`);
      logActivity(`File transfer rejected by ${data.recipient}.`);
    });

    // Latency Telemetry
    state.socket.on("pong_measure", (data) => {
      if (data && data.client_time) {
        state.latencyMs = Math.max(1, Date.now() - data.client_time);
        if (DOM.miniPing) DOM.miniPing.textContent = `${state.latencyMs} ms`;
        if (DOM.diagLatency) DOM.diagLatency.textContent = `${state.latencyMs} ms`;
        
        // Single source of truth update
        if (state.isConnected) {
          setConnectionStatus("connected", "Connected");
        }
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
    DOM.connectBtn.innerHTML = `<svg class="svg-icon sm spinning" aria-hidden="true"><use href="#icon-loader-circle"></use></svg> <span>Connecting to TCP...</span>`;
    DOM.loginError.classList.add("hidden");
    setConnectionStatus("connecting", "Connecting...");

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
    DOM.myAvatar.style.background = getAvatarGradient(state.username);
    DOM.myAvatar.style.color = "#ffffff";
    DOM.myEndpoint.textContent = `${state.host}:${state.port}`;

    if (DOM.miniTcpTarget) DOM.miniTcpTarget.textContent = state.port;
    if (DOM.diagTcpHost) DOM.diagTcpHost.textContent = `${state.host}:${state.port}`;
    if (DOM.rpTcpHost) DOM.rpTcpHost.textContent = `${state.host}:${state.port}`;

    setConnectionStatus("connected", "Connected");

    logActivity(`Successfully connected as '${state.username}' via TCP socket.`);
    appendSystemMessage(`Connected to TCP network as '${state.username}'.`);

    // Focus chat input on desktop
    if (window.innerWidth > 768 && DOM.messageInput) {
      DOM.messageInput.focus();
    }
  }

  function showLoginError(msg) {
    setConnectionStatus("disconnected", "Disconnected");
    DOM.loginError.textContent = msg;
    DOM.loginError.classList.remove("hidden");
    DOM.connectBtn.disabled = false;
    DOM.connectBtn.innerHTML = `<span>Connect to Network</span> <svg class="svg-icon" aria-hidden="true"><use href="#icon-send"></use></svg>`;
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

    scrollToBottom(true);
  }

  function appendChatMessage(sender, content, timestamp, isPrivate, peer) {
    if (DOM.emptyState) {
      DOM.emptyState.style.display = "none";
    }

    const wasNearBottom = isUserNearBottom();

    const isMe = sender.toLowerCase() === state.username.toLowerCase();
    const bubble = document.createElement("div");
    bubble.className = `message-bubble ${isMe ? "mine" : ""} ${isPrivate ? "private" : ""}`;

    const header = document.createElement("div");
    header.className = "msg-header";

    if (isPrivate) {
      header.innerHTML = `
        <span class="msg-badge badge-private">
          <svg class="svg-icon xs"><use href="#icon-lock"></use></svg> PRIVATE
        </span>
        <span class="msg-sender">${isMe ? "You to " + escapeHtml(peer) : escapeHtml(sender)}</span>
        <span class="msg-time">${timestamp || formatTime()}</span>
      `;
    } else {
      header.innerHTML = `
        <span class="msg-sender">${isMe ? "You" : escapeHtml(sender)}</span>
        <span class="msg-time">${timestamp || formatTime()}</span>
      `;
    }

    const body = document.createElement("div");
    body.className = "msg-content";
    body.textContent = content;

    bubble.appendChild(header);
    bubble.appendChild(body);
    DOM.messagesContainer.appendChild(bubble);

    state.messagesCount++;

    if (isMe || wasNearBottom) {
      scrollToBottom(false);
    } else {
      if (DOM.btnJumpLatest) {
        DOM.btnJumpLatest.classList.remove("hidden");
      }
    }
  }

  function appendSystemMessage(text) {
    if (DOM.emptyState) {
      DOM.emptyState.style.display = "none";
    }

    const wasNearBottom = isUserNearBottom();

    const notice = document.createElement("div");
    notice.className = "system-pill";
    notice.textContent = text;
    DOM.messagesContainer.appendChild(notice);

    if (wasNearBottom) {
      scrollToBottom(false);
    }
  }

  // =========================================================================
  // ONLINE USERS & ROOM NAVIGATION
  // =========================================================================
  function updateUserList(users) {
    state.onlineUsers = users;
    const count = users.length;
    if (DOM.userCount) DOM.userCount.textContent = count;
    if (DOM.mobileUserCount) DOM.mobileUserCount.textContent = count;
    if (DOM.diagPeerCount) {
      DOM.diagPeerCount.textContent = `${count} Peer${count === 1 ? "" : "s"}`;
    }
    if (DOM.rpPeerCount) {
      DOM.rpPeerCount.textContent = `${count} Peer${count === 1 ? "" : "s"}`;
    }

    // Refresh Sidebar Users
    DOM.usersNavList.innerHTML = "";
    DOM.fileRecipientSelect.innerHTML = `<option value="">-- Choose Online Peer --</option>`;

    users.forEach((user) => {
      const isMe = user.toLowerCase() === state.username.toLowerCase();

      const li = document.createElement("li");
      li.className = `nav-menu-item ${state.activeChatTarget === user ? "active" : ""}`;
      li.setAttribute("role", "button");
      li.setAttribute("tabindex", "0");

      const avatarBg = getAvatarGradient(user);
      li.innerHTML = `
        <div class="peer-avatar" style="background: ${avatarBg}; color: #ffffff;">${escapeHtml(user.charAt(0).toUpperCase())}</div>
        <span class="nav-title">${escapeHtml(user)} ${isMe ? "(You)" : ""}</span>
        ${!isMe ? `<button class="btn-send-file-tiny" title="Send File to ${escapeHtml(user)}" aria-label="Send file to ${escapeHtml(user)}"><svg class="svg-icon xs"><use href="#icon-paperclip"></use></svg></button>` : ""}
      `;

      if (!isMe) {
        li.addEventListener("click", (e) => {
          if (!e.target.closest(".btn-send-file-tiny")) {
            switchToPrivateChat(user);
            closeSidebar();
            setMobileActiveTab("chat");
          }
        });

        li.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            switchToPrivateChat(user);
            closeSidebar();
            setMobileActiveTab("chat");
          }
        });

        const tinyFileBtn = li.querySelector(".btn-send-file-tiny");
        if (tinyFileBtn) {
          tinyFileBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            closeSidebar();
            openFileModal(user);
          });
        }

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
    document.querySelectorAll(".peer-list .nav-menu-item").forEach(el => el.classList.remove("active"));

    DOM.activeChatTitle.textContent = "Public Room";
    DOM.activeChatDesc.textContent = "Unified stream broadcast to all active network peers";
    if (DOM.headerChannelIcon) {
      DOM.headerChannelIcon.innerHTML = `<use href="#icon-globe"></use>`;
    }
    DOM.messageInput.placeholder = "Type a message to everyone... (Press Enter to send)";
    closeSidebar();
    setMobileActiveTab("chat");
  }

  function switchToPrivateChat(peerUsername) {
    state.activeChatTarget = peerUsername;
    DOM.btnPublicRoom.classList.remove("active");

    document.querySelectorAll(".peer-list .nav-menu-item").forEach(el => {
      const titleEl = el.querySelector(".nav-title");
      const name = titleEl ? titleEl.textContent : "";
      el.classList.toggle("active", name.startsWith(peerUsername));
    });

    DOM.activeChatTitle.textContent = `Private Whisper: ${peerUsername}`;
    DOM.activeChatDesc.textContent = `Encrypted direct message stream with ${peerUsername}`;
    if (DOM.headerChannelIcon) {
      DOM.headerChannelIcon.innerHTML = `<use href="#icon-lock"></use>`;
    }
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
    setMobileActiveTab("share");
  }

  function closeFileModal() {
    DOM.fileModal.classList.add("hidden");
    state.selectedFile = null;
    DOM.filePreviewCard.classList.add("hidden");
    DOM.uploadProgressContainer.classList.add("hidden");
    DOM.confirmSendFileBtn.disabled = true;
    setMobileActiveTab("chat");
  }

  function handleFileSelected(file) {
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      alert("File exceeds maximum allowed size of 100 MB.");
      return;
    }

    state.selectedFile = file;
    DOM.previewFilename.textContent = file.name;
    DOM.previewHash.innerHTML = `<svg class="svg-icon xs spinning" aria-hidden="true"><use href="#icon-loader-circle"></use></svg> <span>Computing SHA-256 on transfer...</span>`;

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
        DOM.uploadProgressText.textContent = "Upload complete. Sending offer to peer...";
        logActivity(`File '${resp.filename}' uploaded. SHA-256: ${resp.sha256.substring(0, 16)}...`);

        state.socket.emit("file_offer", {
          transfer_id: resp.transfer_id,
          recipient: recipient,
          filename: resp.filename,
          filesize: resp.filesize,
          sha256: resp.sha256
        });

        appendSystemMessage(`Offered '${resp.filename}' (${formatBytes(resp.filesize)}) to '${recipient}'. Waiting for response...`);
        setTimeout(closeFileModal, 700);
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
    appendSystemMessage(`Accepted file offer from '${offer.sender}'. Starting download...`);
    logActivity(`Accepted file transfer '${offer.transfer_id}' from ${offer.sender}.`);

    const downloadUrl = `/api/download/${offer.transfer_id}`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = offer.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    appendSystemMessage(`Download initiated for '${offer.filename}'. SHA-256 verified.`);
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
    appendSystemMessage(`Declined file offer from '${offer.sender}'.`);
    logActivity(`Declined file offer from ${offer.sender}.`);
  }

  function handleFileReady(data) {
    appendSystemMessage(`File transfer ready for '${data.filename}'. Transport active on port ${data.file_port}.`);
  }

  // =========================================================================
  // DIAGNOSTICS MODAL
  // =========================================================================
  function openDiagnosticsModal() {
    if (DOM.diagnosticsModal) {
      DOM.diagnosticsModal.classList.remove("hidden");
      setMobileActiveTab("diag");
    }
  }

  function closeDiagnosticsModal() {
    if (DOM.diagnosticsModal) {
      DOM.diagnosticsModal.classList.add("hidden");
      setMobileActiveTab("chat");
    }
  }

  // =========================================================================
  // EVENT LISTENERS SETUP
  // =========================================================================
  function setupEventListeners() {
    // Theme Toggles
    if (DOM.btnThemeToggle) {
      DOM.btnThemeToggle.addEventListener("click", toggleTheme);
    }
    if (DOM.btnLoginThemeToggle) {
      DOM.btnLoginThemeToggle.addEventListener("click", toggleTheme);
    }

    // Mobile Sidebar Drawer
    if (DOM.btnMobileMenu) {
      DOM.btnMobileMenu.addEventListener("click", () => {
        if (DOM.sidebar && DOM.sidebar.classList.contains("open")) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });
    }
    if (DOM.sidebarCloseBtn) {
      DOM.sidebarCloseBtn.addEventListener("click", closeSidebar);
    }
    if (DOM.sidebarBackdrop) {
      DOM.sidebarBackdrop.addEventListener("click", closeSidebar);
    }

    // Mobile Bottom Tab Bar
    if (DOM.tabChat) {
      DOM.tabChat.addEventListener("click", () => {
        closeSidebar();
        setMobileActiveTab("chat");
      });
    }
    if (DOM.tabPeers) {
      DOM.tabPeers.addEventListener("click", () => {
        openSidebar();
        setMobileActiveTab("peers");
      });
    }
    if (DOM.tabShare) {
      DOM.tabShare.addEventListener("click", () => {
        closeSidebar();
        openFileModal();
      });
    }
    if (DOM.tabDiag) {
      DOM.tabDiag.addEventListener("click", () => {
        closeSidebar();
        openDiagnosticsModal();
        setMobileActiveTab("diag");
      });
    }

    // Drawer Quick Actions
    if (DOM.btnDrawerShareFile) {
      DOM.btnDrawerShareFile.addEventListener("click", () => {
        closeSidebar();
        openFileModal();
      });
      DOM.btnDrawerShareFile.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          closeSidebar();
          openFileModal();
        }
      });
    }
    if (DOM.btnDrawerDiagnostics) {
      DOM.btnDrawerDiagnostics.addEventListener("click", () => {
        closeSidebar();
        openDiagnosticsModal();
      });
      DOM.btnDrawerDiagnostics.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          closeSidebar();
          openDiagnosticsModal();
        }
      });
    }
    if (DOM.btnDrawerTheme) {
      DOM.btnDrawerTheme.addEventListener("click", () => {
        toggleTheme();
      });
      DOM.btnDrawerTheme.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleTheme();
        }
      });
    }

    // Mobile Keyboard scroll assist
    if (DOM.messageInput) {
      DOM.messageInput.addEventListener("focus", () => {
        setTimeout(() => {
          scrollToBottom(false);
        }, 280);
      });
    }

    // Advanced Settings Toggle in Login
    if (DOM.btnToggleAdvanced) {
      DOM.btnToggleAdvanced.addEventListener("click", () => {
        const isHidden = DOM.advancedBody.classList.toggle("hidden");
        DOM.btnToggleAdvanced.setAttribute("aria-expanded", isHidden ? "false" : "true");
        if (DOM.advancedChevron) {
          DOM.advancedChevron.classList.toggle("rotated", !isHidden);
        }
      });
    }

    // Connect Button & Enter key
    if (DOM.connectBtn) {
      DOM.connectBtn.addEventListener("click", handleConnectClick);
    }
    if (DOM.usernameInput) {
      DOM.usernameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleConnectClick();
      });
    }

    // Chat Submission
    if (DOM.chatForm) {
      DOM.chatForm.addEventListener("submit", handleSendMessage);
    }
    if (DOM.btnPublicRoom) {
      DOM.btnPublicRoom.addEventListener("click", switchToPublicChat);
      DOM.btnPublicRoom.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          switchToPublicChat();
        }
      });
    }

    // Jump to latest messages button
    if (DOM.btnJumpLatest) {
      DOM.btnJumpLatest.addEventListener("click", () => {
        scrollToBottom(true);
      });
    }

    // Track scroll events to toggle jump button
    if (DOM.messagesContainer) {
      DOM.messagesContainer.addEventListener("scroll", () => {
        if (isUserNearBottom() && DOM.btnJumpLatest) {
          DOM.btnJumpLatest.classList.add("hidden");
        }
      });
    }

    // Disconnect / Reconnect Action
    const disconnectHandler = () => {
      if (state.isConnected) {
        if (confirm("Are you sure you want to disconnect from the network?")) {
          location.reload();
        }
      } else {
        location.reload();
      }
    };
    if (DOM.btnDisconnect) DOM.btnDisconnect.addEventListener("click", disconnectHandler);
    if (DOM.btnSidebarDisconnect) DOM.btnSidebarDisconnect.addEventListener("click", disconnectHandler);

    // File Modal Trigger & Actions
    if (DOM.btnOpenFilePanel) DOM.btnOpenFilePanel.addEventListener("click", () => openFileModal());
    if (DOM.btnComposerAttach) DOM.btnComposerAttach.addEventListener("click", () => openFileModal());
    if (DOM.closeFileModal) DOM.closeFileModal.addEventListener("click", closeFileModal);
    if (DOM.cancelFileBtn) DOM.cancelFileBtn.addEventListener("click", closeFileModal);

    // File Drag & Drop
    if (DOM.dropZone) {
      DOM.dropZone.addEventListener("click", () => DOM.fileInputElement.click());
      DOM.dropZone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          DOM.fileInputElement.click();
        }
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
    }

    if (DOM.fileInputElement) {
      DOM.fileInputElement.addEventListener("change", (e) => {
        if (e.target.files.length > 0) handleFileSelected(e.target.files[0]);
      });
    }

    if (DOM.confirmSendFileBtn) {
      DOM.confirmSendFileBtn.addEventListener("click", handleConfirmSendFile);
    }

    // Incoming File Offers
    if (DOM.btnAcceptFile) DOM.btnAcceptFile.addEventListener("click", handleAcceptFileOffer);
    if (DOM.btnRejectFile) DOM.btnRejectFile.addEventListener("click", handleRejectFileOffer);

    // Diagnostics Trigger (Desktop toggles Right Panel, Mobile opens Modal)
    if (DOM.btnOpenDiagnostics) {
      DOM.btnOpenDiagnostics.addEventListener("click", () => {
        if (window.innerWidth >= 1024 && DOM.rightPanel) {
          DOM.rightPanel.classList.toggle("hidden");
        } else {
          openDiagnosticsModal();
        }
      });
    }
    if (DOM.btnCloseRightPanel) {
      DOM.btnCloseRightPanel.addEventListener("click", () => {
        if (DOM.rightPanel) DOM.rightPanel.classList.add("hidden");
      });
    }
    if (DOM.diagnosticsMiniBtn) {
      DOM.diagnosticsMiniBtn.addEventListener("click", openDiagnosticsModal);
      DOM.diagnosticsMiniBtn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDiagnosticsModal();
        }
      });
    }
    if (DOM.closeDiagModal) {
      DOM.closeDiagModal.addEventListener("click", closeDiagnosticsModal);
    }
    if (DOM.closeDiagBtn) {
      DOM.closeDiagBtn.addEventListener("click", closeDiagnosticsModal);
    }

    // Close Modals on Backdrop Click
    [DOM.fileModal, DOM.diagnosticsModal].forEach((modal) => {
      if (modal) {
        modal.addEventListener("click", (e) => {
          if (e.target === modal) {
            modal.classList.add("hidden");
            setMobileActiveTab("chat");
          }
        });
      }
    });

    // Global Keyboard Navigation (ESC to close modals and drawer)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (DOM.sidebar && DOM.sidebar.classList.contains("open")) {
          closeSidebar();
          return;
        }
        if (DOM.fileModal && !DOM.fileModal.classList.contains("hidden")) {
          closeFileModal();
          return;
        }
        if (DOM.diagnosticsModal && !DOM.diagnosticsModal.classList.contains("hidden")) {
          closeDiagnosticsModal();
          return;
        }
      }
    });
  }

  // Run on DOM Ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
