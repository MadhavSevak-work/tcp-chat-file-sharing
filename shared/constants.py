"""
Global constants for the TCP Chat and File Sharing System.
Used across both the server and client components.
"""

# Networking defaults
DEFAULT_HOST = "127.0.0.1"
DEFAULT_CHAT_PORT = 5000
DEFAULT_FILE_PORT = 5001

# Buffer and Framing sizes
HEADER_SIZE = 4                  # 4-byte big-endian unsigned integer prefix (!I)
BUFFER_SIZE = 4096               # General receive buffer
CHUNK_SIZE = 64 * 1024           # 64 KB chunk size for efficient binary file streaming
MAX_MESSAGE_SIZE = 10 * 1024 * 1024 # 10 MB max control/chat payload size
MAX_FILE_SIZE = 100 * 1024 * 1024   # 100 MB max supported file transfer size
SOCKET_TIMEOUT = 10.0            # Socket timeout in seconds

# Protocol Message Types
MSG_CONNECT = "CONNECT"
MSG_CONNECT_ACK = "CONNECT_ACK"
MSG_DISCONNECT = "DISCONNECT"
MSG_CHAT = "CHAT"
MSG_PRIVATE_CHAT = "PRIVATE_CHAT"
MSG_USER_LIST = "USER_LIST"
MSG_SYSTEM = "SYSTEM"
MSG_ERROR = "ERROR"

# File Transfer Signaling Message Types
MSG_FILE_OFFER = "FILE_OFFER"
MSG_FILE_ACCEPT = "FILE_ACCEPT"
MSG_FILE_REJECT = "FILE_REJECT"
MSG_FILE_READY = "FILE_READY"
MSG_FILE_CANCEL = "FILE_CANCEL"
MSG_FILE_PROGRESS = "FILE_PROGRESS"
MSG_FILE_COMPLETE = "FILE_COMPLETE"
MSG_FILE_CHUNK = "FILE_CHUNK"
MAX_WS_PAYLOAD = 105 * 1024 * 1024  # 105 MB WebSocket maxPayload to prevent close code 1009

# Validation constraints
MIN_USERNAME_LENGTH = 2
MAX_USERNAME_LENGTH = 20
USERNAME_REGEX = r"^[a-zA-Z0-9_\-\.]{2,20}$"
