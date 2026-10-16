/**
 * NetChat Live — React 18 & Tailwind CSS UI Component
 * Exact 1:1 match of approved desktop and mobile designs with live Socket.IO state & RESTORED Landing Page.
 */

(function () {
  "use strict";

  const { useState, useEffect, useRef, createElement: h } = React;

  // Icon SVG Definitions matching Lucide / Reference designs
  function Icon({ name, className = "w-4 h-4" }) {
    switch (name) {
      case "lock":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("rect", { x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" }),
          h("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" })
        );
      case "link":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }),
          h("path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" })
        );
      case "phone":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" })
        );
      case "video":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" }),
          h("rect", { x: "2", y: "6", width: "14", height: "12", rx: "2" })
        );
      case "users":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }),
          h("circle", { cx: "9", cy: "7", r: "4" }),
          h("path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }),
          h("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })
        );
      case "power":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "M12 2v10" }),
          h("path", { d: "M18.4 6.6a9 9 0 1 1-12.77.04" })
        );
      case "speaker":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("polygon", { points: "11 5 6 9 2 9 2 15 6 15 11 19 11 5" }),
          h("path", { d: "M15.54 8.46a5 5 0 0 1 0 7.07" })
        );
      case "mic":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }),
          h("path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }),
          h("line", { x1: "12", x2: "12", y1: "19", y2: "22" })
        );
      case "mic-off":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("line", { x1: "2", x2: "22", y1: "2", y2: "22" }),
          h("path", { d: "M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" }),
          h("path", { d: "M5 10v2a7 7 0 0 0 12 5" }),
          h("path", { d: "M15 9.34V5a3 3 0 0 0-5.68-1.33" }),
          h("path", { d: "M9 9v3a3 3 0 0 0 5.12 2.12" }),
          h("line", { x1: "12", x2: "12", y1: "19", y2: "22" })
        );
      case "camera-off":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("line", { x1: "2", x2: "22", y1: "2", y2: "22" }),
          h("path", { d: "M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196" }),
          h("path", { d: "M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" })
        );
      case "phone-off":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.56 9.44" }),
          h("line", { x1: "2", x2: "22", y1: "2", y2: "22" })
        );
      case "paperclip":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" })
        );
      case "sparkle":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "currentColor" },
          h("path", { d: "M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" })
        );
      case "refresh":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }),
          h("path", { d: "M21 3v5h-5" }),
          h("path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }),
          h("path", { d: "M8 16H3v5" })
        );
      case "eye":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" }),
          h("circle", { cx: "12", cy: "12", r: "3" })
        );
      case "eye-off":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "M9.88 9.88a3 3 0 1 0 4.24 4.24" }),
          h("path", { d: "M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" }),
          h("path", { d: "M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" }),
          h("line", { x1: "2", x2: "22", y1: "2", y2: "22" })
        );
      case "shield":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" })
        );
      default:
        return null;
    }
  }

  // Deterministic avatar gradient generator from name
  function getAvatarGradient(name = "") {
    const gradients = [
      "from-emerald-600 to-teal-800",
      "from-blue-600 to-indigo-800",
      "from-purple-600 to-violet-800",
      "from-rose-600 to-pink-800",
      "from-amber-600 to-orange-800",
      "from-cyan-600 to-blue-800"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % gradients.length;
    return gradients[idx];
  }

  // User Avatar Component with Image or Deterministic Gradient Fallback
  function Avatar({ name, src, size = "md", isSpeaking = false, isMuted = false, isLocal = false }) {
    const sizeClasses = {
      sm: "w-5 h-5 text-[10px]",
      md: "w-7 h-7 text-xs",
      lg: "w-8 h-8 text-sm"
    }[size] || "w-7 h-7 text-xs";

    const initial = (name || "U").charAt(0).toUpperCase();
    const gradient = getAvatarGradient(name);

    return h("div", { className: `relative shrink-0 rounded-full ${sizeClasses}` },
      src
        ? h("img", {
            src,
            alt: name,
            className: "w-full h-full object-cover rounded-full"
          })
        : h("div", {
            className: `w-full h-full rounded-full flex items-center justify-center font-semibold text-white ${
              isLocal ? "bg-zinc-800 border border-zinc-700" : `bg-gradient-to-br ${gradient}`
            }`
          }, isLocal ? "" : initial),
      isSpeaking && h("div", {
        className: "absolute -bottom-0.5 -right-0.5 bg-emerald-950 border border-emerald-500 rounded-full p-0.5 flex items-center justify-center"
      }, h(Icon, { name: "speaker", className: "w-2.5 h-2.5 text-emerald-400" })),
      isMuted && h("div", {
        className: "absolute -bottom-0.5 -right-0.5 bg-zinc-950 border border-zinc-800 rounded-full p-0.5 flex items-center justify-center"
      }, h(Icon, { name: "mic-off", className: "w-2.5 h-2.5 text-red-400" }))
    );
  }

  // Parse text to render @mentions as exact green pill badges
  function renderMessageText(text) {
    if (!text) return "";
    const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push(
        h("span", {
          key: match.index,
          className: "bg-emerald-950/70 text-emerald-400 border border-emerald-500/40 text-xs font-medium px-2 py-0.5 rounded-md inline-block mr-1"
        }, `@${match[1]}`)
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  }

  // ===========================================================================
  // 1. RESTORED & RE-STYLED LANDING / ENTRY SCREEN (zinc-950 minimalist design)
  // ===========================================================================
  function LandingScreen({ isConnected, connectionStatus, onJoinSuccess }) {
    const [mode, setMode] = useState("create"); // "create" | "join"
    const [nickname, setNickname] = useState("");
    const [roomId, setRoomId] = useState("");
    const [passkey, setPasskey] = useState("");
    const [showPasskey, setShowPasskey] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Auto-detect invite link parameters (?room=... & pin=...)
    useEffect(() => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlRoom = params.get("room");
        const urlPin = params.get("pin");
        if (urlRoom) {
          setRoomId(urlRoom);
          setMode("join");
        }
        if (urlPin) {
          setPasskey(urlPin);
        }
      } catch (_) {}
    }, []);

    const handleGenerateRoom = () => {
      setErrorMsg(null);
      if (window.__NETCHAT_BRIDGE__ && typeof window.__NETCHAT_BRIDGE__.generateRoomId === "function") {
        setRoomId(window.__NETCHAT_BRIDGE__.generateRoomId());
      } else {
        const adjectives = ["swift", "quiet", "shadow", "cyber", "hyper", "neon", "delta"];
        const nouns = ["node", "relay", "packet", "nexus", "squad", "stream", "vault"];
        const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNum = Math.floor(100 + Math.random() * 900);
        setRoomId(`${randomAdj}-${randomNoun}-${randomNum}`);
      }
    };

    const handleSubmit = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      setErrorMsg(null);

      const nick = nickname.trim();
      const room = roomId.trim().toLowerCase();
      const pin = passkey.trim();

      if (!nick) {
        setErrorMsg("Please enter your nickname.");
        return;
      }
      if (!room) {
        setErrorMsg("Please enter or generate a Room ID.");
        return;
      }
      if (!pin) {
        setErrorMsg("Please enter a Room Passkey.");
        return;
      }

      setIsLoading(true);

      const callback = (res) => {
        setIsLoading(false);
        if (res && res.status === "success") {
          onJoinSuccess({ username: nick, roomId: room, passkey: pin });
        } else {
          setErrorMsg((res && res.message) ? res.message : "Failed to enter room. Check credentials.");
        }
      };

      if (window.__NETCHAT_BRIDGE__) {
        if (mode === "create") {
          window.__NETCHAT_BRIDGE__.createRoom(nick, room, pin, callback);
        } else {
          window.__NETCHAT_BRIDGE__.joinRoom(nick, room, pin, callback);
        }
      } else {
        // Fallback simulation if bridge is not ready
        setTimeout(() => {
          setIsLoading(false);
          onJoinSuccess({ username: nick, roomId: room, passkey: pin });
        }, 500);
      }
    };

    const statusDotClass = isConnected
      ? "bg-emerald-500 animate-pulse"
      : (connectionStatus === "connecting" ? "bg-amber-500 animate-pulse" : "bg-red-500");

    const statusText = isConnected
      ? "Connected"
      : (connectionStatus === "connecting" ? "Connecting..." : "Offline");

    return h("div", { className: "min-h-screen w-screen flex flex-col items-center justify-center bg-zinc-950 p-4 text-zinc-100 select-none relative overflow-hidden font-sans" },
      // Background subtle ambient radial glow
      h("div", { className: "absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/20 via-zinc-950/80 to-zinc-950 pointer-events-none" }),

      // Centered Card Container (max-w-md w-full, bg-zinc-900, border border-zinc-800, rounded-2xl)
      h("div", { className: "relative bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl z-10 backdrop-blur-xl" },
        // Brand Header & Connection Pill
        h("div", { className: "flex items-center justify-between mb-2" },
          h("div", { className: "flex items-center gap-2" },
            h("div", { className: "p-2 bg-zinc-800 border border-zinc-700/60 rounded-xl flex items-center justify-center text-emerald-400" },
              h(Icon, { name: "lock", className: "w-5 h-5" })
            ),
            h("div", null,
              h("h1", { className: "text-lg font-bold text-zinc-100 tracking-tight leading-none" }, "NetChat Live"),
              h("span", { className: "text-[11px] text-zinc-400 font-normal" }, "Server Based Chatting Platform")
            )
          ),
          // Live status badge
          h("div", {
            className: `px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 border ${
              isConnected ? "bg-emerald-950/50 text-emerald-400 border-emerald-500/30" : "bg-zinc-800/80 text-zinc-400 border-zinc-700"
            }`
          },
            h("span", { className: `w-2 h-2 rounded-full ${statusDotClass}` }),
            h("span", null, statusText)
          )
        ),

        // Subtitle
        h("p", { className: "text-xs text-zinc-400 mb-6 leading-relaxed" },
          "Minimalist, zero-retention ephemeral chat with end-to-end encrypted messaging and peer-to-peer audio calls."
        ),

        // Clean Form Tabs (Create Room / Join Room)
        h("div", { className: "grid grid-cols-2 p-1 bg-zinc-950 border border-zinc-800 rounded-xl mb-6 shadow-inner" },
          h("button", {
            type: "button",
            onClick: () => { setMode("create"); setErrorMsg(null); },
            className: `py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === "create"
                ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50"
                : "text-zinc-400 hover:text-zinc-200"
            }`
          }, "Create Room"),
          h("button", {
            type: "button",
            onClick: () => { setMode("join"); setErrorMsg(null); },
            className: `py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === "join"
                ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50"
                : "text-zinc-400 hover:text-zinc-200"
            }`
          }, "Join Room")
        ),

        // Error message banner
        errorMsg && h("div", { className: "bg-red-950/40 border border-red-800/60 text-red-300 text-xs px-3.5 py-2.5 rounded-xl mb-4 flex items-center gap-2 animate-in fade-in duration-150" },
          h(Icon, { name: "power", className: "w-4 h-4 shrink-0 text-red-400" }),
          h("span", { className: "flex-1" }, errorMsg)
        ),

        // Form Fields
        h("form", { onSubmit: handleSubmit, className: "space-y-4" },
          // Nickname Field
          h("div", null,
            h("label", { className: "text-xs font-medium text-zinc-400 mb-1.5 block" }, "Nickname"),
            h("input", {
              type: "text",
              value: nickname,
              onChange: (e) => setNickname(e.target.value),
              placeholder: "e.g., Alex, Sam, DevMaster",
              autoFocus: true,
              style: { backgroundColor: "#09090b", color: "#f4f4f5" },
              className: "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
            })
          ),

          // Room ID Field
          h("div", null,
            h("label", { className: "text-xs font-medium text-zinc-400 mb-1.5 block" }, "Room ID"),
            mode === "create"
              ? h("div", { className: "flex items-center gap-2" },
                  h("input", {
                    type: "text",
                    value: roomId,
                    onChange: (e) => setRoomId(e.target.value.toLowerCase()),
                    placeholder: "e.g., dev-squad, stealth-ops",
                    style: { backgroundColor: "#09090b", color: "#f4f4f5" },
                    className: "flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none font-mono transition-all"
                  }),
                  h("button", {
                    type: "button",
                    onClick: handleGenerateRoom,
                    title: "Generate Random Room ID",
                    className: "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-3 py-2.5 rounded-xl text-xs font-medium transition-colors border border-zinc-700/50 flex items-center gap-1.5 shrink-0"
                  },
                    h(Icon, { name: "refresh", className: "w-3.5 h-3.5" }),
                    h("span", null, "Random")
                  )
                )
              : h("input", {
                  type: "text",
                  value: roomId,
                  onChange: (e) => setRoomId(e.target.value.toLowerCase()),
                  placeholder: "Enter existing Room ID",
                  style: { backgroundColor: "#09090b", color: "#f4f4f5" },
                  className: "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none font-mono transition-all"
                })
          ),

          // Room Passkey / PIN Field
          h("div", null,
            h("div", { className: "flex items-center justify-between mb-1.5" },
              h("label", { className: "text-xs font-medium text-zinc-400 block" }, "Room Passkey (PIN)"),
              h("span", { className: "text-[10px] text-zinc-500 flex items-center gap-1" },
                h(Icon, { name: "shield", className: "w-2.5 h-2.5 text-emerald-500/70" }),
                "Zero-knowledge E2EE"
              )
            ),
            h("div", {
              className: "relative flex items-center bg-zinc-950 border border-zinc-800 rounded-xl focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all"
            },
              h("input", {
                type: showPasskey ? "text" : "password",
                value: passkey,
                onChange: (e) => setPasskey(e.target.value),
                placeholder: "Room PIN / secret passkey",
                style: { backgroundColor: "transparent", color: "#f4f4f5", border: "none", outline: "none" },
                className: "flex-1 !bg-transparent px-3.5 py-2.5 text-sm !text-zinc-100 placeholder-zinc-500 outline-none font-mono"
              }),
              h("button", {
                type: "button",
                onClick: () => setShowPasskey((prev) => !prev),
                title: showPasskey ? "Hide Passkey" : "Show Passkey",
                className: "p-2.5 text-zinc-400 hover:text-zinc-200 transition-colors"
              }, h(Icon, { name: showPasskey ? "eye-off" : "eye", className: "w-4 h-4" }))
            )
          ),

          // Submit Button
          h("button", {
            type: "submit",
            disabled: isLoading,
            className: "mt-6 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          },
            h(Icon, { name: "lock", className: "w-4 h-4" }),
            h("span", null, isLoading
              ? "Connecting..."
              : (mode === "create" ? "Create & Enter Room" : "Join Encrypted Room")
            )
          )
        )
      ),

      // Footer disclaimer
      h("div", { className: "mt-6 text-center text-xs text-zinc-500 relative z-10" },
        "Pure peer-to-peer WebRTC & WebSocket mesh • No chats are saved to disk or server logs"
      )
    );
  }

  // ===========================================================================
  // 2. MAIN NETCHAT LIVE APPLICATION (LIVE WIRED STATE & CONDITIONAL CALL RIBBON)
  // ===========================================================================
  function NetChatApp() {
    // Session state
    const [inRoom, setInRoom] = useState(false);
    const [roomId, setRoomId] = useState("");
    const [username, setUsername] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState("connecting");
    const [isMembersOpen, setIsMembersOpen] = useState(true);
    const [toastMessage, setToastMessage] = useState(null);

    // Call Ribbon state (MUST NOT be visible by default)
    const [isCallActive, setIsCallActive] = useState(false);
    const [callType, setCallType] = useState("audio");
    const [meshPeers, setMeshPeers] = useState([]);
    const [isVoiceMuted, setIsVoiceMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);

    // Live Room Users (for right sidebar and @mention autocomplete)
    const [roomUsers, setRoomUsers] = useState([]);

    // Live Messages state (empty initially, mapped dynamically)
    const [messages, setMessages] = useState([]);

    // Chat input & mention autocomplete state
    const [inputValue, setInputValue] = useState("");
    const [isMentionOpen, setIsMentionOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Toast helper
    const showToast = (msg) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3000);
    };

    // Filter participants for mention popover (excluding local user)
    const mentionMatches = roomUsers
      .filter((u) => !u.isLocal)
      .filter((u) => u.name.toLowerCase().includes(mentionQuery.toLowerCase()));

    // Synchronize initial state from window.__NETCHAT_BRIDGE__ or window.__NETCHAT_STATE__
    useEffect(() => {
      const syncFromBridge = () => {
        if (window.__NETCHAT_BRIDGE__) {
          const s = window.__NETCHAT_BRIDGE__.getState();
          setIsConnected(s.isConnected);
          setConnectionStatus(s.connectionStatus);
          setIsCallActive(s.isCallActive);
          setCallType(s.callType);
          setIsVoiceMuted(s.isMuted);
          setIsCameraOff(s.isCameraOff);
          setMeshPeers(s.meshPeers || []);

          if (s.roomId) {
            setRoomId(s.roomId);
            setInRoom(true);
          }
          if (s.username) {
            setUsername(s.username);
          }

          if (Array.isArray(s.onlineUsers) && s.onlineUsers.length > 0) {
            const roster = s.onlineUsers.map((u) => {
              const name = typeof u === "string" ? u : (u.username || "Peer");
              const isLocal = name.toLowerCase() === (s.username || "").toLowerCase();
              return {
                id: name.toLowerCase(),
                name: name,
                isOnline: true,
                isLocal: isLocal,
                avatar: null
              };
            });
            setRoomUsers(roster);
          }
        }
      };

      syncFromBridge();
      const interval = setInterval(syncFromBridge, 1000);

      // Listen for reactive CustomEvents from app.js
      const onConnectionChanged = (e) => {
        if (e.detail) {
          setIsConnected(e.detail.isConnected);
          setConnectionStatus(e.detail.status);
        }
      };

      const onNewMessage = (e) => {
        if (e.detail) {
          setMessages((prev) => [...prev, e.detail]);
          setTimeout(() => {
            if (messagesEndRef.current) {
              messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
          }, 30);
        }
      };

      const onUsersUpdated = (e) => {
        if (Array.isArray(e.detail)) {
          const roster = e.detail.map((u) => {
            const name = typeof u === "string" ? u : (u.username || "Peer");
            const isLocal = name.toLowerCase() === (username || "").toLowerCase();
            return {
              id: name.toLowerCase(),
              name: name,
              isOnline: true,
              isLocal: isLocal,
              avatar: null
            };
          });
          setRoomUsers(roster);
        }
      };

      const onRoomJoined = (e) => {
        if (e.detail) {
          setRoomId(e.detail.roomId);
          setUsername(e.detail.username);
          setInRoom(true);
        }
      };

      const onRoomLeft = () => {
        setInRoom(false);
        setRoomId("");
        setMessages([]);
        setRoomUsers([]);
        setIsCallActive(false);
      };

      const onCallChanged = (e) => {
        if (e.detail) {
          setIsCallActive(Boolean(e.detail.active));
          if (e.detail.callType) setCallType(e.detail.callType);
        }
      };

      window.addEventListener("netchat:connection_changed", onConnectionChanged);
      window.addEventListener("netchat:new_message", onNewMessage);
      window.addEventListener("netchat:users_updated", onUsersUpdated);
      window.addEventListener("netchat:room_joined", onRoomJoined);
      window.addEventListener("netchat:room_left", onRoomLeft);
      window.addEventListener("netchat:call_changed", onCallChanged);

      return () => {
        clearInterval(interval);
        window.removeEventListener("netchat:connection_changed", onConnectionChanged);
        window.removeEventListener("netchat:new_message", onNewMessage);
        window.removeEventListener("netchat:users_updated", onUsersUpdated);
        window.removeEventListener("netchat:room_joined", onRoomJoined);
        window.removeEventListener("netchat:room_left", onRoomLeft);
        window.removeEventListener("netchat:call_changed", onCallChanged);
      };
    }, [username]);

    // Handle input typing & detect '@' for mention popover
    const handleInputChange = (e) => {
      const val = e.target.value;
      setInputValue(val);

      const cursorPos = e.target.selectionStart;
      const textBefore = val.slice(0, cursorPos);
      const match = /(?:^|\s)@([a-zA-Z0-9_-]*)$/.exec(textBefore);

      if (match) {
        setMentionQuery(match[1]);
        setMentionSelectedIndex(0);
        setIsMentionOpen(true);
      } else {
        setIsMentionOpen(false);
      }
    };

    // Insert chosen mention
    const insertMention = (name) => {
      const input = inputRef.current;
      if (!input) return;

      const cursorPos = input.selectionStart;
      const textBefore = inputValue.slice(0, cursorPos);
      const match = /(?:^|\s)@([a-zA-Z0-9_-]*)$/.exec(textBefore);
      if (!match) return;

      const atOffset = match[0].startsWith("@") ? 0 : 1;
      const atIndex = match.index + atOffset;
      const before = inputValue.substring(0, atIndex);
      const after = inputValue.substring(cursorPos);
      const nextVal = `${before}@${name} ${after}`;

      setInputValue(nextVal);
      setIsMentionOpen(false);

      setTimeout(() => {
        const nextPos = before.length + name.length + 2;
        input.focus();
        input.setSelectionRange(nextPos, nextPos);
      }, 0);
    };

    // Handle Keydown (Arrow navigation, Tab/Enter selection)
    const handleKeyDown = (e) => {
      if (isMentionOpen && mentionMatches.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionSelectedIndex((prev) => (prev + 1) % mentionMatches.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionSelectedIndex((prev) => (prev - 1 + mentionMatches.length) % mentionMatches.length);
          return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          const target = mentionMatches[mentionSelectedIndex];
          if (target) {
            insertMention(target.name);
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setIsMentionOpen(false);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };

    // Send chat message
    const sendMessage = () => {
      const trimmed = inputValue.trim();
      if (!trimmed) return;

      if (window.__NETCHAT_BRIDGE__ && typeof window.__NETCHAT_BRIDGE__.sendMessage === "function") {
        window.__NETCHAT_BRIDGE__.sendMessage(trimmed);
      }

      setInputValue("");
      setIsMentionOpen(false);

      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 50);
    };

    // Share link handler
    const handleShare = () => {
      const url = window.location.href;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          showToast("Room invite link copied to clipboard!");
        }).catch(() => {});
      } else {
        showToast(`Room: ${roomId}`);
      }
    };

    // Voice / Video Call Toggles
    const handleToggleVoice = () => {
      if (isCallActive) {
        if (window.__NETCHAT_BRIDGE__) window.__NETCHAT_BRIDGE__.endCall();
        setIsCallActive(false);
      } else {
        if (window.__NETCHAT_BRIDGE__) window.__NETCHAT_BRIDGE__.startCall("audio");
        setIsCallActive(true);
        setCallType("audio");
      }
    };

    const handleToggleVideo = () => {
      if (isCallActive && callType === "video") {
        if (window.__NETCHAT_BRIDGE__) window.__NETCHAT_BRIDGE__.endCall();
        setIsCallActive(false);
      } else {
        if (window.__NETCHAT_BRIDGE__) window.__NETCHAT_BRIDGE__.startCall("video");
        setIsCallActive(true);
        setCallType("video");
      }
    };

    const handleToggleMute = () => {
      if (window.__NETCHAT_BRIDGE__) window.__NETCHAT_BRIDGE__.toggleMute();
      setIsVoiceMuted((prev) => !prev);
    };

    const handleToggleCamera = () => {
      if (window.__NETCHAT_BRIDGE__) window.__NETCHAT_BRIDGE__.toggleCamera();
      setIsCameraOff((prev) => !prev);
    };

    const handleEndCall = () => {
      if (window.__NETCHAT_BRIDGE__) window.__NETCHAT_BRIDGE__.endCall();
      setIsCallActive(false);
    };

    const handleDisconnect = () => {
      if (confirm("Disconnect and leave this room?")) {
        if (window.__NETCHAT_BRIDGE__) {
          window.__NETCHAT_BRIDGE__.disconnect();
        }
        setInRoom(false);
        setRoomId("");
        setMessages([]);
        setRoomUsers([]);
      }
    };

    // If not in a room, render the restored & re-styled Landing Screen
    if (!inRoom) {
      return h(LandingScreen, {
        isConnected: isConnected,
        connectionStatus: connectionStatus,
        onJoinSuccess: ({ username: u, roomId: r }) => {
          setUsername(u);
          setRoomId(r);
          setInRoom(true);
        }
      });
    }

    // Dynamic connection dot styling
    const headerDotClass = isConnected
      ? "bg-emerald-500 animate-pulse ring-2 ring-emerald-500/20"
      : (connectionStatus === "connecting" ? "bg-amber-500 animate-pulse" : "bg-red-500");

    // Dynamic list of call participants: local user + connected mesh peers
    const activeCallParticipants = [
      { id: "local", name: username || "You", isLocal: true, isSpeaking: false, isMuted: isVoiceMuted },
      ...meshPeers.map((p) => ({
        id: p.id,
        name: p.name,
        isLocal: false,
        isSpeaking: p.isSpeaking,
        isMuted: p.isMuted
      }))
    ];

    return h("div", { className: "h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans antialiased overflow-hidden select-none" },

      // =======================================================================
      // 1. TOP HEADER (h-14 / 56px, bg-zinc-950, border-b border-zinc-800/80 px-4)
      // =======================================================================
      h("header", { className: "h-14 bg-zinc-950 border-b border-zinc-800/80 px-4 flex items-center justify-between shrink-0 z-30" },
        // Left Brand
        h("div", { className: "flex items-center gap-1.5" },
          h("span", { className: "font-semibold text-zinc-100 text-lg tracking-tight" }, "NetChat Live"),
          h("span", {
            className: `w-2.5 h-2.5 rounded-full ${headerDotClass} inline-block ml-1.5`,
            title: isConnected ? "Connected" : connectionStatus
          })
        ),

        // Center Room Pill
        h("div", { className: "bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm" },
          h(Icon, { name: "lock", className: "w-3 h-3 text-zinc-400" }),
          h("span", { className: "font-mono font-medium" }, `room: ${roomId}`)
        ),

        // Right Actions Group (Exact 5-icon order)
        h("div", { className: "flex items-center gap-1.5 sm:gap-2" },
          // Button 1 - Share/Link
          h("button", {
            type: "button",
            onClick: handleShare,
            title: "Share Room Link",
            className: "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 p-2 rounded-lg transition-colors border border-transparent hover:border-zinc-700/50"
          }, h(Icon, { name: "link", className: "w-4 h-4" })),

          // Button 2 - Voice Call
          h("button", {
            type: "button",
            onClick: handleToggleVoice,
            title: isCallActive && callType === "audio" ? "Leave Voice Call" : "Start Voice Call",
            className: `p-2 rounded-lg transition-colors border border-transparent ${
              isCallActive && callType === "audio"
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/40"
                : "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700/50"
            }`
          }, h(Icon, { name: "phone", className: "w-4 h-4" })),

          // Button 3 - Video Call
          h("button", {
            type: "button",
            onClick: handleToggleVideo,
            title: isCallActive && callType === "video" ? "Leave Video Call" : "Start Video Call",
            className: `p-2 rounded-lg transition-colors border border-transparent ${
              isCallActive && callType === "video"
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/40"
                : "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700/50"
            }`
          }, h(Icon, { name: "video", className: "w-4 h-4" })),

          // Button 4 - Members Sidebar Toggle (with top-right notification badge)
          h("button", {
            type: "button",
            onClick: () => setIsMembersOpen((prev) => !prev),
            title: "Toggle Room Members Sidebar",
            className: "relative hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 p-2 rounded-lg transition-colors border border-transparent hover:border-zinc-700/50"
          },
            h(Icon, { name: "users", className: "w-4 h-4" }),
            h("span", {
              className: "absolute -top-1 -right-1 bg-zinc-700 text-zinc-200 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-zinc-950 shadow-sm"
            }, roomUsers.length)
          ),

          // Button 5 - Disconnect
          h("button", {
            type: "button",
            onClick: handleDisconnect,
            title: "Disconnect Session",
            className: "hover:bg-red-500/10 text-red-400/90 hover:text-red-400 p-2 rounded-lg transition-colors border border-transparent hover:border-red-900/40"
          }, h(Icon, { name: "power", className: "w-4 h-4" }))
        )
      ),

      // =======================================================================
      // 2. ACTIVE VOICE CALL RIBBON (Conditionally Rendered: ONLY when call is active)
      // =======================================================================
      isCallActive && h("div", { className: "w-full bg-zinc-950/80 border-b border-zinc-800/80 px-4 py-2.5 flex items-center justify-between gap-4 overflow-x-auto shrink-0 backdrop-blur-md z-20 animate-in fade-in slide-in-from-top-2 duration-150" },
        // Left (Status & Active Participants from WebRTC Mesh)
        h("div", { className: "flex items-center gap-3 min-w-0 overflow-x-auto py-0.5" },
          h("span", { className: "text-xs font-medium text-zinc-400 whitespace-nowrap hidden sm:inline" },
            callType === "video" ? "Active Video Call" : "Active Voice Call"
          ),
          activeCallParticipants.map((p) => {
            const isSpeaking = p.isSpeaking;
            return h("div", {
              key: p.id,
              className: `flex items-center gap-2 text-xs px-2.5 py-1 rounded-full shrink-0 shadow-sm transition-all ${
                isSpeaking
                  ? "bg-emerald-950/40 border border-emerald-500 text-emerald-300"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-300"
              }`
            },
              h(Avatar, { name: p.name, size: "sm", isSpeaking: isSpeaking, isMuted: p.isMuted, isLocal: p.isLocal }),
              h("span", { className: "font-medium" }, p.name)
            );
          })
        ),

        // Right (Call Control Buttons)
        h("div", { className: "flex items-center gap-2 shrink-0" },
          // Mute Toggle
          h("button", {
            type: "button",
            onClick: handleToggleMute,
            className: `bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-1.5 transition-colors ${
              isVoiceMuted ? "border-red-900/60 text-red-400" : ""
            }`
          },
            h(Icon, { name: isVoiceMuted ? "mic-off" : "mic", className: "w-3.5 h-3.5" }),
            h("span", null, isVoiceMuted ? "Unmute" : "Mute")
          ),

          // Camera Off Toggle
          callType === "video" && h("button", {
            type: "button",
            onClick: handleToggleCamera,
            className: "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-1.5 transition-colors"
          },
            h(Icon, { name: isCameraOff ? "camera-off" : "video", className: "w-3.5 h-3.5" }),
            h("span", null, isCameraOff ? "Camera Off" : "Camera On")
          ),

          // End Call
          h("button", {
            type: "button",
            onClick: handleEndCall,
            className: "bg-zinc-900 hover:bg-red-950/50 text-red-400 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-900/40 flex items-center gap-1.5 transition-colors"
          },
            h(Icon, { name: "phone-off", className: "w-3.5 h-3.5" }),
            h("span", null, "End")
          )
        )
      ),

      // =======================================================================
      // MAIN CONTENT AREA (Chat Feed + Members Sidebar)
      // =======================================================================
      h("div", { className: "flex-1 flex overflow-hidden relative" },

        // =====================================================================
        // 4. CHAT FEED & MESSAGE BUBBLES
        // =====================================================================
        h("main", { className: "flex-1 flex flex-col overflow-hidden bg-zinc-950 relative" },
          // Scrollable messages container
          h("div", { className: "flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full" },
            messages.length === 0
              ? h("div", { className: "h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500 space-y-3" },
                  h("div", { className: "w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400" },
                    h(Icon, { name: "lock", className: "w-6 h-6 text-emerald-500/80" })
                  ),
                  h("div", null,
                    h("h3", { className: "text-sm font-semibold text-zinc-300" }, `Welcome to room: ${roomId}`),
                    h("p", { className: "text-xs text-zinc-500 mt-1 max-w-sm" },
                      "This room is live and ready. Messages are ephemeral and end-to-end encrypted with zero server retention."
                    )
                  )
                )
              : messages.map((msg) => {
                  if (msg.isMe) {
                    // Outgoing Message (You)
                    return h("div", { key: msg.id, className: "flex flex-col items-end ml-auto max-w-[85%] sm:max-w-[70%]" },
                      h("div", { className: "flex items-center gap-1.5 mb-1 text-[11px] text-zinc-400" },
                        h("span", null, "You"),
                        msg.timestamp && h("span", { className: "text-zinc-600 text-[10px]" }, msg.timestamp)
                      ),
                      h("div", { className: "bg-zinc-800 border border-zinc-700/60 text-zinc-100 text-sm p-3 rounded-2xl rounded-tr-sm shadow-sm leading-relaxed" },
                        renderMessageText(msg.text)
                      )
                    );
                  } else {
                    // Incoming Message (Peer)
                    return h("div", { key: msg.id, className: "flex items-start gap-2.5 max-w-[85%] sm:max-w-[70%]" },
                      h(Avatar, { name: msg.sender, src: msg.avatar, size: "md" }),
                      h("div", { className: "flex-1 min-w-0" },
                        h("div", { className: "flex items-center gap-1.5 mb-1 text-[11px] text-zinc-400" },
                          h("span", { className: "font-medium" }, msg.sender),
                          msg.timestamp && h("span", { className: "text-zinc-600 text-[10px]" }, msg.timestamp)
                        ),
                        h("div", { className: "bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm p-3 rounded-2xl rounded-tl-sm shadow-sm leading-relaxed" },
                          renderMessageText(msg.text)
                        )
                      )
                    );
                  }
                }),
            h("div", { ref: messagesEndRef })
          ),

          // Decorative bottom right star watermark
          h("div", { className: "absolute bottom-16 right-6 pointer-events-none opacity-20 hidden md:block" },
            h(Icon, { name: "sparkle", className: "w-8 h-8 text-zinc-400" })
          ),

          // ===================================================================
          // 5. DOCKED BOTTOM INPUT BAR & @MENTION AUTOCOMPLETE
          // ===================================================================
          h("footer", { className: "sticky bottom-0 bg-zinc-950 border-t border-zinc-800/80 p-3 sm:p-4 pb-safe relative z-20" },

            // @Mention Autocomplete Popover (Triggers when typing '@')
            isMentionOpen && mentionMatches.length > 0 && h("div", {
              className: "absolute bottom-full mb-2 left-4 w-60 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1 z-40 max-h-44 overflow-y-auto backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150"
            },
              mentionMatches.map((m, idx) => {
                const isSelected = idx === mentionSelectedIndex;
                return h("div", {
                  key: m.id,
                  onClick: () => insertMention(m.name),
                  className: `flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                    isSelected ? "bg-zinc-800" : "hover:bg-zinc-800"
                  }`
                },
                  h(Avatar, { name: m.name, src: m.avatar, size: "sm" }),
                  h("span", { className: "text-zinc-200 font-medium" }, `@${m.name}`),
                  h("span", { className: "text-zinc-500 text-[11px] ml-auto" }, "(online)")
                );
              })
            ),

            // Input Container with emerald focus ring matching reference design
            h("div", {
              className: "relative flex items-center bg-zinc-900 border border-zinc-800 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/30 rounded-xl px-3 py-1.5 transition-all shadow-inner"
            },
              // Left: Paperclip icon button
              h("button", {
                type: "button",
                title: "Attach File",
                onClick: () => {
                  const input = document.getElementById("file-upload");
                  if (input) input.click();
                },
                className: "text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors"
              }, h(Icon, { name: "paperclip", className: "w-4 h-4" })),

              // Center: Text input field (forced transparent to prevent CSS bleeding)
              h("input", {
                ref: inputRef,
                type: "text",
                value: inputValue,
                onChange: handleInputChange,
                onKeyDown: handleKeyDown,
                placeholder: "Type a message...",
                style: { backgroundColor: "transparent", color: "#f4f4f5", border: "none", outline: "none", boxShadow: "none" },
                className: "flex-1 !bg-transparent !border-0 !outline-none !shadow-none text-sm !text-zinc-100 placeholder-zinc-500 px-2 py-1.5 font-normal"
              }),

              // Right: Send button
              h("button", {
                type: "button",
                onClick: sendMessage,
                className: "text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95"
              }, "Send")
            )
          )
        ),

        // =====================================================================
        // 3. ROOM MEMBERS SIDEBAR (Exact side panel)
        // =====================================================================
        // Mobile Backdrop Overlay
        isMembersOpen && h("div", {
          onClick: () => setIsMembersOpen(false),
          className: "lg:hidden fixed inset-0 top-14 bg-black/30 z-30 transition-opacity"
        }),

        // Sidebar Container (Docked on desktop >= 1024px, Slide-over on mobile < 1024px)
        isMembersOpen && h("aside", {
          className: "fixed top-14 right-0 bottom-0 w-48 sm:w-56 bg-zinc-950 border-l border-zinc-800 z-40 p-3 sm:p-4 shadow-2xl lg:static lg:w-60 lg:z-10 lg:shadow-none shrink-0 overflow-y-auto"
        },
          // Header: "Room Members (count)"
          h("div", { className: "text-xs font-semibold text-zinc-300 mb-3 tracking-wide" }, `Room Members (${roomUsers.length})`),

          // Member List
          h("div", { className: "space-y-1" },
            roomUsers.length === 0
              ? h("div", { className: "text-xs text-zinc-500 italic py-2" }, "No other peers in room")
              : roomUsers.map((m) =>
                  h("div", {
                    key: m.id,
                    className: "flex items-center justify-between py-2 px-1 text-xs rounded-lg hover:bg-zinc-900/50 transition-colors"
                  },
                    // Left: Avatar + Name
                    h("div", { className: "flex items-center gap-2 min-w-0" },
                      h(Avatar, { name: m.name, src: m.avatar, size: "sm", isLocal: m.isLocal }),
                      h("span", { className: "text-zinc-200 font-medium truncate" }, m.name),
                      m.isLocal && h("span", { className: "text-zinc-400 text-[11px] font-normal" }, "(You)")
                    ),
                    // Right: Active status dot
                    h("span", { className: "w-2 h-2 rounded-full bg-emerald-500 shrink-0" })
                  )
                )
          )
        )
      ),

      // Toast Notification
      toastMessage && h("div", {
        className: "fixed bottom-20 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs px-4 py-2 rounded-full shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-3"
      }, toastMessage)
    );
  }

  // Mount React Component to DOM
  function mountReactApp() {
    const rootEl = document.getElementById("react-root");
    if (!rootEl) return;

    if (window.ReactDOM && typeof ReactDOM.createRoot === "function") {
      const root = ReactDOM.createRoot(rootEl);
      root.render(h(NetChatApp));
      console.log("[React] NetChat Live React app mounted successfully with live state.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountReactApp);
  } else {
    mountReactApp();
  }

  window.mountNetChatReact = mountReactApp;
})();
