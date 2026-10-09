"""
Modern UI Dialogs for File Offer, Destination Selection, and File Sending.
Designed with charcoal dark theme and consistent styling.
"""

import os
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from typing import Callable, Optional, List

from shared.protocol import compute_file_sha256, sanitize_filename
from shared.constants import MAX_FILE_SIZE


def format_bytes(size: int) -> str:
    """Formats raw byte count into human-readable string (KB, MB)."""
    if size < 1024:
        return f"{size} bytes"
    elif size < 1024 * 1024:
        return f"{size / 1024:.1f} KB ({size:,} bytes)"
    else:
        return f"{size / (1024 * 1024):.2f} MB ({size:,} bytes)"


class FileOfferDialog(tk.Toplevel):
    """
    Modal dialog prompted when an incoming file offer is received from a peer.
    Prompts user to accept (and pick save directory) or reject.
    """
    def __init__(self, parent: tk.Tk, offer_data: dict, on_decision: Callable[[bool, str], None]):
        super().__init__(parent)
        self.offer_data = offer_data
        self.on_decision = on_decision
        self.save_path: str = ""

        self.title("📥 Incoming File Offer")
        self.geometry("480x320")
        self.resizable(False, False)
        self.configure(bg="#1A1D24")
        self.transient(parent)
        self.grab_set()

        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self._on_reject)

    def _build_ui(self):
        pad_frame = tk.Frame(self, bg="#1A1D24", padx=20, pady=16)
        pad_frame.pack(fill=tk.BOTH, expand=True)

        # Header Title
        title_lbl = tk.Label(
            pad_frame,
            text="Incoming File Transfer Request",
            font=("Segoe UI", 12, "bold"),
            fg="#F3F4F6",
            bg="#1A1D24"
        )
        title_lbl.pack(anchor="w", pady=(0, 10))

        # Details Box
        info_frame = tk.Frame(pad_frame, bg="#222630", padx=12, pady=10, relief=tk.SOLID, bd=1)
        info_frame.pack(fill=tk.X, pady=(0, 12))

        sender = self.offer_data.get("sender", "Unknown")
        filename = self.offer_data.get("filename", "unknown")
        filesize = self.offer_data.get("filesize", 0)
        sha256 = self.offer_data.get("sha256", "")

        def make_row(parent, label_text, val_text, val_color="#F3F4F6"):
            row = tk.Frame(parent, bg="#222630")
            row.pack(fill=tk.X, pady=2)
            tk.Label(row, text=label_text, font=("Segoe UI", 9, "bold"), fg="#9CA3AF", bg="#222630", width=12, anchor="w").pack(side=tk.LEFT)
            tk.Label(row, text=val_text, font=("Segoe UI", 9), fg=val_color, bg="#222630", anchor="w").pack(side=tk.LEFT, fill=tk.X, expand=True)

        make_row(info_frame, "Sender:", sender, "#60A5FA")
        make_row(info_frame, "File Name:", filename)
        make_row(info_frame, "File Size:", format_bytes(filesize))
        make_row(info_frame, "SHA-256:", f"{sha256[:16]}...{sha256[-8:]}" if sha256 else "N/A", "#A78BFA")

        # Destination Folder Selector
        dest_lbl = tk.Label(pad_frame, text="Save To Location:", font=("Segoe UI", 9, "bold"), fg="#D1D5DB", bg="#1A1D24")
        dest_lbl.pack(anchor="w", pady=(4, 2))

        dest_row = tk.Frame(pad_frame, bg="#1A1D24")
        dest_row.pack(fill=tk.X, pady=(0, 16))

        # Default to Downloads directory
        default_dir = os.path.join(os.path.expanduser("~"), "Downloads")
        if not os.path.exists(default_dir):
            default_dir = os.getcwd()
        self.default_filepath = os.path.join(default_dir, filename)

        self.path_var = tk.StringVar(value=self.default_filepath)
        path_entry = tk.Entry(dest_row, textvariable=self.path_var, font=("Segoe UI", 9), bg="#121418", fg="#F3F4F6", relief=tk.FLAT, bd=4)
        path_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))

        browse_btn = tk.Button(
            dest_row,
            text="Browse...",
            font=("Segoe UI", 9),
            bg="#2D3748",
            fg="#F3F4F6",
            activebackground="#4A5568",
            activeforeground="#FFFFFF",
            relief=tk.FLAT,
            padx=10,
            command=self._on_browse
        )
        browse_btn.pack(side=tk.RIGHT)

        # Buttons (Accept / Reject)
        btn_frame = tk.Frame(pad_frame, bg="#1A1D24")
        btn_frame.pack(fill=tk.X, side=tk.BOTTOM)

        reject_btn = tk.Button(
            btn_frame,
            text="✕ Decline",
            font=("Segoe UI", 10, "bold"),
            bg="#DC2626",
            fg="#FFFFFF",
            activebackground="#B91C1C",
            activeforeground="#FFFFFF",
            relief=tk.FLAT,
            padx=16,
            pady=6,
            command=self._on_reject
        )
        reject_btn.pack(side=tk.RIGHT, padx=(8, 0))

        accept_btn = tk.Button(
            btn_frame,
            text="✓ Accept & Save",
            font=("Segoe UI", 10, "bold"),
            bg="#059669",
            fg="#FFFFFF",
            activebackground="#047857",
            activeforeground="#FFFFFF",
            relief=tk.FLAT,
            padx=16,
            pady=6,
            command=self._on_accept
        )
        accept_btn.pack(side=tk.RIGHT)

    def _on_browse(self):
        filename = self.offer_data.get("filename", "file")
        chosen = filedialog.asksaveasfilename(
            parent=self,
            initialdir=os.path.dirname(self.path_var.get()),
            initialfile=filename,
            title="Select Destination"
        )
        if chosen:
            self.path_var.set(chosen)

    def _on_accept(self):
        chosen_path = self.path_var.get().strip()
        if not chosen_path:
            messagebox.showwarning("Save Path Required", "Please select a valid destination filepath.", parent=self)
            return

        if os.path.exists(chosen_path):
            confirm = messagebox.askyesno(
                "Confirm Overwrite",
                f"File '{os.path.basename(chosen_path)}' already exists.\nDo you want to overwrite it?",
                parent=self
            )
            if not confirm:
                return

        self.save_path = chosen_path
        self.destroy()
        self.on_decision(True, self.save_path)

    def _on_reject(self):
        self.destroy()
        self.on_decision(False, "")


