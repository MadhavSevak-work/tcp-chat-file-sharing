"""
TCP Framing and Application Protocol Implementation.

In TCP/IP, the Transmission Control Protocol provides a reliable stream of bytes,
NOT distinct message packets. Senders might send two messages in rapid succession
that arrive bundled together (coalescing), or a single large message might arrive
in fragments across several recv() calls.

To achieve clean, unambiguous message boundaries, this module implements:
Length-Prefixed Framing:
Each message begins with a 4-byte header containing a 32-bit unsigned big-endian
integer (struct format '!I') indicating the exact byte length of the UTF-8 JSON payload.
"""

import json
import os
import re
import socket
import struct
import hashlib
from typing import Dict, Any, Optional, Tuple

from shared.constants import (
    HEADER_SIZE,
    MAX_MESSAGE_SIZE,
    MIN_USERNAME_LENGTH,
    MAX_USERNAME_LENGTH,
    USERNAME_REGEX,
)


class ProtocolError(Exception):
    """Raised when protocol invariants or frame bounds are violated."""
    pass


class ConnectionClosedError(Exception):
    """Raised when the remote socket has closed the connection cleanly or abruptly."""
    pass


def recv_exact(sock: socket.socket, num_bytes: int) -> bytes:
    """
    Read exactly `num_bytes` from the TCP stream.
    Loops until all requested bytes are gathered, or raises ConnectionClosedError
    if the peer disconnects before the full byte count is delivered.
    """
    received_chunks = []
    bytes_collected = 0

    while bytes_collected < num_bytes:
        bytes_needed = num_bytes - bytes_collected
        try:
            chunk = sock.recv(min(bytes_needed, 4096))
        except (socket.timeout, BlockingIOError):
            continue
        except (ConnectionResetError, ConnectionAbortedError, OSError) as e:
            raise ConnectionClosedError(f"Connection lost while reading data: {e}")

        if not chunk:
            raise ConnectionClosedError("Remote endpoint closed connection prematurely.")

        received_chunks.append(chunk)
        bytes_collected += len(chunk)

    return b"".join(received_chunks)


def send_msg(sock: socket.socket, payload: Dict[str, Any], lock=None) -> None:
    """
    Serializes a dictionary to JSON and frames it with a 4-byte big-endian length prefix.
    Optionally accepts a threading.Lock to ensure thread-safe writes on shared sockets.
    """
    try:
        json_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    except Exception as e:
        raise ProtocolError(f"Failed to serialize payload to JSON: {e}")

    payload_length = len(json_bytes)
    if payload_length > MAX_MESSAGE_SIZE:
        raise ProtocolError(f"Payload size ({payload_length} bytes) exceeds limit ({MAX_MESSAGE_SIZE} bytes)")

    # 4-byte unsigned integer, network byte order (big-endian)
    header = struct.pack("!I", payload_length)
    packet = header + json_bytes

    if lock:
        with lock:
            sock.sendall(packet)
    else:
        sock.sendall(packet)


def recv_msg(sock: socket.socket) -> Optional[Dict[str, Any]]:
    """
    Receives a single framed JSON message from the socket.
    Returns the parsed dictionary, or raises ConnectionClosedError/ProtocolError.
    """
    # 1. Read 4-byte header
    try:
        header_bytes = recv_exact(sock, HEADER_SIZE)
    except ConnectionClosedError:
        return None

    if not header_bytes:
        return None

    payload_length = struct.unpack("!I", header_bytes)[0]
    if payload_length > MAX_MESSAGE_SIZE:
        # Gracefully handle Cloud HTTP probes (e.g., Render/AWS health checks: HEAD, GET, OPTIONS)
        if header_bytes in (b"HEAD", b"GET ", b"POST", b"OPTI", b"PUT "):
            try:
                sock.sendall(b"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\nContent-Length: 2\r\n\r\nOK")
            except Exception:
                pass
            return None
        raise ProtocolError(f"Incoming message payload too large: {payload_length} bytes")

    # 2. Read exact payload
    payload_bytes = recv_exact(sock, payload_length)

    # 3. Decode & deserialize
    try:
        return json.loads(payload_bytes.decode("utf-8"))
    except json.JSONDecodeError as e:
        raise ProtocolError(f"Malformed JSON payload received: {e}")


def send_frame(sock: socket.socket, data: bytes, lock=None) -> None:
    """
    Wraps raw binary data in the exact 4-byte big-endian length prefix (!I)
    required by the TCP byte-stream protocol and transmits across the socket.
    """
    if not isinstance(data, (bytes, bytearray)):
        data = bytes(data)
    frame_length = len(data)
    header = struct.pack("!I", frame_length)
    packet = header + data
    if lock:
        with lock:
            sock.sendall(packet)
    else:
        sock.sendall(packet)


def recv_frame(sock: socket.socket, max_frame_size: int = MAX_MESSAGE_SIZE) -> Optional[bytes]:
    """
    Reads the full 4-byte length header (!I), then loops until the complete
    chunk buffer is received, preventing frame boundary alignment issues.
    """
    try:
        header_bytes = recv_exact(sock, HEADER_SIZE)
    except ConnectionClosedError:
        return None

    if not header_bytes:
        return None

    payload_length = struct.unpack("!I", header_bytes)[0]
    if payload_length > max_frame_size:
        raise ProtocolError(f"Incoming binary frame too large: {payload_length} bytes")

    return recv_exact(sock, payload_length)



def validate_username(username: str) -> Tuple[bool, str]:
    """
    Validates a requested username.
    Rules:
    - Must be a non-empty string.
    - Length between MIN_USERNAME_LENGTH and MAX_USERNAME_LENGTH.
    - Contains only alphanumeric characters, underscores, dashes, and dots.
    - Cannot be reserved system names ('Server', 'System', 'All').
    """
    if not isinstance(username, str):
        return False, "Username must be text."

    cleaned = username.strip()
    if len(cleaned) < MIN_USERNAME_LENGTH or len(cleaned) > MAX_USERNAME_LENGTH:
        return False, f"Username must be between {MIN_USERNAME_LENGTH} and {MAX_USERNAME_LENGTH} characters."

    if not re.match(USERNAME_REGEX, cleaned):
        return False, "Username may only contain letters, numbers, hyphens, dots, and underscores."

    if cleaned.lower() in ("server", "system", "all", "everyone", "admin"):
        return False, f"'{cleaned}' is a reserved system name."

    return True, cleaned


def sanitize_filename(filename: str) -> str:
    """
    Strips directory paths and path traversal sequences ('../', '..\\')
    to prevent unauthorized filesystem overwrites.
    """
    if not filename:
        return "received_file"
    # Remove null bytes
    clean = str(filename).replace("\x00", "")
    # Normalize Windows and Unix path separators
    clean = clean.replace("\\", "/")
    # Repeatedly remove any relative traversal patterns
    clean = re.sub(r'(?:\.\./)+', '', clean)
    # Extract only the base name
    base = os.path.basename(clean)
    # Remove path separators and hazardous filesystem characters
    cleaned = re.sub(r'[\\/*?:"<>|\x00]', "", base).strip()
    # Strip any leading dots or whitespace
    while cleaned.startswith(".."):
        cleaned = cleaned[2:].strip()
    cleaned = cleaned.strip(". ")
    return cleaned if cleaned else "received_file"


def compute_file_sha256(filepath: str) -> str:
    """
    Computes the SHA-256 hash of a file incrementally to avoid loading large files into memory.
    """
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while True:
            chunk = f.read(64 * 1024)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()
