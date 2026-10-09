"""
Client File Transfer Worker.

Handles chunked binary file upload and download operations through the File Relay server.
Includes live progress tracking, cancellation support, and SHA-256 integrity verification.
"""

import hashlib
import os
import socket
import threading
from typing import Callable, Optional

from shared.constants import CHUNK_SIZE, SOCKET_TIMEOUT
from shared.protocol import send_msg, recv_msg, ConnectionClosedError, ProtocolError


class FileTransferWorker:
    def __init__(self, transfer_id: str, is_upload: bool, filename: str, filesize: int,
                 expected_sha256: str, host: str, file_port: int,
                 local_path: str,
                 on_progress: Optional[Callable[[int, int, float], None]] = None,
                 on_complete: Optional[Callable[[bool, str], None]] = None):
        self.transfer_id = transfer_id
        self.is_upload = is_upload
        self.filename = filename
        self.filesize = filesize
        self.expected_sha256 = expected_sha256
        self.host = host
        self.file_port = file_port
        self.local_path = local_path
        self.on_progress = on_progress
        self.on_complete = on_complete

        self.sock: Optional[socket.socket] = None
        self.is_aborted = False
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        """Launches the transfer in a dedicated background daemon thread."""
        target_fn = self._upload_runner if self.is_upload else self._download_runner
        self._thread = threading.Thread(
            target=target_fn,
            name=f"FT-{'Up' if self.is_upload else 'Down'}-{self.transfer_id[:6]}",
            daemon=True
        )
        self._thread.start()

    def abort(self) -> None:
        """Cancels the active transfer and closes the connection."""
        self.is_aborted = True
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass

    def _upload_runner(self) -> None:
        """Streams local file chunks to the File Relay server."""
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.settimeout(SOCKET_TIMEOUT)
            self.sock.connect((self.host, self.file_port))

            # Send upload handshake
            send_msg(self.sock, {"action": "upload", "transfer_id": self.transfer_id})
            resp = recv_msg(self.sock)
            if not resp or resp.get("status") != "ok":
                raise ProtocolError(resp.get("message", "Relay handshake rejected."))

            self.sock.settimeout(None)  # Remove timeout during data streaming

            bytes_sent = 0
            with open(self.local_path, "rb") as f:
                while bytes_sent < self.filesize and not self.is_aborted:
                    chunk = f.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    self.sock.sendall(chunk)
                    bytes_sent += len(chunk)

                    if self.on_progress:
                        percentage = (bytes_sent / self.filesize) * 100.0 if self.filesize > 0 else 100.0
                        self.on_progress(bytes_sent, self.filesize, percentage)

            if self.is_aborted:
                if self.on_complete:
                    self.on_complete(False, "Upload cancelled by user.")
                return

            if bytes_sent < self.filesize:
                raise ConnectionClosedError("Upload connection broken before all bytes were sent.")

            if self.on_complete:
                self.on_complete(True, f"Successfully uploaded '{self.filename}'.")

        except Exception as e:
            if not self.is_aborted and self.on_complete:
                self.on_complete(False, f"Upload error: {e}")
        finally:
            self._cleanup_socket()

    def _download_runner(self) -> None:
        """Downloads chunks from File Relay, saves to disk, and verifies SHA-256."""
        part_filepath = self.local_path + ".part"
        hasher = hashlib.sha256()
        bytes_received = 0

        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.settimeout(SOCKET_TIMEOUT)
            self.sock.connect((self.host, self.file_port))

            # Send download handshake
            send_msg(self.sock, {"action": "download", "transfer_id": self.transfer_id})
            resp = recv_msg(self.sock)
            if not resp or resp.get("status") != "ok":
                raise ProtocolError(resp.get("message", "Relay handshake rejected."))

            self.sock.settimeout(None)

            # Ensure target directory exists
            os.makedirs(os.path.dirname(os.path.abspath(self.local_path)), exist_ok=True)

            with open(part_filepath, "wb") as f:
                while bytes_received < self.filesize and not self.is_aborted:
                    bytes_to_read = min(CHUNK_SIZE, self.filesize - bytes_received)
                    chunk = self.sock.recv(bytes_to_read)
                    if not chunk:
                        break
                    f.write(chunk)
                    hasher.update(chunk)
                    bytes_received += len(chunk)

                    if self.on_progress:
                        percentage = (bytes_received / self.filesize) * 100.0 if self.filesize > 0 else 100.0
                        self.on_progress(bytes_received, self.filesize, percentage)

            if self.is_aborted:
                if os.path.exists(part_filepath):
                    try:
                        os.remove(part_filepath)
                    except Exception:
                        pass
                if self.on_complete:
                    self.on_complete(False, "Download cancelled by user.")
                return

            if bytes_received < self.filesize:
                if os.path.exists(part_filepath):
                    try:
                        os.remove(part_filepath)
                    except Exception:
                        pass
                raise ConnectionClosedError("Download connection closed prematurely.")

            # Integrity verification
            computed_sha256 = hasher.hexdigest()
            if self.expected_sha256 and computed_sha256.lower() != self.expected_sha256.lower():
                if os.path.exists(part_filepath):
                    try:
                        os.remove(part_filepath)
                    except Exception:
                        pass
                raise ValueError(
                    f"Integrity Check Failed!\n"
                    f"Expected SHA-256: {self.expected_sha256}\n"
                    f"Computed SHA-256: {computed_sha256}"
                )

            # Atomic rename from .part to final target
            if os.path.exists(self.local_path):
                # Avoid collision if file exists
                os.remove(self.local_path)
            os.rename(part_filepath, self.local_path)

            if self.on_complete:
                self.on_complete(
                    True,
                    f"File '{self.filename}' received successfully!\n"
                    f"SHA-256 Checksum Verified: {computed_sha256[:16]}..."
                )

        except Exception as e:
            if os.path.exists(part_filepath):
                try:
                    os.remove(part_filepath)
                except Exception:
                    pass
            if not self.is_aborted and self.on_complete:
                self.on_complete(False, f"Download error: {e}")
        finally:
            self._cleanup_socket()

    def _cleanup_socket(self) -> None:
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
            self.sock = None
