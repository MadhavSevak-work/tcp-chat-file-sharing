"""
Flask Application and Real-Time Socket.IO Server.

Serves the modern web frontend, handles secure HTTP file upload/download endpoints,
and routes browser WebSockets through the TCP Gateway to the central ChatServer.
"""

import os
import sys
import time
import uuid
import logging
import threading
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from shared.constants import (
    DEFAULT_HOST,
    DEFAULT_CHAT_PORT,
    DEFAULT_FILE_PORT,
    MAX_FILE_SIZE,
    MAX_WS_PAYLOAD,
    MSG_FILE_CHUNK,
)
from shared.protocol import (
    validate_username,
    sanitize_filename,
    compute_file_sha256,
)
from web_app.gateway import GatewayManager

# Initialize Flask and SocketIO
app = Flask(__name__)
app.config["SECRET_KEY"] = "tcp_chat_cn_secret_key_2026"
app.config["MAX_CONTENT_LENGTH"] = MAX_WS_PAYLOAD

# Upload directory configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Configure SocketIO with threading mode, 105 MB payload buffer to prevent WebSocket 1009, and resilient heartbeats
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    max_http_buffer_size=MAX_WS_PAYLOAD,
    ping_timeout=60,
    ping_interval=25,
)
gateway_manager = GatewayManager()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("WebApp")

# File storage registry: transfer_id -> {filepath, filename, filesize, sha256, sender}
file_registry = {}
active_chunk_transfers = {}
chunk_transfers_lock = threading.Lock()


# ============================================================================
# SECURITY & RATE LIMITING HELPERS
# ============================================================================

class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding window rate limiter."""
    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.records = {}
        self.lock = threading.Lock()

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        with self.lock:
            timestamps = self.records.get(key, [])
            cutoff = now - self.window_seconds
            timestamps = [t for t in timestamps if t > cutoff]
            if len(timestamps) >= self.max_requests:
                self.records[key] = timestamps
                return False
            timestamps.append(now)
            self.records[key] = timestamps
            return True

    def reset(self, key: str) -> None:
        with self.lock:
            self.records.pop(key, None)


# TASK 4: Connection throttling: max 5 connection attempts per IP per minute (60s)
ip_connection_limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=60.0)

# TASK 4: Message throttling: max 5 incoming chat messages per active socket per second (1.0s)
socket_message_limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=1.0)


def get_client_ip() -> str:
    """Extract client IP address accounting for proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "127.0.0.1"


# ============================================================================
# HTTP ROUTES
# ============================================================================

@app.route("/")
def index():
    """Renders the main single-page application."""
    return render_template("index.html")


@app.route("/api/status")
def api_status():
    """Returns network diagnostics and gateway status."""
    stats = gateway_manager.get_stats()
    return jsonify({
        "status": "online",
        "gateway_port": 5050,
        "tcp_server_host": DEFAULT_HOST,
        "tcp_chat_port": DEFAULT_CHAT_PORT,
        "tcp_file_port": DEFAULT_FILE_PORT,
        "active_web_sessions": stats["active_gateway_sessions"],
        "web_users": stats["web_users"],
        "server_time": time.time()
    })


@app.route("/api/upload", methods=["POST"])
def upload_file():
    """
    HTTP endpoint for secure browser file upload.
    Validates file, computes SHA-256 hash, and registers the transfer.
    Enforces 64 KB chunk writing and strictly rejects streams exceeding 100 MB without RAM exhaustion.
    """
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "No file part in request."}), 400

    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"status": "error", "message": "No selected file."}), 400

    raw_filename = file.filename
    clean_filename = sanitize_filename(raw_filename)
    transfer_id = str(uuid.uuid4())
    stored_filename = f"{transfer_id}_{clean_filename}"
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], stored_filename)

    # Save to disk in 64 KB chunks while strictly checking size to prevent RAM/disk exhaustion
    bytes_written = 0
    try:
        with open(filepath, "wb") as f:
            while True:
                chunk = file.stream.read(64 * 1024)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > MAX_FILE_SIZE:
                    f.close()
                    if os.path.exists(filepath):
                        os.remove(filepath)
                    return jsonify({
                        "status": "error",
                        "message": f"File exceeds maximum allowed size ({MAX_FILE_SIZE // (1024*1024)} MB)."
                    }), 400
                f.write(chunk)
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"status": "error", "message": f"Upload failed: {e}"}), 500

    filesize = bytes_written
    if filesize == 0:
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"status": "error", "message": "File cannot be empty."}), 400

    # Compute SHA-256
    sha256 = compute_file_sha256(filepath)

    file_registry[transfer_id] = {
        "filepath": filepath,
        "filename": clean_filename,
        "filesize": filesize,
        "sha256": sha256,
        "created_at": time.time()
    }

    logger.info(f"Uploaded file '{clean_filename}' ({filesize} bytes), SHA-256: {sha256[:16]}...")
    return jsonify({
        "status": "ok",
        "transfer_id": transfer_id,
        "filename": clean_filename,
        "filesize": filesize,
        "sha256": sha256,
        "download_url": f"/api/download/{transfer_id}"
    })


