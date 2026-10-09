"""
Main Desktop Graphical User Interface.

Built with Tkinter and ttk following modern UI/UX principles:
- Charcoal dark theme with subtle blue accents.
- Responsive, non-blocking asynchronous event processing via queue.Queue and root.after().
- Rich styled chat history with color tags for group, private, system, and file events.
- Online users directory with one-click direct message and file transfer actions.
- Live file transfer progress indicators with SHA-256 integrity verification feedback.
"""

import os
import queue
import threading
import time
import uuid
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
from typing import Optional, List, Dict

from client.network import NetworkManager, NetworkEvent
from client.file_transfer import FileTransferWorker
from client.dialogs import FileOfferDialog, SendFileDialog, format_bytes
from shared.constants import (
    DEFAULT_HOST,
    DEFAULT_CHAT_PORT,
    DEFAULT_FILE_PORT,
    MSG_CHAT,
    MSG_PRIVATE_CHAT,
    MSG_USER_LIST,
    MSG_SYSTEM,
    MSG_ERROR,
    MSG_FILE_OFFER,
    MSG_FILE_READY,
    MSG_FILE_REJECT,
    MSG_FILE_CANCEL,
)
from shared.protocol import sanitize_filename, validate_username


class ChatClientGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("TCP Chat & File Sharing System — Computer Networks Project")
        self.root.geometry("1040x680")
        self.root.minsize(860, 560)
        self.root.configure(bg="#121418")

        # Network queue and state
        self.event_queue = queue.Queue()
        self.net_manager = NetworkManager(self.event_queue)
        self.online_users: List[str] = []
        self.current_user: str = ""
        self.private_target: Optional[str] = None  # None = Public room, str = Private user

        # Active file transfer state
        self.active_transfers: Dict[str, FileTransferWorker] = {}

        # Configure Tkinter styles
        self._setup_styles()

        # Build UI layout
        self._build_top_bar()
        self._build_main_layout()

        # Intercept window close
        self.root.protocol("WM_DELETE_WINDOW", self._on_window_close)

        # Start non-blocking periodic event polling loop
        self.root.after(50, self._process_event_queue)

    def _setup_styles(self):
        style = ttk.Style(self.root)
        try:
            style.theme_use("clam")
        except Exception:
            pass

        # Progressbar styling
        style.configure(
            "Accent.Horizontal.TProgressbar",
            troughcolor="#1A1D24",
            background="#2563EB",
            darkcolor="#1D4ED8",
            lightcolor="#3B82F6",
            bordercolor="#1A1D24"
        )

        style.configure(
            "TCombobox",
            fieldbackground="#222630",
            background="#2D3748",
            foreground="#F3F4F6",
            arrowcolor="#F3F4F6"
        )

    # ==========================================
    # UI CONSTRUCTION
    # ==========================================
    def _build_top_bar(self):
        """Builds the top configuration bar: Server IP, Port, Username, Connect/Disconnect."""
        self.top_frame = tk.Frame(self.root, bg="#1A1D24", padx=16, pady=10, relief=tk.FLAT)
        self.top_frame.pack(fill=tk.X, side=tk.TOP)

        # Server IP
        tk.Label(self.top_frame, text="Host IP:", font=("Segoe UI", 9, "bold"), fg="#9CA3AF", bg="#1A1D24").pack(side=tk.LEFT, padx=(0, 4))
        self.ip_entry = tk.Entry(self.top_frame, font=("Segoe UI", 9), width=13, bg="#222630", fg="#F3F4F6", relief=tk.FLAT, bd=3)
        self.ip_entry.insert(0, DEFAULT_HOST)
        self.ip_entry.pack(side=tk.LEFT, padx=(0, 12))

        # Port
        tk.Label(self.top_frame, text="Port:", font=("Segoe UI", 9, "bold"), fg="#9CA3AF", bg="#1A1D24").pack(side=tk.LEFT, padx=(0, 4))
        self.port_entry = tk.Entry(self.top_frame, font=("Segoe UI", 9), width=6, bg="#222630", fg="#F3F4F6", relief=tk.FLAT, bd=3)
        self.port_entry.insert(0, str(DEFAULT_CHAT_PORT))
        self.port_entry.pack(side=tk.LEFT, padx=(0, 12))

        # Username
        tk.Label(self.top_frame, text="Username:", font=("Segoe UI", 9, "bold"), fg="#9CA3AF", bg="#1A1D24").pack(side=tk.LEFT, padx=(0, 4))
        self.user_entry = tk.Entry(self.top_frame, font=("Segoe UI", 9), width=14, bg="#222630", fg="#F3F4F6", relief=tk.FLAT, bd=3)
        self.user_entry.insert(0, "Student1")
        self.user_entry.pack(side=tk.LEFT, padx=(0, 16))

        # Connect Button
        self.connect_btn = tk.Button(
            self.top_frame,
            text="⚡ Connect",
            font=("Segoe UI", 9, "bold"),
            bg="#2563EB",
            fg="#FFFFFF",
            activebackground="#1D4ED8",
            activeforeground="#FFFFFF",
            relief=tk.FLAT,
            padx=14,
            pady=3,
            cursor="hand2",
            command=self._on_connect_clicked
        )
        self.connect_btn.pack(side=tk.LEFT, padx=(0, 8))

        # Disconnect Button
        self.disconnect_btn = tk.Button(
            self.top_frame,
            text="Disconnect",
            font=("Segoe UI", 9),
            bg="#374151",
            fg="#D1D5DB",
            activebackground="#4B5563",
            activeforeground="#FFFFFF",
            relief=tk.FLAT,
            padx=12,
            pady=3,
            state=tk.DISABLED,
            cursor="hand2",
            command=self._on_disconnect_clicked
        )
        self.disconnect_btn.pack(side=tk.LEFT, padx=(0, 16))

        # Status Pill Indicator
        self.status_pill = tk.Label(
            self.top_frame,
            text="● Disconnected",
            font=("Segoe UI", 9, "bold"),
            fg="#EF4444",
            bg="#1A1D24"
        )
        self.status_pill.pack(side=tk.RIGHT, padx=4)

    def _build_main_layout(self):
        """Constructs split-view: Main chat area on left, Online users & file status on right."""
        main_split = tk.Frame(self.root, bg="#121418")
        main_split.pack(fill=tk.BOTH, expand=True, padx=14, pady=10)

        # ------------------- LEFT: CHAT AREA -------------------
        chat_container = tk.Frame(main_split, bg="#1A1D24", padx=12, pady=10)
        chat_container.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))

        # Chat Room Header
        self.header_frame = tk.Frame(chat_container, bg="#1A1D24")
        self.header_frame.pack(fill=tk.X, pady=(0, 8))

        self.room_title_lbl = tk.Label(
            self.header_frame,
            text="🌐 Public Chat Room",
            font=("Segoe UI", 11, "bold"),
            fg="#F3F4F6",
            bg="#1A1D24"
        )
        self.room_title_lbl.pack(side=tk.LEFT)

        self.back_to_public_btn = tk.Button(
            self.header_frame,
            text="← Return to Public Room",
            font=("Segoe UI", 8),
            bg="#2D3748",
            fg="#60A5FA",
            relief=tk.FLAT,
            padx=8,
            pady=2,
            cursor="hand2",
            command=self._switch_to_public_chat
        )
        # Hidden initially because public chat is default

        # Scrolled Text for Chat Logs
        self.chat_display = scrolledtext.ScrolledText(
            chat_container,
            wrap=tk.WORD,
            bg="#121418",
            fg="#F3F4F6",
            font=("Segoe UI", 10),
            relief=tk.FLAT,
            bd=0,
            padx=10,
            pady=10
        )
        self.chat_display.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        self.chat_display.config(state=tk.DISABLED)

        # Chat text formatting tags
        self.chat_display.tag_configure("timestamp", foreground="#6B7280", font=("Segoe UI", 8))
        self.chat_display.tag_configure("system", foreground="#FBBF24", font=("Segoe UI", 9, "italic"))
        self.chat_display.tag_configure("error", foreground="#F87171", font=("Segoe UI", 9, "bold"))
        self.chat_display.tag_configure("sender_other", foreground="#60A5FA", font=("Segoe UI", 10, "bold"))
        self.chat_display.tag_configure("sender_me", foreground="#34D399", font=("Segoe UI", 10, "bold"))
        self.chat_display.tag_configure("private_tag", foreground="#C084FC", font=("Segoe UI", 9, "bold"))
        self.chat_display.tag_configure("private_body", foreground="#E9D5FF")
        self.chat_display.tag_configure("content", foreground="#F3F4F6")

        # Bottom Input Area
        input_frame = tk.Frame(chat_container, bg="#1A1D24")
        input_frame.pack(fill=tk.X)

        self.msg_entry = tk.Entry(
            input_frame,
            font=("Segoe UI", 10),
            bg="#222630",
            fg="#F3F4F6",
            insertbackground="#FFFFFF",
            relief=tk.FLAT,
            bd=6
        )
        self.msg_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 8))
        self.msg_entry.bind("<Return>", lambda e: self._on_send_message())

        self.send_btn = tk.Button(
            input_frame,
            text="Send 📤",
            font=("Segoe UI", 9, "bold"),
            bg="#2563EB",
            fg="#FFFFFF",
            activebackground="#1D4ED8",
            activeforeground="#FFFFFF",
            relief=tk.FLAT,
            padx=14,
            pady=4,
            cursor="hand2",
            state=tk.DISABLED,
            command=self._on_send_message
        )
        self.send_btn.pack(side=tk.LEFT, padx=(0, 6))

        self.attach_btn = tk.Button(
            input_frame,
            text="📎 File",
            font=("Segoe UI", 9),
            bg="#374151",
            fg="#F3F4F6",
            activebackground="#4B5563",
            activeforeground="#FFFFFF",
            relief=tk.FLAT,
            padx=12,
            pady=4,
            cursor="hand2",
            state=tk.DISABLED,
            command=self._on_open_file_dialog
        )
        self.attach_btn.pack(side=tk.LEFT)

        # ------------------- RIGHT: SIDEBAR -------------------
        sidebar = tk.Frame(main_split, bg="#1A1D24", width=260, padx=12, pady=10)
        sidebar.pack(side=tk.RIGHT, fill=tk.Y)
        sidebar.pack_propagate(False)

        # Online Users Title
        self.user_count_lbl = tk.Label(
            sidebar,
            text="Online Users (0)",
            font=("Segoe UI", 10, "bold"),
            fg="#F3F4F6",
            bg="#1A1D24"
        )
        self.user_count_lbl.pack(anchor="w", pady=(0, 4))

        tk.Label(
            sidebar,
            text="Double-click to private message",
            font=("Segoe UI", 8),
            fg="#9CA3AF",
            bg="#1A1D24"
        ).pack(anchor="w", pady=(0, 6))

        # Online Users Listbox
        self.users_listbox = tk.Listbox(
            sidebar,
            bg="#121418",
            fg="#F3F4F6",
            selectbackground="#2563EB",
            selectforeground="#FFFFFF",
            font=("Segoe UI", 9),
            relief=tk.FLAT,
            bd=0,
            highlightthickness=0
        )
        self.users_listbox.pack(fill=tk.BOTH, expand=True, pady=(0, 8))
        self.users_listbox.bind("<Double-Button-1>", self._on_user_double_click)

        # Action button under users
        self.direct_file_btn = tk.Button(
            sidebar,
            text="📤 Send File to User",
            font=("Segoe UI", 8, "bold"),
            bg="#2563EB",
            fg="#FFFFFF",
            relief=tk.FLAT,
            padx=6,
            pady=4,
            cursor="hand2",
            state=tk.DISABLED,
            command=self._on_open_file_dialog
        )
        self.direct_file_btn.pack(fill=tk.X, pady=(0, 12))

        # File Transfer Status Widget (Bottom of sidebar)
        self.ft_frame = tk.Frame(sidebar, bg="#222630", padx=10, pady=8, relief=tk.SOLID, bd=1)
        self.ft_frame.pack(fill=tk.X, side=tk.BOTTOM)

        self.ft_title_lbl = tk.Label(
            self.ft_frame,
            text="File Transfers",
            font=("Segoe UI", 9, "bold"),
            fg="#D1D5DB",
            bg="#222630"
        )
        self.ft_title_lbl.pack(anchor="w")

        self.ft_status_lbl = tk.Label(
            self.ft_frame,
            text="Idle (Ready)",
            font=("Segoe UI", 8),
            fg="#9CA3AF",
            bg="#222630"
        )
        self.ft_status_lbl.pack(anchor="w", pady=(2, 4))

        self.ft_progress = ttk.Progressbar(
            self.ft_frame,
            style="Accent.Horizontal.TProgressbar",
            mode="determinate"
        )
        self.ft_progress.pack(fill=tk.X, pady=(0, 4))

        self.ft_cancel_btn = tk.Button(
            self.ft_frame,
            text="Cancel Transfer",
            font=("Segoe UI", 7),
            bg="#EF4444",
            fg="#FFFFFF",
            relief=tk.FLAT,
            state=tk.DISABLED,
            command=self._on_cancel_active_transfer
        )
        self.ft_cancel_btn.pack(anchor="e")

    # ==========================================
    # NETWORK EVENT PROCESSING LOOP
    # ==========================================
    def _process_event_queue(self):
        """Drains events from background worker threads safely into Tkinter main thread."""
        while not self.event_queue.empty():
            try:
                event: NetworkEvent = self.event_queue.get_nowait()
                self._handle_event(event)
            except queue.Empty:
                break
            except Exception as e:
                self._append_system_msg(f"GUI Event Processing Error: {e}")

        # Re-schedule polling loop
        self.root.after(50, self._process_event_queue)

    def _handle_event(self, event: NetworkEvent):
        etype = event.type
        data = event.data

        if etype == "CONNECTED":
            self.current_user = data.get("username", "")
            self.status_pill.config(text=f"● Online ({self.current_user})", fg="#10B981")
            self.connect_btn.config(state=tk.DISABLED)
            self.disconnect_btn.config(state=tk.NORMAL)
            self.send_btn.config(state=tk.NORMAL)
            self.attach_btn.config(state=tk.NORMAL)
            self.direct_file_btn.config(state=tk.NORMAL)
            self.ip_entry.config(state=tk.DISABLED)
            self.port_entry.config(state=tk.DISABLED)
            self.user_entry.config(state=tk.DISABLED)
            self._append_system_msg(f"✅ Connected to server as '{self.current_user}'. File relay ready on port {data.get('file_port')}.")

        elif etype == "DISCONNECTED":
            self.status_pill.config(text="● Disconnected", fg="#EF4444")
            self.connect_btn.config(state=tk.NORMAL)
            self.disconnect_btn.config(state=tk.DISABLED)
            self.send_btn.config(state=tk.DISABLED)
            self.attach_btn.config(state=tk.DISABLED)
            self.direct_file_btn.config(state=tk.DISABLED)
            self.ip_entry.config(state=tk.NORMAL)
            self.port_entry.config(state=tk.NORMAL)
            self.user_entry.config(state=tk.NORMAL)
            self.users_listbox.delete(0, tk.END)
            self.user_count_lbl.config(text="Online Users (0)")
            self._append_system_msg(f"⚠️ {event.message}")

        elif etype == MSG_CHAT:
            sender = data.get("sender", "Unknown")
            content = data.get("content", "")
            timestamp = data.get("timestamp", time.strftime("%H:%M:%S"))
            self._append_chat_msg(sender, content, timestamp, is_private=False)

        elif etype == MSG_PRIVATE_CHAT:
            sender = data.get("sender", "Unknown")
            recipient = data.get("recipient", "")
            content = data.get("content", "")
            timestamp = data.get("timestamp", time.strftime("%H:%M:%S"))
            is_outgoing = (sender.lower() == self.current_user.lower())
            peer = recipient if is_outgoing else sender
            self._append_chat_msg(sender, content, timestamp, is_private=True, peer=peer)

        elif etype == MSG_USER_LIST:
            users = data.get("users", [])
            self.online_users = users
            self._refresh_users_list()

        elif etype == MSG_SYSTEM:
            msg = data.get("message", "")
            self._append_system_msg(msg)

        elif etype == MSG_ERROR:
            err_msg = data.get("message", "An unexpected error occurred.")
            self._append_error_msg(f"Error: {err_msg}")

        elif etype == MSG_FILE_OFFER:
            self._handle_incoming_file_offer(data)

        elif etype == MSG_FILE_READY:
            self._handle_file_ready(data)

        elif etype == MSG_FILE_REJECT:
            recipient = data.get("recipient", "Peer")
            filename = data.get("filename", "file")
            self._append_system_msg(f"❌ User '{recipient}' rejected your file offer for '{filename}'.")
            self._reset_file_transfer_ui("Offer Rejected")

        elif etype == MSG_FILE_CANCEL:
            by_user = data.get("by", "Peer")
            self._append_system_msg(f"⚠️ File transfer was cancelled by '{by_user}'.")
            self._cancel_active_transfers_internal()

    # ==========================================
    # USER ACTIONS (CONNECT, DISCONNECT, CHAT)
    # ==========================================
    def _on_connect_clicked(self):
        host = self.ip_entry.get().strip()
        port_str = self.port_entry.get().strip()
        username = self.user_entry.get().strip()

        if not host:
            messagebox.showerror("Error", "Please provide a valid server IP address.")
            return

        try:
            port = int(port_str)
            if port < 1024 or port > 65535:
                raise ValueError()
        except ValueError:
            messagebox.showerror("Error", "Port must be an integer between 1024 and 65535.")
            return

        is_valid, val_msg = validate_username(username)
        if not is_valid:
            messagebox.showerror("Invalid Username", val_msg)
            return

        self.status_pill.config(text="● Connecting...", fg="#FBBF24")
        self.connect_btn.config(state=tk.DISABLED)

        # Run connection asynchronously so Tkinter never freezes
        def do_connect():
            success, err = self.net_manager.connect(host, port, username)
            if not success:
                self.root.after(0, lambda: self._on_connect_failed(err))

        threading.Thread(target=do_connect, daemon=True).start()

    def _on_connect_failed(self, error_message: str):
        self.status_pill.config(text="● Connection Failed", fg="#EF4444")
        self.connect_btn.config(state=tk.NORMAL)
        messagebox.showerror("Connection Error", error_message)

    def _on_disconnect_clicked(self):
        self.net_manager.disconnect()

    def _on_send_message(self):
        text = self.msg_entry.get().strip()
        if not text or not self.net_manager.is_connected:
            return

        self.msg_entry.delete(0, tk.END)

        if self.private_target:
            # Send targeted private message
            self.net_manager.send_private(self.private_target, text)
        else:
            # Send group broadcast
            self.net_manager.send_chat(text)

    def _switch_to_public_chat(self):
        self.private_target = None
        self.room_title_lbl.config(text="🌐 Public Chat Room", fg="#F3F4F6")
        self.back_to_public_btn.pack_forget()

    def _switch_to_private_chat(self, target_username: str):
        if target_username.lower() == self.current_user.lower():
            return
        self.private_target = target_username
        self.room_title_lbl.config(text=f"🔒 Private Chat with {target_username}", fg="#C084FC")
        self.back_to_public_btn.pack(side=tk.RIGHT)

    def _on_user_double_click(self, event):
        selection = self.users_listbox.curselection()
        if not selection:
            return
        selected_text = self.users_listbox.get(selection[0])
        clean_name = selected_text.replace(" (You)", "").strip()
        if clean_name.lower() != self.current_user.lower():
            self._switch_to_private_chat(clean_name)

    # ==========================================
    # FILE TRANSFER WORKFLOW
    # ==========================================
    def _on_open_file_dialog(self):
        if not self.net_manager.is_connected:
            messagebox.showwarning("Not Connected", "You must connect to the server first.")
            return

        eligible_peers = [u for u in self.online_users if u.lower() != self.current_user.lower()]
        if not eligible_peers:
            messagebox.showinfo("No Peers", "No other users are currently online to send files to.")
            return

        SendFileDialog(
            self.root,
            online_users=self.online_users,
            current_user=self.current_user,
            preselected_user=self.private_target,
            on_send=self._initiate_file_send
        )

    def _initiate_file_send(self, filepath: str, recipient: str, filesize: int, sha256: str):
        filename = sanitize_filename(filepath)
        transfer_id = str(uuid.uuid4())

        self._append_system_msg(f"📤 Offering '{filename}' ({format_bytes(filesize)}) to '{recipient}'...")
        self.ft_status_lbl.config(text=f"Offering to {recipient}...", fg="#F59E0B")
        self.ft_progress["value"] = 0

        # Store transfer metadata pending acceptance
        self._pending_upload = {
            "transfer_id": transfer_id,
            "filepath": filepath,
            "filename": filename,
            "filesize": filesize,
            "sha256": sha256,
            "recipient": recipient
        }

        # Send offer over chat signaling socket
        self.net_manager.send_file_offer(transfer_id, recipient, filename, filesize, sha256)

    def _handle_incoming_file_offer(self, offer_data: dict):
        def on_decision(accepted: bool, save_path: str):
            transfer_id = offer_data.get("transfer_id")
            sender = offer_data.get("sender")
            filename = offer_data.get("filename")
            filesize = offer_data.get("filesize")
            sha256 = offer_data.get("sha256")

            if accepted:
                self._pending_download = {
                    "transfer_id": transfer_id,
                    "save_path": save_path,
                    "filename": filename,
                    "filesize": filesize,
                    "sha256": sha256,
                    "sender": sender
                }
                self._append_system_msg(f"📥 Accepted file offer from '{sender}'. Preparing transfer...")
                self.net_manager.send_file_accept(transfer_id, sender, filename, filesize, sha256)
            else:
                self._append_system_msg(f"Declined file offer from '{sender}'.")
                self.net_manager.send_file_reject(transfer_id, sender, filename)

        FileOfferDialog(self.root, offer_data, on_decision)

    def _handle_file_ready(self, ready_data: dict):
        """Called when server notifies both parties that transfer can proceed on File Relay."""
        transfer_id = ready_data.get("transfer_id")
        file_port = ready_data.get("file_port", self.net_manager.file_port)
        filename = ready_data.get("filename")
        filesize = ready_data.get("filesize")
        sha256 = ready_data.get("sha256")
        sender = ready_data.get("sender")
        recipient = ready_data.get("recipient")

        is_sender = (sender.lower() == self.current_user.lower())

        self.ft_cancel_btn.config(state=tk.NORMAL)

        if is_sender:
            local_path = self._pending_upload.get("filepath", "")
            self.ft_status_lbl.config(text=f"Uploading {filename}...", fg="#3B82F6")

            worker = FileTransferWorker(
                transfer_id=transfer_id,
                is_upload=True,
                filename=filename,
                filesize=filesize,
                expected_sha256=sha256,
                host=self.net_manager.server_host,
                file_port=file_port,
                local_path=local_path,
                on_progress=lambda b, t, p: self.root.after(0, lambda: self._update_progress(p, b, t)),
                on_complete=lambda ok, msg: self.root.after(0, lambda: self._on_transfer_finished(ok, msg, transfer_id))
            )
            self.active_transfers[transfer_id] = worker
            worker.start()

        else:
            # We are the downloader
            save_path = self._pending_download.get("save_path", "")
            self.ft_status_lbl.config(text=f"Downloading {filename}...", fg="#10B981")

            worker = FileTransferWorker(
                transfer_id=transfer_id,
                is_upload=False,
                filename=filename,
                filesize=filesize,
                expected_sha256=sha256,
                host=self.net_manager.server_host,
                file_port=file_port,
                local_path=save_path,
                on_progress=lambda b, t, p: self.root.after(0, lambda: self._update_progress(p, b, t)),
                on_complete=lambda ok, msg: self.root.after(0, lambda: self._on_transfer_finished(ok, msg, transfer_id))
            )
            self.active_transfers[transfer_id] = worker
            worker.start()

    def _update_progress(self, percent: float, current_bytes: int, total_bytes: int):
        self.ft_progress["value"] = percent
        self.ft_status_lbl.config(
            text=f"{percent:.1f}% ({format_bytes(current_bytes)} / {format_bytes(total_bytes)})"
        )

    def _on_transfer_finished(self, success: bool, message: str, transfer_id: str):
        self.active_transfers.pop(transfer_id, None)
        if success:
            self._append_system_msg(f"🎉 {message}")
            self._reset_file_transfer_ui("Completed 100%")
            messagebox.showinfo("File Transfer Complete", message)
        else:
            self._append_error_msg(f"❌ {message}")
            self._reset_file_transfer_ui("Failed / Aborted")

    def _on_cancel_active_transfer(self):
        self._cancel_active_transfers_internal()
        self._reset_file_transfer_ui("Cancelled")

    def _cancel_active_transfers_internal(self):
        for tid, worker in list(self.active_transfers.items()):
            worker.abort()
        self.active_transfers.clear()

    def _reset_file_transfer_ui(self, status_text: str = "Idle (Ready)"):
        self.ft_status_lbl.config(text=status_text, fg="#9CA3AF")
        self.ft_progress["value"] = 0
        self.ft_cancel_btn.config(state=tk.DISABLED)

    # ==========================================
    # DISPLAY HELPERS
    # ==========================================
    def _refresh_users_list(self):
        self.users_listbox.delete(0, tk.END)
        count = len(self.online_users)
        self.user_count_lbl.config(text=f"Online Users ({count})")

        for u in self.online_users:
            display_name = f"👤 {u}"
            if u.lower() == self.current_user.lower():
                display_name += " (You)"
            self.users_listbox.insert(tk.END, display_name)

    def _append_chat_msg(self, sender: str, content: str, timestamp: str, is_private: bool = False, peer: str = ""):
        self.chat_display.config(state=tk.NORMAL)

        # Timestamp
        self.chat_display.insert(tk.END, f"[{timestamp}] ", "timestamp")

        # Sender & tags
        is_me = (sender.lower() == self.current_user.lower())
        sender_tag = "sender_me" if is_me else "sender_other"

        if is_private:
            self.chat_display.insert(tk.END, "[PRIVATE] ", "private_tag")
            if is_me:
                self.chat_display.insert(tk.END, f"You -> {peer}: ", sender_tag)
            else:
                self.chat_display.insert(tk.END, f"{sender} (whisper): ", sender_tag)
            self.chat_display.insert(tk.END, f"{content}\n", "private_body")
        else:
            display_sender = "You" if is_me else sender
            self.chat_display.insert(tk.END, f"{display_sender}: ", sender_tag)
            self.chat_display.insert(tk.END, f"{content}\n", "content")

        self.chat_display.see(tk.END)
        self.chat_display.config(state=tk.DISABLED)

    def _append_system_msg(self, text: str):
        self.chat_display.config(state=tk.NORMAL)
        timestamp = time.strftime("%H:%M:%S")
        self.chat_display.insert(tk.END, f"[{timestamp}] ", "timestamp")
        self.chat_display.insert(tk.END, f"{text}\n", "system")
        self.chat_display.see(tk.END)
        self.chat_display.config(state=tk.DISABLED)

    def _append_error_msg(self, text: str):
        self.chat_display.config(state=tk.NORMAL)
        timestamp = time.strftime("%H:%M:%S")
        self.chat_display.insert(tk.END, f"[{timestamp}] ", "timestamp")
        self.chat_display.insert(tk.END, f"{text}\n", "error")
        self.chat_display.see(tk.END)
        self.chat_display.config(state=tk.DISABLED)

    def _on_window_close(self):
        self._cancel_active_transfers_internal()
        if self.net_manager.is_connected:
            self.net_manager.disconnect()
        self.root.destroy()
