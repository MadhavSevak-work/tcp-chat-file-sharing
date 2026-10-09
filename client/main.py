"""
Client application entry point.

Initializes the Tkinter graphical user interface and handles runtime arguments.
Supports optional --host, --port, and --username arguments for quick testing.
"""

import argparse
import os
import sys
import tkinter as tk

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from client.ui import ChatClientGUI
from shared.constants import DEFAULT_HOST, DEFAULT_CHAT_PORT


def main():
    parser = argparse.ArgumentParser(
        description="TCP Chat & File Sharing Desktop Client (Computer Networks Project)"
    )
    parser.add_argument(
        "--host",
        type=str,
        default=DEFAULT_HOST,
        help=f"Default server host (default: {DEFAULT_HOST})"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_CHAT_PORT,
        help=f"Default server port (default: {DEFAULT_CHAT_PORT})"
    )
    parser.add_argument(
        "--username",
        type=str,
        default="",
        help="Optional initial username"
    )
    args = parser.parse_args()

    root = tk.Tk()
    app = ChatClientGUI(root)

    # Prefill from CLI args if provided
    if args.host:
        app.ip_entry.delete(0, tk.END)
        app.ip_entry.insert(0, args.host)

    if args.port:
        app.port_entry.delete(0, tk.END)
        app.port_entry.insert(0, str(args.port))

    if args.username:
        app.user_entry.delete(0, tk.END)
        app.user_entry.insert(0, args.username)

    root.mainloop()


if __name__ == "__main__":
    main()