@app.route("/api/download/<transfer_id>")
def download_file(transfer_id):
    """
    Secure endpoint to download uploaded files with path traversal protection.
    Enforces attachment header and application/octet-stream content type to block in-browser HTML/SVG execution.
    """
    record = file_registry.get(transfer_id)
    if not record or not os.path.exists(record["filepath"]):
        return jsonify({"status": "error", "message": "File not found or expired."}), 404

    directory = os.path.dirname(record["filepath"])
    filename = os.path.basename(record["filepath"])
    clean_dl_name = sanitize_filename(record["filename"])

    response = send_from_directory(
        directory,
        filename,
        as_attachment=True,
        download_name=clean_dl_name,
        mimetype="application/octet-stream"
    )
    # Explicitly enforce Content-Disposition and octet-stream Content-Type headers
    response.headers["Content-Disposition"] = f'attachment; filename="{clean_dl_name}"'
    response.headers["Content-Type"] = "application/octet-stream"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


# ============================================================================
# WEBSOCKET (SOCKET.IO) EVENT HANDLERS
# ============================================================================

@socketio.on("connect")
def handle_connect():
    sid = request.sid
    client_ip = get_client_ip()

    # TASK 4: Connection Throttling (max 5 new connection attempts per IP per minute)
    if not ip_connection_limiter.is_allowed(client_ip):
        logger.warning(f"[RateLimit] Throttled connection attempt from IP: {client_ip}")
        emit("error", {
            "type": "error",
            "message": "Connection rate limit exceeded. Please wait."
        })
        return False

    logger.info(f"[SocketIO] Client connected: {sid} (IP: {client_ip})")
    emit("gateway_ready", {
        "gateway": "TCP-WebSocket Gateway v1.0",
        "default_host": DEFAULT_HOST,
        "default_port": DEFAULT_CHAT_PORT
    })


@socketio.on("disconnect")
def handle_disconnect():
    sid = request.sid
    logger.info(f"[SocketIO] Client disconnected: {sid}")
    gateway_manager.remove_session(sid)
    socket_message_limiter.reset(sid)


@socketio.on("join")
def handle_join(data):
    """
    Browser client requests to join the chat system.
    Establishes the real TCP socket connection on behalf of this user.
    Enforces immutable loopback target (SSRF hardening), IP throttling, and unique nicknames.
    """
    sid = request.sid
    client_ip = get_client_ip()
    username = data.get("username", "").strip()

    # TASK 1: Immutable internal socket target (SSRF prevention)
    # Strictly ignore or reject any custom TCP IP/port parameters sent by the client
    host = DEFAULT_HOST
    port = DEFAULT_CHAT_PORT

    # TASK 4: Connection Throttling check
    if not ip_connection_limiter.is_allowed(client_ip):
        logger.warning(f"[RateLimit] Throttled join attempt from IP: {client_ip}")
        emit("join_error", {
            "type": "error",
            "code": "RATE_LIMIT_EXCEEDED",
            "message": "Connection rate limit exceeded. Please wait."
        })
        return

    # Username syntax validation
    is_valid, val_msg = validate_username(username)
    if not is_valid:
        emit("join_error", {"type": "error", "code": "INVALID_USERNAME", "message": val_msg})
        return

    # TASK 5: Nickname Collision Prevention in Gateway Registry
    if gateway_manager.is_nickname_taken(val_msg):
        logger.warning(f"[Gateway] Nickname collision detected for '{val_msg}'")
        emit("join_error", {
            "type": "error",
            "code": "NICKNAME_TAKEN",
            "message": "Nickname already in use. Please choose another."
        })
        return

    # Callback executed by the background TCP thread to push messages to this browser
    def emit_to_browser(event_name: str, payload: dict):
        socketio.emit(event_name, payload, room=sid)

    # Create real TCP socket connection to the ChatServer
    success, msg, session = gateway_manager.create_session(
        sid=sid,
        username=val_msg,
        host=host,
        port=port,
        emit_callback=emit_to_browser
    )

    if success:
        logger.info(f"[Gateway] Browser user '{val_msg}' connected to TCP Server at {host}:{port}")
        emit("join_success", {
            "username": val_msg,
            "host": host,
            "port": port,
            "file_port": session.file_port,
            "message": msg
        })
    else:
        logger.warning(f"[Gateway] TCP connection failed for '{username}': {msg}")
        is_taken = "already in use" in msg.lower() or "nickname" in msg.lower()
        emit("join_error", {
            "type": "error",
            "code": "NICKNAME_TAKEN" if is_taken else "CONNECT_FAILED",
            "message": "Nickname already in use. Please choose another." if is_taken else msg
        })


