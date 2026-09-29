"""`dividendcase` command: start the local server and open it in the browser."""
import argparse
import json
import socket
import sys
import threading
import urllib.request
import webbrowser

import uvicorn

from dividendcase import __version__
from dividendcase.config import settings


def _port_in_use(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def _running_version(host: str, port: int) -> str | None:
    """The version of DividendCase already answering on this port, if it is DividendCase."""
    try:
        with urllib.request.urlopen(f"http://{host}:{port}/health", timeout=2) as resp:
            body = json.load(resp)
        return body.get("version") if body.get("status") == "ok" else None
    except Exception:
        return None


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="dividendcase",
        description="Run DividendCase on this computer. Your data stays in "
                    f"{settings.data_dir}.",
    )
    parser.add_argument("--port", type=int, default=settings.port, help=f"port to listen on (default {settings.port})")
    parser.add_argument("--no-browser", action="store_true", help="don't open the browser")
    parser.add_argument("--version", action="version", version=f"dividendcase {__version__}")
    args = parser.parse_args()

    url = f"http://{settings.host}:{args.port}/dashboard/"

    if _port_in_use(settings.host, args.port):
        running = _running_version(settings.host, args.port)
        if running is None:
            sys.exit(
                f"Port {args.port} is used by another program. "
                f"Start DividendCase on another one, for example: dividendcase --port {args.port + 1}"
            )
        print(f"DividendCase {running} is already running at {url}")
        if running != __version__:
            print(f"(This is {__version__}; stop the running one first to use it.)")
        if not args.no_browser:
            webbrowser.open(url)
        return

    print(f"DividendCase {__version__} is running at {url}")
    print(f"Your data: {settings.data_dir}")
    print("Press Ctrl+C to stop.")

    if not args.no_browser:
        threading.Timer(1.5, webbrowser.open, args=(url,)).start()

    # Bound to 127.0.0.1 only: nothing on the network can reach it
    uvicorn.run("dividendcase.main:app", host=settings.host, port=args.port,
                log_level=settings.log_level.lower())


if __name__ == "__main__":
    main()
