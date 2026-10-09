"""
Lightweight Terminal-based TCP Chat Client.

Designed for quick command-line verification and headless testing.
Demonstrates raw socket communication, message framing, and multithreaded CLI I/O.
"""

import argparse
import os
import socket
import sys
import threading
import time

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from shared.constants import (
    DEFAULT_HOST,
    DEFAULT_CHAT_PORT,
    MSG_CONNECT,
    MSG_CONNECT_ACK,
    MSG_CHAT,
    MSG_PRIVATE_CHAT,
    MSG_USER_LIST,
    MSG_SYSTEM,
    MSG_ERROR,
    MSG_DISCONNECT,
)
from shared.protocol import send_msg, recv_msg, ConnectionClosedError


def receive_worker(sock: socket.socket, stop_event: threading.Event):
    """Continuously listens for incoming framed messages from server and prints them."""
    while not stop_event.is_set():
        try:
            msg = recv_msg(sock)
            if msg is None:
                print("\n[Server disconnected]")
                break

            mtype = msg.get("type")
            if mtype == MSG_CHAT:
                sender = msg.get("sender")
                content = msg.get("content")
                ts = msg.get("timestamp", "")
                print(f"\n[{ts}] {sender}: {content}\n> ", end="", flush=True)

            elif mtype == MSG_PRIVATE_CHAT:
                sender = msg.get("sender")
                content = msg.get("content")
                ts = msg.get("timestamp", "")
                print(f"\n[{ts}] [PRIVATE from {sender}]: {content}\n> ", end="", flush=True)

            elif mtype == MSG_USER_LIST:
                users = msg.get("users", [])
                print(f"\n[Online Users: {', '.join(users)}]\n> ", end="", flush=True)

            elif mtype == MSG_SYSTEM:
                print(f"\n[System: {msg.get('message')}]\n> ", end="", flush=True)

            elif mtype == MSG_ERROR:
                print(f"\n[Server Error: {msg.get('message')}]\n> ", end="", flush=True)

        except (ConnectionClosedError, OSError):
            break
        except Exception as e:
            print(f"\n[Error: {e}]\n> ", end="", flush=True)

    stop_event.set()


def main():
    parser = argparse.ArgumentParser(description="Terminal Client for TCP Multi-Client Chat")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Server IP")
    parser.add_argument("--port", type=int, default=DEFAULT_CHAT_PORT, help="Server Port")
    parser.add_argument("--username", default="", help="Username")
    args = parser.parse_args()

    username = args.username
    if not username:
        try:
            username = input("Enter your username: ").strip()
        except (KeyboardInterrupt, EOFError):
            return

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.connect((args.host, args.port))
    except Exception as e:
        print(f"Could not connect to {args.host}:{args.port} -> {e}")
        return

    # Handshake
    send_msg(sock, {"type": MSG_CONNECT, "username": username})
    ack = recv_msg(sock)
    if not ack or ack.get("type") != MSG_CONNECT_ACK:
        err = ack.get("message", "Handshake failed") if ack else "Connection closed"
        print(f"Authentication failed: {err}")
        sock.close()
        return

    print(f"Connected! {ack.get('message')}")
    print("Commands:")
    print("  /pm <username> <message>   - Send private message")
    print("  /quit                      - Disconnect and exit\n")

    stop_event = threading.Event()
    listener = threading.Thread(target=receive_worker, args=(sock, stop_event), daemon=True)
    listener.start()

    try:
        while not stop_event.is_set():
            try:
                line = input("> ").strip()
            except (KeyboardInterrupt, EOFError):
                break

            if not line:
                continue

            if line == "/quit":
                send_msg(sock, {"type": MSG_DISCONNECT})
                break

            if line.startswith("/pm "):
                parts = line.split(" ", 2)
                if len(parts) >= 3:
                    target_user = parts[1]
                    pm_body = parts[2]
                    send_msg(sock, {
                        "type": MSG_PRIVATE_CHAT,
                        "recipient": target_user,
                        "content": pm_body
                    })
                else:
                    print("Usage: /pm <username> <message>")
            else:
                send_msg(sock, {"type": MSG_CHAT, "content": line})

    finally:
        stop_event.set()
        try:
            sock.close()
        except Exception:
            pass
        print("\nExited.")


if __name__ == "__main__":
    main()