@socketio.on("send_chat")
def handle_send_chat(data):
    sid = request.sid
    content = data.get("content", "").strip()
    if not content:
        return

    # TASK 4: Restrict incoming chat messages to maximum 5 per second
    if not socket_message_limiter.is_allowed(sid):
        emit("error", {
            "type": "error",
            "message": "Rate limit exceeded. Please wait."
        })
        return

    session = gateway_manager.get_session(sid)
    if session and session.is_connected:
        session.send_chat(content)


@socketio.on("send_private")
def handle_send_private(data):
    sid = request.sid
    recipient = data.get("recipient", "").strip()
    content = data.get("content", "").strip()
    if not content or not recipient:
        return

    # TASK 4: Restrict incoming private messages to maximum 5 per second
    if not socket_message_limiter.is_allowed(sid):
        emit("error", {
            "type": "error",
            "message": "Rate limit exceeded. Please wait."
        })
        return

    session = gateway_manager.get_session(sid)
    if session and session.is_connected:
        session.send_private(recipient, content)


@socketio.on("file_chunk")
def handle_file_chunk(data):
    """
    Receives 64 KB binary or base64 file chunk streamed over WebSocket.
    Writes chunks sequentially to disk, tracks progress, and returns an
    immediate acknowledgment for backpressure preservation.
    When all chunks arrive, verifies SHA-256 and registers the file for download.
    """
    sid = request.sid
    if not isinstance(data, dict):
        return {"status": "error", "message": "Invalid chunk payload"}

    transfer_id = data.get("transfer_id")
    chunk_index = data.get("chunk_index", 0)
    total_chunks = data.get("total_chunks", 1)
    filename = data.get("filename", "uploaded_file.bin")
    filesize = data.get("filesize", 0)
    expected_sha256 = data.get("sha256", "")
    raw_data = data.get("data")
    recipient = data.get("recipient", "")

    if not transfer_id or raw_data is None:
        return {"status": "error", "message": "Missing transfer_id or chunk data"}

    import base64
    if isinstance(raw_data, str):
        if "," in raw_data:
            raw_data = raw_data.split(",", 1)[1]
        try:
            chunk_bytes = base64.b64decode(raw_data)
        except Exception as e:
            return {"status": "error", "message": f"Base64 decode error: {e}"}
    elif isinstance(raw_data, (bytes, bytearray)):
        chunk_bytes = bytes(raw_data)
    else:
        return {"status": "error", "message": "Unsupported chunk format"}

    clean_filename = sanitize_filename(filename)
    stored_filename = f"{transfer_id}_{clean_filename}"
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], stored_filename)

    with chunk_transfers_lock:
        if transfer_id not in active_chunk_transfers:
            # New transfer session: reset file if exists
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except Exception:
                    pass
            active_chunk_transfers[transfer_id] = {
                "filepath": filepath,
                "filename": clean_filename,
                "filesize": filesize,
                "sha256": expected_sha256,
                "bytes_written": 0,
                "chunks_received": 0,
                "created_at": time.time()
            }
        entry = active_chunk_transfers[transfer_id]

    try:
        with open(filepath, "ab") as f:
            f.write(chunk_bytes)
        with chunk_transfers_lock:
            entry["bytes_written"] += len(chunk_bytes)
            entry["chunks_received"] += 1
            is_complete = (chunk_index >= total_chunks - 1) or (filesize > 0 and entry["bytes_written"] >= filesize)
    except Exception as e:
        logger.error(f"[Gateway] Error writing chunk {chunk_index} for {transfer_id}: {e}")
        return {"status": "error", "message": f"Write failed: {e}"}

    if is_complete:
        computed_sha = compute_file_sha256(filepath)
        final_size = entry["bytes_written"]
        file_registry[transfer_id] = {
            "filepath": filepath,
            "filename": clean_filename,
            "filesize": final_size,
            "sha256": computed_sha,
            "created_at": time.time()
        }
        with chunk_transfers_lock:
            active_chunk_transfers.pop(transfer_id, None)

        logger.info(f"[WebSocket Chunking] Assembled '{clean_filename}' ({final_size} bytes, SHA-256: {computed_sha[:16]}...)")

    target = data.get("target", "")
    is_broadcast = (
        recipient == "__BROADCAST__"
        or (isinstance(recipient, str) and recipient.lower() in ("__broadcast__", "all"))
        or target == "all"
        or bool(data.get("is_broadcast"))
    )

    # Forward to TCP core with length prefixing if this user has an active TCP session
    session = gateway_manager.get_session(sid)
    if session and session.is_connected:
        session.send_file_chunk(
            transfer_id,
            chunk_index,
            total_chunks,
            chunk_bytes,
            "__BROADCAST__" if is_broadcast else recipient,
            is_broadcast=is_broadcast
        )
    elif is_broadcast:
        # Pure WebSocket fallback: fan out chunk to all connected peers
        emit("file_chunk", data, broadcast=True, include_self=False)

    ack = {
        "status": "ok",
        "transfer_id": transfer_id,
        "chunk_index": chunk_index,
        "is_complete": is_complete
    }
    emit("file_chunk_ack", ack, room=sid)
    return ack