class SendFileDialog(tk.Toplevel):
    """
    Dialog for preparing and initiating a file transfer to another online user.
    """
    def __init__(self, parent: tk.Tk, online_users: List[str], current_user: str,
                 preselected_user: Optional[str], on_send: Callable[[str, str, int, str], None]):
        super().__init__(parent)
        self.online_users = [u for u in online_users if u.lower() != current_user.lower()]
        self.current_user = current_user
        self.preselected_user = preselected_user
        self.on_send = on_send

        self.title("📤 Send File to Peer")
        self.geometry("480x360")
        self.resizable(False, False)
        self.configure(bg="#1A1D24")
        self.transient(parent)
        self.grab_set()

        self.selected_file_path = ""
        self.file_size = 0
        self.file_sha256 = ""

        self._build_ui()

    def _build_ui(self):
        pad_frame = tk.Frame(self, bg="#1A1D24", padx=20, pady=16)
        pad_frame.pack(fill=tk.BOTH, expand=True)

        tk.Label(
            pad_frame,
            text="Share a File with Connected Peer",
            font=("Segoe UI", 12, "bold"),
            fg="#F3F4F6",
            bg="#1A1D24"
        ).pack(anchor="w", pady=(0, 12))

        # Recipient Selection
        tk.Label(pad_frame, text="Select Recipient:", font=("Segoe UI", 9, "bold"), fg="#D1D5DB", bg="#1A1D24").pack(anchor="w", pady=(0, 4))
        self.recipient_var = tk.StringVar()
        if self.preselected_user and self.preselected_user in self.online_users:
            self.recipient_var.set(self.preselected_user)
        elif self.online_users:
            self.recipient_var.set(self.online_users[0])

        recipient_dropdown = ttk.Combobox(
            pad_frame,
            textvariable=self.recipient_var,
            values=self.online_users,
            state="readonly" if self.online_users else "disabled",
            font=("Segoe UI", 10)
        )
        recipient_dropdown.pack(fill=tk.X, pady=(0, 14))

        # File Chooser
        tk.Label(pad_frame, text="Choose File:", font=("Segoe UI", 9, "bold"), fg="#D1D5DB", bg="#1A1D24").pack(anchor="w", pady=(0, 4))
        file_row = tk.Frame(pad_frame, bg="#1A1D24")
        file_row.pack(fill=tk.X, pady=(0, 12))

        self.file_path_var = tk.StringVar(value="No file selected...")
        path_entry = tk.Entry(
            file_row,
            textvariable=self.file_path_var,
            state="readonly",
            font=("Segoe UI", 9),
            bg="#121418",
            fg="#9CA3AF",
            relief=tk.FLAT,
            bd=4
        )
        path_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))

        browse_btn = tk.Button(
            file_row,
            text="Select File...",
            font=("Segoe UI", 9),
            bg="#2D3748",
            fg="#F3F4F6",
            activebackground="#4A5568",
            activeforeground="#FFFFFF",
            relief=tk.FLAT,
            padx=10,
            command=self._on_choose_file
        )
        browse_btn.pack(side=tk.RIGHT)

        # File Preview Box
        self.preview_frame = tk.Frame(pad_frame, bg="#222630", padx=10, pady=8, relief=tk.SOLID, bd=1)
        self.preview_frame.pack(fill=tk.X, pady=(0, 16))

        self.info_size_lbl = tk.Label(self.preview_frame, text="Size: --", font=("Segoe UI", 9), fg="#9CA3AF", bg="#222630")
        self.info_size_lbl.pack(anchor="w")

        self.info_sha_lbl = tk.Label(self.preview_frame, text="SHA-256: --", font=("Segoe UI", 9), fg="#9CA3AF", bg="#222630")
        self.info_sha_lbl.pack(anchor="w")

        # Bottom Actions
        btn_frame = tk.Frame(pad_frame, bg="#1A1D24")
        btn_frame.pack(fill=tk.X, side=tk.BOTTOM)

        cancel_btn = tk.Button(
            btn_frame,
            text="Cancel",
            font=("Segoe UI", 10),
            bg="#374151",
            fg="#F3F4F6",
            relief=tk.FLAT,
            padx=14,
            pady=6,
            command=self.destroy
        )
        cancel_btn.pack(side=tk.RIGHT, padx=(8, 0))

        self.send_btn = tk.Button(
            btn_frame,
            text="📤 Send Offer",
            font=("Segoe UI", 10, "bold"),
            bg="#2563EB",
            fg="#FFFFFF",
            activebackground="#1D4ED8",
            activeforeground="#FFFFFF",
            relief=tk.FLAT,
            padx=18,
            pady=6,
            state=tk.DISABLED,
            command=self._on_confirm_send
        )
        self.send_btn.pack(side=tk.RIGHT)

    def _on_choose_file(self):
        filepath = filedialog.askopenfilename(parent=self, title="Select File to Send")
        if not filepath:
            return

        size = os.path.getsize(filepath)
        if size > MAX_FILE_SIZE:
            messagebox.showerror(
                "File Too Large",
                f"File size is {format_bytes(size)}. Maximum supported size is {MAX_FILE_SIZE // (1024*1024)} MB.",
                parent=self
            )
            return

        if size == 0:
            messagebox.showwarning("Empty File", "Cannot send empty 0-byte file.", parent=self)
            return

        self.selected_file_path = filepath
        self.file_size = size
        self.file_path_var.set(filepath)

        # Compute SHA-256
        self.info_sha_lbl.config(text="Computing SHA-256 checksum...", fg="#F59E0B")
        self.update_idletasks()

        self.file_sha256 = compute_file_sha256(filepath)
        self.info_size_lbl.config(text=f"Size: {format_bytes(size)}", fg="#10B981")
        self.info_sha_lbl.config(text=f"SHA-256: {self.file_sha256[:16]}...{self.file_sha256[-8:]}", fg="#60A5FA")
        self.send_btn.config(state=tk.NORMAL)

    def _on_confirm_send(self):
        recipient = self.recipient_var.get().strip()
        if not recipient:
            messagebox.showwarning("Select Recipient", "Please select an online peer to send to.", parent=self)
            return

        if not self.selected_file_path:
            return

        self.destroy()
        self.on_send(self.selected_file_path, recipient, self.file_size, self.file_sha256)
