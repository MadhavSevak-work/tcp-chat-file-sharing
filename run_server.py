"""
Convenience launcher to run the TCP Server.
Usage:
    python run_server.py [--host 0.0.0.0] [--port 5000] [--file-port 5001]
"""

from server.main import main

if __name__ == "__main__":
    main()