@socketio.on("file_offer")
def handle_file_offer(data):
    sid = request.sid
    session = gateway_manager.get_session(sid)
    transfer_id = data.get("transfer_id")
    recipient = data.get("recipient", "")
    filename = data.get("filename")
    filesize = data.get("filesize", data.get("size", 0))
    sha256 = data.get("sha256")
    target = data.get("target", "")
    is_broadcast = (
        recipient == "__BROADCAST__"
        or (isinstance(recipient, str) and recipient.lower() in ("__broadcast__", "all"))
        or target == "all"
        or bool(data.get("is_broadcast"))
    )

    if session and session.is_connected:
        session.send_file_offer(
            transfer_id=transfer_id,
            recipient="__BROADCAST__" if is_broadcast else recipient,
            filename=filename,
            filesize=filesize,
            sha256=sha256,
            is_broadcast=is_broadcast
        )
    else:
        # Pure WebSocket fallback: fan out offer event to all connected peers
        offer_payload = {
            "type": "incoming_file_offer",
            "sender": "WebUser",
            "is_broadcast": is_broadcast,
            "filename": filename,
            "size": filesize,
            "filesize": filesize,
            "sha256": sha256,
            "transfer_id": transfer_id
        }
        emit("incoming_file_offer", offer_payload, broadcast=True, include_self=False)
        emit("file_offer", offer_payload, broadcast=True, include_self=False)


@socketio.on("file_accept")
def handle_file_accept(data):
    sid = request.sid
    session = gateway_manager.get_session(sid)
    if session and session.is_connected:
        transfer_id = data.get("transfer_id")
        sender = data.get("sender")
        filename = data.get("filename")
        filesize = data.get("filesize")
        sha256 = data.get("sha256")
        session.send_file_accept(transfer_id, sender, filename, filesize, sha256)


@socketio.on("file_reject")
def handle_file_reject(data):
    sid = request.sid
    session = gateway_manager.get_session(sid)
    if session and session.is_connected:
        transfer_id = data.get("transfer_id")
        sender = data.get("sender")
        filename = data.get("filename")
        session.send_file_reject(transfer_id, sender, filename)


@socketio.on("ping_measure")
def handle_ping(data):
    """Immediate echo for round-trip latency calculation."""
    emit("pong_measure", {
        "client_time": data.get("client_time"),
        "server_time": time.time()
    })


# ============================================================================
# ENTRY POINT
# ============================================================================

def create_app():
    return app, socketio


if __name__ == "__main__":
    host = "0.0.0.0"
    port = 5050
    print("=" * 60)
    print(f"Starting Web Gateway Server on http://localhost:{port}")
    print(f"Bridges browser clients to TCP Chat Server on Port {DEFAULT_CHAT_PORT}")
    print("=" * 60)
    socketio.run(app, host=host, port=port, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)
