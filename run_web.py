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
    print(f"[*] Underlying TCP: 127.0.0.1:{DEFAULT_CHAT_PORT}")
    print("=" * 65)

    socketio.run(app, host=args.host, port=args.port, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)


if __name__ == "__main__":
    main()
