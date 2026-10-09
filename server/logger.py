"""
Thread-safe logging configuration for the TCP Chat and File Transfer Server.
Provides structured logs with timestamps, log levels, and optional file output.
"""

import logging
import os
import sys

def setup_logger(name: str = "TCPServer", log_to_file: bool = True, log_dir: str = "logs") -> logging.Logger:
    """
    Configures and returns a thread-safe logger with clean console formatting.
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    # Avoid adding duplicate handlers if setup is called multiple times
    if logger.handlers:
        return logger

    # Console Handler (clean stdout)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_format = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(threadName)s] %(message)s",
        datefmt="%H:%M:%S"
    )
    console_handler.setFormatter(console_format)
    logger.addHandler(console_handler)

    # File Handler
    if log_to_file:
        try:
            os.makedirs(log_dir, exist_ok=True)
            log_filepath = os.path.join(log_dir, "server.log")
            file_handler = logging.FileHandler(log_filepath, encoding="utf-8")
            file_handler.setLevel(logging.DEBUG)
            file_format = logging.Formatter(
                "%(asctime)s | %(levelname)-7s | [%(threadName)s] | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S"
            )
            file_handler.setFormatter(file_format)
            logger.addHandler(file_handler)
        except Exception as e:
            logger.warning(f"Could not initialize file logger: {e}")

    return logger
