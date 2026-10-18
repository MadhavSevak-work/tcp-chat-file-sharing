/**
 * NetChat Live — React 18 & Tailwind CSS UI Component
 * Exact 1:1 pixel-perfect match of approved NetChat Live "Create/Join Room" Landing Screen
 * and live-wired chat room with conditional WebRTC call ribbon and Socket.IO state.
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
      case "share":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" }),
          h("polyline", { points: "16 6 12 2 8 6" }),
          h("line", { x1: "12", x2: "12", y1: "2", y2: "15" })
        );
      case "sparkle":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "currentColor" },
          h("path", { d: "M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" })
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
      case "download":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
          h("polyline", { points: "7 10 12 15 17 10" }),
          h("line", { x1: "12", x2: "12", y1: "15", y2: "3" })
        );
      case "camera":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("path", { d: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" }),
          h("circle", { cx: "12", cy: "13", r: "3" })
        );
      case "qr":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("rect", { x: "3", y: "3", width: "7", height: "7" }),
          h("rect", { x: "14", y: "3", width: "7", height: "7" }),
          h("rect", { x: "14", y: "14", width: "7", height: "7" }),
          h("rect", { x: "3", y: "14", width: "7", height: "7" })
        );
      case "x":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
          h("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
        );
      case "smile":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("circle", { cx: "12", cy: "12", r: "10" }),
          h("path", { d: "M8 14s1.5 2 4 2 4-2 4-2" }),
          h("line", { x1: "9", x2: "9.01", y1: "9", y2: "9" }),
          h("line", { x1: "15", x2: "15.01", y1: "9", y2: "9" })
        );
      case "reply":
        return h("svg", { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          h("polyline", { points: "9 17 4 12 9 7" }),
          h("path", { d: "M20 18v-2a4 4 0 0 0-4-4H4" })
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

  // QR Code Renderer Component using QR library
  function QRCode({ value, size = 192, className = "" }) {
    const qrRef = useRef(null);

    useEffect(() => {
      if (!qrRef.current || !value) return;
      const el = qrRef.current;
      el.innerHTML = "";

      try {
        if (typeof window.QRCode !== "undefined") {
          if (typeof window.QRCode.toCanvas === "function") {
            const canvas = document.createElement("canvas");
            el.appendChild(canvas);
            window.QRCode.toCanvas(canvas, value, {
              width: size,
              margin: 2,
              color: { dark: "#09090b", light: "#ffffff" }
            }, (err) => {
              if (err) console.warn("QRCode.toCanvas error:", err);
            });
          } else {
            new window.QRCode(el, {
              text: value,
              width: size,
              height: size,
              colorDark: "#09090b",
              colorLight: "#ffffff",
              correctLevel: (typeof window.QRCode.CorrectLevel !== "undefined") ? window.QRCode.CorrectLevel.M : 0
            });
            const canvas = el.querySelector("canvas");
            const img = el.querySelector("img");
            if (canvas && img) {
              img.style.display = "none";
              img.setAttribute("aria-hidden", "true");
            }
          }
        }
      } catch (err) {
        console.warn("QR code render failed:", err);
      }
    }, [value, size]);

    return h("div", {
      ref: qrRef,
      className: `bg-white p-3 rounded-xl flex items-center justify-center shadow-md ${className}`
    });
  }

  // Live Camera QR Scanner Modal Component (html5-qrcode)
  function QrCameraScannerModal({ onScan, onClose }) {
    const scannerRef = useRef(null);

    useEffect(() => {
      let html5QrCode = null;
      let isMounted = true;

      const startScanner = async () => {
        try {
          if (typeof window.Html5Qrcode !== "undefined") {
            html5QrCode = new window.Html5Qrcode("landing-qr-reader");
            scannerRef.current = html5QrCode;

            const qrConfig = {
              fps: 10,
              qrbox: { width: 220, height: 220 },
              aspectRatio: 1.0
            };

            const onSuccess = (decodedText) => {
              if (!isMounted) return;
              isMounted = false;
              if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().then(() => {
                  try { html5QrCode.clear(); } catch (_) {}
                }).catch(() => {});
              }
              onScan(decodedText);
            };

            try {
              await html5QrCode.start(
                { facingMode: "environment" },
                qrConfig,
                onSuccess,
                () => {}
              );
            } catch (_) {
              if (!isMounted) return;
              await html5QrCode.start(
                { facingMode: "user" },
                qrConfig,
                onSuccess,
                () => {}
              );
            }
          }
        } catch (err) {
          console.warn("[QR Scanner] Camera start error:", err);
        }
      };

      const timer = setTimeout(startScanner, 120);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              scannerRef.current.stop().then(() => {
                try { scannerRef.current.clear(); } catch (_) {}
              }).catch(() => {});
            } else {
              scannerRef.current.clear();
            }
          } catch (_) {}
        }
      };
    }, []);

    return h("div", {
      className: "fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4",
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      }
    },
      h("div", {
        className: "w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center shadow-2xl relative"
      },
        h("h3", { className: "text-base font-semibold text-zinc-100 mb-1" }, "Scan Room QR Code"),
        h("p", { className: "text-xs text-zinc-400 text-center mb-4" }, "Point camera at a NetChat Live room QR code"),
        h("div", {
          id: "landing-qr-reader",
          className: "w-full aspect-square max-w-[280px] bg-black rounded-xl overflow-hidden border border-zinc-800 relative flex items-center justify-center"
        }),
        h("button", {
          type: "button",
          onClick: onClose,
          className: "mt-4 w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
        }, "Close Camera")
      )
    );
  }

  // Comprehensive Dark-Themed Emoji Picker Component with EmojiMart support
  function EmojiPickerComponent({ onSelect, onClose }) {
    const containerRef = useRef(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState(0);

    const categories = [
      {
        name: "Smileys",
        icon: "😀",
        emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "☺️", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😗", "😋", "😛", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕"]
      },
      {
        name: "Gestures",
        icon: "👍",
        emojis: ["👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘", "👌", "🤌", "🤏", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤙", "💪", "🦾", "✍️", "🙏", "🤝", "👏", "🙌", "👐", "🤲", "🫂", "💅", "🤳", "🙋", "🙆", "🙅", "🤷"]
      },
      {
        name: "Hearts & Sparkles",
        icon: "❤️",
        emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "🔥", "✨", "⚡", "💥", "💫", "🌟", "⭐", "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🎯", "🚀", "🛸", "💯"]
      },
      {
        name: "Animals & Food",
        icon: "🐶",
        emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦄", "☕", "🍵", "🧃", "🥤", "🍺", "🍻", "🍷", "🍕", "🍔", "🍟", "🌮", "🍣", "🍦", "🍩", "🍪", "🎂", "🍫", "🍿", "🍎", "🍓", "🥑"]
      },
      {
        name: "Objects & Tech",
        icon: "💡",
        emojis: ["💡", "💻", "📱", "📷", "🔍", "🔒", "🔑", "🛡️", "⚙️", "🧪", "📦", "✉️", "📝", "📅", "📌", "📍", "🏷️", "💰", "💳", "💎", "⏳", "⏰", "📢", "🔔", "🎵", "🎶", "💬", "💭", "💤", "🌐", "🧭", "🏁", "🏳️", "🌈", "☀️", "🌙", "🪐", "☁️", "❄️", "☔"]
      }
    ];

    // Try mounting EmojiMart if available in DOM
    useEffect(() => {
      if (window.EmojiMart && window.EmojiMart.Picker && containerRef.current) {
        try {
          const picker = new window.EmojiMart.Picker({
            theme: "dark",
            onEmojiSelect: (emoji) => {
              onSelect(emoji);
            }
          });
          containerRef.current.innerHTML = "";
          containerRef.current.appendChild(picker);
          return () => {
            if (containerRef.current) containerRef.current.innerHTML = "";
          };
        } catch (_) {}
      }
    }, []);

    const allEmojis = categories.flatMap(c => c.emojis);
    const displayedEmojis = searchQuery.trim()
      ? allEmojis.filter((e) => e.includes(searchQuery.trim()) || true).slice(0, 48)
      : categories[activeTab].emojis;

    return h("div", {
      ref: containerRef,
      className: "w-72 sm:w-80 bg-zinc-900 border border-zinc-800 text-zinc-100 flex flex-col p-2 select-none"
    },
      // Search bar + Close
      h("div", { className: "flex items-center gap-2 mb-2 pb-1 border-b border-zinc-800" },
        h("input", {
          type: "text",
          value: searchQuery,
          onChange: (e) => setSearchQuery(e.target.value),
          placeholder: "Search emojis...",
          className: "flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-700"
        }),
        h("button", {
          type: "button",
          onClick: onClose,
          className: "text-zinc-500 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 cursor-pointer text-xs"
        }, h(Icon, { name: "x", className: "w-3.5 h-3.5" }))
      ),

      // Category Tabs
      !searchQuery.trim() && h("div", { className: "flex items-center justify-between px-1 mb-2 border-b border-zinc-800/60 pb-1.5" },
        categories.map((cat, idx) =>
          h("button", {
            key: cat.name,
            type: "button",
            onClick: () => setActiveTab(idx),
            title: cat.name,
            className: `p-1 rounded-md text-base transition-transform hover:scale-110 cursor-pointer ${
              activeTab === idx ? "bg-zinc-800 ring-1 ring-zinc-700" : "opacity-60 hover:opacity-100"
            }`
          }, cat.icon)
        )
      ),

      // Emoji Grid (scrollable)
      h("div", { className: "grid grid-cols-7 sm:grid-cols-8 gap-1 max-h-48 overflow-y-auto p-1 [scrollbar-width:thin] [scrollbar-color:#27272a_transparent]" },
        displayedEmojis.map((emoji, idx) =>
          h("button", {
            key: `${emoji}-${idx}`,
            type: "button",
            onClick: () => onSelect({ native: emoji }),
            className: "w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-zinc-800 hover:scale-125 active:scale-95 transition-all cursor-pointer"
          }, emoji)
        )
      )
    );
  }

  // ===========================================================================
  // 1. EXACT 1:1 PIXEL-PERFECT LANDING SCREEN (Create / Join Room)
  // ===========================================================================
  function LandingScreen({ isConnected, onJoinSuccess }) {
    // isJoinMode: boolean state (default false to make Create Room active by default)
    const [isJoinMode, setIsJoinMode] = useState(false);
    const [nickname, setNickname] = useState("");
    const [roomId, setRoomId] = useState("");
    const [passkey, setPasskey] = useState("");
    const [showPasskey, setShowPasskey] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [passkeyError, setPasskeyError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const nicknameInputRef = useRef(null);

    // Auto-detect invite link parameters (?room=... & passkey=...)
    useEffect(() => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlRoom = params.get('room') || params.get('roomId') || params.get('room_id');
        const urlPasskey = params.get('passkey') || params.get('pin');

        if (urlRoom && urlPasskey) {
          setRoomId(urlRoom);
          setPasskey(urlPasskey);
          // Ensure the UI switches to the "Join Room" tab automatically
          setIsJoinMode(true);
          // Clean up the URL bar so the credentials don't stay visible
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (urlRoom) {
          setRoomId(urlRoom.toLowerCase());
          setIsJoinMode(true);
        } else if (urlPasskey) {
          setPasskey(urlPasskey);
        }
      } catch (_) {}

      const onQrScanned = (e) => {
        if (e.detail) {
          let scannedRoom = e.detail.roomId || e.detail.room;
          let scannedPasskey = e.detail.passkey || e.detail.pin;
          if (typeof e.detail === "string") {
            try {
              if (e.detail.startsWith("http://") || e.detail.startsWith("https://")) {
                const u = new URL(e.detail);
                scannedRoom = u.searchParams.get("room") || u.searchParams.get("roomId") || scannedRoom;
                scannedPasskey = u.searchParams.get("passkey") || u.searchParams.get("pin") || scannedPasskey;
              } else if (e.detail.startsWith("{")) {
                const parsed = JSON.parse(e.detail);
                scannedRoom = parsed.roomId || parsed.room || scannedRoom;
                scannedPasskey = parsed.passkey || parsed.pin || scannedPasskey;
              }
            } catch (_) {}
          }
          if (scannedRoom) setRoomId(scannedRoom.toLowerCase());
          if (scannedPasskey) setPasskey(scannedPasskey);
          setIsJoinMode(true);
          setErrorMsg(null);
          setPasskeyError(null);
          setTimeout(() => {
            if (nicknameInputRef.current) {
              nicknameInputRef.current.focus();
            }
          }, 100);
        }
      };

      window.addEventListener("netchat:qr_scanned", onQrScanned);
      return () => window.removeEventListener("netchat:qr_scanned", onQrScanned);
    }, []);

    // Toggle tab mode: clear roomId and passkey, keep nickname
    const handleTabSwitch = (joinMode) => {
      if (isJoinMode !== joinMode) {
        setIsJoinMode(joinMode);
        setRoomId("");
        setPasskey("");
        setErrorMsg(null);
        setPasskeyError(null);
      }
    };

    // PWA Install Action
    const handleInstallClick = () => {
      if (window.__NETCHAT_BRIDGE__ && typeof window.__NETCHAT_BRIDGE__.installApp === "function") {
        window.__NETCHAT_BRIDGE__.installApp();
      }
    };

    // QR Scanner Action
    const handleScanQrClick = () => {
      setIsScanning(true);
    };

    const handleQrDetected = (decodedText) => {
      if (!decodedText) return;
      let room = "";
      let pass = "";

      // 1. Check if it's a URL containing ?room= and &passkey=
      if (decodedText.includes("?") && (decodedText.includes("room=") || decodedText.includes("roomId="))) {
        try {
          const url = new URL(decodedText.startsWith("http") ? decodedText : `http://localhost/${decodedText}`);
          room = url.searchParams.get("room") || url.searchParams.get("roomId") || url.searchParams.get("room_id") || "";
          pass = url.searchParams.get("passkey") || url.searchParams.get("pin") || "";
        } catch (_) {}
      }

      // 2. Otherwise attempt to JSON.parse() it
      if (!room) {
        try {
          const parsed = JSON.parse(decodedText);
          if (parsed && typeof parsed === "object") {
            room = parsed.roomId || parsed.room || parsed.room_id || "";
            pass = parsed.passkey || parsed.pin || "";
          }
        } catch (_) {}
      }

      // Fallback regex if needed
      if (!room) {
        const matchRoom = decodedText.match(/[?&](?:room|roomId|room_id)=([^&]+)/i);
        const matchPass = decodedText.match(/[?&](?:passkey|pin)=([^&]+)/i);
        if (matchRoom) room = decodeURIComponent(matchRoom[1]);
        if (matchPass) pass = decodeURIComponent(matchPass[1]);
      }

      // 3. Immediately update roomId and passkey state variables
      if (room) setRoomId(room.toLowerCase());
      if (pass) setPasskey(pass);

      // 4. Set isScanning to false to close camera, ensuring user stays on "Join Room" tab
      setIsJoinMode(true);
      setIsScanning(false);
      setErrorMsg(null);
      setPasskeyError(null);
      setTimeout(() => {
        if (nicknameInputRef.current) nicknameInputRef.current.focus();
      }, 100);
    };

    // Submit Action (Create / Join)
    const handleSubmit = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      setErrorMsg(null);
      setPasskeyError(null);

      const nick = nickname.trim();
      const room = roomId.trim().toLowerCase();
      const pin = passkey.trim();

      if (!nick) {
        setErrorMsg("Please enter your nickname.");
        return;
      }
      if (!room) {
        setErrorMsg("Please enter a Room ID.");
        return;
      }
      if (!pin) {
        setErrorMsg("Please enter a Passkey.");
        return;
      }

      if (!isJoinMode) {
        const passkeyRegex = /^(?=.*[A-Z])(?=.*[!@#$&*]).{8,}$/;
        if (!passkeyRegex.test(pin)) {
          setPasskeyError("Passkey must be 8+ chars with an uppercase letter and special character.");
          return;
        }
      }

      setIsLoading(true);

      const callback = (res) => {
        setIsLoading(false);
        if (res && res.status === "success") {
          onJoinSuccess({ username: nick, roomId: room, passkey: pin });
        } else {
          setErrorMsg((res && res.message) ? res.message : "Authentication failed. Check credentials.");
        }
      };

      if (window.__NETCHAT_BRIDGE__) {
        if (isJoinMode) {
          window.__NETCHAT_BRIDGE__.joinRoom(nick, room, pin, callback);
        } else {
          window.__NETCHAT_BRIDGE__.createRoom(nick, room, pin, callback);
        }
      } else {
        setTimeout(() => {
          setIsLoading(false);
          onJoinSuccess({ username: nick, roomId: room, passkey: pin });
        }, 500);
      }
    };

    return h("div", { className: "min-h-screen bg-zinc-950 flex flex-col font-sans select-none relative overflow-hidden text-zinc-100" },
      // Top Header (h-14, border-b border-zinc-800/80, px-4)
      h("header", { className: "h-14 border-b border-zinc-800/80 px-4 flex items-center justify-between shrink-0 z-20" },
        // Left Brand & Socket Status Dot
        h("div", { className: "flex items-center" },
          h("span", { className: "font-semibold text-zinc-100 text-lg tracking-tight" }, "NetChat Live"),
          h("span", {
            className: `w-2 h-2 rounded-full inline-block ml-2 ${
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
            }`,
            title: isConnected ? "Socket Connected" : "Socket Offline"
          })
        ),

        // Right "Install App" Button
        h("button", {
          type: "button",
          onClick: handleInstallClick,
          className: "text-sm text-zinc-300 hover:text-white flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 bg-zinc-900/50 transition-colors cursor-pointer"
        },
          h(Icon, { name: "download", className: "w-4 h-4 text-zinc-400" }),
          h("span", null, "Install App")
        )
      ),

      // Central Card Container
      h("main", { className: "flex-1 flex items-center justify-center p-4 relative z-10" },
        h("div", { className: "w-full max-w-[400px] bg-[#111113] border border-zinc-800/80 rounded-[20px] p-6 shadow-2xl" },
          // Clean Tab Switcher (Join vs Create)
          h("div", { className: "flex p-1 bg-zinc-900/80 border border-zinc-800 rounded-xl mb-6" },
            // Tab 1: Join Room (Strictly "Join Room", no brackets)
            h("button", {
              type: "button",
              onClick: () => handleTabSwitch(true),
              className: isJoinMode
                ? "flex-1 py-2 text-sm font-medium text-zinc-200 bg-zinc-700/50 rounded-lg shadow-sm text-center transition-all cursor-pointer"
                : "flex-1 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-400 text-center cursor-pointer transition-all"
            }, "Join Room"),

            // Tab 2: Create Room (Strictly "Create Room", no brackets)
            h("button", {
              type: "button",
              onClick: () => handleTabSwitch(false),
              className: !isJoinMode
                ? "flex-1 py-2 text-sm font-medium text-zinc-200 bg-zinc-700/50 rounded-lg shadow-sm text-center transition-all cursor-pointer"
                : "flex-1 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-400 text-center cursor-pointer transition-all"
            }, "Create Room")
          ),

          // Error banner (if any)
          errorMsg && h("div", { className: "bg-red-950/40 border border-red-800/60 text-red-300 text-xs px-3.5 py-2.5 rounded-xl mb-4 flex items-center gap-2 animate-in fade-in duration-150" },
            h("span", { className: "flex-1" }, errorMsg)
          ),

          // Form Inputs
          h("form", { onSubmit: handleSubmit },
            // Nickname Input
            h("div", { className: "flex flex-col gap-1.5 mb-4" },
              h("label", { className: "text-sm font-medium text-zinc-300" }, "Nickname"),
              h("input", {
                ref: nicknameInputRef,
                type: "text",
                value: nickname,
                onChange: (e) => setNickname(e.target.value),
                placeholder: "@enter_username",
                autoFocus: true,
                style: { backgroundColor: "#18181b", color: "#e4e4e7", fontSize: "16px" },
                className: "w-full bg-[#18181b] border border-zinc-800 rounded-xl px-3 py-2.5 text-[16px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
              })
            ),

            // Room ID Input
            h("div", { className: "flex flex-col gap-1.5 mb-4" },
              h("label", { className: "text-sm font-medium text-zinc-300" }, "Room ID"),
              h("input", {
                type: "text",
                value: roomId,
                onChange: (e) => setRoomId(e.target.value.toLowerCase()),
                placeholder: "e.g., dev-squad",
                style: { backgroundColor: "#18181b", color: "#e4e4e7", fontSize: "16px" },
                className: "w-full bg-[#18181b] border border-zinc-800 rounded-xl px-3 py-2.5 text-[16px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors font-mono"
              })
            ),

            // Passkey Input with Eye Toggle
            h("div", { className: "flex flex-col gap-1.5 mb-4" },
              h("label", { className: "text-sm font-medium text-zinc-300" }, "Passkey"),
              h("div", { className: "relative w-full" },
                h("input", {
                  type: showPasskey ? "text" : "password",
                  value: passkey,
                  onChange: (e) => {
                    setPasskey(e.target.value);
                    if (passkeyError) setPasskeyError(null);
                  },
                  placeholder: "••••••••",
                  style: { backgroundColor: "#18181b", color: "#e4e4e7", fontSize: "16px" },
                  className: "w-full bg-[#18181b] border border-zinc-800 rounded-xl px-3 py-2.5 pr-10 text-[16px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors font-mono"
                }),
                h("button", {
                  type: "button",
                  onClick: () => setShowPasskey((prev) => !prev),
                  title: showPasskey ? "Hide Passkey" : "Show Passkey",
                  className: "absolute text-zinc-500 hover:text-zinc-300 right-3 top-1/2 -translate-y-1/2 cursor-pointer p-1 transition-colors"
                }, h(Icon, { name: showPasskey ? "eye-off" : "eye", className: "w-4 h-4" }))
              ),
              passkeyError && h("p", {
                className: "text-red-400 text-[12px] mt-1 px-1"
              }, passkeyError)
            ),

            // Action Buttons Container (2 columns in Join mode, 1 column in Create mode)
            isJoinMode
              ? h("div", { className: "grid grid-cols-2 gap-3 mt-6" },
                  // Button 1: Scan Room QR Code
                  h("button", {
                    type: "button",
                    onClick: handleScanQrClick,
                    className: "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-sm font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 border border-zinc-700 transition-colors cursor-pointer"
                  },
                    h(Icon, { name: "camera", className: "w-4 h-4 text-zinc-400" }),
                    h("span", null, "Scan Room QR Code")
                  ),

                  // Button 2: Join Room ↗ (With shadow applied strictly via className)
                  h("button", {
                    type: "submit",
                    disabled: isLoading,
                    className: "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all cursor-pointer disabled:opacity-50"
                  },
                    h("span", null, isLoading ? "Joining..." : "Join Room ↗")
                  )
                )
              : h("div", { className: "mt-6" },
                  // Single Full-Width Button: Create Room (With shadow applied strictly via className)
                  h("button", {
                    type: "submit",
                    disabled: isLoading,
                    className: "w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all cursor-pointer disabled:opacity-50"
                  },
                    h("span", null, isLoading ? "Creating..." : "Create Room")
                  )
                )
          )
        )
      ),

      // Decorative bottom-right sparkle watermark matching reference design
      h("div", { className: "absolute bottom-6 right-6 pointer-events-none opacity-20 hidden sm:block" },
        h(Icon, { name: "sparkle", className: "w-8 h-8 text-zinc-400" })
      ),

      // Live Camera QR Scanner Modal Overlay
      isScanning && h(QrCameraScannerModal, {
        onScan: handleQrDetected,
        onClose: () => setIsScanning(false)
      })
    );
  }

  // ===========================================================================
  // 2. MAIN NETCHAT LIVE APPLICATION (LIVE WIRED STATE & CONDITIONAL CALL RIBBON)
  // ===========================================================================
  function NetChatApp() {
    // Session state
    const [joined, setJoined] = useState(false);
    const inRoom = joined;
    const setInRoom = setJoined;
    const [roomId, setRoomId] = useState("");
    const [passkey, setPasskey] = useState("");
    const [showQrModal, setShowQrModal] = useState(false);
    const [username, setUsername] = useState("");
    const [localStream, setLocalStream] = useState(null);
    const peersRef = useRef({});
    const isDisconnectingRef = useRef(false);
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

    // Chat input, reply, typing, and mention autocomplete state
    const [inputValue, setInputValue] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    const [replyingTo, setReplyingTo] = useState(null);
    const [showMentionMenu, setShowMentionMenu] = useState(false);
    const [mentionFilter, setMentionFilter] = useState("");
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    // Direct/Broadcast File Sharing Popover state
    const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const pendingFileTargetRef = useRef(null);
    const p2pFileInputRef = useRef(null);

    // Toast helper
    const showToast = (msg) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3000);
    };

    // Filtered participants for mention popover (excluding local user)
    const filteredMentionUsers = roomUsers
      .filter((u) => !u.isLocal && u.name.toLowerCase() !== (username || "").toLowerCase())
      .filter((u) => (u.name || "").toLowerCase().includes(mentionFilter.toLowerCase()));

    // Selection logic for @username mention
    const handleSelectMention = (targetUsername) => {
      const input = inputRef.current;
      const cursorPos = input ? input.selectionStart : inputValue.length;
      const textBefore = inputValue.slice(0, cursorPos);
      const match = /(?:^|\s)@([a-zA-Z0-9_-]*)$/.exec(textBefore);

      let nextVal;
      let newCursorPos;
      if (match) {
        const atOffset = match[0].startsWith("@") ? 0 : 1;
        const atIndex = match.index + atOffset;
        const before = inputValue.substring(0, atIndex);
        const after = inputValue.substring(cursorPos);
        nextVal = `${before}@${targetUsername} ${after}`;
        newCursorPos = before.length + targetUsername.length + 2;
      } else {
        nextVal = `${inputValue}@${targetUsername} `;
        newCursorPos = nextVal.length;
      }

      setInputValue(nextVal);
      setShowMentionMenu(false);
      setMentionFilter("");

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    };

    // Other online peers in room (excluding local user)
    const otherPeers = roomUsers.filter((u) => !u.isLocal);

    // File selection trigger
    const handleSelectFileTarget = (target) => {
      setIsShareMenuOpen(false);
      pendingFileTargetRef.current = target;
      if (p2pFileInputRef.current) {
        p2pFileInputRef.current.value = "";
        p2pFileInputRef.current.click();
      }
    };

    // Native file change handler
    const handleFileSelected = (e) => {
      if (!e.target || !e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const target = pendingFileTargetRef.current;
      pendingFileTargetRef.current = null;

      if (target === "ALL" || target?.type === "ALL" || target?.socketId === "ALL") {
        if (window.__NETCHAT_BRIDGE__ && typeof window.__NETCHAT_BRIDGE__.sendP2PFile === "function") {
          window.__NETCHAT_BRIDGE__.sendP2PFile(file, "ALL", "All Peers");
        }
        showToast(`Broadcasting '${file.name}' to all peers...`);
      } else if (target) {
        const peerObj = roomUsers.find((u) => u.socketId === target || u.id === target || u.name === target);
        const targetSid = typeof target === "string" ? target : (target.socketId || target.id);
        const targetName = peerObj ? peerObj.name : (typeof target === "string" ? target : (target.name || target.username));
        if (window.__NETCHAT_BRIDGE__ && typeof window.__NETCHAT_BRIDGE__.sendP2PFile === "function") {
          window.__NETCHAT_BRIDGE__.sendP2PFile(file, targetSid, targetName);
        }
        showToast(`Sending '${file.name}' to @${targetName}...`);
      }
      try {
        e.target.value = "";
      } catch (_) {}
    };

    // Toggle paperclip popover or direct file select
    const handlePaperclipClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsShareMenuOpen((prev) => !prev);
    };

    // Close file sharing popover & emoji picker on outside click
    useEffect(() => {
      const handleClickOutside = (e) => {
        if (isShareMenuOpen) {
          const popover = document.getElementById("file-share-popover");
          const btn = document.getElementById("btn-paperclip-toggle");
          if (popover && !popover.contains(e.target) && btn && !btn.contains(e.target)) {
            setIsShareMenuOpen(false);
          }
        }
        if (showEmojiPicker) {
          const picker = document.getElementById("chat-emoji-picker-container");
          const btn = document.getElementById("btn-chat-emoji-toggle");
          if (picker && !picker.contains(e.target) && btn && !btn.contains(e.target)) {
            setShowEmojiPicker(false);
          }
        }
        if (showMentionMenu) {
          const menu = document.getElementById("chat-mentions-popover");
          if (menu && !menu.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target)) {
            setShowMentionMenu(false);
          }
        }
      };
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }, [isShareMenuOpen, showEmojiPicker, showMentionMenu]);

    // Handle emoji selection: append to existing input without overwriting
    const handleEmojiSelect = (emoji) => {
      const char = typeof emoji === "string" ? emoji : (emoji.native || emoji.emoji || "");
      if (char) {
        setInputValue((prev) => prev + char);
      }
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    // Synchronize state from window.__NETCHAT_BRIDGE__ or window.__NETCHAT_STATE__
    useEffect(() => {
      const syncFromBridge = () => {
        if (isDisconnectingRef.current) return;
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
            if (s.roomPasskey) setPasskey(s.roomPasskey);
            setJoined(true);
          }
          if (s.username) {
            setUsername(s.username);
          }

          if (Array.isArray(s.onlineUsers) && s.onlineUsers.length > 0) {
            const roster = s.onlineUsers.map((u) => {
              const name = typeof u === "string" ? u : (u.username || "Peer");
              const isLocal = name.toLowerCase() === (s.username || "").toLowerCase();
              const socketId = typeof u === "object" ? (u.socket_id || u.id) : null;
              return {
                id: socketId || name.toLowerCase(),
                name: name,
                socketId: socketId,
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
          setMessages((prev) => {
            if (e.detail.id && prev.some((m) => m.id === e.detail.id)) {
              return prev;
            }
            if (e.detail.isMe && prev.some((m) => m.isMe && m.text === e.detail.text)) {
              return prev;
            }
            return [...prev, e.detail];
          });
        }
      };

      const onUsersUpdated = (e) => {
        if (Array.isArray(e.detail)) {
          const roster = e.detail.map((u) => {
            const name = typeof u === "string" ? u : (u.username || "Peer");
            const isLocal = name.toLowerCase() === (username || "").toLowerCase();
            const socketId = typeof u === "object" ? (u.socket_id || u.socketId || u.id) : null;
            return {
              id: socketId || name.toLowerCase(),
              name: name,
              socketId: socketId,
              isOnline: true,
              isLocal: isLocal,
              avatar: null
            };
          });
          setRoomUsers(roster);
        }
      };

      const onRoomJoined = (e) => {
        if (isDisconnectingRef.current) return;
        if (e.detail) {
          setRoomId(e.detail.roomId);
          setUsername(e.detail.username);
          if (e.detail.passkey || e.detail.pin) setPasskey(e.detail.passkey || e.detail.pin);
          setJoined(true);
        }
      };

      const onRoomLeft = () => {
        setJoined(false);
        setRoomId("");
        setPasskey("");
        setMessages([]);
        setRoomUsers([]);
        setTypingUsers([]);
        setReplyingTo(null);
        setShowMentionMenu(false);
        setIsCallActive(false);
        setShowQrModal(false);
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

    // Auto-scroll to bottom whenever messages array changes
    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Real-Time Typing Indicator Socket Listeners
    useEffect(() => {
      const getSocket = () => (window.__NETCHAT_STATE__ && window.__NETCHAT_STATE__.socket) || window.socket || null;
      let activeSocket = getSocket();
      const typerTimers = {};

      const handleUserTyping = (data) => {
        if (!data) return;
        const name = data.nickname || data.username || (typeof data === "string" ? data : "");
        if (!name || name.toLowerCase() === (username || "").toLowerCase()) return;

        setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));

        if (typerTimers[name]) {
          clearTimeout(typerTimers[name]);
        }
        typerTimers[name] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== name));
          delete typerTimers[name];
        }, 3500);
      };

      const handleUserStopTyping = (data) => {
        if (!data) return;
        const name = data.nickname || data.username || (typeof data === "string" ? data : "");
        if (!name) return;
        if (typerTimers[name]) {
          clearTimeout(typerTimers[name]);
          delete typerTimers[name];
        }
        setTypingUsers((prev) => prev.filter((u) => u.toLowerCase() !== name.toLowerCase()));
      };

      const attach = (s) => {
        if (!s) return;
        s.on("user-typing", handleUserTyping);
        s.on("user_typing", handleUserTyping);
        s.on("typing", handleUserTyping);
        s.on("user-stop-typing", handleUserStopTyping);
        s.on("user_stop_typing", handleUserStopTyping);
        s.on("stop-typing", handleUserStopTyping);
        s.on("stop_typing", handleUserStopTyping);
      };

      const detach = (s) => {
        if (!s) return;
        s.off("user-typing", handleUserTyping);
        s.off("user_typing", handleUserTyping);
        s.off("typing", handleUserTyping);
        s.off("user-stop-typing", handleUserStopTyping);
        s.off("user_stop_typing", handleUserStopTyping);
        s.off("stop-typing", handleUserStopTyping);
        s.off("stop_typing", handleUserStopTyping);
      };

      attach(activeSocket);

      const checkInterval = setInterval(() => {
        const s = getSocket();
        if (s && s !== activeSocket) {
          detach(activeSocket);
          activeSocket = s;
          attach(activeSocket);
        }
      }, 1000);

      return () => {
        clearInterval(checkInterval);
        detach(activeSocket);
        Object.values(typerTimers).forEach(clearTimeout);
      };
    }, [username, roomId]);

    // Handle input typing & detect '@' for mention popover + typing indicator
    const handleInputChange = (e) => {
      const val = e.target.value;
      setInputValue(val);

      // 1. Typing indicator emit with 2000ms debounce
      const socket = (window.__NETCHAT_STATE__ && window.__NETCHAT_STATE__.socket) || window.socket;
      if (socket && roomId) {
        const nickname = username || "Anonymous";
        if (!isTypingRef.current) {
          isTypingRef.current = true;
          socket.emit("typing", { roomId, room_id: roomId, nickname, username: nickname });
        }
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          isTypingRef.current = false;
          socket.emit("stop-typing", { roomId, room_id: roomId, nickname, username: nickname });
          socket.emit("stop_typing", { roomId, room_id: roomId, nickname, username: nickname });
        }, 2000);
      }

      // 2. Mentions tracking
      const cursorPos = e.target.selectionStart;
      const textBefore = val.slice(0, cursorPos);
      const match = /(?:^|\s)@([a-zA-Z0-9_-]*)$/.exec(textBefore);

      if (match && !textBefore.endsWith(" ") && val.trim().length > 0) {
        setShowMentionMenu(true);
        setMentionFilter(match[1] || "");
      } else {
        setShowMentionMenu(false);
        setMentionFilter("");
      }
    };

    // Handle Keydown
    const handleKeyDown = (e) => {
      if (showMentionMenu && filteredMentionUsers.length > 0) {
        if (e.key === "Escape") {
          e.preventDefault();
          setShowMentionMenu(false);
          return;
        }
      }

      if (e.key === "Escape" && replyingTo) {
        e.preventDefault();
        setReplyingTo(null);
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(e);
      }
    };

    // Send chat message
    const sendMessage = (e) => {
      if (e && typeof e.preventDefault === "function") {
        e.preventDefault();
      }
      const trimmed = inputValue.trim();
      if (!trimmed) return;

      // Stop typing immediately on message sent
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current) {
        isTypingRef.current = false;
        const socket = (window.__NETCHAT_STATE__ && window.__NETCHAT_STATE__.socket) || window.socket;
        if (socket && roomId) {
          const nickname = username || "Anonymous";
          socket.emit("stop-typing", { roomId, room_id: roomId, nickname, username: nickname });
          socket.emit("stop_typing", { roomId, room_id: roomId, nickname, username: nickname });
        }
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const replyPayload = replyingTo ? {
        id: replyingTo.id,
        sender: replyingTo.sender,
        text: replyingTo.text,
        snippet: (replyingTo.text || "").substring(0, 80)
      } : null;

      const newMessageObject = {
        id: (window.crypto && typeof crypto.randomUUID === "function")
          ? crypto.randomUUID()
          : `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: trimmed,
        sender: username || "You",
        isMe: true,
        timestamp: timeStr,
        avatar: null,
        replyTo: replyPayload
      };

      if (window.__NETCHAT_BRIDGE__ && typeof window.__NETCHAT_BRIDGE__.sendMessage === "function") {
        window.__NETCHAT_BRIDGE__.sendMessage(trimmed, replyPayload);
      }

      setMessages((prevMessages) => [...prevMessages, newMessageObject]);
      setInputValue("");
      setReplyingTo(null);
      setShowMentionMenu(false);
      setMentionFilter("");
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

    const handleDisconnect = (e) => {
      // 1. PREVENT DEFAULT & STOP MEDIA FIRST:
      if (e && typeof e.preventDefault === "function") {
        e.preventDefault();
      }
      isDisconnectingRef.current = true;

      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      const activeStream = (window.__NETCHAT_STATE__ && window.__NETCHAT_STATE__.localStream)
        || (window.webrtcMesh && window.webrtcMesh.localStream)
        || (window.webrtcState && window.webrtcState.localStream)
        || null;
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (window.webrtcMesh && window.webrtcMesh.localStream) {
        window.webrtcMesh.localStream = null;
      }
      if (window.webrtcState && window.webrtcState.localStream) {
        window.webrtcState.localStream = null;
      }

      // 2. DESTROY PEER CONNECTIONS & SOCKET CLEANUP:
      if (peersRef.current) {
        Object.keys(peersRef.current).forEach((key) => {
          try {
            const peer = peersRef.current[key];
            if (peer && typeof peer.close === "function") peer.close();
            else if (peer && peer.pc && typeof peer.pc.close === "function") peer.pc.close();
          } catch (_) {}
        });
        peersRef.current = {};
      }
      if (window.webrtcMesh && window.webrtcMesh.peers) {
        Object.keys(window.webrtcMesh.peers).forEach((key) => {
          try {
            if (window.webrtcMesh.peers[key]?.pc) window.webrtcMesh.peers[key].pc.close();
          } catch (_) {}
        });
        window.webrtcMesh.peers = {};
      }
      if (window.webrtcState && window.webrtcState.peerConnection) {
        try { window.webrtcState.peerConnection.close(); } catch (_) {}
        window.webrtcState.peerConnection = null;
      }

      const socket = (window.__NETCHAT_STATE__ && window.__NETCHAT_STATE__.socket)
        || window.socket
        || null;
      if (socket) {
        socket.emit('leave-room');
        try {
          socket.off('room-joined');
          socket.off('room_joined');
          socket.off('joined');
          socket.emit('leave_room', { room_id: roomId, username: username });
        } catch (_) {}
      }

      if (window.__NETCHAT_STATE__) {
        window.__NETCHAT_STATE__.roomId = "";
        window.__NETCHAT_STATE__.roomPasskey = "";
        window.__NETCHAT_STATE__.peerList = [];
        window.__NETCHAT_STATE__.onlineUsers = [];
      }
      if (window.__NETCHAT_BRIDGE__ && typeof window.__NETCHAT_BRIDGE__.disconnect === "function") {
        try {
          window.__NETCHAT_BRIDGE__.disconnect();
        } catch (_) {}
      }
      try {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, document.title, window.location.pathname);
        }
      } catch (_) {}

      setShowQrModal(false);
      setRoomUsers([]);
      setIsCallActive(false);

      // 3. STATE RESET (Strict Order):
      setRoomId('');
      setPasskey('');
      setMessages([]);
      setTypingUsers([]);
      setReplyingTo(null);
      setShowMentionMenu(false);
      setLocalStream(null);
      setJoined(false); // Do this LAST.
    };

    // If not in a room, render the restored & re-styled Landing Screen
    if (!joined) {
      return h(LandingScreen, {
        isConnected: isConnected,
        onJoinSuccess: ({ username: u, roomId: r, passkey: p }) => {
          isDisconnectingRef.current = false;
          setUsername(u);
          setRoomId(r);
          setPasskey(p || "");
          setJoined(true);
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

    return h("div", { className: "h-[100dvh] overflow-hidden flex flex-col bg-zinc-950 text-zinc-100 font-sans antialiased select-none" },

      // =======================================================================
      // 1. TOP HEADER (h-14 / 56px, bg-zinc-950, border-b border-zinc-800/80 px-3 sm:px-4)
      // =======================================================================
      h("header", { className: "h-14 bg-zinc-950 border-b border-zinc-800/80 flex items-center justify-between gap-2 px-3 sm:px-4 shrink-0 z-30" },
        // Left Brand
        h("div", { className: "flex items-center shrink-0 min-w-0" },
          h("span", { className: "font-semibold text-zinc-100 text-base sm:text-lg tracking-tight whitespace-nowrap shrink-0" }, "NetChat Live"),
          h("span", {
            className: `w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ml-1 sm:ml-2 ${headerDotClass} inline-block`,
            title: isConnected ? "Connected" : connectionStatus
          })
        ),

        // Center Room Pill + Share QR Button
        h("div", { className: "flex items-center gap-1.5 shrink min-w-0" },
          h("div", { className: "bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm min-w-[80px] overflow-hidden whitespace-nowrap text-ellipsis" },
            h(Icon, { name: "lock", className: "w-3 h-3 text-zinc-400 shrink-0" }),
            h("span", { className: "font-mono font-medium whitespace-nowrap overflow-hidden text-ellipsis" }, `room: ${roomId}`)
          ),
          h("button", {
            type: "button",
            onClick: () => setShowQrModal(true),
            title: "Share QR",
            "aria-label": "Share QR",
            className: "text-zinc-400 hover:text-white p-1.5 bg-zinc-800/50 hover:bg-zinc-700 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
          },
            h(Icon, { name: "qr", className: "w-4 h-4" })
          )
        ),

        // Right Actions Group (Exact 5-icon order)
        h("div", { className: "flex items-center gap-1 sm:gap-2 shrink-0" },
          // Button 1 - Share/Link
          h("button", {
            type: "button",
            onClick: handleShare,
            title: "Share Room Link",
            className: "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 p-2 rounded-lg transition-colors border border-transparent hover:border-zinc-700/50 cursor-pointer"
          }, h(Icon, { name: "link", className: "w-4 h-4" })),

          // Button 2 - Voice Call
          h("button", {
            type: "button",
            onClick: handleToggleVoice,
            title: isCallActive && callType === "audio" ? "Leave Voice Call" : "Start Voice Call",
            className: `p-2 rounded-lg transition-colors border border-transparent cursor-pointer ${
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
            className: `p-2 rounded-lg transition-colors border border-transparent cursor-pointer ${
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
            className: "relative hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 p-2 rounded-lg transition-colors border border-transparent hover:border-zinc-700/50 cursor-pointer"
          },
            h(Icon, { name: "users", className: "w-4 h-4" }),
            h("span", {
              className: "absolute -top-1 -right-1 bg-zinc-700 text-zinc-200 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-zinc-950 shadow-sm"
            }, roomUsers.length)
          ),

          // Button 5 - Red Disconnect/Power Button
          h("button", {
            type: "button",
            onClick: handleDisconnect,
            title: "Disconnect",
            "aria-label": "Disconnect",
            className: "text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 p-2 rounded-lg transition-colors border border-red-500/20 hover:border-red-500/40 cursor-pointer"
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
            className: `bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-1.5 transition-colors cursor-pointer ${
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
            className: "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-1.5 transition-colors cursor-pointer"
          },
            h(Icon, { name: isCameraOff ? "camera-off" : "video", className: "w-3.5 h-3.5" }),
            h("span", null, isCameraOff ? "Camera Off" : "Camera On")
          ),

          // End Call
          h("button", {
            type: "button",
            onClick: handleEndCall,
            className: "bg-zinc-900 hover:bg-red-950/50 text-red-400 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-900/40 flex items-center gap-1.5 transition-colors cursor-pointer"
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
        h("main", { className: "flex-1 flex flex-col overflow-hidden bg-zinc-950 relative min-w-0" },
          // Scrollable messages container
          h("div", { className: "flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full [scrollbar-width:thin] [scrollbar-color:#27272a_transparent] flex flex-col" },
            messages.length === 0
              ? h("div", { className: "flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500 space-y-3" },
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
                  const rep = msg.replyTo || msg.replyingTo || msg.reply_to;
                  const quotedBox = rep && h("div", {
                    className: "bg-black/20 rounded p-1.5 mb-1 text-[11px] border-l-2 border-emerald-500/50 text-zinc-300"
                  },
                    h("div", { className: "font-medium text-emerald-400/90 text-[10px]" }, rep.sender || "User"),
                    h("div", { className: "truncate opacity-80" }, rep.text || rep.snippet || rep.content || "")
                  );

                  if (msg.isMe) {
                    // Outgoing Message (You)
                    return h("div", { key: msg.id, className: "group flex flex-col items-end ml-auto max-w-[85%] sm:max-w-[70%]" },
                      h("div", { className: "flex items-center gap-1.5 mb-1 text-[11px] text-zinc-400" },
                        h("button", {
                          type: "button",
                          onClick: () => setReplyingTo(msg),
                          title: "Reply to message",
                          className: "text-zinc-500 hover:text-zinc-300 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        }, h(Icon, { name: "reply", className: "w-3 h-3" })),
                        h("span", null, "You"),
                        msg.timestamp && h("span", { className: "text-zinc-600 text-[10px]" }, msg.timestamp)
                      ),
                      h("div", { className: "bg-zinc-800 border border-zinc-700/60 text-zinc-100 text-sm p-3 rounded-2xl rounded-tr-sm shadow-sm leading-relaxed" },
                        quotedBox,
                        renderMessageText(msg.text)
                      )
                    );
                  } else {
                    // Incoming Message (Peer)
                    return h("div", { key: msg.id, className: "group flex items-start gap-2.5 max-w-[85%] sm:max-w-[70%]" },
                      h(Avatar, { name: msg.sender, src: msg.avatar, size: "md" }),
                      h("div", { className: "flex-1 min-w-0" },
                        h("div", { className: "flex items-center gap-1.5 mb-1 text-[11px] text-zinc-400" },
                          h("span", { className: "font-medium" }, msg.sender),
                          msg.timestamp && h("span", { className: "text-zinc-600 text-[10px]" }, msg.timestamp),
                          h("button", {
                            type: "button",
                            onClick: () => setReplyingTo(msg),
                            title: "Reply to message",
                            className: "text-zinc-500 hover:text-zinc-300 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ml-auto sm:ml-0"
                          }, h(Icon, { name: "reply", className: "w-3 h-3" }))
                        ),
                        h("div", { className: "bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm p-3 rounded-2xl rounded-tl-sm shadow-sm leading-relaxed" },
                          quotedBox,
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
          // 5. DOCKED BOTTOM INPUT BAR, TYPING INDICATOR & MENTIONS
          // ===================================================================
          h("footer", { className: "shrink-0 w-full bg-zinc-950 border-t border-zinc-800 p-3 pb-safe z-10 relative" },

            // 1. TYPING INDICATOR UI (Directly above the main chat input bar)
            typingUsers.length > 0 && h("div", {
              className: "absolute bottom-full left-4 mb-1 text-zinc-500 text-[11px] italic pointer-events-none"
            }, `${typingUsers.join(', ')} is typing...`),

            // 2. MESSAGE REPLY FEATURE (Input Preview UI)
            replyingTo && h("div", {
              className: "w-full bg-zinc-900 border-t border-zinc-800 border-b-0 px-3 py-2 text-xs flex justify-between items-center text-zinc-400 rounded-t-xl mb-1.5"
            },
              h("div", { className: "border-l-2 border-emerald-500 pl-2 flex flex-col min-w-0 pr-2" },
                h("span", { className: "font-semibold text-emerald-400 text-[11px]" }, `Replying to ${replyingTo.sender || "User"}`),
                h("span", { className: "truncate text-zinc-400 text-xs" }, replyingTo.text || "")
              ),
              h("button", {
                type: "button",
                onClick: () => setReplyingTo(null),
                className: "text-zinc-500 hover:text-zinc-200 p-1 rounded-lg transition-colors cursor-pointer shrink-0 ml-2",
                title: "Cancel Reply"
              },
                h(Icon, { name: "x", className: "w-3.5 h-3.5" })
              )
            ),

            // 3. MENTIONS / TAGGING FEATURE (@username floating popover)
            showMentionMenu && filteredMentionUsers.length > 0 && h("div", {
              id: "chat-mentions-popover",
              className: "absolute bottom-full left-0 mb-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto"
            },
              filteredMentionUsers.map((u) =>
                h("div", {
                  key: u.id || u.name,
                  onClick: () => handleSelectMention(u.name),
                  className: "px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 cursor-pointer"
                }, `@${u.name}`)
              )
            ),

            // Input Container with emerald focus ring matching reference design
            h("div", {
              className: "relative flex items-center bg-zinc-900 border border-zinc-800 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/30 rounded-xl px-3 py-1.5 transition-all shadow-inner"
            },
              // Hidden native file input for scoped WebRTC file selection
              h("input", {
                ref: p2pFileInputRef,
                type: "file",
                onChange: handleFileSelected,
                className: "hidden",
                "aria-hidden": "true"
              }),

              // Left: Paperclip icon button wrapped in relative container (Mobile & Desktop)
              h("div", { className: "relative flex items-center shrink-0" },
                h("button", {
                  id: "btn-paperclip-toggle",
                  type: "button",
                  title: "Share File",
                  onClick: handlePaperclipClick,
                  className: `p-2 sm:p-1.5 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center ${
                    isShareMenuOpen
                      ? "text-emerald-400 bg-zinc-800"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`
                }, h(Icon, { name: "paperclip", className: "w-4 h-4" })),

                // Floating popover menu when open
                isShareMenuOpen && h("div", {
                  id: "file-share-popover",
                  className: "absolute bottom-full left-0 mb-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1 z-50"
                },
                  // Send to All button (Broadcast file to all connected peers)
                  h("button", {
                    type: "button",
                    onClick: () => handleSelectFileTarget("ALL"),
                    className: "w-full flex items-center gap-2 px-3 py-3 sm:py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-lg cursor-pointer transition-colors text-left"
                  },
                    h(Icon, { name: "share", className: "w-4 h-4 text-emerald-400 shrink-0" }),
                    h("span", { className: "font-medium" }, "Send to All")
                  ),

                  // Divider
                  h("div", { className: "border-b border-zinc-800/80 my-1 pb-1" }),

                  // Individual Items: Map over active roomUsers (excluding local user)
                  otherPeers.length > 0
                    ? otherPeers.map((peer) =>
                        h("button", {
                          key: peer.id || peer.socketId || peer.name,
                          type: "button",
                          onClick: () => handleSelectFileTarget(peer.socketId || peer.id),
                          className: "w-full flex items-center gap-2 px-3 py-3 sm:py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-lg cursor-pointer transition-colors text-left"
                        },
                          h(Avatar, { name: peer.name, src: peer.avatar, size: "sm" }),
                          h("span", { className: "truncate" }, `Send to @${peer.name}`)
                        )
                      )
                    : h("div", { className: "px-3 py-2 text-xs text-zinc-500 italic" }, "No peers online")
                )
              ),

              // Center: Text input field (forced transparent to prevent CSS bleeding, 16px font to prevent iOS Safari auto-zoom)
              h("input", {
                ref: inputRef,
                type: "text",
                value: inputValue,
                onChange: handleInputChange,
                onKeyDown: handleKeyDown,
                placeholder: "Type a message...",
                style: { backgroundColor: "transparent", color: "#f4f4f5", border: "none", outline: "none", boxShadow: "none", fontSize: "16px" },
                className: "flex-1 !bg-transparent !border-0 !outline-none !shadow-none text-[16px] !text-zinc-100 placeholder-zinc-500 px-2 py-1.5 font-normal"
              }),

              // Smile/Emoji icon button inside/next to text input field
              h("button", {
                id: "btn-chat-emoji-toggle",
                type: "button",
                onClick: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowEmojiPicker((prev) => !prev);
                },
                title: "Insert Emoji",
                "aria-label": "Insert Emoji",
                className: `text-zinc-400 hover:text-white p-2 sm:p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0 ${
                  showEmojiPicker ? "text-white bg-zinc-800" : ""
                }`
              }, h(Icon, { name: "smile", className: "w-4 h-4" })),

              // Right: Send button
              h("button", {
                type: "button",
                onClick: (e) => sendMessage(e),
                className: "text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 cursor-pointer shrink-0 ml-1"
              }, "Send"),

              // Emoji Picker Popover Container
              showEmojiPicker && h("div", {
                id: "chat-emoji-picker-container",
                className: "absolute bottom-full right-2 sm:right-4 mb-2 z-50 shadow-2xl border border-zinc-800 rounded-xl overflow-hidden"
              },
                h(EmojiPickerComponent, {
                  onSelect: handleEmojiSelect,
                  onClose: () => setShowEmojiPicker(false)
                })
              )
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
          className: "fixed top-14 right-0 bottom-0 w-48 sm:w-56 bg-zinc-950 border-l border-zinc-800/80 z-40 p-3 sm:p-4 shadow-2xl lg:static lg:w-60 lg:z-10 lg:shadow-none shrink-0 overflow-hidden flex flex-col"
        },
          // Header: "Room Members (count)"
          h("div", { className: "text-xs font-semibold text-zinc-300 mb-3 tracking-wide shrink-0" }, `Room Members (${roomUsers.length})`),

          // Member List
          h("div", { className: "space-y-1 overflow-y-auto flex-1 [scrollbar-width:thin] [scrollbar-color:#27272a_transparent]" },
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
                    // Right: Actions (Individual share button for remote peers + Active status dot)
                    h("div", { className: "flex items-center shrink-0" },
                      !m.isLocal && h("button", {
                        type: "button",
                        onClick: (e) => {
                          e.stopPropagation();
                          handleSelectFileTarget(m.socketId || m.id);
                        },
                        title: `Send file to ${m.name} via WebRTC`,
                        className: "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 p-2 sm:p-1.5 rounded-md transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center mr-1 cursor-pointer"
                      },
                        h(Icon, { name: "paperclip", className: "w-4 h-4" })
                      ),
                      // Active status dot
                      h("span", { className: "w-2 h-2 rounded-full bg-emerald-500 shrink-0" })
                    )
                  )
                )
          )
        )
      ),

      // Toast Notification
      toastMessage && h("div", {
        className: "fixed bottom-20 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs px-4 py-2 rounded-full shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-3"
      }, toastMessage),

      // QR Code Generator Modal (Desktop & Mobile)
      showQrModal && h("div", {
        className: "fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4",
        onClick: (e) => {
          if (e.target === e.currentTarget) setShowQrModal(false);
        }
      },
        h("div", {
          className: "bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center max-w-sm w-full shadow-2xl relative"
        },
          // Close button
          h("button", {
            type: "button",
            onClick: () => setShowQrModal(false),
            title: "Close QR Modal",
            "aria-label": "Close",
            className: "absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          },
            h(Icon, { name: "x", className: "w-5 h-5" })
          ),
          h("h3", { className: "text-base font-semibold text-zinc-100 mb-1" }, "Room QR Code"),
          h("p", { className: "text-xs text-zinc-400 text-center mb-4" }, "Scan to join this secure room"),
          h(QRCode, {
            value: `${window.location.origin}/?room=${roomId}&passkey=${encodeURIComponent(passkey)}`
          }),
          h("div", { className: "mt-4 text-center font-mono text-xs text-zinc-400 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800/80 w-full truncate" },
            `Room: ${roomId}`
          )
        )
      )
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
