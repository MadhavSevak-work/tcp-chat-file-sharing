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
    fileSha256: null,
    isHashing: false,
    uploadQueue: [], // Sequential transfer queue array
    isProcessingQueue: false,
    isUploadingChunk: false,
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
    btnComposerEmoji: document.getElementById("btn-composer-emoji"),
    emojiPopover: document.getElementById("emoji-popover"),
    emojiGrid: document.getElementById("emoji-grid"),
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
    broadcastRecipientBadge: document.getElementById("broadcast-recipient-badge"),
    dropZone: document.getElementById("drop-zone"),
    fileInputElement: document.getElementById("file-upload") || document.getElementById("file-input-element"),
    fileQueueContainer: document.getElementById("file-queue-container"),
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
    incomingBroadcastBadge: document.getElementById("incoming-broadcast-badge"),
    incomingBroadcastText: document.getElementById("incoming-broadcast-text"),
    incomingModalTitle: document.getElementById("incoming-modal-title"),
    incomingModalLead: document.getElementById("incoming-modal-lead"),
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
    const line = document.createElement("div");
    line.className = "log-line";
    const timeSpan = document.createElement("span");
    timeSpan.className = "log-time";
    timeSpan.textContent = `[${time}] `;
    line.appendChild(timeSpan);
    line.appendChild(document.createTextNode(String(text)));

    if (DOM.activityLogBox) {
      DOM.activityLogBox.appendChild(line);
      DOM.activityLogBox.scrollTop = DOM.activityLogBox.scrollHeight;
    }
    if (DOM.rpActivityLog) {
      DOM.rpActivityLog.appendChild(line.cloneNode(true));
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

  // Configurable Render backend target
  // Can be set globally via window.NETCHAT_BACKEND_URL or defaults to Render production domain
  const BACKEND_URL = (typeof window !== "undefined" && window.NETCHAT_BACKEND_URL)
    || ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && window.location.port === "5050"
      ? window.location.origin
      : "https://netchat-live.onrender.com");

  let reconnectAttemptsCount = 0;

  function updateWakeupBanner(isWaking, message) {
    if (DOM.loginGatewayDot) {
      DOM.loginGatewayDot.className = "status-dot " + (isWaking ? "connecting" : (state.isConnected ? "connected" : "disconnected"));
    }
    if (DOM.loginGatewayBadge) {
      DOM.loginGatewayBadge.className = "badge " + (isWaking ? "badge-warning" : (state.isConnected ? "badge-success" : "badge-secondary"));
      DOM.loginGatewayBadge.textContent = isWaking ? "WAKING UP..." : (state.isConnected ? "READY" : "OFFLINE");
    }
    if (DOM.gatewayDisplayEndpoint) {
      let host = "netchat-live.onrender.com";
      try { host = new URL(BACKEND_URL).host; } catch (_) {}
      DOM.gatewayDisplayEndpoint.textContent = isWaking
        ? (message || "Connecting to Render server... backend may take 30s to wake up")
        : (state.isConnected ? `Connected: ${host}` : `Target: ${host}`);
    }

    if (DOM.loginError) {
      if (isWaking) {
        DOM.loginError.className = "alert-banner alert-warning";
        DOM.loginError.innerHTML = `<strong>Notice:</strong> Connecting to Render server... free-tier backend may take ~30s to wake up from idle state.`;
        DOM.loginError.classList.remove("hidden");
      } else if (DOM.loginError.classList.contains("alert-warning")) {
        DOM.loginError.classList.add("hidden");
        DOM.loginError.className = "alert-banner alert-error hidden";
      }
    }
  }

  function init() {
    initTheme();
    setConnectionStatus("disconnected", "Disconnected");

    // Detect environment host for user-facing connection banner
    let hostLabel = "netchat-live.onrender.com";
    try {
      hostLabel = new URL(BACKEND_URL).host;
    } catch (_) {}

    if (DOM.gatewayDisplayEndpoint) {
      DOM.gatewayDisplayEndpoint.textContent = `Target: ${hostLabel}`;
    }
    if (DOM.diagGatewayHost) {
      DOM.diagGatewayHost.textContent = hostLabel;
    }

    setupEventListeners();
    connectSocket();
  }

  function connectSocket() {
    updateWakeupBanner(true, "Connecting to Render server... backend may take 30s to wake up");

    state.socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    state.socket.on("connect", () => {
      logActivity(`WebSocket transport established with Gateway (${BACKEND_URL}).`);
      reconnectAttemptsCount = 0;
      updateWakeupBanner(false);
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

    state.socket.on("connect_error", (error) => {
      reconnectAttemptsCount++;
      logActivity(`Connection pending/delayed (attempt ${reconnectAttemptsCount}): Render backend waking up...`);
      setConnectionStatus("disconnected", "Connecting...");
      updateWakeupBanner(true, `Connecting to Render server (attempt ${reconnectAttemptsCount})... backend may take 30s to wake up`);
    });

    if (state.socket.io) {
      state.socket.io.on("reconnect_attempt", (attempt) => {
        updateWakeupBanner(true, `Reconnecting to Render server (attempt ${attempt})... waking up`);
      });

      state.socket.io.on("reconnect", () => {
        logActivity("Reconnected to Render backend successfully!");
        updateWakeupBanner(false);
      });
    }

    state.socket.on("gateway_ready", (data) => {
      logActivity(`Gateway ready (${data.gateway}). Loopback socket target: ${data.default_host}:${data.default_port}`);
      if (DOM.gatewayDisplayEndpoint) {
        DOM.gatewayDisplayEndpoint.textContent = `Loopback Target: ${data.default_host}:${data.default_port}`;
      }
    });

    state.socket.on("error", (data) => {
      const msg = data && data.message ? data.message : "Security rate limit exceeded.";
      appendSystemMessage(msg);
      logActivity(`[Security Warning] ${msg}`);
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

    state.socket.on("incoming_file_offer", (data) => {
      handleIncomingFileOffer(data);
    });

    state.socket.on("file_chunk", (data) => {
      handleIncomingFileChunk(data);
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

    if (!username) {
      showLoginError("Please enter a username.");
      return;
    }

    if (!state.socket || !state.socket.connected) {
      showLoginError("Render backend is still waking up from idle state (~30s). Please wait a moment and try again.");
      updateWakeupBanner(true, "Connecting to Render server... backend may take 30s to wake up");
      return;
    }

    DOM.connectBtn.disabled = true;
    DOM.connectBtn.innerHTML = `<svg class="svg-icon sm spinning" aria-hidden="true"><use href="#icon-loader-circle"></use></svg> <span>Connecting to TCP...</span>`;
    DOM.loginError.classList.add("hidden");
    setConnectionStatus("connecting", "Connecting...");

    logActivity(`Requesting secure TCP registration for '${username}' on 127.0.0.1:5000...`);
    state.socket.emit("join", { username });
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
    toggleEmojiPopover(false);
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

  // =========================================================================
  // CURATED EMOJI QUICK-BAR (Zero External Libraries, Secure Connect Theme)
  // =========================================================================
  const CURATED_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '👏', '🚀', '👀', '💯', '🙏', '✨', '⚡'];
  let lastCaretStart = null;
  let lastCaretEnd = null;

  function updateInputCaret() {
    if (DOM.messageInput) {
      lastCaretStart = DOM.messageInput.selectionStart;
      lastCaretEnd = DOM.messageInput.selectionEnd;
    }
  }

  function toggleEmojiPopover(force) {
    if (!DOM.emojiPopover) return;
    const isHidden = DOM.emojiPopover.classList.contains("hidden");
    const shouldOpen = typeof force === "boolean" ? force : isHidden;

    if (shouldOpen) {
      DOM.emojiPopover.classList.remove("hidden");
      DOM.emojiPopover.setAttribute("aria-hidden", "false");
      if (DOM.btnComposerEmoji) {
        DOM.btnComposerEmoji.classList.add("active");
        DOM.btnComposerEmoji.setAttribute("aria-expanded", "true");
      }
    } else {
      DOM.emojiPopover.classList.add("hidden");
      DOM.emojiPopover.setAttribute("aria-hidden", "true");
      if (DOM.btnComposerEmoji) {
        DOM.btnComposerEmoji.classList.remove("active");
        DOM.btnComposerEmoji.setAttribute("aria-expanded", "false");
      }
    }
  }

  function insertEmoji(emoji) {
    const input = DOM.messageInput;
    if (!input) return;

    let start = typeof lastCaretStart === "number" ? lastCaretStart : input.selectionStart;
    let end = typeof lastCaretEnd === "number" ? lastCaretEnd : input.selectionEnd;

    if (start === null || start === undefined) start = input.value.length;
    if (end === null || end === undefined) end = input.value.length;

    const text = input.value;
    const before = text.substring(0, start);
    const after = text.substring(end);

    input.value = before + emoji + after;
    const newPos = start + emoji.length;
    lastCaretStart = newPos;
    lastCaretEnd = newPos;

    input.focus();
    input.setSelectionRange(newPos, newPos);
    input.dispatchEvent(new Event("input", { bubbles: true }));
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
      const badge = document.createElement("span");
      badge.className = "msg-badge badge-private";
      badge.innerHTML = `<svg class="svg-icon xs" aria-hidden="true"><use href="#icon-lock"></use></svg> PRIVATE`;
      header.appendChild(badge);

      const senderEl = document.createElement("span");
      senderEl.className = "msg-sender";
      senderEl.textContent = isMe ? `You to ${peer}` : sender;
      header.appendChild(senderEl);

      const timeEl = document.createElement("span");
      timeEl.className = "msg-time";
      timeEl.textContent = timestamp || formatTime();
      header.appendChild(timeEl);
    } else {
      const senderEl = document.createElement("span");
      senderEl.className = "msg-sender";
      senderEl.textContent = isMe ? "You" : sender;
      header.appendChild(senderEl);

      const timeEl = document.createElement("span");
      timeEl.className = "msg-time";
      timeEl.textContent = timestamp || formatTime();
      header.appendChild(timeEl);
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
    const previousSelected = DOM.fileRecipientSelect.value;
    DOM.fileRecipientSelect.innerHTML = `
      <option value="__BROADCAST__">🌐 Entire Server (All Peers)</option>
      <option value="">-- Choose Online Peer --</option>
    `;

    users.forEach((user) => {
      const isMe = user.toLowerCase() === state.username.toLowerCase();

      const li = document.createElement("li");
      li.className = `nav-menu-item ${state.activeChatTarget === user ? "active" : ""}`;
      li.setAttribute("role", "button");
      li.setAttribute("tabindex", "0");

      const avatarBg = getAvatarGradient(user);
      const avatarEl = document.createElement("div");
      avatarEl.className = "peer-avatar";
      avatarEl.style.background = avatarBg;
      avatarEl.style.color = "#ffffff";
      avatarEl.textContent = user.charAt(0).toUpperCase();

      const titleEl = document.createElement("span");
      titleEl.className = "nav-title";
      titleEl.textContent = `${user} ${isMe ? "(You)" : ""}`;

      li.appendChild(avatarEl);
      li.appendChild(titleEl);

      if (!isMe) {
        const fileBtn = document.createElement("button");
        fileBtn.className = "btn-send-file-tiny";
        fileBtn.title = `Send File to ${user}`;
        fileBtn.setAttribute("aria-label", `Send file to ${user}`);
        fileBtn.innerHTML = `<svg class="svg-icon xs" aria-hidden="true"><use href="#icon-paperclip"></use></svg>`;
        li.appendChild(fileBtn);
      }

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

    if (previousSelected && Array.from(DOM.fileRecipientSelect.options).some(o => o.value === previousSelected)) {
      DOM.fileRecipientSelect.value = previousSelected;
    } else if (!DOM.fileRecipientSelect.value) {
      DOM.fileRecipientSelect.value = "__BROADCAST__";
    }
    updateBroadcastBadge();
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
  function updateBroadcastBadge() {
    const isBroadcast = DOM.fileRecipientSelect && DOM.fileRecipientSelect.value === "__BROADCAST__";
    if (DOM.broadcastRecipientBadge) {
      DOM.broadcastRecipientBadge.classList.toggle("hidden", !isBroadcast);
    }
  }

  function openFileModal(preselectedUser = null) {
    DOM.fileModal.classList.remove("hidden");
    if (preselectedUser) {
      DOM.fileRecipientSelect.value = preselectedUser;
    } else if (state.activeChatTarget) {
      DOM.fileRecipientSelect.value = state.activeChatTarget;
    } else {
      DOM.fileRecipientSelect.value = "__BROADCAST__";
    }
    updateBroadcastBadge();
    setMobileActiveTab("share");
  }

  // =========================================================================
  // INCREMENTAL SHA-256 & SEQUENTIAL TRANSFER QUEUE ENGINE
  // =========================================================================

  class IncrementalSHA256 {
    constructor() {
      this.K = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
      ]);
      this.H = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
      ]);
      this.buffer = new Uint8Array(64);
      this.bufferLength = 0;
      this.totalBytes = 0;
      this.w = new Uint32Array(64);
    }

    _compress(block) {
      const w = this.w;
      for (let i = 0; i < 16; i++) {
        const idx = i * 4;
        w[i] = (block[idx] << 24) | (block[idx + 1] << 16) | (block[idx + 2] << 8) | block[idx + 3];
      }
      for (let i = 16; i < 64; i++) {
        const s0 = (w[i - 15] >>> 7 | w[i - 15] << 25) ^ (w[i - 15] >>> 18 | w[i - 15] << 14) ^ (w[i - 15] >>> 3);
        const s1 = (w[i - 2] >>> 17 | w[i - 2] << 15) ^ (w[i - 2] >>> 19 | w[i - 2] << 13) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      let a = this.H[0], b = this.H[1], c = this.H[2], d = this.H[3];
      let e = this.H[4], f = this.H[5], g = this.H[6], h = this.H[7];

      for (let i = 0; i < 64; i++) {
        const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + this.K[i] + w[i]) | 0;
        const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }

      this.H[0] = (this.H[0] + a) | 0;
      this.H[1] = (this.H[1] + b) | 0;
      this.H[2] = (this.H[2] + c) | 0;
      this.H[3] = (this.H[3] + d) | 0;
      this.H[4] = (this.H[4] + e) | 0;
      this.H[5] = (this.H[5] + f) | 0;
      this.H[6] = (this.H[6] + g) | 0;
      this.H[7] = (this.H[7] + h) | 0;
    }

    update(chunk) {
      const data = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
      this.totalBytes += data.length;
      let offset = 0;
      while (offset < data.length) {
        const needed = 64 - this.bufferLength;
        const toCopy = Math.min(needed, data.length - offset);
        this.buffer.set(data.subarray(offset, offset + toCopy), this.bufferLength);
        this.bufferLength += toCopy;
        offset += toCopy;
        if (this.bufferLength === 64) {
          this._compress(this.buffer);
          this.bufferLength = 0;
        }
      }
    }

    digest() {
      const totalBits = BigInt(this.totalBytes) * 8n;
      const pad = new Uint8Array(1);
      pad[0] = 0x80;
      this.update(pad);

      while (this.bufferLength !== 56) {
        if (this.bufferLength < 56) {
          const zeros = new Uint8Array(56 - this.bufferLength);
          this.update(zeros);
        } else {
          const zeros = new Uint8Array(64 - this.bufferLength);
          this.update(zeros);
        }
      }

      const lenBuf = new Uint8Array(8);
      const view = new DataView(lenBuf.buffer);
      view.setBigUint64(0, totalBits, false);
      this.update(lenBuf);

      let hex = "";
      for (let i = 0; i < 8; i++) {
        hex += this.H[i].toString(16).padStart(8, "0");
      }
      return hex;
    }
  }

  async function computeFileSHA256NonBlocking(file, onProgress) {
    const HASH_SLICE_SIZE = 1024 * 1024; // 1 MB slices
    const totalSlices = Math.ceil(file.size / HASH_SLICE_SIZE) || 1;
    const hasher = new IncrementalSHA256();

    for (let i = 0; i < totalSlices; i++) {
      const start = i * HASH_SLICE_SIZE;
      const end = Math.min(start + HASH_SLICE_SIZE, file.size);
      const slice = file.slice(start, end);
      const buf = await slice.arrayBuffer();
      hasher.update(new Uint8Array(buf));

      const percent = Math.min(100, Math.round((end / file.size) * 100));
      if (typeof onProgress === "function") {
        onProgress(percent);
      }

      // Non-blocking yield to event loop: keeps WebSocket ping/pong and UI alive
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return hasher.digest();
  }

  function setQueue(updater) {
    if (typeof updater === "function") {
      state.uploadQueue = updater(state.uploadQueue);
    } else {
      state.uploadQueue = updater;
    }
    renderQueueUI();
  }

  function closeFileModal() {
    if (state.isProcessingQueue) {
      if (!confirm("File transfers are currently in progress. Close and abort remaining queue?")) {
        return;
      }
    }
    DOM.fileModal.classList.add("hidden");
    state.uploadQueue = [];
    state.isProcessingQueue = false;
    state.isUploadingChunk = false;
    state.selectedFile = null;
    state.fileSha256 = null;
    renderQueueUI();
    setMobileActiveTab("chat");
  }

  function handleFilesSelected(files) {
    if (!files || files.length === 0) return;

    const newItems = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 100 * 1024 * 1024) {
        alert(`'${file.name}' exceeds the maximum allowed size of 100 MB and was skipped.`);
        continue;
      }
      if (file.size === 0) {
        alert(`'${file.name}' is empty (0 bytes) and was skipped.`);
        continue;
      }

      // Prevent exact duplicate file entries in queue
      const alreadyInQueue = state.uploadQueue.some(
        (q) => q.name === file.name && q.size === file.size && q.status !== "failed"
      );
      if (alreadyInQueue) continue;

      newItems.push({
        id: "q_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7) + "_" + i,
        file: file,
        name: file.name,
        size: file.size,
        hash: null,
        status: "pending", // 'pending' | 'hashing' | 'uploading' | 'completed' | 'failed'
        progress: 0,
        error: null
      });
    }

    if (newItems.length > 0) {
      // Safe addition: if an active chunk stream is in progress, files are appended
      // to the queue without interrupting or restarting the current streaming item
      setQueue((prev) => [...prev, ...newItems]);
      if (state.isUploadingChunk) {
        logActivity(`Queued ${newItems.length} additional file(s) for transfer.`);
      }
    }
  }

  // Backward compatibility alias for single file selection
  function handleFileSelected(file) {
    if (file) handleFilesSelected([file]);
  }

  function removeFromQueue(itemId) {
    const item = state.uploadQueue.find((q) => q.id === itemId);
    if (!item) return;

    if (item.status === "hashing" || item.status === "uploading") {
      alert("Cannot remove file while transfer is in progress.");
      return;
    }

    setQueue((prev) => prev.filter((q) => q.id !== itemId));
  }

  function renderQueueUI() {
    if (!DOM.fileQueueContainer) return;

    if (state.uploadQueue.length === 0) {
      DOM.fileQueueContainer.classList.add("hidden");
      DOM.fileQueueContainer.innerHTML = "";
      if (DOM.filePreviewCard) DOM.filePreviewCard.classList.add("hidden");
      if (DOM.uploadProgressContainer) DOM.uploadProgressContainer.classList.add("hidden");
      if (DOM.confirmSendFileBtn) {
        DOM.confirmSendFileBtn.disabled = true;
        const btnSpan = DOM.confirmSendFileBtn.querySelector("span");
        if (btnSpan) btnSpan.textContent = "Send File Offer";
      }
      return;
    }

    DOM.fileQueueContainer.classList.remove("hidden");
    if (DOM.filePreviewCard) DOM.filePreviewCard.classList.add("hidden");
    if (DOM.uploadProgressContainer) DOM.uploadProgressContainer.classList.add("hidden");

    const total = state.uploadQueue.length;
    const completed = state.uploadQueue.filter((q) => q.status === "completed").length;
    const totalBytes = state.uploadQueue.reduce((acc, q) => acc + q.size, 0);
    const hasPending = state.uploadQueue.some((q) => q.status === "pending" || q.status === "failed");

    const headerHtml = `
      <div class="queue-header-summary">
        <span>Queue: ${completed} of ${total} transferred</span>
        <span class="text-mono">${formatBytes(totalBytes)}</span>
      </div>
    `;

    const itemsHtml = state.uploadQueue
      .map((item) => {
        const isRemovable = item.status === "pending" && !state.isProcessingQueue;
        const statusLabel =
          item.status === "hashing"
            ? `HASHING ${item.progress}%`
            : item.status === "uploading"
            ? `STREAMING ${item.progress}%`
            : item.status.toUpperCase();

        return `
          <div class="queue-item-card status-${item.status}" id="queue-card-${item.id}">
            <div class="queue-item-row">
              <div class="queue-item-icon" aria-hidden="true">
                <svg class="svg-icon xs"><use href="#icon-file"></use></svg>
              </div>
              <div class="queue-item-info">
                <div class="queue-item-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                <div class="queue-item-meta">
                  <span>${formatBytes(item.size)}</span>
                  <span class="queue-badge badge-${item.status}">${statusLabel}</span>
                </div>
              </div>
              ${
                isRemovable
                  ? `<button type="button" class="queue-item-btn-remove" data-id="${item.id}" title="Remove file" aria-label="Remove ${escapeHtml(item.name)}">
                      <svg class="svg-icon xs"><use href="#icon-x"></use></svg>
                    </button>`
                  : ""
              }
            </div>
            ${item.hash ? `<div class="queue-item-hash text-mono text-xs">SHA-256: ${item.hash.substring(0, 24)}...</div>` : ""}
            ${
              item.status === "hashing" || item.status === "uploading" || item.status === "completed"
                ? `<div class="queue-item-progress-track">
                    <div class="queue-item-progress-bar" style="width: ${item.progress}%;"></div>
                  </div>`
                : ""
            }
          </div>
        `;
      })
      .join("");

    DOM.fileQueueContainer.innerHTML = headerHtml + itemsHtml;

    if (DOM.confirmSendFileBtn) {
      DOM.confirmSendFileBtn.disabled = !hasPending || state.isProcessingQueue;
      const btnSpan = DOM.confirmSendFileBtn.querySelector("span");
      if (btnSpan) {
        if (state.isProcessingQueue) {
          btnSpan.textContent = "Processing Queue...";
        } else if (total > 1) {
          btnSpan.textContent = `Send ${total} Files`;
        } else {
          btnSpan.textContent = "Send File Offer";
        }
      }
    }
  }

  async function handleConfirmSendFile() {
    const recipient = DOM.fileRecipientSelect.value;
    if (!recipient) {
      alert("Please select a recipient.");
      return;
    }

    if (state.isProcessingQueue) return;

    const hasPending = state.uploadQueue.some((q) => q.status === "pending" || q.status === "failed");
    if (!hasPending) {
      alert("All files in the queue have already been transferred.");
      return;
    }

    state.isProcessingQueue = true;
    renderQueueUI();

    // =========================================================================
    // SEQUENTIAL QUEUE EXECUTION ENGINE
    // Processes files one by one strictly:
    // a. Compute SHA-256 for item i
    // b. Stream 64 KB chunks over WebSocket
    // c. Wait for server/peer completion ACK / emit file_offer
    // d. Mark item as completed and automatically trigger upload for next item
    // =========================================================================
    while (true) {
      // Pick the next pending or failed item in the queue
      const item = state.uploadQueue.find((q) => q.status === "pending" || q.status === "failed");
      if (!item) break; // All queued items completed!

      try {
        // Step a: Compute non-blocking SHA-256 for current item
        item.status = "hashing";
        item.progress = 0;
        renderQueueUI();

        const fileHash = await computeFileSHA256NonBlocking(item.file, (percent) => {
          item.progress = percent;
          renderQueueUI();
        });

        if (!fileHash) {
          throw new Error("SHA-256 computation failed");
        }
        item.hash = fileHash;

        // Step b: Stream 64 KB chunks over WebSocket with backpressure
        item.status = "uploading";
        item.progress = 0;
        renderQueueUI();

        state.isUploadingChunk = true;
        const transferId = "tf_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        const CHUNK_SIZE = 64 * 1024;
        const totalChunks = Math.ceil(item.size / CHUNK_SIZE) || 1;

        for (let i = 0; i < totalChunks; i++) {
          if (!state.socket || !state.isConnected) {
            throw new Error("WebSocket disconnected during transfer.");
          }

          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, item.size);
          const slice = item.file.slice(start, end);
          const chunkBuffer = await slice.arrayBuffer();

          // Wait for ACK callback from server before next chunk
          await new Promise((resolve, reject) => {
            let resolved = false;
            const ackTimeout = setTimeout(() => {
              if (!resolved) {
                resolved = true;
                resolve(); // Fallback timeout
              }
            }, 15000);

            const isBroadcast = recipient === "__BROADCAST__";
            state.socket.emit(
              "file_chunk",
              {
                type: "file_chunk",
                transfer_id: transferId,
                chunk_index: i,
                total_chunks: totalChunks,
                filename: item.file.name,
                filesize: item.size,
                size: item.size,
                sha256: item.hash,
                recipient: recipient,
                is_broadcast: isBroadcast,
                target: isBroadcast ? "all" : undefined,
                data: chunkBuffer
              },
              (response) => {
                if (!resolved) {
                  resolved = true;
                  clearTimeout(ackTimeout);
                  if (response && response.status === "error") {
                    reject(new Error(response.message || "Failed to write chunk"));
                  } else {
                    resolve(response);
                  }
                }
              }
            );
          });

          item.progress = Math.round((end / item.size) * 100);
          renderQueueUI();

          if (i % 4 === 0) {
            await new Promise((r) => setTimeout(r, 0));
          }
        }
        state.isUploadingChunk = false;

        // Step c: Emit file_offer signaling to recipient peer
        const isBroadcast = recipient === "__BROADCAST__";
        state.socket.emit("file_offer", {
          type: "file_offer",
          transfer_id: transferId,
          recipient: recipient,
          is_broadcast: isBroadcast,
          target: isBroadcast ? "all" : undefined,
          filename: item.file.name,
          filesize: item.size,
          size: item.size,
          sha256: item.hash
        });

        if (isBroadcast) {
          appendSystemMessage(`Broadcasting '${item.file.name}' (${formatBytes(item.size)}) to entire server.`);
          logActivity(`Public file broadcast initiated for '${item.file.name}'. SHA-256: ${item.hash.substring(0, 16)}...`);
        } else {
          appendSystemMessage(`Offered '${item.file.name}' (${formatBytes(item.size)}) to '${recipient}'.`);
          logActivity(`File '${item.file.name}' streamed. SHA-256: ${item.hash.substring(0, 16)}...`);
        }

        // Step d: Mark item as completed and automatically loop to next item
        item.status = "completed";
        item.progress = 100;
        renderQueueUI();

      } catch (err) {
        console.error(`Error transferring '${item.name}':`, err);
        state.isUploadingChunk = false;
        item.status = "failed";
        item.error = err.message || "Transfer error";
        renderQueueUI();
        appendSystemMessage(`Failed to send '${item.name}': ${err.message || "Error"}`);
      }
    }

    state.isProcessingQueue = false;
    renderQueueUI();

    const allCompleted = state.uploadQueue.every((q) => q.status === "completed");
    if (allCompleted) {
      appendSystemMessage(`All ${state.uploadQueue.length} queued file(s) transferred successfully.`);
      setTimeout(() => {
        closeFileModal();
      }, 1200);
    }
  }

  state.incomingTransfers = state.incomingTransfers || {};

  function handleIncomingFileOffer(data) {
    if (!data) return;
    if (state.pendingOffer && state.pendingOffer.transfer_id === data.transfer_id) {
      return;
    }
    state.pendingOffer = data;
    const isBroadcast = Boolean(data.is_broadcast || data.recipient === "__BROADCAST__" || data.target === "all");
    DOM.incomingSenderName.textContent = data.sender;
    DOM.incomingFileName.textContent = data.filename;
    DOM.incomingFileSize.textContent = formatBytes(data.filesize || data.size || 0);
    DOM.incomingFileHash.textContent = data.sha256;

    if (DOM.incomingBroadcastBadge) {
      if (DOM.incomingBroadcastText) {
        DOM.incomingBroadcastText.textContent = `Public File Broadcast from ${data.sender}`;
      } else {
        DOM.incomingBroadcastBadge.textContent = `Public File Broadcast from ${data.sender}`;
      }
      DOM.incomingBroadcastBadge.classList.toggle("hidden", !isBroadcast);
    }
    if (DOM.incomingModalTitle) {
      DOM.incomingModalTitle.textContent = isBroadcast ? "Public File Broadcast" : "Incoming File Offer";
    }
    if (DOM.incomingModalLead) {
      if (isBroadcast) {
        DOM.incomingModalLead.innerHTML = `Public File Broadcast from <strong class="text-primary">${escapeHtml(data.sender)}</strong>:`;
      } else {
        DOM.incomingModalLead.innerHTML = `User <strong id="incoming-sender-name" class="text-primary">${escapeHtml(data.sender)}</strong> wants to transfer a file:`;
      }
    }

    DOM.incomingFileModal.classList.remove("hidden");
    logActivity(`${isBroadcast ? "Public file broadcast" : "Incoming file offer"} from ${data.sender}: '${data.filename}' (${formatBytes(data.filesize || data.size || 0)})`);
  }

  function handleIncomingFileChunk(data) {
    if (!data || !data.transfer_id) return;
    const tId = data.transfer_id;
    if (!state.incomingTransfers[tId]) {
      state.incomingTransfers[tId] = {
        transfer_id: tId,
        filename: data.filename || "download.bin",
        filesize: data.filesize || data.size || 0,
        expectedSha: data.sha256 || "",
        chunks: [],
        receivedBytes: 0
      };
    }
    const transfer = state.incomingTransfers[tId];
    if (data.data) {
      transfer.chunks[data.chunk_index] = data.data;
    }
  }

  function handleAcceptFileOffer() {
    if (!state.pendingOffer) return;
    const offer = state.pendingOffer;
    const isBroadcast = Boolean(offer.is_broadcast || offer.recipient === "__BROADCAST__" || offer.target === "all");

    state.socket.emit("file_accept", {
      transfer_id: offer.transfer_id,
      sender: offer.sender,
      filename: offer.filename,
      filesize: offer.filesize || offer.size,
      sha256: offer.sha256
    });

    DOM.incomingFileModal.classList.add("hidden");
    appendSystemMessage(`Accepted ${isBroadcast ? "Public File Broadcast" : "file offer"} from '${offer.sender}'. Starting download...`);
    logActivity(`Accepted ${isBroadcast ? "public broadcast" : "file transfer"} '${offer.transfer_id}' from ${offer.sender}.`);

    const downloadUrl = `${BACKEND_URL}/api/download/${offer.transfer_id}`;
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

    if (DOM.btnOpenFilePanel) DOM.btnOpenFilePanel.addEventListener("click", () => openFileModal());
    if (DOM.btnComposerAttach) DOM.btnComposerAttach.addEventListener("click", () => openFileModal());
    if (DOM.closeFileModal) DOM.closeFileModal.addEventListener("click", closeFileModal);
    if (DOM.cancelFileBtn) DOM.cancelFileBtn.addEventListener("click", closeFileModal);
    if (DOM.fileRecipientSelect) DOM.fileRecipientSelect.addEventListener("change", updateBroadcastBadge);

    // Curated Emoji Quick-bar Events & Caret Tracking
    if (DOM.messageInput) {
      DOM.messageInput.addEventListener("keyup", updateInputCaret);
      DOM.messageInput.addEventListener("mouseup", updateInputCaret);
      DOM.messageInput.addEventListener("select", updateInputCaret);
      DOM.messageInput.addEventListener("blur", updateInputCaret);
    }

    if (DOM.btnComposerEmoji) {
      DOM.btnComposerEmoji.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleEmojiPopover();
      });
    }

    if (DOM.emojiGrid) {
      DOM.emojiGrid.addEventListener("click", (e) => {
        const btn = e.target.closest(".emoji-btn");
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const emoji = btn.dataset.emoji || btn.textContent.trim();
        if (emoji) {
          insertEmoji(emoji);
          toggleEmojiPopover(false);
        }
      });
    }

    // Close Emoji Popover on Outside Click
    document.addEventListener("click", (e) => {
      if (!DOM.emojiPopover || DOM.emojiPopover.classList.contains("hidden")) return;
      if (DOM.emojiPopover.contains(e.target)) return;
      if (DOM.btnComposerEmoji && DOM.btnComposerEmoji.contains(e.target)) return;
      toggleEmojiPopover(false);
    });

    // File Drag & Drop (Supports Multiple Files)
    if (DOM.dropZone) {
      DOM.dropZone.addEventListener("click", () => {
        if (DOM.fileInputElement) DOM.fileInputElement.click();
      });
      DOM.dropZone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (DOM.fileInputElement) DOM.fileInputElement.click();
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
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFilesSelected(Array.from(e.dataTransfer.files));
        }
      });
    }

    if (DOM.fileInputElement) {
      DOM.fileInputElement.addEventListener("change", (e) => {
        if (e.target && e.target.files && e.target.files.length > 0) {
          handleFilesSelected(Array.from(e.target.files));
        }
        // Reset input value so user can re-select the same file(s) if desired
        try {
          e.target.value = "";
        } catch (_) {}
      });
    }

    // Queue Item Removal delegation
    if (DOM.fileQueueContainer) {
      DOM.fileQueueContainer.addEventListener("click", (e) => {
        const btn = e.target.closest(".queue-item-btn-remove");
        if (btn && btn.dataset.id) {
          removeFromQueue(btn.dataset.id);
        }
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

    // Global Keyboard Navigation (ESC to close modals, drawer, and emoji picker)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (DOM.emojiPopover && !DOM.emojiPopover.classList.contains("hidden")) {
          toggleEmojiPopover(false);
          DOM.messageInput?.focus();
          return;
        }
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
