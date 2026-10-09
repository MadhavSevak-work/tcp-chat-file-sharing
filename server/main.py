"""
Server entry point.

Parses command line arguments, configures logging, initializes the ChatServer,
and catches KeyboardInterrupt for a smooth, graceful shutdown.
"""

import argparse
import os
import sys
import time

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server.server_core import ChatServer
from server.logger import setup_logger
from shared.constants import DEFAULT_HOST, DEFAULT_CHAT_PORT, DEFAULT_FILE_PORT


def main():
    parser = argparse.ArgumentParser(
        description="TCP Multi-Client Chat & File Sharing Server (Computer Networks Project)"
    )
    parser.add_argument(
        "--host",
        type=str,
        default=DEFAULT_HOST,
        help=f"IP address to bind the server to (default: {DEFAULT_HOST}, use 0.0.0.0 for LAN)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_CHAT_PORT,
        help=f"TCP port for chat messaging (default: {DEFAULT_CHAT_PORT})"
    )
    parser.add_argument(
        "--file-port",
        type=int,
        default=DEFAULT_FILE_PORT,
        help=f"TCP port for file transfers (default: {DEFAULT_FILE_PORT})"
    )
    args = parser.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    logger = setup_logger("TCPServer")
    server = ChatServer(host=args.host, chat_port=args.port, file_port=args.file_port, logger=logger)

    try:
        server.start()
        logger.info("Server is active. Press Ctrl+C in this terminal to stop.")
        while server.is_running:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("\nReceived keyboard interrupt signal.")
    finally:
        server.stop()
        logger.info("Server process finished.")


if __name__ == "__main__":
    main()
