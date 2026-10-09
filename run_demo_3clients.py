"""
Multi-Client Demo Launcher for College Project Presentation.

Spawns 3 client windows (Alice, Bob, and Charlie) connecting to localhost.
Ensure 'python run_server.py' is running before launching this script,
or it will launch and let you hit 'Connect' on each window.
"""

import subprocess
import sys
import time

def main():
    print("=" * 60)
    print("Launching 3 Desktop Client Instances for Live Demo...")
    print("Make sure 'python run_server.py' is running in another terminal!")
    print("=" * 60)

    users = ["Alice", "Bob", "Charlie"]
    procs = []

    for user in users:
        print(f"Launching client window for: {user}...")
        proc = subprocess.Popen([sys.executable, "run_client.py", "--username", user])
        procs.append(proc)
        time.sleep(0.4)

    print("\nAll 3 client windows launched!")
    print("Press Ctrl+C in this terminal to close all demo client windows.")

    try:
        for p in procs:
            p.wait()
    except KeyboardInterrupt:
        print("\nClosing client processes...")
        for p in procs:
            p.terminate()

if __name__ == "__main__":
    main()
