"""
Launcher for the Web Application and Gateway.
Usage:
    python run_web.py [--host 0.0.0.0] [--port 5050]
"""

import argparse
import sys
import os

# Ensure root in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from web_app.app import app, socketio
from shared.constants import DEFAULT_CHAT_PORT


def main():
    parser = argparse.ArgumentParser(description="Web Gateway for TCP Chat & File Sharing")
    parser.add_argument("--host", default="0.0.0.0", help="HTTP bind host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=5050, help="HTTP web port (default: 5050)")
    args = parser.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    print("=" * 65)
    print("[WEB] TCP Chat & File Sharing Web Application Gateway")
    print(f"[*] Web Interface:  http://localhost:{args.port}")
    # Check if TCP server is already running on port 5000; if not, launch it automatically
    import socket
    s = socket.socket()
    try:
        s.connect(("127.0.0.1", DEFAULT_CHAT_PORT))
        s.close()
        print(f"[*] Connected to existing TCP Server on Port {DEFAULT_CHAT_PORT}")
    except Exception:
        s.close()
        print(f"[*] Starting internal TCP Chat Server on Port {DEFAULT_CHAT_PORT} for cloud/single-process mode...")
        try:
            from server.server_core import ChatServer
            from server.logger import setup_logger
            from shared.constants import DEFAULT_FILE_PORT
            logger = setup_logger("TCPServerAuto")
            tcp_server = ChatServer(host="127.0.0.1", chat_port=DEFAULT_CHAT_PORT, file_port=DEFAULT_FILE_PORT, logger=logger)
            tcp_server.start()
        except Exception as e:
            print(f"[!] Warning: Could not auto-start TCP server: {e}")

    socketio.run(app, host=args.host, port=args.port, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)


if __name__ == "__main__":
    main()
