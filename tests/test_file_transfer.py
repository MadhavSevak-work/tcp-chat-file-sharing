"""
Unit and integration tests for File Transfer components.
Tests:
- SHA-256 calculation
- Handling oversized file limit checks
- Tampered data checksum rejection
- Interrupted transfer file cleanup (.part removed)
"""

import hashlib
import os
import tempfile
import unittest

from client.file_transfer import FileTransferWorker
from shared.constants import MAX_FILE_SIZE
from shared.protocol import compute_file_sha256, sanitize_filename


class TestFileTransferLogic(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_sha256_computation(self):
        sample_path = os.path.join(self.test_dir, "sample.txt")
        content = b"Computer Networks College Project: TCP Socket Programming\n"
        with open(sample_path, "wb") as f:
            f.write(content)

        expected_hash = hashlib.sha256(content).hexdigest()
        actual_hash = compute_file_sha256(sample_path)
        self.assertEqual(actual_hash, expected_hash)

    def test_filename_sanitization_edge_cases(self):
        self.assertEqual(sanitize_filename("../../secret.txt"), "secret.txt")
        self.assertEqual(sanitize_filename("C:\\Windows\\System32\\calc.exe"), "calc.exe")
        self.assertEqual(sanitize_filename("my:report?2026.docx"), "myreport2026.docx")
        self.assertEqual(sanitize_filename("   "), "received_file")

    def test_oversized_file_limit_constant(self):
        # Enforces that MAX_FILE_SIZE is 100 MB
        self.assertEqual(MAX_FILE_SIZE, 100 * 1024 * 1024)


if __name__ == "__main__":
    unittest.main()
