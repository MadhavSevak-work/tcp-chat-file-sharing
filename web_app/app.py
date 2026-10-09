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
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from shared.constants import (
    DEFAULT_HOST,
    DEFAULT_CHAT_PORT,
    DEFAULT_FILE_PORT,
    MAX_FILE_SIZE,
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
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE

# Upload directory configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Configure SocketIO with threading mode
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
gateway_manager = GatewayManager()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("WebApp")

# File storage registry: transfer_id -> {filepath, filename, filesize, sha256, sender}
file_registry = {}


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

    # Save to disk
    file.save(filepath)
    filesize = os.path.getsize(filepath)

    if filesize > MAX_FILE_SIZE:
        os.remove(filepath)
        return jsonify({
            "status": "error",
            "message": f"File exceeds maximum allowed size ({MAX_FILE_SIZE // (1024*1024)} MB)."
        }), 400

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
    """Secure endpoint to download uploaded files with path traversal protection."""
    record = file_registry.get(transfer_id)
    if not record or not os.path.exists(record["filepath"]):
        return jsonify({"status": "error", "message": "File not found or expired."}), 404

    directory = os.path.dirname(record["filepath"])
    filename = os.path.basename(record["filepath"])

    return send_from_directory(
        directory,
        filename,
        as_attachment=True,
        download_name=record["filename"]
    )


# ============================================================================
# WEBSOCKET (SOCKET.IO) EVENT HANDLERS
# ============================================================================

@socketio.on("connect")
def handle_connect():
    sid = request.sid
    logger.info(f"[SocketIO] Client connected: {sid}")
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


@socketio.on("join")
def handle_join(data):
    """
    Browser client requests to join the chat system.
    Establishes the real TCP socket connection on behalf of this user.
    """
    sid = request.sid
    username = data.get("username", "").strip()
    host = data.get("host", DEFAULT_HOST).strip()
    port = int(data.get("port", DEFAULT_CHAT_PORT))

    is_valid, val_msg = validate_username(username)
    if not is_valid:
        emit("join_error", {"message": val_msg})
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
        emit("join_error", {"message": msg})


@socketio.on("send_chat")
def handle_send_chat(data):
    sid = request.sid
    content = data.get("content", "").strip()
    if not content:
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

    session = gateway_manager.get_session(sid)
    if session and session.is_connected:
        session.send_private(recipient, content)


@socketio.on("file_offer")
def handle_file_offer(data):
    sid = request.sid
    session = gateway_manager.get_session(sid)
    if session and session.is_connected:
        transfer_id = data.get("transfer_id")
        recipient = data.get("recipient")
        filename = data.get("filename")
        filesize = data.get("filesize")
        sha256 = data.get("sha256")
        session.send_file_offer(transfer_id, recipient, filename, filesize, sha256)


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
