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
    connectionStatus: "disconnected", // "connected" | "connecting" | "disconnected"
    roomId: null,
    roomPasskey: null, // Strictly in-memory (never persisted)
    roomMode: "create", // "create" | "join"
    isE2EE: true
  };

  // WebRTC Audio/Video & RTCDataChannel P2P State
  const webrtcState = {
    peerConnection: null,
    dataChannel: null,
    localStream: null,
    remoteStream: null,
    activeTargetSid: null,
    activeTargetName: null,
    callType: "video", // "video" | "audio"
    callStatus: "idle", // "idle" | "calling" | "incoming" | "connected"
    callTimerInterval: null,
    callDurationSec: 0,
    isAudioMuted: false,
    isVideoMuted: false,
    pendingIceCandidates: [],
    pendingIncomingOffer: null,
    queuedP2PFile: null,
    rxTransfer: null
  };

  // Full-Room Multi-Peer WebRTC Mesh State
  const webrtcMesh = {
    active: false,
    callType: "audio", // "audio" | "video"
    localStream: null,
    peers: {}, // { [peerSid]: { pc, dc, username, audioEl, videoEl, stream, analyser, source, isSpeaking, pendingCandidates } }
    isAudioMuted: false,
    isVideoMuted: false,
    audioContext: null,
    localAnalyser: null,
    localSource: null,
    speakingCheckInterval: null,
    callTimerInterval: null,
    callDurationSec: 0
  };

  // DOM Elements Cache
  const DOM = {
    // Theme toggles
    htmlRoot: document.documentElement,
    btnLoginThemeToggle: document.getElementById("btn-login-theme-toggle"),
    btnThemeToggle: document.getElementById("btn-theme-toggle"),

    // Login, Room Setup & Gateway
    loginOverlay: document.getElementById("login-overlay"),
    btnModeCreate: document.getElementById("btn-mode-create"),
    btnModeJoin: document.getElementById("btn-mode-join"),
    btnCreateRoom: document.getElementById("btn-create-room"),
    btnJoinRoom: document.getElementById("btn-join-room"),
    btnCreateRoomText: document.getElementById("btn-create-room-text"),
    btnJoinRoomText: document.getElementById("btn-join-room-text"),
    usernameInput: document.getElementById("username-input"),
    roomInput: document.getElementById("room-input"),
    passkeyInput: document.getElementById("passkey-input"),
    btnGenerateRoom: document.getElementById("btn-generate-room"),
    btnScanQr: document.getElementById("btn-scan-qr"),
    btnScanQrSecondary: document.getElementById("btn-scan-qr-secondary"),
    qrScannerModal: document.getElementById("qr-scanner-modal"),
    btnCloseScannerModal: document.getElementById("btn-close-scanner-modal"),
    btnCancelScanner: document.getElementById("btn-cancel-scanner"),
    qrScannerError: document.getElementById("qr-scanner-error"),
    btnTogglePasskey: document.getElementById("btn-toggle-passkey"),
    iconPasskeyVisibility: document.getElementById("icon-passkey-visibility"),
    connectBtnText: document.getElementById("connect-btn-text"),
    roomInputHint: document.getElementById("room-input-hint"),
    hostInput: document.getElementById("host-input"),
    portInput: document.getElementById("port-input"),
    connectBtn: document.getElementById("connect-btn") || document.getElementById("btn-create-room"),
    loginError: document.getElementById("login-error"),
    loginErrorText: document.getElementById("login-error-text"),
    loginStatusBadge: document.getElementById("login-status-badge"),
    loginStatusText: document.getElementById("login-status-text"),
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
    btnSidebarToggle: document.getElementById("btn-sidebar-toggle"),
    btnMobileMenu: document.getElementById("btn-mobile-menu") || document.getElementById("btn-sidebar-toggle"),
    sidebarStatusBadge: document.querySelector(".sidebar-brand .badge-status"),
    myAvatar: document.getElementById("my-avatar"),
    myUsername: document.getElementById("my-username"),
    myEndpoint: document.getElementById("my-endpoint"),
    userCount: document.getElementById("user-count"),
    mobileUserCount: document.getElementById("mobile-user-count"),
    usersNavList: document.getElementById("users-nav-list"),
    btnPublicRoom: document.getElementById("btn-public-room"),
    btnSidebarDisconnect: document.getElementById("btn-sidebar-disconnect"),
    btnDrawerDisconnect: document.getElementById("btn-drawer-disconnect"),
    btnDrawerShareFile: document.getElementById("btn-drawer-share-file"),
    btnDrawerDiagnostics: document.getElementById("btn-drawer-diagnostics"),
    btnDrawerTheme: document.getElementById("btn-drawer-theme"),
    drawerThemeLabel: document.getElementById("drawer-theme-label"),
    btnDrawerCopyLink: document.getElementById("btn-drawer-copy-link"),
    iconDrawerCopyLink: document.getElementById("icon-drawer-copy-link"),
    drawerCopyLinkTitle: document.getElementById("drawer-copy-link-title"),
    drawerLatencyText: document.getElementById("drawer-latency-text"),
    btnPwaInstall: document.getElementById("btn-pwa-install"),
    btnDrawerPwaInstall: document.getElementById("btn-drawer-pwa-install"),

    // Chat Header & Messages
    activeChatTitle: document.getElementById("active-chat-title"),
    activeChatDesc: document.getElementById("active-chat-desc"),
    btnCopyRoomLink: document.getElementById("btn-copy-room-link"),
    btnHeaderShareRoom: document.getElementById("btn-header-share-room"),
    iconCopyInvite: document.getElementById("icon-copy-invite"),
    copyInviteText: document.getElementById("copy-invite-text"),
    headerChannelIcon: document.getElementById("header-channel-icon"),

    // Share Room & QR Code Modal
    shareRoomModal: document.getElementById("share-room-modal"),
    btnCloseShareModal: document.getElementById("btn-close-share-modal"),
    roomQrCode: document.getElementById("room-qr-code"),
    shareRoomUrlInput: document.getElementById("share-room-url-input"),
    btnCopyShareUrl: document.getElementById("btn-copy-share-url"),
    textShareCopy: document.getElementById("text-share-copy"),
    iconShareCopy: document.getElementById("icon-share-copy"),
    shareRoomIdVal: document.getElementById("share-room-id-val"),
    headerStatusPill: document.getElementById("header-status-pill"),
    headerStatusDot: document.getElementById("header-status-dot"),
    headerStatusText: document.getElementById("header-status-text"),
    headerLatencyText: document.getElementById("header-latency-text"),
    messagesContainer: document.getElementById("messages-container"),
    emptyState: document.getElementById("empty-state"),
    btnJumpLatest: document.getElementById("btn-jump-latest"),
    typingIndicator: document.getElementById("typing-indicator"),
    typingText: document.getElementById("typing-text"),
    replyBanner: document.getElementById("reply-banner"),
    replyBannerUser: document.getElementById("reply-banner-user"),
    replyBannerSnippet: document.getElementById("reply-banner-snippet"),
    btnCancelReply: document.getElementById("btn-cancel-reply"),
    chatForm: document.getElementById("chat-form"),
    messageInput: document.getElementById("message-input"),
    btnComposerAttach: document.getElementById("btn-composer-attach"),
    btnComposerEmoji: document.getElementById("btn-composer-emoji"),
    emojiPopover: document.getElementById("emoji-popover"),
    emojiGrid: document.getElementById("emoji-grid"),
    mentionsPopover: document.getElementById("mentions-popover"),
    mentionsList: document.getElementById("mentions-list"),
    btnDisconnect: document.getElementById("btn-disconnect"),

    // WebRTC Audio/Video & Direct P2P File Elements
    btnHeaderAudioCall: document.getElementById("btn-header-audio-call"),
    btnHeaderCall: document.getElementById("btn-header-call"),
    p2pFileInput: document.getElementById("p2p-file-input"),
    webrtcAudioBar: document.getElementById("webrtc-audio-bar"),
    audioBarParticipants: document.getElementById("audio-bar-participants"),
    audioBarTimer: document.getElementById("audio-bar-timer"),
    btnAudioBarMic: document.getElementById("btn-audio-bar-mic"),
    audioBarMicIcon: document.getElementById("audio-bar-mic-icon"),
    btnAudioBarCam: document.getElementById("btn-audio-bar-cam"),
    btnAudioBarLeave: document.getElementById("btn-audio-bar-leave"),
    webrtcCallAnnouncement: document.getElementById("webrtc-call-announcement"),
    announcementCaller: document.getElementById("announcement-caller"),
    btnAnnouncementJoin: document.getElementById("btn-announcement-join"),
    btnAnnouncementDismiss: document.getElementById("btn-announcement-dismiss"),
    remoteAudioContainer: document.getElementById("remote-audio-container"),
    webrtcVideoGrid: document.getElementById("webrtc-video-grid"),
    webrtcCallOverlay: document.getElementById("webrtc-call-overlay"),
    webrtcCallCard: document.getElementById("webrtc-call-card"),
    webrtcPeerName: document.getElementById("webrtc-peer-name"),
    webrtcCallTimer: document.getElementById("webrtc-call-timer"),
    btnWebrtcMinimize: document.getElementById("btn-webrtc-minimize"),
    webrtcRemoteVideo: document.getElementById("webrtc-remote-video"),
    webrtcRemotePlaceholder: document.getElementById("webrtc-remote-placeholder"),
    webrtcPlaceholderText: document.getElementById("webrtc-placeholder-text"),
    webrtcLocalPip: document.getElementById("webrtc-local-pip"),
    webrtcLocalVideo: document.getElementById("webrtc-local-video"),
    webrtcConnectingBadge: document.getElementById("webrtc-connecting-badge"),
    webrtcConnectingText: document.getElementById("webrtc-connecting-text"),
    btnWebrtcMic: document.getElementById("btn-webrtc-mic"),
    webrtcIconMic: document.getElementById("webrtc-icon-mic"),
    btnWebrtcCam: document.getElementById("btn-webrtc-cam"),
    webrtcIconCam: document.getElementById("webrtc-icon-cam"),
    btnWebrtcFlipCam: document.getElementById("btn-webrtc-flip-cam"),
    webrtcIconFlipCam: document.getElementById("webrtc-icon-flip-cam"),
    btnWebrtcMirrorCam: document.getElementById("btn-webrtc-mirror-cam"),
    webrtcIconMirrorCam: document.getElementById("webrtc-icon-mirror-cam"),
    btnWebrtcEnd: document.getElementById("btn-webrtc-end"),
    webrtcIncomingModal: document.getElementById("webrtc-incoming-modal"),
    webrtcCallerName: document.getElementById("webrtc-caller-name"),
    btnWebrtcDecline: document.getElementById("btn-webrtc-decline"),
    btnWebrtcAccept: document.getElementById("btn-webrtc-accept"),

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
  // SINGLE SOURCE OF TRUTH: CONNECTION STATUS MANAGER & MODAL BADGE
  // =========================================================================
  function updateModalConnectionBadge(stateClass, labelText) {
    const badge = DOM.loginStatusBadge || document.getElementById("login-status-badge");
    const textEl = DOM.loginStatusText || document.getElementById("login-status-text");
    if (badge) {
      badge.className = "modal-status-badge " + stateClass;
    }
    if (textEl) {
      textEl.textContent = labelText;
    }
  }

  function setConnectionStatus(status, label) {
    state.connectionStatus = status; // "connected" | "connecting" | "disconnected"

    const isConnected = status === "connected";
    state.isConnected = isConnected;

    // Sync Minimal Modal Connection Status Badge
    if (status === "connected") {
      updateModalConnectionBadge("status-connected", "Connected");
    } else if (status === "connecting") {
      updateModalConnectionBadge("status-connecting", "Connecting...");
    } else {
      updateModalConnectionBadge("status-disconnected", "Offline");
    }

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

    // Sidebar status badge (CSS status dot + readable text + latency/ping)
    if (DOM.sidebarStatusBadge) {
      DOM.sidebarStatusBadge.className = "badge-status " + (isConnected ? "online" : (status === "connecting" ? "connecting" : "offline"));
      const pingText = (isConnected && state.latencyMs > 0) ? ` • ${state.latencyMs}ms` : "";
      DOM.sidebarStatusBadge.innerHTML = `<span class="status-dot ${status}"></span><span class="badge-text">${isConnected ? "ONLINE" : (status === "connecting" ? "CONNECTING" : "OFFLINE")}${pingText}</span>`;
    }
    if (DOM.drawerLatencyText) {
      if (isConnected && state.latencyMs > 0) {
        DOM.drawerLatencyText.textContent = `${state.latencyMs} ms`;
        DOM.drawerLatencyText.classList.remove("hidden");
      } else {
        DOM.drawerLatencyText.textContent = "";
        DOM.drawerLatencyText.classList.add("hidden");
      }
    }

    // Header connection control (Unplug for disconnect, RefreshCw for reconnect)
    if (DOM.btnDisconnect) {
      if (isConnected) {
        DOM.btnDisconnect.innerHTML = `<svg class="svg-icon w-5 h-5" aria-hidden="true"><use href="#icon-unplug"></use></svg>`;
        DOM.btnDisconnect.setAttribute("title", "Disconnect");
        DOM.btnDisconnect.setAttribute("aria-label", "Disconnect");
      } else {
        DOM.btnDisconnect.innerHTML = `<svg class="svg-icon w-5 h-5" aria-hidden="true"><use href="#icon-refresh-cw"></use></svg>`;
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
    if (DOM.tabPeers && DOM.tabPeers.classList.contains("active")) {
      setMobileActiveTab("chat");
    }
  }

  function toggleSidebar() {
    if (window.innerWidth <= 768) {
      if (DOM.sidebar && DOM.sidebar.classList.contains("open")) {
        closeSidebar();
      } else {
        openSidebar();
      }
    } else {
      if (DOM.sidebar) {
        DOM.sidebar.classList.toggle("collapsed");
        updateResizerChevron();
      }
    }
  }

  function updateResizerChevron() {
    const chevronIcon = document.getElementById("resizer-chevron");
    if (!chevronIcon || !DOM.sidebar) return;
    const isCollapsed = DOM.sidebar.classList.contains("collapsed");
    const useEl = chevronIcon.querySelector("use");
    if (useEl) {
      useEl.setAttribute("href", isCollapsed ? "#icon-chevron-right" : "#icon-chevron-left");
    }
    const toggleBtn = document.getElementById("btn-resizer-toggle");
    if (toggleBtn) {
      toggleBtn.setAttribute("title", isCollapsed ? "Expand Sidebar" : "Collapse Sidebar");
      toggleBtn.setAttribute("aria-label", isCollapsed ? "Expand Sidebar" : "Collapse Sidebar");
    }
  }

  function initSidebarResizer() {
    const resizer = document.getElementById("sidebar-resizer");
    const toggleBtn = document.getElementById("btn-resizer-toggle");
    if (!resizer || !DOM.sidebar) return;

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;
    const MIN_WIDTH = 200;
    const MAX_WIDTH = 400;

    try {
      const savedWidth = localStorage.getItem("netchat_sidebar_width");
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
          DOM.sidebar.style.width = parsed + "px";
        }
      }
    } catch (_) {}

    updateResizerChevron();

    if (toggleBtn) {
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleSidebar();
      });
    }

    resizer.addEventListener("mousedown", (e) => {
      if (e.target.closest("#btn-resizer-toggle")) return;
      if (window.innerWidth <= 768) return;

      isDragging = true;
      startX = e.clientX;
      startWidth = DOM.sidebar.getBoundingClientRect().width;
      resizer.classList.add("dragging");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      DOM.sidebar.style.transition = "none";

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const delta = moveEvent.clientX - startX;
        let newWidth = startWidth + delta;
        newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));

        if (DOM.sidebar.classList.contains("collapsed")) {
          DOM.sidebar.classList.remove("collapsed");
          updateResizerChevron();
        }

        DOM.sidebar.style.width = newWidth + "px";
      };

      const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        resizer.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        DOM.sidebar.style.transition = "";

        const finalWidth = DOM.sidebar.getBoundingClientRect().width;
        try {
          if (finalWidth >= MIN_WIDTH && finalWidth <= MAX_WIDTH) {
            localStorage.setItem("netchat_sidebar_width", Math.round(finalWidth));
          }
        } catch (_) {}

        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
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

  // Configurable backend target
  // Can be set globally via window.NETCHAT_BACKEND_URL or defaults to origin when local, otherwise Render
  const BACKEND_URL = (typeof window !== "undefined" && window.NETCHAT_BACKEND_URL)
    || (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? window.location.origin
      : "https://netchat-live.onrender.com");

  let reconnectAttemptsCount = 0;

  function updateWakeupBanner(isWaking, message) {
    if (isWaking) {
      updateModalConnectionBadge("status-connecting", "Connecting...");
    } else if (state.isConnected) {
      updateModalConnectionBadge("status-connected", "Connected");
    } else {
      updateModalConnectionBadge("status-disconnected", "Offline");
    }
  }

  // =========================================================================
  // ZERO-KNOWLEDGE E2EE CRYPTOGRAPHY ENGINE (WEB CRYPTO API)
  // AES-256-GCM + PBKDF2 (SHA-256, 600,000 iterations)
  // =========================================================================
  const E2EE = (function () {
    const PBKDF2_ITERATIONS = 600000;
    const SALT_LENGTH = 16;
    const IV_LENGTH = 12;

    function uint8ArrayToBase64(bytes) {
      let binary = "";
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }

    function base64ToUint8Array(base64) {
      const binary = window.atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    async function importPasskey(passkey) {
      const enc = new TextEncoder();
      return window.crypto.subtle.importKey(
        "raw",
        enc.encode(passkey),
        "PBKDF2",
        false,
        ["deriveKey"]
      );
    }

    async function deriveAesKey(baseKey, salt) {
      return window.crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: PBKDF2_ITERATIONS,
          hash: "SHA-256"
        },
        baseKey,
        {
          name: "AES-GCM",
          length: 256
        },
        false,
        ["encrypt", "decrypt"]
      );
    }

    async function encryptMessage(plaintext, passkey) {
      if (!passkey) throw new Error("Missing encryption passkey");
      const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
      const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
      const baseKey = await importPasskey(passkey);
      const aesKey = await deriveAesKey(baseKey, salt);

      const enc = new TextEncoder();
      const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        enc.encode(plaintext)
      );

      const ciphertext = new Uint8Array(ciphertextBuffer);
      const packed = new Uint8Array(salt.length + iv.length + ciphertext.length);
      packed.set(salt, 0);
      packed.set(iv, salt.length);
      packed.set(ciphertext, salt.length + iv.length);

      return uint8ArrayToBase64(packed);
    }

    async function decryptMessage(base64Payload, passkey) {
      if (!base64Payload || !passkey) return null;
      try {
        const packed = base64ToUint8Array(base64Payload);
        if (packed.length < SALT_LENGTH + IV_LENGTH + 16) return null;

        const salt = packed.subarray(0, SALT_LENGTH);
        const iv = packed.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const ciphertext = packed.subarray(SALT_LENGTH + IV_LENGTH);

        const baseKey = await importPasskey(passkey);
        const aesKey = await deriveAesKey(baseKey, salt);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: "AES-GCM", iv: iv },
          aesKey,
          ciphertext
        );

        return new TextDecoder().decode(decryptedBuffer);
      } catch (err) {
        return null;
      }
    }

    return { encryptMessage, decryptMessage };
  })();

  function generateRandomRoomId() {
    const adjectives = ["quantum", "cyber", "stealth", "shadow", "apex", "nexus", "prism", "zero"];
    const nouns = ["room", "channel", "relay", "vault", "core", "node", "matrix", "shield"];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(100 + Math.random() * 900);
    return `${adj}-${noun}-${num}`;
  }

  function setRoomMode(mode) {
    state.roomMode = mode;
    clearLoginError();
    if (DOM.btnModeCreate && DOM.btnModeJoin) {
      DOM.btnModeCreate.classList.toggle("active", mode === "create");
      DOM.btnModeCreate.setAttribute("aria-selected", mode === "create" ? "true" : "false");
      DOM.btnModeJoin.classList.toggle("active", mode === "join");
      DOM.btnModeJoin.setAttribute("aria-selected", mode === "join" ? "true" : "false");
    }

    const btnCreate = DOM.btnCreateRoom;
    const btnJoin = DOM.btnJoinRoom;
    if (btnCreate && btnJoin) {
      if (mode === "create") {
        btnCreate.style.display = "inline-flex";
        btnJoin.style.display = "none";
      } else {
        btnCreate.style.display = "none";
        btnJoin.style.display = "inline-flex";
      }
    }

    const btnScan = DOM.btnScanQr;
    const btnScanSec = DOM.btnScanQrSecondary;
    const btnGen = DOM.btnGenerateRoom;
    if (btnScan) btnScan.style.display = (mode === "join") ? "inline-flex" : "none";
    if (btnScanSec) btnScanSec.style.display = (mode === "join") ? "inline-flex" : "none";
    if (btnGen) btnGen.style.display = (mode === "create") ? "inline-flex" : "none";

    if (mode === "create") {
      if (DOM.roomInput && DOM.roomInput.readOnly) {
        DOM.roomInput.readOnly = false;
        DOM.roomInput.classList.remove("input-locked");
        DOM.roomInput.removeAttribute("title");
      }
      if (DOM.passkeyInput && DOM.passkeyInput.readOnly) {
        DOM.passkeyInput.readOnly = false;
        DOM.passkeyInput.classList.remove("input-locked");
        DOM.passkeyInput.removeAttribute("title");
      }
      const banner = document.getElementById("invite-room-banner");
      if (banner) banner.style.display = "none";
    }

    if (DOM.connectBtnText) {
      DOM.connectBtnText.textContent = mode === "create" ? "Create & Enter Room" : "Join Encrypted Room";
    }

    if (DOM.roomInputHint) {
      DOM.roomInputHint.textContent = mode === "create"
        ? "Unique room identifier shared between peers."
        : "Enter the Room ID given to you by the room creator.";
    }
  }

  function togglePasskeyVisibility() {
    if (!DOM.passkeyInput) return;
    const isPass = DOM.passkeyInput.type === "password";
    DOM.passkeyInput.type = isPass ? "text" : "password";
    if (DOM.iconPasskeyVisibility) {
      DOM.iconPasskeyVisibility.innerHTML = `<use href="#icon-${isPass ? "eye-off" : "eye"}"></use>`;
    }
  }

  // =========================================================================
  // TYPING INDICATOR CONTROLLER
  // =========================================================================
  const typingState = {
    isTyping: false,
    timeout: null,
    activeTypers: new Map() // username -> timeoutId
  };

  function handleInputTyping() {
    if (!state.roomId || !state.username || !state.socket) return;

    if (!typingState.isTyping) {
      typingState.isTyping = true;
      state.socket.emit("typing", {
        room_id: state.roomId,
        username: state.username
      });
      // Also emit user_typing for compatibility
      state.socket.emit("user_typing", {
        room_id: state.roomId,
        username: state.username
      });
    }

    if (typingState.timeout) {
      clearTimeout(typingState.timeout);
    }

    // Debounce: reset 1.5-second timeout on every keystroke
    typingState.timeout = setTimeout(() => {
      stopTyping();
    }, 1500);
  }

  function stopTyping() {
    if (typingState.isTyping) {
      typingState.isTyping = false;
      if (typingState.timeout) {
        clearTimeout(typingState.timeout);
        typingState.timeout = null;
      }
      if (state.roomId && state.username && state.socket) {
        state.socket.emit("stop_typing", {
          room_id: state.roomId,
          username: state.username
        });
        state.socket.emit("user_stop_typing", {
          room_id: state.roomId,
          username: state.username
        });
      }
    }
  }

  function renderTypingIndicator() {
    if (!DOM.typingIndicator) return;
    const typers = Array.from(typingState.activeTypers.keys());

    if (typers.length === 0) {
      DOM.typingIndicator.classList.add("hidden");
      if (DOM.typingText) DOM.typingText.textContent = "";
      return;
    }

    let text = "";
    if (typers.length === 1) {
      text = `${typers[0]} is typing...`;
    } else if (typers.length === 2) {
      text = `${typers[0]} and ${typers[1]} are typing...`;
    } else {
      text = `${typers[0]}, ${typers[1]} and ${typers.length - 2} more are typing...`;
    }

    if (DOM.typingText) {
      DOM.typingText.textContent = text;
    }
    DOM.typingIndicator.classList.remove("hidden");
  }

  // =========================================================================
  // MESSAGE REPLIES CONTROLLER
  // =========================================================================
  let activeReply = null; // { id, sender, snippet }

  function initiateReply(messageId, sender, text) {
    const rawText = (text || "").trim();
    const snippet = rawText.length > 70 ? rawText.substring(0, 70) + "..." : rawText;

    activeReply = {
      id: messageId || "",
      sender: sender || "Anonymous",
      snippet: snippet || "(attachment)"
    };

    if (DOM.replyBanner) {
      if (DOM.replyBannerUser) DOM.replyBannerUser.textContent = activeReply.sender;
      if (DOM.replyBannerSnippet) DOM.replyBannerSnippet.textContent = activeReply.snippet;
      DOM.replyBanner.classList.remove("hidden");
    }

    if (DOM.messageInput) {
      DOM.messageInput.focus();
    }
  }

  function cancelReply() {
    activeReply = null;
    if (DOM.replyBanner) {
      DOM.replyBanner.classList.add("hidden");
      if (DOM.replyBannerUser) DOM.replyBannerUser.textContent = "";
      if (DOM.replyBannerSnippet) DOM.replyBannerSnippet.textContent = "";
    }
  }

  // =========================================================================
  // SHAREABLE ROOM LINK & QR CODE CONTROLLER (DIRECT JOIN URL & QR MODAL)
  // =========================================================================
  function checkUrlRoomParams() {
    if (state.isConnected && state.roomId) return;

    let roomParam = "";
    let pinParam = "";

    // 1. Check URL query parameters (?room=XYZ&pin=ABC)
    if (window.location.search) {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        roomParam = (searchParams.get("room") || "").trim().toLowerCase();
        pinParam = (searchParams.get("pin") || "").trim();
      } catch (_) {}
    }

    // 2. Fallback to hash parameters (#room=XYZ&pin=ABC)
    if (!roomParam && window.location.hash) {
      try {
        const rawHash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(rawHash);
        roomParam = (hashParams.get("room") || "").trim().toLowerCase();
        if (!pinParam) pinParam = (hashParams.get("pin") || "").trim();
      } catch (_) {}
    }

    if (!roomParam) return;

    // Auto-fill the Room ID input and switch to "Join Room" view
    setRoomMode("join");

    if (DOM.roomInput) {
      DOM.roomInput.value = roomParam;
      DOM.roomInput.readOnly = true;
      DOM.roomInput.classList.add("input-locked");
      DOM.roomInput.title = "Room ID auto-filled from invite URL";
    }

    if (pinParam && DOM.passkeyInput) {
      DOM.passkeyInput.value = pinParam;
      DOM.passkeyInput.readOnly = true;
      DOM.passkeyInput.classList.add("input-locked");
      DOM.passkeyInput.title = "Passkey auto-filled from invite URL";
    }

    let inviteBanner = document.getElementById("invite-room-banner");
    if (!inviteBanner) {
      inviteBanner = document.createElement("div");
      inviteBanner.id = "invite-room-banner";
      inviteBanner.className = "alert-banner alert-info";
      const usernameGroup = DOM.usernameInput ? DOM.usernameInput.closest(".form-group") : null;
      if (usernameGroup && usernameGroup.parentNode) {
        usernameGroup.parentNode.insertBefore(inviteBanner, usernameGroup);
      }
    }
    const pinText = pinParam ? " (Passkey Loaded)" : "";
    inviteBanner.innerHTML = `<strong>Room Invite:</strong> Ready to join <code>${escapeHtml(roomParam)}</code>${pinText}`;
    inviteBanner.style.display = "block";

    if (DOM.btnJoinRoomText) DOM.btnJoinRoomText.textContent = `Join ${roomParam}`;
    if (DOM.connectBtnText) DOM.connectBtnText.textContent = `Join ${roomParam}`;

    // Leave only the Username field blank and automatically set focus to it
    if (DOM.usernameInput) {
      DOM.usernameInput.value = "";
      setTimeout(() => {
        DOM.usernameInput.focus();
      }, 50);
    }

    logActivity(`Auto-filled Room ID '${roomParam}'${pinParam ? " and passkey" : ""} from invite URL.`);
  }

  function generateShareUrl(roomId, pin) {
    const id = roomId || state.roomId || "";
    const roomPin = (pin !== undefined && pin !== null)
      ? String(pin).trim()
      : (state.roomPasskey ? String(state.roomPasskey).trim() : "");

    // Dynamically read the current domain using window.location.origin
    const baseOrigin = (typeof window !== "undefined" && window.location && window.location.origin)
      ? window.location.origin
      : "https://netchat-live.onrender.com";

    const joinUrl = new URL(baseOrigin);
    if (id) {
      joinUrl.searchParams.set("room", id);
    }
    if (roomPin) {
      joinUrl.searchParams.set("pin", roomPin);
    }
    const finalUrl = joinUrl.toString();
    return finalUrl;
  }

  let qrCodeInstance = null;

  function renderRoomQrCode(url) {
    const qrContainer = DOM.roomQrCode;
    if (!qrContainer) return;

    // 1. Clear the QR container before generating a new QR code
    qrContainer.innerHTML = "";

    try {
      if (typeof QRCode !== "undefined") {
        if (typeof QRCode.toCanvas === "function") {
          const canvas = document.createElement("canvas");
          canvas.className = "max-w-full h-auto object-contain";
          qrContainer.appendChild(canvas);
          QRCode.toCanvas(canvas, url, {
            width: 200,
            margin: 1,
            color: { dark: "#09090b", light: "#ffffff" }
          }, function (err) {
            if (err) console.warn("QRCode.toCanvas error:", err);
          });
        } else {
          qrCodeInstance = new QRCode(qrContainer, {
            text: url,
            width: 200,
            height: 200,
            colorDark: "#09090b",
            colorLight: "#ffffff",
            correctLevel: (typeof QRCode.CorrectLevel !== "undefined") ? QRCode.CorrectLevel.M : 0
          });

          // Prevent duplicate elements from qrcodejs (which outputs both canvas and img)
          const canvas = qrContainer.querySelector("canvas");
          const img = qrContainer.querySelector("img");
          if (canvas && img) {
            img.style.display = "none";
            img.setAttribute("aria-hidden", "true");
          }
          if (canvas) {
            canvas.classList.add("max-w-full", "h-auto", "object-contain");
          } else if (img) {
            img.classList.add("max-w-full", "h-auto", "object-contain");
          }
        }
      } else {
        qrContainer.innerHTML = `<span style="color:#a1a1aa;font-size:0.85rem;">QR Generator Loading...</span>`;
      }
    } catch (err) {
      console.warn("Failed to generate QR code:", err);
      qrContainer.innerHTML = `<span style="color:#ef4444;font-size:0.85rem;">Failed to render QR Code</span>`;
    }
  }

  function openShareRoomModal() {
    if (!state.roomId) return;
    const roomId = state.roomId;
    const roomPin = state.roomPasskey || "";
    const finalUrl = generateShareUrl(roomId, roomPin);

    if (DOM.shareRoomIdVal) {
      DOM.shareRoomIdVal.textContent = roomId;
    }
    if (DOM.shareRoomUrlInput) {
      DOM.shareRoomUrlInput.value = finalUrl;
    }

    // Ensure finalUrl is the exact string passed to the QR code rendering library
    renderRoomQrCode(finalUrl);

    if (DOM.shareRoomModal) {
      DOM.shareRoomModal.classList.remove("hidden");
    }
  }

  function closeShareRoomModal() {
    if (DOM.shareRoomModal) {
      DOM.shareRoomModal.classList.add("hidden");
    }
  }

  async function handleCopyShareUrl() {
    // Ensure the Copy Link action copies the exact finalUrl
    const finalUrl = (DOM.shareRoomUrlInput && DOM.shareRoomUrlInput.value)
      ? DOM.shareRoomUrlInput.value
      : generateShareUrl(state.roomId, state.roomPasskey);
    if (!finalUrl) return;

    let copied = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(finalUrl);
        copied = true;
      } catch (_) {}
    }
    if (!copied) {
      try {
        if (DOM.shareRoomUrlInput) {
          DOM.shareRoomUrlInput.select();
          DOM.shareRoomUrlInput.setSelectionRange(0, 99999);
        }
        copied = document.execCommand("copy");
      } catch (_) {}
    }

    const btn = DOM.btnCopyShareUrl;
    const text = DOM.textShareCopy;
    const icon = DOM.iconShareCopy;

    if (btn) btn.classList.add("copied");
    if (text) text.textContent = "Copied!";
    if (icon) icon.innerHTML = `<use href="#icon-check"></use>`;

    setTimeout(() => {
      if (btn) btn.classList.remove("copied");
      if (text) text.textContent = "Copy Link";
      if (icon) icon.innerHTML = `<use href="#icon-link"></use>`;
    }, 2000);
  }

  async function copyInviteLink() {
    openShareRoomModal();
  }

  // =========================================================================
  // IN-APP QR CODE CAMERA SCANNER (Html5Qrcode)
  // =========================================================================
  let html5QrScannerInstance = null;
  let isQrScannerScanning = false;

  async function startQrScanner() {
    clearLoginError();

    if (typeof Html5Qrcode === "undefined") {
      showLoginError("QR Scanner library is loading. Please check your network and try again.");
      return;
    }

    if (DOM.qrScannerModal) {
      DOM.qrScannerModal.classList.remove("hidden");
    }
    if (DOM.qrScannerError) {
      DOM.qrScannerError.classList.add("hidden");
      DOM.qrScannerError.textContent = "";
    }

    try {
      if (!html5QrScannerInstance) {
        html5QrScannerInstance = new Html5Qrcode("qr-reader");
      }

      const qrConfig = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      isQrScannerScanning = true;

      await html5QrScannerInstance.start(
        { facingMode: "environment" },
        qrConfig,
        (decodedText) => {
          handleQrScanSuccess(decodedText);
        },
        () => {
          // ignore frame parse errors
        }
      );
    } catch (err) {
      console.warn("[QR Scanner] Failed to start camera:", err);
      isQrScannerScanning = false;
      if (DOM.qrScannerError) {
        DOM.qrScannerError.textContent = "Camera access denied or unavailable. Please grant camera permission or enter Room ID manually.";
        DOM.qrScannerError.classList.remove("hidden");
      }
    }
  }

  async function stopQrScanner() {
    if (html5QrScannerInstance && isQrScannerScanning) {
      try {
        await html5QrScannerInstance.stop();
        html5QrScannerInstance.clear();
      } catch (err) {
        console.warn("[QR Scanner] Error stopping camera:", err);
      }
    }
    isQrScannerScanning = false;
    if (DOM.qrScannerModal) {
      DOM.qrScannerModal.classList.add("hidden");
    }
    if (DOM.qrScannerError) {
      DOM.qrScannerError.classList.add("hidden");
    }
  }

  async function handleQrScanSuccess(decodedText) {
    if (!decodedText) return;
    await stopQrScanner();

    let room = "";
    let pin = "";

    try {
      if (decodedText.startsWith("http://") || decodedText.startsWith("https://") || decodedText.includes("?")) {
        const url = new URL(decodedText, window.location.origin);
        room = (url.searchParams.get("room") || "").trim().toLowerCase();
        pin = (url.searchParams.get("pin") || "").trim();
      } else {
        const params = new URLSearchParams(decodedText);
        room = (params.get("room") || "").trim().toLowerCase();
        pin = (params.get("pin") || "").trim();
      }
    } catch (_) {
      const matchRoom = decodedText.match(/[?&]room=([^&]+)/i);
      const matchPin = decodedText.match(/[?&]pin=([^&]+)/i);
      if (matchRoom) room = decodeURIComponent(matchRoom[1]).trim().toLowerCase();
      if (matchPin) pin = decodeURIComponent(matchPin[1]).trim();
    }

    if (room) {
      setRoomMode("join");

      if (DOM.roomInput) {
        DOM.roomInput.value = room;
        DOM.roomInput.readOnly = true;
        DOM.roomInput.classList.add("input-locked");
        DOM.roomInput.title = "Room ID auto-filled from QR code";
      }

      if (pin && DOM.passkeyInput) {
        DOM.passkeyInput.value = pin;
        DOM.passkeyInput.readOnly = true;
        DOM.passkeyInput.classList.add("input-locked");
        DOM.passkeyInput.title = "Passkey auto-filled from QR code";
      }

      clearLoginError();

      let inviteBanner = document.getElementById("invite-room-banner");
      if (!inviteBanner) {
        inviteBanner = document.createElement("div");
        inviteBanner.id = "invite-room-banner";
        inviteBanner.className = "alert-banner alert-info";
        const usernameGroup = DOM.usernameInput ? DOM.usernameInput.closest(".form-group") : null;
        if (usernameGroup && usernameGroup.parentNode) {
          usernameGroup.parentNode.insertBefore(inviteBanner, usernameGroup);
        }
      }
      const pinText = pin ? " (Passkey Loaded)" : "";
      inviteBanner.innerHTML = `<strong>QR Scanned:</strong> Ready to join <code>${escapeHtml(room)}</code>${pinText}`;
      inviteBanner.style.display = "block";

      if (DOM.btnJoinRoomText) DOM.btnJoinRoomText.textContent = `Join ${room}`;
      if (DOM.connectBtnText) DOM.connectBtnText.textContent = `Join ${room}`;

      if (DOM.usernameInput) {
        DOM.usernameInput.value = "";
        setTimeout(() => {
          DOM.usernameInput.focus();
        }, 50);
      }

      logActivity(`Scanned QR code: Auto-filled Room ID '${room}'${pin ? " and passkey" : ""}.`);
      if (navigator.vibrate) {
        try { navigator.vibrate(50); } catch (_) {}
      }
    } else {
      showLoginError("Scanned QR code does not contain a valid NetChat room invite.");
    }
  }

  // PWA Standalone Detection & Complete DOM Removal
  const isPwaInstalled = Boolean(
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) ||
    (window.matchMedia && window.matchMedia('(display-mode: minimal-ui)').matches) ||
    window.navigator.standalone === true ||
    (document.referrer && document.referrer.includes('android-app://'))
  );

  function checkPwaInstalled() {
    if (isPwaInstalled) {
      if (DOM.btnPwaInstall && DOM.btnPwaInstall.parentNode) {
        DOM.btnPwaInstall.remove();
      }
      if (DOM.btnDrawerPwaInstall && DOM.btnDrawerPwaInstall.parentNode) {
        DOM.btnDrawerPwaInstall.remove();
      }
      const pwaToast = document.getElementById("pwa-toast");
      if (pwaToast && pwaToast.parentNode) {
        pwaToast.remove();
      }
    }
  }

  function init() {
    checkPwaInstalled();
    initTheme();
    initSidebarResizer();
    updateModalConnectionBadge("status-connecting", "Connecting...");
    setConnectionStatus("disconnected", "Connecting...");

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
    setRoomMode("create");
    checkUrlRoomParams();
    connectSocket();
  }

  function connectSocket() {
    updateModalConnectionBadge("status-connecting", "Connecting...");

    state.socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    state.socket.on("connect", () => {
      logActivity(`WebSocket transport established with Gateway (${BACKEND_URL}).`);
      reconnectAttemptsCount = 0;
      updateModalConnectionBadge("status-connected", "Connected");
      if (DOM.miniTransport) DOM.miniTransport.textContent = "WebSocket";
      if (DOM.diagTransport) DOM.diagTransport.textContent = "WebSocket";
      startPingMonitoring();
    });

    state.socket.on("disconnect", () => {
      logActivity("WebSocket connection to Gateway closed.");
      setConnectionStatus("disconnected", "Disconnected");
      updateModalConnectionBadge("status-disconnected", "Offline");
    });

    state.socket.on("connect_error", (error) => {
      reconnectAttemptsCount++;
      logActivity(`Connection pending/delayed (attempt ${reconnectAttemptsCount})...`);
      setConnectionStatus("disconnected", "Connecting...");
      updateModalConnectionBadge("status-connecting", "Connecting...");
    });

    if (state.socket.io) {
      state.socket.io.on("reconnect_attempt", (attempt) => {
        updateModalConnectionBadge("status-connecting", "Connecting...");
      });

      state.socket.io.on("reconnect", () => {
        logActivity("Reconnected to backend successfully!");
        updateModalConnectionBadge("status-connected", "Connected");
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
      const errMsg = (data && data.message)
        ? data.message
        : "Username is already taken in this room. Please choose another.";
      showLoginError(errMsg, true);
      // Keep user on join modal with username input focused and highlighted
      if (DOM.loginOverlay) {
        DOM.loginOverlay.classList.remove("hidden");
      }
      if (DOM.appContainer) {
        DOM.appContainer.classList.add("hidden");
      }
      if (DOM.usernameInput) {
        DOM.usernameInput.classList.add("input-error");
        DOM.usernameInput.focus();
      }
    });

    // Zero-Knowledge E2EE Room Socket Listeners
    state.socket.on("room_joined", (data) => {
      logActivity(`E2EE Channel established for room '${data.room_id}'. Zero-Knowledge Relay active.`);
      if (DOM.activeChatTitle) {
        DOM.activeChatTitle.textContent = `🔒 Room: ${data.room_id}`;
      }
      if (DOM.btnHeaderShareRoom) {
        DOM.btnHeaderShareRoom.classList.remove("hidden");
      }
      if (DOM.btnDisconnect) {
        DOM.btnDisconnect.classList.remove("hidden");
      }
      if (DOM.btnDrawerCopyLink) {
        DOM.btnDrawerCopyLink.classList.remove("hidden");
      }
      if (data.room_id) {
        try {
          window.location.hash = "#room=" + encodeURIComponent(data.room_id);
        } catch (_) {}
      }
      const peerList = data.peers || data.members || [];
      if (DOM.activeChatDesc) {
        DOM.activeChatDesc.textContent = "";
        DOM.activeChatDesc.classList.add("hidden");
      }
      updateUserList(peerList);
    });

    state.socket.on("update_peers", (users) => {
      if (Array.isArray(users)) {
        updateUserList(users);
      }
    });

    state.socket.on("room_peers_update", (data) => {
      // Only render if data.room_id matches the client's current active room
      if (data && data.room_id === state.roomId) {
        const peerList = data.peers || [];
        updateUserList(peerList);
        if (DOM.activeChatDesc) {
          DOM.activeChatDesc.textContent = "";
          DOM.activeChatDesc.classList.add("hidden");
        }
      }
    });

    // Real-Time Typing Indicator Socket Listeners
    const handleRemoteTyping = (data) => {
      if (!data || data.room_id !== state.roomId) return;
      if (data.username && data.username.toLowerCase() !== state.username.toLowerCase()) {
        if (typingState.activeTypers.has(data.username)) {
          clearTimeout(typingState.activeTypers.get(data.username));
        }
        const timer = setTimeout(() => {
          typingState.activeTypers.delete(data.username);
          renderTypingIndicator();
        }, 3500);
        typingState.activeTypers.set(data.username, timer);
        renderTypingIndicator();
      }
    };
    state.socket.on("typing", handleRemoteTyping);
    state.socket.on("user_typing", handleRemoteTyping);

    const handleRemoteStopTyping = (data) => {
      if (!data || data.room_id !== state.roomId) return;
      if (data.username && typingState.activeTypers.has(data.username)) {
        clearTimeout(typingState.activeTypers.get(data.username));
        typingState.activeTypers.delete(data.username);
        renderTypingIndicator();
      }
    };
    state.socket.on("stop_typing", handleRemoteStopTyping);
    state.socket.on("user_stop_typing", handleRemoteStopTyping);

    state.socket.on("receive_message", async (data) => {
      if (!data) return;

      if (data.sender && typingState.activeTypers.has(data.sender)) {
        clearTimeout(typingState.activeTypers.get(data.sender));
        typingState.activeTypers.delete(data.sender);
        renderTypingIndicator();
      }

      if (data.type === "system") {
        appendSystemMessage(data.message);
        if (data.room_id === state.roomId && (data.peers || data.members)) {
          const peerList = data.peers || data.members;
          updateUserList(peerList);
          if (DOM.activeChatDesc) {
            DOM.activeChatDesc.textContent = "";
            DOM.activeChatDesc.classList.add("hidden");
          }
        }
        return;
      }

      if (data.payload) {
        // Zero-Knowledge message decryption flow using in-memory passkey
        const decrypted = await E2EE.decryptMessage(data.payload, state.roomPasskey);
        const msgId = data.id || data.message_id || ((window.crypto && typeof crypto.randomUUID === "function") ? crypto.randomUUID() : ("msg-" + Math.random().toString(36).substring(2, 9)));
        if (decrypted !== null) {
          appendChatMessage(data.sender, decrypted, data.timestamp, false, null, false, msgId, data.reply_to);
          logActivity(`[E2EE Decrypt OK] Packet verified and decrypted from ${data.sender}.`);
        } else {
          // Graceful decryption failure without crashing the client app
          appendChatMessage(data.sender, "[Unable to decrypt: Invalid Passkey]", data.timestamp, false, null, true, msgId, data.reply_to);
          logActivity(`[E2EE Decrypt FAIL] MAC tag mismatch / invalid passkey from ${data.sender}.`);
        }
      }
    });

    state.socket.on("room_error", (data) => {
      showLoginError(data.message || "Failed to join encrypted room.");
    });

    // Chat & Networking Events
    state.socket.on("chat_message", (data) => {
      appendChatMessage(data.sender, data.content, data.timestamp, false, null, false, data.id, data.reply_to);
    });

    state.socket.on("private_message", (data) => {
      const isMe = data.sender.toLowerCase() === state.username.toLowerCase();
      const peer = isMe ? data.recipient : data.sender;
      appendChatMessage(data.sender, data.content, data.timestamp, true, peer, false, data.id, data.reply_to);
    });

    state.socket.on("user_list", (data) => {
      // Stop populating sidebar from global peer events when an E2EE room is active
      if (!state.roomId) {
        updateUserList(data.users || []);
      }
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

    // WebRTC Signaling Router Listeners (Zero Retention)
    state.socket.on("webrtc_offer", (data) => {
      handleIncomingWebrtcOffer(data);
    });

    state.socket.on("webrtc_answer", (data) => {
      handleIncomingWebrtcAnswer(data);
    });

    state.socket.on("webrtc_ice_candidate", (data) => {
      handleIncomingIceCandidate(data);
    });

    state.socket.on("webrtc_call_end", (data) => {
      handleIncomingCallEnd(data);
    });

    state.socket.on("call_started", (data) => {
      handleCallStarted(data);
    });

    state.socket.on("call_user_joined", (data) => {
      handleCallUserJoined(data);
    });

    state.socket.on("call_user_left", (data) => {
      handleCallUserLeft(data);
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
  // LOGIN, E2EE ROOM SETUP & AUTHENTICATION
  // =========================================================================
  // Persistent Client Session Identifier (for resilient spot re-claiming)
  const getClientSessionId = () => {
    try {
      let sId = sessionStorage.getItem("netchat_session_id");
      if (!sId) {
        sId = (window.crypto && typeof crypto.randomUUID === "function")
          ? crypto.randomUUID()
          : "sess-" + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
        sessionStorage.setItem("netchat_session_id", sId);
      }
      return sId;
    } catch (_) {
      return "sess-" + Math.random().toString(36).substring(2, 12);
    }
  };

  let isSubmittingAuth = false;

  function setButtonsLoading(isLoading, activeBtnId = null) {
    if (!isLoading) {
      isSubmittingAuth = false;
    }
    const btnCreate = DOM.btnCreateRoom;
    const btnJoin = DOM.btnJoinRoom;

    if (btnCreate) {
      btnCreate.disabled = isLoading;
      if (isLoading && activeBtnId === "btn-create-room") {
        btnCreate.innerHTML = `<svg class="svg-icon sm spinning" aria-hidden="true"><use href="#icon-loader-circle"></use></svg> <span id="btn-create-room-text">Connecting...</span>`;
      } else {
        btnCreate.innerHTML = `<span id="btn-create-room-text">Create Room</span> <svg class="svg-icon" aria-hidden="true"><use href="#icon-lock"></use></svg>`;
      }
    }

    if (btnJoin) {
      btnJoin.disabled = isLoading;
      if (isLoading && activeBtnId === "btn-join-room") {
        btnJoin.innerHTML = `<svg class="svg-icon sm spinning" aria-hidden="true"><use href="#icon-loader-circle"></use></svg> <span id="btn-join-room-text">Connecting...</span>`;
      } else {
        btnJoin.innerHTML = `<span id="btn-join-room-text">Join Room</span> <svg class="svg-icon" aria-hidden="true"><use href="#icon-send"></use></svg>`;
      }
    }

    if (DOM.connectBtn && DOM.connectBtn !== btnCreate && DOM.connectBtn !== btnJoin) {
      DOM.connectBtn.disabled = isLoading;
    }
  }

  function showLoginError(msg, highlightUsername = false) {
    isSubmittingAuth = false;
    // Keep connection indicator green/connected if socket is active
    if (state.socket && state.socket.connected) {
      setConnectionStatus("connected", "Connected");
    } else {
      setConnectionStatus("disconnected", "Disconnected");
    }
    setButtonsLoading(false);
    let errorSpan = DOM.loginErrorText || (DOM.loginError ? DOM.loginError.querySelector("#login-error-text") : null);
    if (!errorSpan && DOM.loginError) {
      DOM.loginError.innerHTML = `<span id="login-error-text" class="login-error-text" style="color: #ef4444; font-weight: 500;"></span>`;
      errorSpan = DOM.loginError.querySelector("#login-error-text");
      DOM.loginErrorText = errorSpan;
    }
    if (errorSpan) {
      errorSpan.textContent = msg;
    }
    if (DOM.loginError) {
      DOM.loginError.classList.remove("hidden");
    }
    if (highlightUsername && DOM.usernameInput) {
      DOM.usernameInput.classList.add("input-error");
      DOM.usernameInput.focus();
    }
  }

  function clearLoginError() {
    const errorSpan = DOM.loginErrorText || (DOM.loginError ? DOM.loginError.querySelector("#login-error-text") : null);
    if (errorSpan) {
      errorSpan.textContent = "";
    }
    if (DOM.loginError) {
      DOM.loginError.classList.add("hidden");
    }
    if (DOM.usernameInput) {
      DOM.usernameInput.classList.remove("input-error");
    }
  }

  function handleCreateRoom(e) {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    if (isSubmittingAuth) return;
    isSubmittingAuth = true;
    clearLoginError();

    const userEl = DOM.usernameInput || document.getElementById("username-input");
    const roomEl = DOM.roomInput || document.getElementById("room-input");
    const passEl = DOM.passkeyInput || document.getElementById("passkey-input");

    const username = userEl ? userEl.value.trim() : "";
    const roomId = roomEl ? roomEl.value.trim().toLowerCase() : "";
    const pin = passEl ? passEl.value.trim() : "";

    if (!username) {
      isSubmittingAuth = false;
      showLoginError("Please enter a nickname.");
      if (userEl) userEl.focus();
      return;
    }

    if (!roomId) {
      isSubmittingAuth = false;
      showLoginError("Please enter or generate a Room ID.");
      if (roomEl) roomEl.focus();
      return;
    }

    if (!pin) {
      isSubmittingAuth = false;
      showLoginError("Please enter a Room PIN.");
      if (passEl) passEl.focus();
      return;
    }

    if (!state.socket || !state.socket.connected) {
      isSubmittingAuth = false;
      showLoginError("Connecting to server. Please wait a moment and try again.");
      return;
    }

    setButtonsLoading(true, "btn-create-room");

    const payload = {
      room_id: roomId,
      pin: pin,
      passkey: pin,
      username: username,
      session_id: getClientSessionId()
    };

    state.socket.emit("create_room", payload, (response) => {
      isSubmittingAuth = false;
      setButtonsLoading(false);
      if (response && response.status === "success") {
        // Save credentials in memory (zero-retention)
        state.username = username;
        state.roomId = roomId;
        state.roomPasskey = pin;
        state.isE2EE = true;

        // Populate member roster from server acknowledgment or self
        const initialPeers = (response && (response.users || response.peers) && (response.users || response.peers).length > 0)
          ? (response.users || response.peers)
          : [username];
        updateUserList(initialPeers);
        typingState.activeTypers.forEach((timer) => clearTimeout(timer));
        typingState.activeTypers.clear();
        renderTypingIndicator();

        // Register underlying gateway TCP session
        state.socket.emit("join", { username });

        // Close modal and render chat UI
        handleJoinSuccess({
          username: username,
          host: state.host,
          port: state.port,
          roomId: roomId
        });
      } else {
        const errorMsg = (response && response.message) ? response.message : "Room already exists";
        showLoginError(errorMsg);
      }
    });
  }

  function handleJoinRoom(e) {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    if (isSubmittingAuth) return;
    isSubmittingAuth = true;
    clearLoginError();

    const userEl = DOM.usernameInput || document.getElementById("username-input");
    const roomEl = DOM.roomInput || document.getElementById("room-input");
    const passEl = DOM.passkeyInput || document.getElementById("passkey-input");

    const username = userEl ? userEl.value.trim() : "";
    const roomId = roomEl ? roomEl.value.trim().toLowerCase() : "";
    const pin = passEl ? passEl.value.trim() : "";

    if (!username) {
      isSubmittingAuth = false;
      showLoginError("Please enter a nickname.");
      if (userEl) userEl.focus();
      return;
    }

    if (!roomId) {
      isSubmittingAuth = false;
      showLoginError("Please enter a Room ID.");
      if (roomEl) roomEl.focus();
      return;
    }

    if (!pin) {
      isSubmittingAuth = false;
      showLoginError("Please enter the Room PIN.");
      if (passEl) passEl.focus();
      return;
    }

    if (!state.socket || !state.socket.connected) {
      isSubmittingAuth = false;
      showLoginError("Connecting to server. Please wait a moment and try again.");
      return;
    }

    setButtonsLoading(true, "btn-join-room");

    const payload = {
      room_id: roomId,
      pin: pin,
      passkey: pin,
      username: username,
      session_id: getClientSessionId()
    };

    state.socket.emit("join_room", payload, (response) => {
      isSubmittingAuth = false;
      setButtonsLoading(false);
      if (response && response.status === "success") {
        // Save credentials in memory (zero-retention)
        state.username = username;
        state.roomId = roomId;
        state.roomPasskey = pin;
        state.isE2EE = true;

        // Populate member roster from server acknowledgment or self
        const initialPeers = (response && (response.users || response.peers) && (response.users || response.peers).length > 0)
          ? (response.users || response.peers)
          : [username];
        updateUserList(initialPeers);
        typingState.activeTypers.forEach((timer) => clearTimeout(timer));
        typingState.activeTypers.clear();
        renderTypingIndicator();

        // Register underlying gateway TCP session
        state.socket.emit("join", { username });

        // Close modal and render chat UI
        handleJoinSuccess({
          username: username,
          host: state.host,
          port: state.port,
          roomId: roomId
        });
      } else {
        const errorMsg = (response && response.message)
          ? response.message
          : "Invalid credentials or room does not exist.";
        showLoginError(errorMsg, errorMsg.includes("Username"));
      }
    });
  }


  function handleJoinSuccess(data) {
    if (!data) return;
    isSubmittingAuth = false;
    setButtonsLoading(false);

    if (data.status === "error") {
      showLoginError(data.message || "Failed to enter room.");
      return;
    }

    if (data.username) state.username = data.username;
    if (data.host) state.host = data.host;
    if (data.port) state.port = data.port;
    if (data.roomId || data.room_id) state.roomId = data.roomId || data.room_id;

    const isFirstEntry = DOM.appContainer && DOM.appContainer.classList.contains("hidden");

    // Transition from login modal to main chat UI
    if (DOM.loginOverlay) {
      DOM.loginOverlay.classList.add("hidden");
    }
    if (DOM.appContainer) {
      DOM.appContainer.classList.remove("hidden");
    }

    if (DOM.myUsername && state.username) {
      DOM.myUsername.textContent = state.username;
    }
    if (DOM.myAvatar && state.username) {
      DOM.myAvatar.textContent = state.username.charAt(0).toUpperCase();
      DOM.myAvatar.style.background = getAvatarGradient(state.username);
      DOM.myAvatar.style.color = "#ffffff";
    }
    if (DOM.myEndpoint) {
      DOM.myEndpoint.textContent = `${state.host}:${state.port}`;
    }

    if (DOM.miniTcpTarget) DOM.miniTcpTarget.textContent = state.port;
    if (DOM.diagTcpHost) DOM.diagTcpHost.textContent = `${state.host}:${state.port}`;
    if (DOM.rpTcpHost) DOM.rpTcpHost.textContent = `${state.host}:${state.port}`;

    if (DOM.activeChatTitle && state.roomId) {
      DOM.activeChatTitle.textContent = `🔒 Room: ${state.roomId}`;
      if (DOM.btnHeaderShareRoom) {
        DOM.btnHeaderShareRoom.classList.remove("hidden");
      }
      if (DOM.btnDisconnect) {
        DOM.btnDisconnect.classList.remove("hidden");
      }
      if (DOM.btnDrawerCopyLink) {
        DOM.btnDrawerCopyLink.classList.remove("hidden");
      }
    }
    if (DOM.activeChatDesc) {
      DOM.activeChatDesc.textContent = "";
      DOM.activeChatDesc.classList.add("hidden");
    }

    setConnectionStatus("connected", "Connected");

    if (isFirstEntry) {
      logActivity(`Successfully connected as '${state.username}'. Room: ${state.roomId}`);
    }

    // Clean hash from URL bar once successfully joined so PIN isn't left visible
    try {
      history.replaceState(null, document.title, window.location.pathname + window.location.search);
    } catch (_) {}

    // Focus chat input on desktop
    if (window.innerWidth > 768 && DOM.messageInput) {
      DOM.messageInput.focus();
    }
  }

  // Expose in global scope as well
  if (typeof window !== "undefined") {
    window.handleJoinSuccess = handleJoinSuccess;
  }

  function handleConnectClick(e) {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    if (state.roomMode === "create") {
      handleCreateRoom(e);
    } else {
      handleJoinRoom(e);
    }
  }

  // =========================================================================
  // CHAT & MESSAGING (ZERO-KNOWLEDGE ENCRYPTION FLOW)
  // =========================================================================
  async function handleSendMessage(e) {
    e.preventDefault();
    stopTyping();
    toggleEmojiPopover(false);
    closeMentionsPopover();
    const text = DOM.messageInput.value.trim();
    if (!text) return;

    DOM.messageInput.value = "";

    // Generate unique ID for every sent message using crypto.randomUUID()
    const msgId = (window.crypto && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : ("msg-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9));

    // Capture reply context if active
    const replyPayload = activeReply ? {
      id: activeReply.id,
      sender: activeReply.sender,
      snippet: activeReply.snippet
    } : null;

    // E2EE Room encryption flow
    if (state.roomId && state.roomPasskey) {
      try {
        const ciphertextBase64 = await E2EE.encryptMessage(text, state.roomPasskey);
        const msgPacket = {
          id: msgId,
          room_id: state.roomId,
          username: state.username,
          payload: ciphertextBase64
        };
        if (replyPayload) {
          msgPacket.reply_to = replyPayload;
        }
        state.socket.emit("send_message", msgPacket);
        logActivity(`Encrypted and dispatched packet to room '${state.roomId}'.`);
      } catch (err) {
        console.error("Encryption error:", err);
        appendSystemMessage("Encryption failure: Could not encrypt message.");
      }
    } else if (state.activeChatTarget) {
      // Send Private Whisper
      state.socket.emit("send_private", {
        id: msgId,
        recipient: state.activeChatTarget,
        content: text,
        reply_to: replyPayload
      });
      logActivity(`Sent private message to ${state.activeChatTarget}.`);
    } else {
      // Send Public Broadcast
      state.socket.emit("send_chat", {
        id: msgId,
        content: text,
        reply_to: replyPayload
      });
      logActivity(`Sent public broadcast message.`);
    }

    // Frontend Cleanup: Clear active reply context variable and hide reply banner
    cancelReply();

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

  // =========================================================================
  // @USERNAME MENTION / TAGGING AUTOCOMPLETE SYSTEM
  // =========================================================================
  const mentionsState = {
    isOpen: false,
    triggerIndex: -1,
    query: "",
    matches: [],
    selectedIndex: 0
  };

  function getActiveParticipants() {
    const list = [];
    (state.onlineUsers || []).forEach((u) => {
      let name = "";
      if (typeof u === "string") name = u;
      else if (u && typeof u === "object") name = u.username || "";
      if (name && !list.some(n => n.toLowerCase() === name.toLowerCase())) {
        list.push(name);
      }
    });
    if (state.username && !list.some(n => n.toLowerCase() === state.username.toLowerCase())) {
      list.unshift(state.username);
    }
    return list;
  }

  function checkMentionTrigger() {
    const input = DOM.messageInput;
    if (!input) return;

    const cursorPos = input.selectionStart;
    const textBefore = input.value.slice(0, cursorPos);

    const match = /(?:^|\s)@([a-zA-Z0-9_-]*)$/.exec(textBefore);
    if (!match) {
      closeMentionsPopover();
      return;
    }

    const query = match[1].toLowerCase();
    const atOffset = match[0].startsWith("@") ? 0 : 1;
    mentionsState.triggerIndex = match.index + atOffset;
    mentionsState.query = query;

    const participants = getActiveParticipants();
    const filtered = participants.filter((user) =>
      user.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      closeMentionsPopover();
      return;
    }

    mentionsState.matches = filtered;
    mentionsState.selectedIndex = 0;
    renderMentionsPopover();
  }

  function renderMentionsPopover() {
    if (!DOM.mentionsPopover || !DOM.mentionsList) return;

    DOM.mentionsList.innerHTML = "";
    mentionsState.matches.forEach((username, index) => {
      const isMe = state.username && username.toLowerCase() === state.username.toLowerCase();
      const isSelected = index === mentionsState.selectedIndex;
      const bg = getAvatarGradient(username);
      const initial = username.charAt(0).toUpperCase();

      const item = document.createElement("div");
      item.className = `mention-item ${isSelected ? "selected" : ""}`;
      item.dataset.index = String(index);
      item.dataset.username = username;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", isSelected ? "true" : "false");

      item.innerHTML = `
        <div class="mention-item-avatar" style="background: ${bg};">${initial}</div>
        <div class="mention-item-info">
          <span class="mention-item-name">@${escapeHtml(username)}</span>
          ${isMe ? '<span class="mention-item-tag">You</span>' : '<span class="mention-item-status">Active</span>'}
        </div>
      `;

      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        chooseMention(username);
      });

      item.addEventListener("click", (e) => {
        e.preventDefault();
        chooseMention(username);
      });

      DOM.mentionsList.appendChild(item);
    });

    DOM.mentionsPopover.classList.remove("hidden");
    mentionsState.isOpen = true;
    scrollSelectedMentionIntoView();
  }

  function updateSelectedMentionUI() {
    if (!DOM.mentionsList) return;
    const items = DOM.mentionsList.querySelectorAll(".mention-item");
    items.forEach((item, idx) => {
      const isSelected = idx === mentionsState.selectedIndex;
      item.classList.toggle("selected", isSelected);
      item.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
    scrollSelectedMentionIntoView();
  }

  function scrollSelectedMentionIntoView() {
    if (!DOM.mentionsList) return;
    const selectedEl = DOM.mentionsList.querySelector(".mention-item.selected");
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function chooseMention(username) {
    const input = DOM.messageInput;
    if (!input) return;

    const text = input.value;
    const cursorPos = input.selectionStart;
    const atIndex = mentionsState.triggerIndex;
    if (atIndex < 0 || atIndex > text.length) return;

    const before = text.substring(0, atIndex);
    const after = text.substring(cursorPos);
    const insertText = `@${username} `;

    input.value = before + insertText + after;
    const newPos = before.length + insertText.length;
    input.focus();
    input.setSelectionRange(newPos, newPos);

    closeMentionsPopover();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function handleMentionsKeydown(e) {
    if (!mentionsState.isOpen) return false;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (mentionsState.matches.length > 0) {
        mentionsState.selectedIndex = (mentionsState.selectedIndex + 1) % mentionsState.matches.length;
        updateSelectedMentionUI();
      }
      return true;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (mentionsState.matches.length > 0) {
        mentionsState.selectedIndex = (mentionsState.selectedIndex - 1 + mentionsState.matches.length) % mentionsState.matches.length;
        updateSelectedMentionUI();
      }
      return true;
    }

    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      if (mentionsState.matches.length > 0) {
        const selected = mentionsState.matches[mentionsState.selectedIndex];
        if (selected) {
          chooseMention(selected);
        }
      }
      return true;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      closeMentionsPopover();
      return true;
    }

    return false;
  }

  function closeMentionsPopover() {
    if (DOM.mentionsPopover) {
      DOM.mentionsPopover.classList.add("hidden");
    }
    mentionsState.isOpen = false;
    mentionsState.triggerIndex = -1;
    mentionsState.query = "";
    mentionsState.matches = [];
    mentionsState.selectedIndex = 0;
  }

  function appendChatMessage(sender, content, timestamp, isPrivate, peer, isDecryptError = false, messageId = null, replyTo = null) {
    if (DOM.emptyState) {
      DOM.emptyState.style.display = "none";
    }

    const wasNearBottom = isUserNearBottom();

    // Unique Message ID
    const msgId = messageId || ((window.crypto && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : ("msg-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9)));

    const isMe = sender && state.username && sender.toLowerCase() === state.username.toLowerCase();
    const bubble = document.createElement("div");
    bubble.className = `message-bubble ${isMe ? "mine" : ""} ${isPrivate ? "private" : ""} ${isDecryptError ? "decrypt-error" : ""}`;
    bubble.dataset.messageId = msgId;

    const header = document.createElement("div");
    header.className = "msg-header";

    if (state.isE2EE && isDecryptError) {
      const e2eeBadge = document.createElement("span");
      e2eeBadge.className = "msg-badge badge-warning";
      e2eeBadge.innerHTML = `<svg class="svg-icon xs" aria-hidden="true"><use href="#icon-lock"></use></svg> AUTH FAIL`;
      header.appendChild(e2eeBadge);
    }

    // Convert raw timestamp to clean, human-readable time format (e.g., "12:45 PM")
    let formattedTime;
    if (timestamp) {
      const rawTimestamp = typeof timestamp === "number" ? timestamp : parseFloat(timestamp);
      if (!isNaN(rawTimestamp)) {
        const dateObj = new Date(rawTimestamp * 1000); // Backend sends UNIX timestamp in seconds
        formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        formattedTime = timestamp;
      }
    } else {
      const dateObj = new Date();
      formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

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
      timeEl.textContent = formattedTime;
      header.appendChild(timeEl);
    } else {
      const senderEl = document.createElement("span");
      senderEl.className = "msg-sender";
      senderEl.textContent = isMe ? "You" : sender;
      header.appendChild(senderEl);

      const timeEl = document.createElement("span");
      timeEl.className = "msg-time";
      timeEl.textContent = formattedTime;
      header.appendChild(timeEl);
    }

    // Small Reply Button on every rendered chat message
    if (!isDecryptError) {
      const replyBtn = document.createElement("button");
      replyBtn.type = "button";
      replyBtn.className = "msg-reply-btn";
      replyBtn.title = "Reply to this message";
      replyBtn.setAttribute("aria-label", `Reply to ${sender}`);
      replyBtn.innerHTML = `<svg class="svg-icon xs" aria-hidden="true"><use href="#icon-reply"></use></svg><span>Reply</span>`;
      replyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        initiateReply(msgId, sender, content);
      });
      header.appendChild(replyBtn);
    }

    bubble.appendChild(header);

    // If reply_to payload exists, render styled blockquote or nested div directly above the message text
    if (replyTo && (replyTo.snippet || replyTo.sender)) {
      const quoteDiv = document.createElement("div");
      quoteDiv.className = "msg-reply-quote";
      if (replyTo.id) {
        quoteDiv.dataset.replyTargetId = replyTo.id;
        quoteDiv.title = "Jump to original quoted message";
        quoteDiv.addEventListener("click", () => {
          const target = document.querySelector(`[data-message-id="${replyTo.id}"]`);
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "center" });
            target.classList.add("msg-highlight-pulse");
            setTimeout(() => target.classList.remove("msg-highlight-pulse"), 1600);
          }
        });
      }

      const quoteSender = document.createElement("div");
      quoteSender.className = "msg-reply-quote-sender";
      quoteSender.innerHTML = `<svg class="svg-icon xs" aria-hidden="true"><use href="#icon-reply"></use></svg><span>${escapeHtml(replyTo.sender || "User")}</span>`;

      const quoteSnippet = document.createElement("div");
      quoteSnippet.className = "msg-reply-quote-snippet";
      quoteSnippet.textContent = replyTo.snippet || "";

      quoteDiv.appendChild(quoteSender);
      quoteDiv.appendChild(quoteSnippet);
      bubble.appendChild(quoteDiv);
    }

    const body = document.createElement("div");
    body.className = "msg-content" + (isDecryptError ? " msg-decrypt-error" : "");

    if (isDecryptError) {
      body.textContent = content;
    } else {
      const safeEscaped = escapeHtml(content);
      let isMentionedMe = false;
      const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
      const renderedHtml = safeEscaped.replace(mentionRegex, (match, username) => {
        const isCurrent = state.username && username.toLowerCase() === state.username.toLowerCase();
        if (isCurrent) {
          isMentionedMe = true;
        }
        return `<span class="mention-pill ${isCurrent ? 'mention-me' : ''} bg-emerald-500/20 text-emerald-400 font-medium px-1.5 py-0.5 rounded-md">@${username}</span>`;
      });
      body.innerHTML = renderedHtml;

      if (isMentionedMe) {
        bubble.classList.add("msg-mentioned");
      }
    }
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
    if (!Array.isArray(users)) users = [];
    state.onlineUsers = users;

    // Normalize entries whether users is a list of strings or list of objects {socket_id, username}
    const normalizedUsers = users.map((u) => {
      if (typeof u === "string") return { username: u, socket_id: null };
      if (u && typeof u === "object") return { username: u.username || "", socket_id: u.socket_id || null };
      return { username: String(u || ""), socket_id: null };
    }).filter(u => Boolean(u.username));

    // Ensure current user is in the roster if connected in a room
    if (state.roomId && state.username && !normalizedUsers.some(u => u.username.toLowerCase() === state.username.toLowerCase())) {
      normalizedUsers.unshift({ username: state.username, socket_id: state.socket?.id || null });
    }

    const count = normalizedUsers.length;
    if (DOM.userCount) DOM.userCount.textContent = count;
    if (DOM.mobileUserCount) DOM.mobileUserCount.textContent = count;
    if (DOM.diagPeerCount) {
      DOM.diagPeerCount.textContent = `${count} Peer${count === 1 ? "" : "s"}`;
    }
    if (DOM.rpPeerCount) {
      DOM.rpPeerCount.textContent = `${count} Peer${count === 1 ? "" : "s"}`;
    }

    const usernames = normalizedUsers.map(u => u.username);

    // Reset active whisper target if the user is no longer in this room
    if (state.activeChatTarget && !usernames.some(name => name.toLowerCase() === state.activeChatTarget.toLowerCase())) {
      state.activeChatTarget = null;
      if (DOM.btnPublicRoom) DOM.btnPublicRoom.classList.add("active");
      if (DOM.activeChatTitle && state.roomId) {
        DOM.activeChatTitle.textContent = `🔒 Room: ${state.roomId}`;
      }
      if (DOM.headerChannelIcon) {
        DOM.headerChannelIcon.innerHTML = `<use href="#icon-globe"></use>`;
      }
      if (DOM.messageInput) {
        DOM.messageInput.placeholder = "Type a message to everyone... (Press Enter to send)";
      }
    }

    // Clear the DOM container under the ONLINE PEERS header
    if (DOM.usersNavList) {
      DOM.usersNavList.innerHTML = "";
    }

    const previousSelected = DOM.fileRecipientSelect ? DOM.fileRecipientSelect.value : "";
    if (DOM.fileRecipientSelect) {
      DOM.fileRecipientSelect.innerHTML = `
        <option value="__BROADCAST__">🌐 Entire Server (All Peers)</option>
        <option value="">-- Choose Online Peer --</option>
      `;
    }

    // Loop through users array and append a clean, styled list item for each username
    normalizedUsers.forEach((userObj) => {
      const user = userObj.username;
      const isMe = user.toLowerCase() === (state.username || "").toLowerCase();

      if (DOM.fileRecipientSelect && !isMe) {
        const opt = document.createElement("option");
        opt.value = user;
        opt.textContent = user;
        DOM.fileRecipientSelect.appendChild(opt);
      }

      if (DOM.usersNavList) {
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
          const callBtn = document.createElement("button");
          callBtn.className = "btn-call-peer-tiny";
          callBtn.title = `Call ${user} (P2P Video)`;
          callBtn.setAttribute("aria-label", `Call ${user}`);
          callBtn.innerHTML = `<svg class="svg-icon xs" aria-hidden="true"><use href="#icon-video"></use></svg>`;
          li.appendChild(callBtn);

          const fileBtn = document.createElement("button");
          fileBtn.className = "btn-send-file-tiny";
          fileBtn.title = `Send P2P File to ${user}`;
          fileBtn.setAttribute("aria-label", `Send file to ${user}`);
          fileBtn.innerHTML = `<svg class="svg-icon xs" aria-hidden="true"><use href="#icon-paperclip"></use></svg>`;
          li.appendChild(fileBtn);

          li.addEventListener("click", (e) => {
            if (!e.target.closest(".btn-send-file-tiny") && !e.target.closest(".btn-call-peer-tiny")) {
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

          callBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            closeSidebar();
            startWebrtcCall(userObj.socket_id, user, "video");
          });

          fileBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            closeSidebar();
            triggerP2PFileSelect(userObj.socket_id, user);
          });
        }

        DOM.usersNavList.appendChild(li);
      }
    });

    const otherPeers = normalizedUsers.filter(u => u.username.toLowerCase() !== (state.username || "").toLowerCase());
    const hasOtherPeers = otherPeers.length > 0 && Boolean(state.roomId);
    if (DOM.btnHeaderAudioCall) {
      DOM.btnHeaderAudioCall.classList.toggle("hidden", !hasOtherPeers);
    }
    if (DOM.btnHeaderCall) {
      DOM.btnHeaderCall.classList.toggle("hidden", !hasOtherPeers);
    }

    if (DOM.fileRecipientSelect) {
      if (previousSelected && Array.from(DOM.fileRecipientSelect.options).some(o => o.value === previousSelected)) {
        DOM.fileRecipientSelect.value = previousSelected;
      } else if (!DOM.fileRecipientSelect.value) {
        DOM.fileRecipientSelect.value = "__BROADCAST__";
      }
      updateBroadcastBadge();
    }

    if (DOM.activeChatDesc && state.roomId) {
      DOM.activeChatDesc.textContent = "";
      DOM.activeChatDesc.classList.add("hidden");
    }
  }

  function switchToPublicChat() {
    state.activeChatTarget = null;
    DOM.btnPublicRoom.classList.add("active");
    document.querySelectorAll(".peer-list .nav-menu-item").forEach(el => el.classList.remove("active"));

    if (state.roomId) {
      DOM.activeChatTitle.textContent = `🔒 Room: ${state.roomId}`;
      DOM.activeChatDesc.textContent = "";
      DOM.activeChatDesc.classList.add("hidden");
      if (DOM.btnHeaderShareRoom) DOM.btnHeaderShareRoom.classList.remove("hidden");
      if (DOM.btnDisconnect) DOM.btnDisconnect.classList.remove("hidden");
      if (DOM.btnDrawerCopyLink) DOM.btnDrawerCopyLink.classList.remove("hidden");
    } else {
      DOM.activeChatTitle.textContent = "Public Room";
      DOM.activeChatDesc.textContent = "Unified stream broadcast to all active network peers";
      if (DOM.btnHeaderShareRoom) DOM.btnHeaderShareRoom.classList.add("hidden");
      if (DOM.btnDisconnect) DOM.btnDisconnect.classList.add("hidden");
      if (DOM.btnDrawerCopyLink) DOM.btnDrawerCopyLink.classList.add("hidden");
    }
    DOM.messageInput.placeholder = "Type a message to everyone... (Press Enter to send)";
    closeSidebar();
    setMobileActiveTab("chat");
  }

  function switchToPrivateChat(peerUsername) {
    state.activeChatTarget = peerUsername;
    DOM.btnPublicRoom.classList.remove("active");
    if (DOM.btnHeaderShareRoom) {
      DOM.btnHeaderShareRoom.classList.add("hidden");
    }
    if (DOM.btnDisconnect) {
      DOM.btnDisconnect.classList.remove("hidden");
    }
    if (DOM.btnDrawerCopyLink) {
      DOM.btnDrawerCopyLink.classList.add("hidden");
    }

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
  // WEBRTC PEER-TO-PEER AUDIO/VIDEO CALLING & RTCDATACHANNEL FILE TRANSFERS
  // =========================================================================

  const RTC_CONFIG = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" }
    ]
  };

  /**
   * Resolves target peer socket ID and username for WebRTC interactions
   */
  function resolveWebRtcTarget(targetSid, targetName) {
    if (targetSid && targetName) return { sid: targetSid, username: targetName };
    if (state.activeChatTarget) {
      const match = (state.onlineUsers || []).find(u => {
        const un = typeof u === "string" ? u : (u?.username || "");
        return un.toLowerCase() === state.activeChatTarget.toLowerCase();
      });
      if (match) {
        return {
          sid: typeof match === "object" ? match.socket_id : null,
          username: state.activeChatTarget
        };
      }
    }
    // If only 1 other peer in room, pick them
    const otherUsers = (state.onlineUsers || []).map(u => {
      if (typeof u === "string") return { username: u, socket_id: null };
      return { username: u?.username || "", socket_id: u?.socket_id || null };
    }).filter(u => u.username && u.username.toLowerCase() !== (state.username || "").toLowerCase());

    if (otherUsers.length > 0) {
      return { sid: otherUsers[0].socket_id, username: otherUsers[0].username };
    }
    return { sid: null, username: null };
  }

  /**
   * Initiates an outgoing WebRTC P2P Audio/Video Call
   */
  async function startWebrtcCall(targetSid, targetName, callType = "video") {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("WebRTC Audio/Video requires a secure HTTPS context or localhost.");
      return;
    }

    const resolved = resolveWebRtcTarget(targetSid, targetName);
    if (!resolved.username) {
      appendSystemMessage("⚠️ No peer found in this room to call.");
      return;
    }

    targetSid = resolved.sid;
    targetName = resolved.username;

    logActivity(`[WebRTC] Starting ${callType} call with '${targetName}'...`);

    // Reset any previous peer connection
    endWebrtcCall(false);

    webrtcState.callType = callType;
    webrtcState.activeTargetSid = targetSid;
    webrtcState.activeTargetName = targetName;
    webrtcState.callStatus = "calling";
    webrtcState.pendingIceCandidates = [];

    // Update UI elements
    if (DOM.webrtcPeerName) DOM.webrtcPeerName.textContent = `${targetName}`;
    if (DOM.webrtcCallTimer) DOM.webrtcCallTimer.textContent = "00:00";
    if (DOM.webrtcConnectingBadge) {
      DOM.webrtcConnectingBadge.classList.remove("hidden");
      if (DOM.webrtcConnectingText) DOM.webrtcConnectingText.textContent = `Calling ${targetName}...`;
    }
    if (DOM.webrtcCallOverlay) {
      DOM.webrtcCallOverlay.classList.remove("hidden");
      DOM.webrtcCallOverlay.classList.remove("minimized");
    }

    try {
      // 1. Acquire local camera / microphone stream
      const constraints = {
        video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
        audio: true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      webrtcState.localStream = stream;
      if (DOM.webrtcLocalVideo) {
        DOM.webrtcLocalVideo.srcObject = stream;
      }
      if (DOM.webrtcVideoGrid && callType === "video") {
        DOM.webrtcVideoGrid.innerHTML = "";
        renderVideoTile("local", state.username || "You", stream, true);
      }

      // 2. Instantiate RTCPeerConnection
      const pc = new RTCPeerConnection(RTC_CONFIG);
      webrtcState.peerConnection = pc;

      // Add local media tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // 3. Create RTCDataChannel for simultaneous zero-retention P2P data / file sharing
      const dc = pc.createDataChannel("p2p_channel", { ordered: true });
      setupP2PDataChannel(dc, targetSid, targetName);

      // Handle remote incoming tracks
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          webrtcState.remoteStream = event.streams[0];
          if (DOM.webrtcRemoteVideo) {
            DOM.webrtcRemoteVideo.srcObject = event.streams[0];
          }
          if (DOM.webrtcVideoGrid && webrtcState.callType === "video") {
            renderVideoTile(targetSid, targetName, event.streams[0], false);
          }
          if (DOM.webrtcConnectingBadge) {
            DOM.webrtcConnectingBadge.classList.add("hidden");
          }
        }
      };

      // Handle ICE candidates generated by browser
      pc.onicecandidate = (event) => {
        if (event.candidate && state.socket) {
          state.socket.emit("webrtc_ice_candidate", {
            target_sid: targetSid,
            room_id: state.roomId,
            candidate: event.candidate
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          onWebrtcCallConnected();
        } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          logActivity(`[WebRTC] Connection state: ${pc.connectionState}`);
          endWebrtcCall(false);
        }
      };

      // 4. Generate Offer & set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 5. Send Offer over zero-retention Flask signaling router
      state.socket.emit("webrtc_offer", {
        target_sid: targetSid,
        room_id: state.roomId,
        sender: state.username,
        offer: offer,
        type: callType
      });

      logActivity(`[WebRTC] Signaling SDP Offer dispatched to ${targetName}.`);

    } catch (err) {
      logActivity(`[WebRTC Error] Could not start call: ${err.message}`);
      appendSystemMessage(`⚠️ Call error: ${err.message}`);
      endWebrtcCall(false);
    }
  }

  // =========================================================================
  // MULTI-PEER FULL-MESH WEBRTC COMMUNICATION PIPELINE (AUDIO/VIDEO & P2P DATA)
  // =========================================================================

  function setupAudioContext() {
    if (!webrtcMesh.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        webrtcMesh.audioContext = new AudioCtx();
      }
    }
    if (webrtcMesh.audioContext && webrtcMesh.audioContext.state === "suspended") {
      webrtcMesh.audioContext.resume().catch(() => {});
    }
  }

  function setupLocalAudioAnalyser(stream) {
    try {
      setupAudioContext();
      if (!webrtcMesh.audioContext) return;
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;
      const mediaStream = new MediaStream([audioTrack]);
      const source = webrtcMesh.audioContext.createMediaStreamSource(mediaStream);
      const analyser = webrtcMesh.audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      webrtcMesh.localAnalyser = analyser;
      webrtcMesh.localSource = source;
      startVoiceActivityMonitoring();
    } catch (e) {
      console.warn("Local AudioContext setup failed:", e);
    }
  }

  function setupRemoteAudioAnalyser(peerSid, stream) {
    try {
      setupAudioContext();
      if (!webrtcMesh.audioContext) return;
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;
      const mediaStream = new MediaStream([audioTrack]);
      const source = webrtcMesh.audioContext.createMediaStreamSource(mediaStream);
      const analyser = webrtcMesh.audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      if (webrtcMesh.peers[peerSid]) {
        webrtcMesh.peers[peerSid].analyser = analyser;
        webrtcMesh.peers[peerSid].source = source;
      }
    } catch (e) {
      console.warn("Remote AudioContext setup failed:", e);
    }
  }

  function startVoiceActivityMonitoring() {
    if (webrtcMesh.speakingCheckInterval) clearInterval(webrtcMesh.speakingCheckInterval);
    const dataArray = new Uint8Array(128);
    const SPEAKING_THRESHOLD = 20;

    webrtcMesh.speakingCheckInterval = setInterval(() => {
      // 1. Local voice check
      if (webrtcMesh.localAnalyser && !webrtcMesh.isAudioMuted) {
        webrtcMesh.localAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setParticipantSpeaking("local", avg > SPEAKING_THRESHOLD);
      } else {
        setParticipantSpeaking("local", false);
      }

      // 2. Remote peers voice check
      Object.keys(webrtcMesh.peers).forEach((peerSid) => {
        const peer = webrtcMesh.peers[peerSid];
        if (peer && peer.analyser) {
          peer.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          setParticipantSpeaking(peerSid, avg > SPEAKING_THRESHOLD);
        }
      });
    }, 100);
  }

  function setParticipantSpeaking(id, isSpeaking) {
    const chip = document.getElementById(`audio-chip-${id}`);
    if (chip) {
      chip.classList.toggle("speaking", isSpeaking);
    }
    const tile = document.getElementById(`video-tile-${id}`);
    if (tile) {
      tile.classList.toggle("speaking", isSpeaking);
    }
  }

  function startRoomCallTimer() {
    clearInterval(webrtcMesh.callTimerInterval);
    webrtcMesh.callDurationSec = 0;
    webrtcMesh.callTimerInterval = setInterval(() => {
      webrtcMesh.callDurationSec++;
      const mins = Math.floor(webrtcMesh.callDurationSec / 60);
      const secs = webrtcMesh.callDurationSec % 60;
      const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      if (DOM.audioBarTimer) DOM.audioBarTimer.textContent = formatted;
      if (DOM.webrtcCallTimer) DOM.webrtcCallTimer.textContent = formatted;
    }, 1000);
  }

  function renderAudioBarParticipant(id, name, isLocal = false) {
    if (!DOM.audioBarParticipants) return;
    let chip = document.getElementById(`audio-chip-${id}`);
    if (!chip) {
      chip = document.createElement("div");
      chip.id = `audio-chip-${id}`;
      chip.className = `audio-participant-chip ${isLocal ? "local" : ""}`;
      const initial = (name || "P").charAt(0).toUpperCase();
      const bg = getAvatarGradient(name || "P");
      chip.innerHTML = `
        <div class="participant-avatar-mini" style="background: ${bg};">${initial}</div>
        <span class="participant-name-mini">${name}${isLocal ? " (You)" : ""}</span>
      `;
      DOM.audioBarParticipants.appendChild(chip);
    }
  }

  // Camera Switching & Self-View Mirroring Controls
  let currentFacingMode = "user"; // "user" | "environment"
  let isLocalSelfViewMirrored = false; // default false: natural unmirrored transform scaleX(1)

  function updateLocalMirrorUI() {
    const localTile = document.getElementById("video-tile-local");
    if (localTile) {
      localTile.classList.toggle("mirrored", isLocalSelfViewMirrored);
    }
    if (DOM.webrtcLocalVideo) {
      DOM.webrtcLocalVideo.classList.toggle("mirrored", isLocalSelfViewMirrored);
    }
    if (DOM.btnWebrtcMirrorCam) {
      DOM.btnWebrtcMirrorCam.classList.toggle("active-off", !isLocalSelfViewMirrored);
    }
  }

  function toggleLocalMirror() {
    isLocalSelfViewMirrored = !isLocalSelfViewMirrored;
    updateLocalMirrorUI();
    logActivity(`[WebRTC] Local self-view mirror set to: ${isLocalSelfViewMirrored ? 'Mirrored (scaleX(-1))' : 'Natural (scaleX(1))'}.`);
  }

  async function switchCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Camera switching requires a secure HTTPS context or localhost.");
      return;
    }

    const nextFacingMode = currentFacingMode === "user" ? "environment" : "user";
    try {
      logActivity(`[WebRTC] Switching camera to ${nextFacingMode}...`);
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextFacingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      } catch (fallbackErr) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      }

      const newTrack = stream.getVideoTracks()[0];
      if (!newTrack) return;

      currentFacingMode = nextFacingMode;
      if (currentFacingMode === "environment") {
        isLocalSelfViewMirrored = false;
      }

      // Update mesh local stream and active senders
      if (webrtcMesh.localStream) {
        const oldTrack = webrtcMesh.localStream.getVideoTracks()[0];
        if (oldTrack) {
          oldTrack.stop();
          webrtcMesh.localStream.removeTrack(oldTrack);
        }
        webrtcMesh.localStream.addTrack(newTrack);

        Object.values(webrtcMesh.peers).forEach((peer) => {
          if (peer.pc) {
            const sender = peer.pc.getSenders().find((s) => s.track && s.track.kind === "video");
            if (sender) {
              sender.replaceTrack(newTrack).catch((e) => console.warn("replaceTrack failed:", e));
            }
          }
        });
      }

      // Update 1-on-1 local stream and active senders
      if (webrtcState.localStream) {
        const oldTrack = webrtcState.localStream.getVideoTracks()[0];
        if (oldTrack) {
          oldTrack.stop();
          webrtcState.localStream.removeTrack(oldTrack);
        }
        webrtcState.localStream.addTrack(newTrack);
        if (webrtcState.peerConnection) {
          const sender = webrtcState.peerConnection.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender) {
            sender.replaceTrack(newTrack).catch((e) => console.warn("replaceTrack failed:", e));
          }
        }
      }

      // Refresh local video display elements
      const localTile = document.getElementById("video-tile-local");
      if (localTile) {
        const video = localTile.querySelector("video");
        if (video) {
          video.srcObject = webrtcMesh.localStream || webrtcState.localStream;
          video.play().catch(() => {});
        }
      }
      if (DOM.webrtcLocalVideo) {
        DOM.webrtcLocalVideo.srcObject = webrtcMesh.localStream || webrtcState.localStream;
      }

      updateLocalMirrorUI();
      logActivity(`[WebRTC] Successfully switched to ${currentFacingMode === "user" ? "Front (Selfie)" : "Rear (Environment)"} camera.`);
    } catch (err) {
      logActivity(`[WebRTC Switch Camera Error] ${err.message}`);
      appendSystemMessage(`⚠️ Camera switch failed: ${err.message}`);
    }
  }

  function renderVideoTile(id, name, stream, isLocal = false) {
    if (!DOM.webrtcVideoGrid) return;
    let tile = document.getElementById(`video-tile-${id}`);
    if (!tile) {
      tile = document.createElement("div");
      tile.id = `video-tile-${id}`;
      tile.className = `video-tile ${isLocal ? "local-tile" : ""} ${isLocal && isLocalSelfViewMirrored ? "mirrored" : ""}`;
      const initial = (name || "P").charAt(0).toUpperCase();
      const bg = getAvatarGradient(name || "P");
      tile.innerHTML = `
        <video class="tile-video webrtc-tile-video" autoplay playsinline ${isLocal ? "muted" : ""}></video>
        <div class="tile-avatar-fallback hidden" style="background: ${bg};">${initial}</div>
        <div class="tile-label">${name}${isLocal ? " (You)" : ""}</div>
        <div class="tile-speaking-circle"></div>
      `;
      DOM.webrtcVideoGrid.appendChild(tile);
    }
    const video = tile.querySelector("video");
    if (video && stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
    updateVideoGridCount();
  }

  function updateVideoGridCount() {
    if (!DOM.webrtcVideoGrid) return;
    const count = DOM.webrtcVideoGrid.querySelectorAll(".video-tile").length;
    DOM.webrtcVideoGrid.setAttribute("data-count", String(Math.min(6, Math.max(1, count))));
  }

  function removeVideoTile(id) {
    const tile = document.getElementById(`video-tile-${id}`);
    if (tile) {
      tile.remove();
      updateVideoGridCount();
    }
  }

  function removeAudioBarParticipant(id) {
    const chip = document.getElementById(`audio-chip-${id}`);
    if (chip) chip.remove();
  }

  /**
   * Starts a Full-Room Group Call (Audio-first or Video)
   */
  async function startRoomCall(callType = "audio") {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("WebRTC requires a secure HTTPS context or localhost.");
      return;
    }

    if (webrtcMesh.active) {
      if (callType === "video" && webrtcMesh.callType === "audio") {
        toggleMeshCamera();
      }
      return;
    }

    // End 1-on-1 call if running
    endWebrtcCall(false);

    try {
      logActivity(`[Room Call] Initiating ${callType} call for room '${state.roomId}'...`);
      const isVideo = callType === "video";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false
      });

      webrtcMesh.active = true;
      webrtcMesh.callType = callType;
      webrtcMesh.localStream = stream;
      webrtcMesh.isAudioMuted = false;
      webrtcMesh.isVideoMuted = false;
      webrtcMesh.peers = {};

      setupLocalAudioAnalyser(stream);

      // Render local UI
      if (callType === "audio") {
        if (DOM.webrtcAudioBar) DOM.webrtcAudioBar.classList.remove("hidden");
        if (DOM.webrtcCallOverlay) DOM.webrtcCallOverlay.classList.add("hidden");
        if (DOM.audioBarParticipants) DOM.audioBarParticipants.innerHTML = "";
        renderAudioBarParticipant("local", state.username || "You", true);
      } else {
        if (DOM.webrtcAudioBar) DOM.webrtcAudioBar.classList.add("hidden");
        if (DOM.webrtcCallOverlay) {
          DOM.webrtcCallOverlay.classList.remove("hidden");
          DOM.webrtcCallOverlay.classList.remove("minimized");
        }
        if (DOM.webrtcVideoGrid) DOM.webrtcVideoGrid.innerHTML = "";
        renderVideoTile("local", state.username || "You", stream, true);
      }

      startRoomCallTimer();

      // Broadcast call_started to all room participants
      if (state.socket) {
        state.socket.emit("call_started", {
          room_id: state.roomId,
          sender: state.username,
          call_type: callType
        });
      }

      // Connect to any online peers already in the room
      const otherPeers = (state.onlineUsers || []).map(u => {
        if (typeof u === "string") return { username: u, socket_id: null };
        return { username: u?.username || "", socket_id: u?.socket_id || null };
      }).filter(u => u.username && u.username.toLowerCase() !== (state.username || "").toLowerCase() && u.socket_id);

      otherPeers.forEach(peer => {
        createMeshPeerConnection(peer.socket_id, peer.username, true);
      });

      appendSystemMessage(`📞 Started room ${callType} call.`);
    } catch (err) {
      logActivity(`[Room Call Error] Could not start call: ${err.message}`);
      appendSystemMessage(`⚠️ Call error: ${err.message}`);
      leaveRoomCall();
    }
  }

  /**
   * Joins an ongoing room call announced by peer
   */
  async function joinRoomCall(callType = "audio") {
    if (DOM.webrtcCallAnnouncement) {
      DOM.webrtcCallAnnouncement.classList.add("hidden");
    }

    if (webrtcMesh.active) return;
    endWebrtcCall(false);

    try {
      logActivity(`[Room Call] Joining ${callType} call...`);
      const isVideo = callType === "video";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false
      });

      webrtcMesh.active = true;
      webrtcMesh.callType = callType;
      webrtcMesh.localStream = stream;
      webrtcMesh.isAudioMuted = false;
      webrtcMesh.isVideoMuted = false;
      webrtcMesh.peers = {};

      setupLocalAudioAnalyser(stream);

      // Render local UI
      if (callType === "audio") {
        if (DOM.webrtcAudioBar) DOM.webrtcAudioBar.classList.remove("hidden");
        if (DOM.webrtcCallOverlay) DOM.webrtcCallOverlay.classList.add("hidden");
        if (DOM.audioBarParticipants) DOM.audioBarParticipants.innerHTML = "";
        renderAudioBarParticipant("local", state.username || "You", true);
      } else {
        if (DOM.webrtcAudioBar) DOM.webrtcAudioBar.classList.add("hidden");
        if (DOM.webrtcCallOverlay) {
          DOM.webrtcCallOverlay.classList.remove("hidden");
          DOM.webrtcCallOverlay.classList.remove("minimized");
        }
        if (DOM.webrtcVideoGrid) DOM.webrtcVideoGrid.innerHTML = "";
        renderVideoTile("local", state.username || "You", stream, true);
      }

      startRoomCallTimer();

      // Broadcast call_user_joined to trigger offers from existing members
      if (state.socket) {
        state.socket.emit("call_user_joined", {
          room_id: state.roomId,
          sender: state.username,
          call_type: callType
        });
      }

      appendSystemMessage(`📞 Joined room call.`);
    } catch (err) {
      logActivity(`[Room Call Error] Could not join call: ${err.message}`);
      appendSystemMessage(`⚠️ Call error: ${err.message}`);
      leaveRoomCall();
    }
  }

  function handleCallStarted(data) {
    if (webrtcMesh.active) return;
    if (data.sender_sid === state.socket?.id) return;
    if (DOM.announcementCaller) DOM.announcementCaller.textContent = data.sender || "Peer";
    if (DOM.webrtcCallAnnouncement) {
      DOM.webrtcCallAnnouncement.dataset.callType = data.call_type || "audio";
      DOM.webrtcCallAnnouncement.classList.remove("hidden");
    }
  }

  function handleCallUserJoined(data) {
    if (!webrtcMesh.active) return;
    if (data.sender_sid === state.socket?.id) return;
    const peerSid = data.sender_sid;
    const peerName = data.sender || "Peer";
    logActivity(`[Mesh] Member '${peerName}' joined call. Initiating peer connection...`);
    createMeshPeerConnection(peerSid, peerName, true);
  }

  function handleCallUserLeft(data) {
    const peerSid = data.sender_sid;
    const peerName = data.sender || "Peer";
    logActivity(`[Mesh] Member '${peerName}' left call.`);
    removeMeshPeer(peerSid);
  }

  function createMeshPeerConnection(peerSid, peerName, isInitiator) {
    if (!peerSid) return null;
    if (webrtcMesh.peers[peerSid]) return webrtcMesh.peers[peerSid];

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peerObj = {
      pc: pc,
      dc: null,
      username: peerName,
      audioEl: null,
      stream: null,
      analyser: null,
      source: null,
      pendingCandidates: []
    };
    webrtcMesh.peers[peerSid] = peerObj;

    // Add local tracks
    if (webrtcMesh.localStream) {
      webrtcMesh.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, webrtcMesh.localStream);
      });
    }

    // RTCDataChannel for P2P direct transfer
    if (isInitiator) {
      try {
        const dc = pc.createDataChannel("p2p_data_transfer", { ordered: true });
        setupP2PDataChannel(dc, peerSid, peerName);
        peerObj.dc = dc;
      } catch (_) {}
    } else {
      pc.ondatachannel = (e) => {
        setupP2PDataChannel(e.channel, peerSid, peerName);
        peerObj.dc = e.channel;
      };
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && state.socket) {
        state.socket.emit("webrtc_ice_candidate", {
          target_sid: peerSid,
          room_id: state.roomId,
          candidate: event.candidate,
          metadata: { isMesh: true }
        });
      }
    };

    pc.ontrack = (event) => {
      handleMeshRemoteTrack(peerSid, peerName, event);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        removeMeshPeer(peerSid);
      }
    };

    if (isInitiator) {
      createMeshOffer(peerSid, peerObj);
    }

    return peerObj;
  }

  async function createMeshOffer(peerSid, peerObj) {
    try {
      const offer = await peerObj.pc.createOffer();
      await peerObj.pc.setLocalDescription(offer);
      state.socket.emit("webrtc_offer", {
        target_sid: peerSid,
        room_id: state.roomId,
        sender: state.username,
        offer: offer,
        type: "mesh",
        metadata: { isMesh: true, callType: webrtcMesh.callType }
      });
    } catch (e) {
      logActivity(`[Mesh Offer Error] ${e.message}`);
    }
  }

  async function handleMeshWebrtcOffer(data) {
    const peerSid = data.sender_sid;
    const peerName = data.sender || "Peer";

    if (!webrtcMesh.active) {
      // If user is not yet in the call, show announcement banner
      handleCallStarted({ sender_sid: peerSid, sender: peerName, call_type: data.type || "audio" });
      return;
    }

    let peerObj = webrtcMesh.peers[peerSid];
    if (!peerObj) {
      peerObj = createMeshPeerConnection(peerSid, peerName, false);
    }

    try {
      await peerObj.pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      while (peerObj.pendingCandidates && peerObj.pendingCandidates.length > 0) {
        const c = peerObj.pendingCandidates.shift();
        try { await peerObj.pc.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
      }
      const answer = await peerObj.pc.createAnswer();
      await peerObj.pc.setLocalDescription(answer);

      state.socket.emit("webrtc_answer", {
        target_sid: peerSid,
        room_id: state.roomId,
        sender: state.username,
        answer: answer,
        type: "mesh",
        metadata: { isMesh: true }
      });
    } catch (err) {
      logActivity(`[Mesh Answer Error] ${err.message}`);
    }
  }

  async function handleMeshWebrtcAnswer(data) {
    const peerSid = data.sender_sid;
    const peerObj = webrtcMesh.peers[peerSid];
    if (!peerObj) return;

    try {
      await peerObj.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      while (peerObj.pendingCandidates && peerObj.pendingCandidates.length > 0) {
        const c = peerObj.pendingCandidates.shift();
        try { await peerObj.pc.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
      }
    } catch (err) {
      logActivity(`[Mesh RemoteDesc Error] ${err.message}`);
    }
  }

  async function handleMeshIceCandidate(data) {
    const peerSid = data.sender_sid;
    const peerObj = webrtcMesh.peers[peerSid];
    if (!peerObj) return;

    if (peerObj.pc && peerObj.pc.remoteDescription && peerObj.pc.remoteDescription.type) {
      try {
        await peerObj.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (_) {}
    } else {
      peerObj.pendingCandidates = peerObj.pendingCandidates || [];
      peerObj.pendingCandidates.push(data.candidate);
    }
  }

  function handleMeshRemoteTrack(peerSid, peerName, event) {
    const stream = event.streams[0] || new MediaStream([event.track]);
    const peerObj = webrtcMesh.peers[peerSid];
    if (peerObj) peerObj.stream = stream;

    // Audio Track: Mount dynamic <audio autoPlay playsinline />
    if (event.track.kind === "audio") {
      let audioEl = document.getElementById(`remote-audio-${peerSid}`);
      if (!audioEl) {
        audioEl = document.createElement("audio");
        audioEl.id = `remote-audio-${peerSid}`;
        audioEl.autoplay = true;
        audioEl.playsInline = true;
        if (DOM.remoteAudioContainer) {
          DOM.remoteAudioContainer.appendChild(audioEl);
        }
      }
      audioEl.srcObject = stream;
      audioEl.play().catch(() => {});
      if (peerObj) peerObj.audioEl = audioEl;

      setupRemoteAudioAnalyser(peerSid, stream);
      renderAudioBarParticipant(peerSid, peerName);
    }

    // Video Track: Render in responsive video grid
    if (event.track.kind === "video" || webrtcMesh.callType === "video") {
      renderVideoTile(peerSid, peerName, stream, false);
    }
  }

  function removeMeshPeer(peerSid) {
    const peerObj = webrtcMesh.peers[peerSid];
    if (peerObj) {
      try { peerObj.pc.close(); } catch (_) {}
      if (peerObj.audioEl) {
        try { peerObj.audioEl.remove(); } catch (_) {}
      }
      delete webrtcMesh.peers[peerSid];
    }
    removeAudioBarParticipant(peerSid);
    removeVideoTile(peerSid);
  }

  function toggleMeshMic() {
    if (!webrtcMesh.localStream) return;
    webrtcMesh.isAudioMuted = !webrtcMesh.isAudioMuted;
    webrtcMesh.localStream.getAudioTracks().forEach((t) => {
      t.enabled = !webrtcMesh.isAudioMuted;
    });

    if (DOM.btnAudioBarMic) {
      DOM.btnAudioBarMic.classList.toggle("active-off", webrtcMesh.isAudioMuted);
    }
    if (DOM.audioBarMicIcon) {
      DOM.audioBarMicIcon.innerHTML = webrtcMesh.isAudioMuted
        ? `<use href="#icon-mic-off"></use>`
        : `<use href="#icon-mic"></use>`;
    }
    if (DOM.btnWebrtcMic) {
      DOM.btnWebrtcMic.classList.toggle("active-off", webrtcMesh.isAudioMuted);
    }
    if (DOM.webrtcIconMic) {
      DOM.webrtcIconMic.innerHTML = webrtcMesh.isAudioMuted
        ? `<use href="#icon-mic-off"></use>`
        : `<use href="#icon-mic"></use>`;
    }
  }

  async function toggleMeshCamera() {
    if (!webrtcMesh.active) {
      startRoomCall("video");
      return;
    }

    if (webrtcMesh.callType === "audio") {
      // Upgrade audio call to video
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
        });
        const videoTrack = camStream.getVideoTracks()[0];
        webrtcMesh.localStream.addTrack(videoTrack);
        webrtcMesh.callType = "video";

        // Add track on all peer connections and renegotiate
        Object.keys(webrtcMesh.peers).forEach((sid) => {
          const peer = webrtcMesh.peers[sid];
          if (peer && peer.pc) {
            peer.pc.addTrack(videoTrack, webrtcMesh.localStream);
            createMeshOffer(sid, peer);
          }
        });

        // Switch to video UI
        if (DOM.webrtcAudioBar) DOM.webrtcAudioBar.classList.add("hidden");
        if (DOM.webrtcCallOverlay) {
          DOM.webrtcCallOverlay.classList.remove("hidden");
          DOM.webrtcCallOverlay.classList.remove("minimized");
        }
        if (DOM.webrtcVideoGrid) DOM.webrtcVideoGrid.innerHTML = "";
        renderVideoTile("local", state.username || "You", webrtcMesh.localStream, true);
        Object.keys(webrtcMesh.peers).forEach((sid) => {
          const p = webrtcMesh.peers[sid];
          if (p && p.stream) {
            renderVideoTile(sid, p.username, p.stream, false);
          }
        });
      } catch (err) {
        logActivity(`[Camera Upgrade Error] ${err.message}`);
        appendSystemMessage(`⚠️ Camera access failed: ${err.message}`);
      }
    } else {
      // Toggle video mute state
      webrtcMesh.isVideoMuted = !webrtcMesh.isVideoMuted;
      webrtcMesh.localStream.getVideoTracks().forEach((t) => {
        t.enabled = !webrtcMesh.isVideoMuted;
      });
      if (DOM.btnWebrtcCam) {
        DOM.btnWebrtcCam.classList.toggle("active-off", webrtcMesh.isVideoMuted);
      }
      if (DOM.webrtcIconCam) {
        DOM.webrtcIconCam.innerHTML = webrtcMesh.isVideoMuted
          ? `<use href="#icon-video-off"></use>`
          : `<use href="#icon-video"></use>`;
      }
    }
  }

  function leaveRoomCall() {
    if (webrtcMesh.active && state.socket) {
      state.socket.emit("call_user_left", {
        room_id: state.roomId,
        sender: state.username
      });
    }

    if (webrtcMesh.localStream) {
      webrtcMesh.localStream.getTracks().forEach((t) => {
        try { t.stop(); } catch (_) {}
      });
      webrtcMesh.localStream = null;
    }

    Object.keys(webrtcMesh.peers).forEach((sid) => {
      removeMeshPeer(sid);
    });
    webrtcMesh.peers = {};

    clearInterval(webrtcMesh.speakingCheckInterval);
    clearInterval(webrtcMesh.callTimerInterval);
    webrtcMesh.speakingCheckInterval = null;
    webrtcMesh.callTimerInterval = null;

    if (webrtcMesh.audioContext) {
      try { webrtcMesh.audioContext.close(); } catch (_) {}
      webrtcMesh.audioContext = null;
    }

    webrtcMesh.active = false;
    webrtcMesh.isAudioMuted = false;
    webrtcMesh.isVideoMuted = false;

    if (DOM.webrtcAudioBar) DOM.webrtcAudioBar.classList.add("hidden");
    if (DOM.webrtcCallOverlay) DOM.webrtcCallOverlay.classList.add("hidden");
    if (DOM.webrtcCallAnnouncement) DOM.webrtcCallAnnouncement.classList.add("hidden");
    if (DOM.audioBarParticipants) DOM.audioBarParticipants.innerHTML = "";
    if (DOM.webrtcVideoGrid) DOM.webrtcVideoGrid.innerHTML = "";
    if (DOM.remoteAudioContainer) DOM.remoteAudioContainer.innerHTML = "";

    logActivity("[Room Call] Left call and released media hardware.");
  }

  /**
   * Handles incoming WebRTC SDP Offer from peer
   */
  async function handleIncomingWebrtcOffer(data) {
    if (!data || !data.offer) return;
    const senderSid = data.sender_sid;
    const senderName = data.sender || "Peer";
    const callType = data.type || "video";

    if (webrtcMesh.active || callType === "mesh" || (data.metadata && data.metadata.isMesh)) {
      handleMeshWebrtcOffer(data);
      return;
    }

    logActivity(`[WebRTC] Incoming '${callType}' offer received from '${senderName}'.`);

    // If this is a data-only P2P transfer connection, auto-accept without camera/audio prompts
    if (callType === "file_data") {
      try {
        const pc = new RTCPeerConnection(RTC_CONFIG);
        webrtcState.peerConnection = pc;
        webrtcState.activeTargetSid = senderSid;
        webrtcState.activeTargetName = senderName;

        pc.ondatachannel = (e) => {
          setupP2PDataChannel(e.channel, senderSid, senderName);
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && state.socket) {
            state.socket.emit("webrtc_ice_candidate", {
              target_sid: senderSid,
              room_id: state.roomId,
              candidate: event.candidate
            });
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        // Drain any pre-queued ICE candidates
        drainPendingIceCandidates(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        state.socket.emit("webrtc_answer", {
          target_sid: senderSid,
          room_id: state.roomId,
          sender: state.username,
          answer: answer,
          type: "file_data"
        });
        logActivity(`[WebRTC] Auto-answered P2P data connection with ${senderName}.`);
      } catch (err) {
        logActivity(`[WebRTC] Error auto-answering file data channel: ${err.message}`);
      }
      return;
    }

    // If already in an active audio/video call, notify caller of busy state
    if (webrtcState.callStatus === "connected" || webrtcState.callStatus === "calling") {
      state.socket.emit("webrtc_call_end", {
        target_sid: senderSid,
        room_id: state.roomId,
        reason: "busy"
      });
      return;
    }

    webrtcState.pendingIncomingOffer = data;
    webrtcState.callType = callType;

    // Show clean incoming call prompt
    if (DOM.webrtcCallerName) DOM.webrtcCallerName.textContent = senderName;
    if (DOM.webrtcIncomingModal) {
      DOM.webrtcIncomingModal.classList.remove("hidden");
    }
  }

  /**
   * Accepts the incoming WebRTC call
   */
  async function acceptIncomingWebrtcCall() {
    if (!webrtcState.pendingIncomingOffer) return;
    const data = webrtcState.pendingIncomingOffer;
    webrtcState.pendingIncomingOffer = null;

    if (DOM.webrtcIncomingModal) {
      DOM.webrtcIncomingModal.classList.add("hidden");
    }

    const senderSid = data.sender_sid;
    const senderName = data.sender || "Peer";
    const callType = data.type || "video";

    webrtcState.activeTargetSid = senderSid;
    webrtcState.activeTargetName = senderName;
    webrtcState.callStatus = "connected";

    if (DOM.webrtcPeerName) DOM.webrtcPeerName.textContent = senderName;
    if (DOM.webrtcCallTimer) DOM.webrtcCallTimer.textContent = "00:00";
    if (DOM.webrtcCallOverlay) {
      DOM.webrtcCallOverlay.classList.remove("hidden");
      DOM.webrtcCallOverlay.classList.remove("minimized");
    }
    if (DOM.webrtcConnectingBadge) {
      DOM.webrtcConnectingBadge.classList.add("hidden");
    }

    try {
      // 1. Get user media
      const constraints = {
        video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
        audio: true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      webrtcState.localStream = stream;
      if (DOM.webrtcLocalVideo) {
        DOM.webrtcLocalVideo.srcObject = stream;
      }
      if (DOM.webrtcVideoGrid && callType === "video") {
        DOM.webrtcVideoGrid.innerHTML = "";
        renderVideoTile("local", state.username || "You", stream, true);
      }

      // 2. Instantiate RTCPeerConnection
      const pc = new RTCPeerConnection(RTC_CONFIG);
      webrtcState.peerConnection = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ondatachannel = (e) => {
        setupP2PDataChannel(e.channel, senderSid, senderName);
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          webrtcState.remoteStream = event.streams[0];
          if (DOM.webrtcRemoteVideo) {
            DOM.webrtcRemoteVideo.srcObject = event.streams[0];
          }
          if (DOM.webrtcVideoGrid && webrtcState.callType === "video") {
            renderVideoTile(senderSid, senderName, event.streams[0], false);
          }
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && state.socket) {
          state.socket.emit("webrtc_ice_candidate", {
            target_sid: senderSid,
            room_id: state.roomId,
            candidate: event.candidate
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          onWebrtcCallConnected();
        } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          endWebrtcCall(false);
        }
      };

      // 3. Set remote description from offer
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

      // 4. Drain any pending ICE candidates
      drainPendingIceCandidates(pc);

      // 5. Create answer & set local description
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // 6. Send Answer back via Flask-SocketIO
      state.socket.emit("webrtc_answer", {
        target_sid: senderSid,
        room_id: state.roomId,
        sender: state.username,
        answer: answer,
        type: callType
      });

      startWebrtcCallTimer();
      logActivity(`[WebRTC] Call accepted with ${senderName}.`);

    } catch (err) {
      logActivity(`[WebRTC Error] Error accepting call: ${err.message}`);
      appendSystemMessage(`⚠️ Media access failed: ${err.message}`);
      endWebrtcCall(true, "media_error");
    }
  }

  /**
   * Declines an incoming WebRTC call
   */
  function declineIncomingWebrtcCall() {
    if (DOM.webrtcIncomingModal) {
      DOM.webrtcIncomingModal.classList.add("hidden");
    }
    if (webrtcState.pendingIncomingOffer && state.socket) {
      state.socket.emit("webrtc_call_end", {
        target_sid: webrtcState.pendingIncomingOffer.sender_sid,
        room_id: state.roomId,
        reason: "declined"
      });
    }
    webrtcState.pendingIncomingOffer = null;
  }

  /**
   * Handles incoming SDP Answer from peer
   */
  async function handleIncomingWebrtcAnswer(data) {
    if (!data || !data.answer) return;
    if (webrtcMesh.peers[data.sender_sid]) {
      handleMeshWebrtcAnswer(data);
      return;
    }

    logActivity(`[WebRTC] Received SDP Answer from '${data.sender || "Peer"}'.`);

    const pc = webrtcState.peerConnection;
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        drainPendingIceCandidates(pc);
        if (data.type !== "file_data") {
          onWebrtcCallConnected();
        }
      } catch (err) {
        logActivity(`[WebRTC Error] Error setting remote description: ${err.message}`);
      }
    }
  }

  /**
   * Handles incoming ICE candidate
   */
  async function handleIncomingIceCandidate(data) {
    if (!data || !data.candidate) return;
    if (webrtcMesh.peers[data.sender_sid]) {
      handleMeshIceCandidate(data);
      return;
    }

    const pc = webrtcState.peerConnection;
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        // Safe candidate catch
      }
    } else {
      webrtcState.pendingIceCandidates.push(data.candidate);
    }
  }

  /**
   * Drains any buffered ICE candidates once remote description is set
   */
  async function drainPendingIceCandidates(pc) {
    while (webrtcState.pendingIceCandidates.length > 0) {
      const candidate = webrtcState.pendingIceCandidates.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {}
    }
  }

  /**
   * Called when P2P Call is confirmed connected
   */
  function onWebrtcCallConnected() {
    webrtcState.callStatus = "connected";
    if (DOM.webrtcConnectingBadge) {
      DOM.webrtcConnectingBadge.classList.add("hidden");
    }
    startWebrtcCallTimer();
    logActivity(`[WebRTC] Direct P2P Media Stream Connected!`);
  }

  /**
   * Starts call duration timer
   */
  function startWebrtcCallTimer() {
    clearInterval(webrtcState.callTimerInterval);
    webrtcState.callDurationSec = 0;
    webrtcState.callTimerInterval = setInterval(() => {
      webrtcState.callDurationSec++;
      const mins = Math.floor(webrtcState.callDurationSec / 60);
      const secs = webrtcState.callDurationSec % 60;
      const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      if (DOM.webrtcCallTimer) {
        DOM.webrtcCallTimer.textContent = formatted;
      }
    }, 1000);
  }

  /**
   * Ends an active or pending WebRTC call and frees all media hardware
   */
  function endWebrtcCall(notifyPeer = true, reason = "ended") {
    clearInterval(webrtcState.callTimerInterval);
    webrtcState.callTimerInterval = null;

    if (notifyPeer && webrtcState.activeTargetSid && state.socket) {
      state.socket.emit("webrtc_call_end", {
        target_sid: webrtcState.activeTargetSid,
        room_id: state.roomId,
        reason: reason
      });
    }

    // Stop and release all microphone and camera tracks
    if (webrtcState.localStream) {
      webrtcState.localStream.getTracks().forEach((track) => {
        try { track.stop(); } catch (_) {}
      });
      webrtcState.localStream = null;
    }

    if (DOM.webrtcLocalVideo) {
      DOM.webrtcLocalVideo.srcObject = null;
    }
    if (DOM.webrtcRemoteVideo) {
      DOM.webrtcRemoteVideo.srcObject = null;
    }

    // Close peer connection
    if (webrtcState.peerConnection) {
      try {
        webrtcState.peerConnection.close();
      } catch (_) {}
      webrtcState.peerConnection = null;
    }

    webrtcState.dataChannel = null;
    webrtcState.callStatus = "idle";
    webrtcState.activeTargetSid = null;
    webrtcState.activeTargetName = null;
    webrtcState.isAudioMuted = false;
    webrtcState.isVideoMuted = false;
    webrtcState.pendingIceCandidates = [];

    // Reset UI
    if (DOM.webrtcCallOverlay) {
      DOM.webrtcCallOverlay.classList.add("hidden");
      DOM.webrtcCallOverlay.classList.remove("minimized");
    }
    if (DOM.webrtcVideoGrid) {
      DOM.webrtcVideoGrid.innerHTML = "";
    }
    currentFacingMode = "user";
    isLocalSelfViewMirrored = false;
    if (DOM.webrtcIncomingModal) {
      DOM.webrtcIncomingModal.classList.add("hidden");
    }
    if (DOM.btnWebrtcMic) {
      DOM.btnWebrtcMic.classList.remove("active-off");
    }
    if (DOM.btnWebrtcCam) {
      DOM.btnWebrtcCam.classList.remove("active-off");
    }
    if (DOM.webrtcIconMic) {
      DOM.webrtcIconMic.innerHTML = `<use href="#icon-mic"></use>`;
    }
    if (DOM.webrtcIconCam) {
      DOM.webrtcIconCam.innerHTML = `<use href="#icon-video"></use>`;
    }

    logActivity("[WebRTC] Call terminated and media hardware released.");
  }

  function handleIncomingCallEnd(data) {
    if (webrtcMesh.active && data && data.sender_sid) {
      removeMeshPeer(data.sender_sid);
      return;
    }
    const peerName = webrtcState.activeTargetName || "Peer";
    const reason = data && data.reason ? data.reason : "ended";
    endWebrtcCall(false);
    if (reason === "declined") {
      appendSystemMessage(`📞 ${peerName} declined the call.`);
    } else if (reason === "busy") {
      appendSystemMessage(`📞 ${peerName} is currently in another call.`);
    } else {
      appendSystemMessage(`📞 Call with ${peerName} ended.`);
    }
  }

  function toggleWebrtcMic() {
    if (!webrtcState.localStream) return;
    webrtcState.isAudioMuted = !webrtcState.isAudioMuted;
    webrtcState.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !webrtcState.isAudioMuted;
    });

    if (DOM.btnWebrtcMic) {
      DOM.btnWebrtcMic.classList.toggle("active-off", webrtcState.isAudioMuted);
    }
    if (DOM.webrtcIconMic) {
      DOM.webrtcIconMic.innerHTML = webrtcState.isAudioMuted
        ? `<use href="#icon-mic-off"></use>`
        : `<use href="#icon-mic"></use>`;
    }
  }

  function toggleWebrtcCam() {
    if (!webrtcState.localStream) return;
    webrtcState.isVideoMuted = !webrtcState.isVideoMuted;
    webrtcState.localStream.getVideoTracks().forEach((track) => {
      track.enabled = !webrtcState.isVideoMuted;
    });

    if (DOM.btnWebrtcCam) {
      DOM.btnWebrtcCam.classList.toggle("active-off", webrtcState.isVideoMuted);
    }
    if (DOM.webrtcIconCam) {
      DOM.webrtcIconCam.innerHTML = webrtcState.isVideoMuted
        ? `<use href="#icon-video-off"></use>`
        : `<use href="#icon-video"></use>`;
    }
  }

  function toggleWebrtcMinimize() {
    if (DOM.webrtcCallOverlay) {
      DOM.webrtcCallOverlay.classList.toggle("minimized");
    }
  }

  // =========================================================================
  // RTCDATACHANNEL P2P ZERO-RETENTION LARGE FILE TRANSFERS
  // =========================================================================

  /**
   * Initializes RTCDataChannel listener and sets up packet processing
   */
  function setupP2PDataChannel(channel, peerSid, peerName) {
    webrtcState.dataChannel = channel;
    channel.binaryType = "arraybuffer";

    channel.onopen = () => {
      logActivity(`[P2P Channel Open] Direct channel connected to '${peerName || "peer"}'.`);
      if (webrtcState.queuedP2PFile) {
        const item = webrtcState.queuedP2PFile;
        webrtcState.queuedP2PFile = null;
        executeP2PFileSend(item.file, channel, item.peerName);
      }
    };

    channel.onclose = () => {
      logActivity(`[P2P Channel Closed] Channel closed with '${peerName || "peer"}'.`);
    };

    channel.onerror = (err) => {
      logActivity(`[P2P Channel Error] ${err.message || err}`);
    };

    channel.onmessage = (event) => {
      handleIncomingP2PDataMessage(event.data, peerName);
    };
  }

  /**
   * Creates a dedicated data-only PeerConnection when calling isn't active
   */
  async function initP2PDataConnection(targetSid, targetName) {
    logActivity(`[P2P] Negotiating direct data channel with ${targetName}...`);
    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      webrtcState.peerConnection = pc;
      webrtcState.activeTargetSid = targetSid;
      webrtcState.activeTargetName = targetName;
      webrtcState.pendingIceCandidates = [];

      const dc = pc.createDataChannel("p2p_data_transfer", { ordered: true });
      setupP2PDataChannel(dc, targetSid, targetName);

      pc.onicecandidate = (event) => {
        if (event.candidate && state.socket) {
          state.socket.emit("webrtc_ice_candidate", {
            target_sid: targetSid,
            room_id: state.roomId,
            candidate: event.candidate
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      state.socket.emit("webrtc_offer", {
        target_sid: targetSid,
        room_id: state.roomId,
        sender: state.username,
        offer: offer,
        type: "file_data"
      });
    } catch (err) {
      logActivity(`[P2P Error] Failed to establish data connection: ${err.message}`);
      appendSystemMessage(`⚠️ P2P Connection failed: ${err.message}`);
    }
  }

  /**
   * Selects and queues a file for P2P transfer
   */
  function triggerP2PFileSelect(targetSid, targetName) {
    const resolved = resolveWebRtcTarget(targetSid, targetName);
    if (!resolved.username) {
      appendSystemMessage("⚠️ Please choose an online peer to send a file to.");
      return;
    }
    webrtcState.p2pSelectedTarget = resolved;
    if (DOM.p2pFileInput) {
      DOM.p2pFileInput.value = "";
      DOM.p2pFileInput.click();
    }
  }

  function handleP2PFileInputChange(e) {
    if (!e.target || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const target = webrtcState.p2pSelectedTarget || resolveWebRtcTarget();

    if (!target || !target.username) {
      appendSystemMessage("⚠️ No target peer selected for direct P2P transfer.");
      return;
    }

    sendP2PFile(file, target.sid, target.username);
    e.target.value = "";
  }

  /**
   * Sends a file directly to peer via RTCDataChannel (0 bytes on server)
   */
  function sendP2PFile(file, targetSid, targetName) {
    const resolved = resolveWebRtcTarget(targetSid, targetName);
    targetSid = resolved.sid;
    targetName = resolved.username;

    if (!targetName) {
      appendSystemMessage("⚠️ Cannot send file: no online peer selected.");
      return;
    }

    logActivity(`[P2P Transfer] Preparing '${file.name}' (${formatBytes(file.size)}) for ${targetName}...`);

    const meshPeer = targetSid ? webrtcMesh.peers[targetSid] : null;
    if (meshPeer && meshPeer.dc && meshPeer.dc.readyState === "open") {
      executeP2PFileSend(file, meshPeer.dc, targetName);
      return;
    }

    if (webrtcState.dataChannel && webrtcState.dataChannel.readyState === "open") {
      executeP2PFileSend(file, webrtcState.dataChannel, targetName);
    } else {
      webrtcState.queuedP2PFile = { file, targetSid, targetName };
      initP2PDataConnection(targetSid, targetName);
    }
  }

  /**
   * Slices file into 16 KB chunks and streams over RTCDataChannel with backpressure flow control
   */
  function executeP2PFileSend(file, channel, peerName) {
    const transferId = "p2p-tx-" + Date.now() + "-" + Math.random().toString(36).substr(2, 6);
    const CHUNK_SIZE = 16384; // 16 KB
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Render outgoing transfer progress card in message stream
    renderP2PTransferCard(transferId, file.name, file.size, true, peerName);

    // Send metadata header packet
    channel.send(JSON.stringify({
      type: "p2p_file_start",
      id: transferId,
      name: file.name,
      size: file.size,
      mime: file.type || "application/octet-stream",
      totalChunks: totalChunks
    }));

    let offset = 0;
    channel.bufferedAmountLowThreshold = 65536; // 64 KB threshold for backpressure

    function sendNextSlice() {
      if (offset >= file.size) {
        // Transfer completed!
        channel.send(JSON.stringify({
          type: "p2p_file_complete",
          id: transferId
        }));
        updateP2PTransferComplete(transferId, null, file.name);
        logActivity(`[P2P Transfer Done] Direct transfer of '${file.name}' to ${peerName} finished!`);
        return;
      }

      // Respect backpressure
      if (channel.bufferedAmount > 128 * 1024) {
        channel.onbufferedamountlow = () => {
          channel.onbufferedamountlow = null;
          sendNextSlice();
        };
        return;
      }

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          channel.send(evt.target.result);
          offset += slice.size;
          const pct = Math.min(100, Math.round((offset / file.size) * 100));
          updateP2PTransferProgress(transferId, pct, `${formatBytes(offset)} / ${formatBytes(file.size)}`);
          // Continue slicing next chunk
          sendNextSlice();
        } catch (err) {
          logActivity(`[P2P Send Error] Failed sending chunk: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(slice);
    }

    sendNextSlice();
  }

  /**
   * Processes incoming data packets over RTCDataChannel
   */
  function handleIncomingP2PDataMessage(data, peerName) {
    // 1. JSON Control Messages
    if (typeof data === "string") {
      try {
        const msg = JSON.parse(data);
        if (msg.type === "p2p_file_start") {
          webrtcState.rxTransfer = {
            id: msg.id,
            name: msg.name,
            size: msg.size,
            mime: msg.mime,
            totalChunks: msg.totalChunks,
            receivedBytes: 0,
            chunks: [],
            sender: peerName || "Peer"
          };
          renderP2PTransferCard(msg.id, msg.name, msg.size, false, peerName);
          logActivity(`[P2P Rx] Started receiving '${msg.name}' (${formatBytes(msg.size)}) directly from ${peerName}.`);
        } else if (msg.type === "p2p_file_complete") {
          const rx = webrtcState.rxTransfer;
          if (rx && rx.id === msg.id) {
            const blob = new Blob(rx.chunks, { type: rx.mime || "application/octet-stream" });
            const blobUrl = URL.createObjectURL(blob);
            updateP2PTransferComplete(rx.id, blobUrl, rx.name);
            webrtcState.rxTransfer = null;
            logActivity(`[P2P Rx Done] '${rx.name}' assembled successfully. Zero server storage used!`);
          }
        }
      } catch (err) {
        logActivity(`[P2P JSON Parse Error] ${err.message}`);
      }
      return;
    }

    // 2. Binary ArrayBuffer chunks
    if (data instanceof ArrayBuffer) {
      const rx = webrtcState.rxTransfer;
      if (rx) {
        rx.chunks.push(data);
        rx.receivedBytes += data.byteLength;
        const pct = Math.min(100, Math.round((rx.receivedBytes / rx.size) * 100));
        updateP2PTransferProgress(rx.id, pct, `${formatBytes(rx.receivedBytes)} / ${formatBytes(rx.size)}`);
      }
    }
  }

  /**
   * Appends an interactive P2P transfer progress card to the chat log
   */
  function renderP2PTransferCard(transferId, filename, filesize, isSender, peerName) {
    if (!DOM.messagesContainer) return;

    if (DOM.emptyState) {
      DOM.emptyState.classList.add("hidden");
    }

    const row = document.createElement("div");
    row.className = `message-row message-p2p-transfer ${isSender ? "outgoing" : "incoming"}`;
    row.id = `card-${transferId}`;

    const title = isSender ? `Sending Direct to ${peerName}` : `Receiving Directly from ${peerName}`;

    row.innerHTML = `
      <div class="p2p-transfer-card">
        <div class="p2p-card-top">
          <div class="p2p-card-icon">
            <svg class="svg-icon sm" aria-hidden="true"><use href="#icon-paperclip"></use></svg>
          </div>
          <div class="p2p-card-info">
            <div class="p2p-card-filename" title="${filename}">${filename}</div>
            <div class="p2p-card-meta">${title} • ${formatBytes(filesize)}</div>
          </div>
        </div>
        <div class="p2p-progress-track">
          <div class="p2p-progress-bar" id="bar-${transferId}" style="width: 0%;"></div>
        </div>
        <div class="p2p-card-bottom">
          <span class="p2p-status-text" id="status-${transferId}">${isSender ? "Sending 0%" : "Receiving 0%"}</span>
          <span class="p2p-badge-zero">Direct P2P • 0 Server Storage</span>
        </div>
        <div id="actions-${transferId}" class="p2p-card-actions hidden"></div>
      </div>
    `;

    DOM.messagesContainer.appendChild(row);
    scrollToBottom();
  }

  /**
   * Updates progress bar and metrics for a P2P transfer
   */
  function updateP2PTransferProgress(transferId, percent, bytesText) {
    const bar = document.getElementById(`bar-${transferId}`);
    const status = document.getElementById(`status-${transferId}`);
    if (bar) {
      bar.style.width = `${percent}%`;
    }
    if (status) {
      status.textContent = `${percent}% (${bytesText})`;
    }
  }

  /**
   * Marks P2P transfer as 100% complete and displays Download button if receiving
   */
  function updateP2PTransferComplete(transferId, blobUrl, filename) {
    const bar = document.getElementById(`bar-${transferId}`);
    const status = document.getElementById(`status-${transferId}`);
    const actions = document.getElementById(`actions-${transferId}`);

    if (bar) {
      bar.style.width = "100%";
      bar.style.background = "#10B981";
    }
    if (status) {
      status.textContent = blobUrl ? "Transfer Complete ✓" : "Sent Directly to Peer ✓";
      status.style.color = "#10B981";
    }

    if (blobUrl && actions) {
      actions.classList.remove("hidden");
      actions.innerHTML = `
        <a href="${blobUrl}" download="${filename}" class="p2p-download-btn">
          <svg class="svg-icon xs" aria-hidden="true"><use href="#icon-download"></use></svg>
          <span>Download ${filename}</span>
        </a>
      `;
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

    // Sidebar Toggle & Mobile Drawer
    if (DOM.btnSidebarToggle) {
      DOM.btnSidebarToggle.addEventListener("click", toggleSidebar);
    }
    if (DOM.btnMobileMenu && DOM.btnMobileMenu !== DOM.btnSidebarToggle) {
      DOM.btnMobileMenu.addEventListener("click", toggleSidebar);
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
    if (DOM.btnDrawerCopyLink) {
      DOM.btnDrawerCopyLink.addEventListener("click", () => {
        copyInviteLink();
        closeSidebar();
      });
      DOM.btnDrawerCopyLink.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          copyInviteLink();
          closeSidebar();
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

    // E2EE Room Mode Selectors & Controls
    if (DOM.btnModeCreate) {
      DOM.btnModeCreate.addEventListener("click", () => setRoomMode("create"));
    }
    if (DOM.btnModeJoin) {
      DOM.btnModeJoin.addEventListener("click", () => setRoomMode("join"));
    }
    if (DOM.btnGenerateRoom) {
      DOM.btnGenerateRoom.addEventListener("click", () => {
        clearLoginError();
        if (DOM.roomInput) DOM.roomInput.value = generateRandomRoomId();
      });
    }
    if (DOM.btnTogglePasskey) {
      DOM.btnTogglePasskey.addEventListener("click", togglePasskeyVisibility);
    }

    // Modal Input Listeners (Clear errors on input modification)
    if (DOM.usernameInput) {
      DOM.usernameInput.addEventListener("input", clearLoginError);
      DOM.usernameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleConnectClick();
      });
    }
    if (DOM.usernameInput) {
      DOM.usernameInput.addEventListener("input", clearLoginError);
      DOM.usernameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleConnectClick(e);
      });
    }
    if (DOM.roomInput) {
      DOM.roomInput.addEventListener("input", clearLoginError);
      DOM.roomInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleConnectClick(e);
      });
    }
    if (DOM.passkeyInput) {
      DOM.passkeyInput.addEventListener("input", clearLoginError);
      DOM.passkeyInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleConnectClick(e);
      });
    }

    // Independent Action Button Listeners
    if (DOM.btnCreateRoom) {
      DOM.btnCreateRoom.addEventListener("click", handleCreateRoom);
    }
    if (DOM.btnJoinRoom) {
      DOM.btnJoinRoom.addEventListener("click", handleJoinRoom);
    }

    // Legacy Fallback Connect Button
    if (DOM.connectBtn && DOM.connectBtn !== DOM.btnCreateRoom && DOM.connectBtn !== DOM.btnJoinRoom) {
      DOM.connectBtn.addEventListener("click", handleConnectClick);
    }

    // Chat Submission & Typing Listener
    if (DOM.chatForm) {
      DOM.chatForm.addEventListener("submit", handleSendMessage);
    }
    if (DOM.messageInput) {
      DOM.messageInput.addEventListener("input", () => {
        checkMentionTrigger();
        handleInputTyping();
      });
      DOM.messageInput.addEventListener("keydown", (e) => {
        if (handleMentionsKeydown(e)) {
          return;
        }
        if (e.key === "Enter") {
          stopTyping();
        } else if (e.key === "Escape" && activeReply) {
          cancelReply();
        } else {
          handleInputTyping();
        }
      });
    }

    document.addEventListener("click", (e) => {
      if (mentionsState.isOpen) {
        if (!e.target.closest("#mentions-popover") && e.target !== DOM.messageInput) {
          closeMentionsPopover();
        }
      }
    });

    if (DOM.btnCancelReply) {
      DOM.btnCancelReply.addEventListener("click", cancelReply);
    }

    // Share Room Modal & Direct QR Code Controls
    if (DOM.btnHeaderShareRoom) {
      DOM.btnHeaderShareRoom.addEventListener("click", openShareRoomModal);
    }
    if (DOM.btnCloseShareModal) {
      DOM.btnCloseShareModal.addEventListener("click", closeShareRoomModal);
    }
    if (DOM.btnCopyShareUrl) {
      DOM.btnCopyShareUrl.addEventListener("click", handleCopyShareUrl);
    }
    if (DOM.shareRoomModal) {
      DOM.shareRoomModal.addEventListener("click", (e) => {
        if (e.target === DOM.shareRoomModal || !e.target.closest(".share-room-card")) {
          closeShareRoomModal();
        }
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && DOM.shareRoomModal && !DOM.shareRoomModal.classList.contains("hidden")) {
        closeShareRoomModal();
      }
    });

    // In-App QR Scanner Controls
    if (DOM.btnScanQr) {
      DOM.btnScanQr.addEventListener("click", startQrScanner);
    }
    if (DOM.btnScanQrSecondary) {
      DOM.btnScanQrSecondary.addEventListener("click", startQrScanner);
    }
    if (DOM.btnCloseScannerModal) {
      DOM.btnCloseScannerModal.addEventListener("click", stopQrScanner);
    }
    if (DOM.btnCancelScanner) {
      DOM.btnCancelScanner.addEventListener("click", stopQrScanner);
    }
    if (DOM.qrScannerModal) {
      DOM.qrScannerModal.addEventListener("click", (e) => {
        if (e.target === DOM.qrScannerModal || !e.target.closest(".qr-scanner-card")) {
          stopQrScanner();
        }
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && DOM.qrScannerModal && !DOM.qrScannerModal.classList.contains("hidden")) {
        stopQrScanner();
      }
    });

    // Copy Invite Link Button
    if (DOM.btnCopyRoomLink) {
      DOM.btnCopyRoomLink.addEventListener("click", copyInviteLink);
    }
    if (DOM.btnDrawerCopyLink) {
      DOM.btnDrawerCopyLink.addEventListener("click", openShareRoomModal);
    }

    // URL change listeners for direct room invites
    window.addEventListener("hashchange", checkUrlRoomParams);
    window.addEventListener("popstate", checkUrlRoomParams);

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

    // Disconnect / Leave Room Action
    const disconnectHandler = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      try {
        if (state.socket) {
          if (state.roomId) {
            state.socket.emit("leave_room", { room_id: state.roomId, username: state.username });
          }
          state.socket.disconnect();
        }
      } catch (_) {}

      // Reset room state
      state.roomId = "";
      state.peerList = [];

      // Route back to the join screen
      if (DOM.appContainer) DOM.appContainer.classList.add("hidden");
      if (DOM.loginOverlay) DOM.loginOverlay.classList.remove("hidden");

      leaveRoomCall();
      endWebrtcCall(false);

      // Hide room-specific header buttons
      if (DOM.btnHeaderShareRoom) DOM.btnHeaderShareRoom.classList.add("hidden");
      if (DOM.btnHeaderAudioCall) DOM.btnHeaderAudioCall.classList.add("hidden");
      if (DOM.btnHeaderCall) DOM.btnHeaderCall.classList.add("hidden");
      if (DOM.btnDisconnect) DOM.btnDisconnect.classList.add("hidden");

      // Reset chat header
      if (DOM.activeChatTitle) DOM.activeChatTitle.textContent = "Public Room";
      if (DOM.activeChatDesc) {
        DOM.activeChatDesc.textContent = "";
        DOM.activeChatDesc.classList.add("hidden");
      }

      // Clear messages view
      if (DOM.messagesContainer) {
        DOM.messagesContainer.innerHTML = "";
        if (DOM.emptyState) {
          DOM.messagesContainer.appendChild(DOM.emptyState);
          DOM.emptyState.classList.remove("hidden");
        }
      }

      // Clean URL parameters / hash
      try {
        history.replaceState(null, document.title, window.location.pathname);
      } catch (_) {}

      // Reconnect socket so client is ready for next room join
      setTimeout(() => {
        connectSocket();
      }, 150);

      if (DOM.usernameInput) {
        DOM.usernameInput.focus();
      }
    };
    if (DOM.btnDisconnect) DOM.btnDisconnect.addEventListener("click", disconnectHandler);
    if (DOM.btnSidebarDisconnect) DOM.btnSidebarDisconnect.addEventListener("click", disconnectHandler);
    if (DOM.btnDrawerDisconnect) DOM.btnDrawerDisconnect.addEventListener("click", disconnectHandler);

    const handleAttachClick = () => {
      const target = resolveWebRtcTarget();
      if (state.activeChatTarget || (target.username && (state.onlineUsers || []).length === 2)) {
        triggerP2PFileSelect(target.sid, target.username);
      } else {
        openFileModal();
      }
    };
    if (DOM.btnOpenFilePanel) DOM.btnOpenFilePanel.addEventListener("click", handleAttachClick);
    if (DOM.btnComposerAttach) DOM.btnComposerAttach.addEventListener("click", handleAttachClick);
    if (DOM.closeFileModal) DOM.closeFileModal.addEventListener("click", closeFileModal);
    if (DOM.cancelFileBtn) DOM.cancelFileBtn.addEventListener("click", closeFileModal);
    if (DOM.fileRecipientSelect) DOM.fileRecipientSelect.addEventListener("change", updateBroadcastBadge);

    // WebRTC Audio/Video & RTCDataChannel P2P Listeners
    if (DOM.btnHeaderAudioCall) {
      DOM.btnHeaderAudioCall.addEventListener("click", () => {
        startRoomCall("audio");
      });
    }

    if (DOM.btnHeaderCall) {
      DOM.btnHeaderCall.addEventListener("click", () => {
        if (state.activeChatTarget) {
          const target = resolveWebRtcTarget();
          if (target.username) {
            startWebrtcCall(target.sid, target.username, "video");
          } else {
            appendSystemMessage("⚠️ Target peer is not online.");
          }
        } else {
          startRoomCall("video");
        }
      });
    }

    // Floating Audio Bar Controls
    if (DOM.btnAudioBarMic) {
      DOM.btnAudioBarMic.addEventListener("click", toggleMeshMic);
    }
    if (DOM.btnAudioBarCam) {
      DOM.btnAudioBarCam.addEventListener("click", toggleMeshCamera);
    }
    if (DOM.btnAudioBarLeave) {
      DOM.btnAudioBarLeave.addEventListener("click", leaveRoomCall);
    }

    // Call Announcement Banner Controls
    if (DOM.btnAnnouncementJoin) {
      DOM.btnAnnouncementJoin.addEventListener("click", () => {
        const type = DOM.webrtcCallAnnouncement?.dataset.callType || "audio";
        joinRoomCall(type);
      });
    }
    if (DOM.btnAnnouncementDismiss) {
      DOM.btnAnnouncementDismiss.addEventListener("click", () => {
        if (DOM.webrtcCallAnnouncement) {
          DOM.webrtcCallAnnouncement.classList.add("hidden");
        }
      });
    }

    if (DOM.btnWebrtcMic) {
      DOM.btnWebrtcMic.addEventListener("click", () => {
        if (webrtcMesh.active) toggleMeshMic();
        else toggleWebrtcMic();
      });
    }

    if (DOM.btnWebrtcCam) {
      DOM.btnWebrtcCam.addEventListener("click", () => {
        if (webrtcMesh.active) toggleMeshCamera();
        else toggleWebrtcCam();
      });
    }

    if (DOM.btnWebrtcFlipCam) {
      DOM.btnWebrtcFlipCam.addEventListener("click", () => {
        switchCamera();
      });
    }

    if (DOM.btnWebrtcMirrorCam) {
      DOM.btnWebrtcMirrorCam.addEventListener("click", () => {
        toggleLocalMirror();
      });
    }

    if (DOM.btnWebrtcEnd) {
      DOM.btnWebrtcEnd.addEventListener("click", () => {
        if (webrtcMesh.active) leaveRoomCall();
        else endWebrtcCall(true);
      });
    }

    if (DOM.btnWebrtcMinimize) {
      DOM.btnWebrtcMinimize.addEventListener("click", toggleWebrtcMinimize);
    }

    if (DOM.btnWebrtcAccept) {
      DOM.btnWebrtcAccept.addEventListener("click", acceptIncomingWebrtcCall);
    }

    if (DOM.btnWebrtcDecline) {
      DOM.btnWebrtcDecline.addEventListener("click", declineIncomingWebrtcCall);
    }

    if (DOM.p2pFileInput) {
      DOM.p2pFileInput.addEventListener("change", handleP2PFileInputChange);
    }

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
