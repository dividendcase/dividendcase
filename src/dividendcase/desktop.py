"""DividendCase without a terminal: what the Windows app's Start menu shortcut runs.

    pythonw -m dividendcase.desktop --store

The server runs in the background, the browser opens once it answers, and an icon in the
notification area offers Open and Quit. Starting it a second time opens the copy already
running. Messages that `dividendcase` prints in a terminal go to dividendcase.log in the
data folder, since a windowless program has nowhere to print.
"""
import argparse
import os
import sys
import threading
import webbrowser
from pathlib import Path

LOG_NAME = "dividendcase.log"
LOG_MAX_BYTES = 1_000_000
ICON = Path(__file__).parent / "assets" / "tray.png"


def _log_to_file(data_dir: Path) -> None:
    """pythonw has no stdout or stderr (they are None, and printing would fail)."""
    data_dir.mkdir(parents=True, exist_ok=True)
    log = data_dir / LOG_NAME
    if log.exists() and log.stat().st_size > LOG_MAX_BYTES:
        log.replace(log.with_suffix(".log.1"))  # keep one older file
    stream = open(log, "a", buffering=1, encoding="utf-8", errors="replace")
    sys.stdout = sys.stderr = stream


def _tell(message: str) -> None:
    """A message the user must see: a dialog on Windows, the log elsewhere."""
    print(message, flush=True)
    if sys.platform == "win32":
        import ctypes

        ctypes.windll.user32.MessageBoxW(None, message, "DividendCase", 0x30)  # warning icon, OK


def _tray(url: str, quit_app) -> bool:
    """Show the notification-area icon and block until Quit. False if it can't be shown
    (pystray and Pillow come with the Windows app, not with the Python package)."""
    try:
        import pystray
        from PIL import Image

        image = Image.open(ICON)
    except Exception as e:
        print(f"No notification-area icon: {e}", flush=True)
        return False

    def on_quit(icon, _item):
        quit_app()
        icon.stop()

    icon = pystray.Icon(
        "DividendCase",
        image,
        "DividendCase",
        menu=pystray.Menu(
            pystray.MenuItem("Open DividendCase", lambda: webbrowser.open(url), default=True),
            pystray.MenuItem("Quit", on_quit),
        ),
    )
    try:
        icon.run()
    except Exception as e:
        print(f"The notification-area icon stopped: {e}", flush=True)
        return False
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="dividendcase.desktop", description=__doc__.splitlines()[0])
    parser.add_argument("--port", type=int, default=None)
    parser.add_argument("--no-browser", action="store_true", help="don't open the browser")
    parser.add_argument("--no-tray", action="store_true", help="no notification-area icon")
    parser.add_argument("--store", action="store_true", help="installed from the Microsoft Store")
    args = parser.parse_args(argv)

    if args.store:
        # Before the settings are read: updates come from the Store, not from PyPI
        os.environ.setdefault("DIVIDENDCASE_INSTALL_METHOD", "store")

    from dividendcase import __version__
    from dividendcase.cli import _open_when_ready, _port_in_use, _running_version
    from dividendcase.config import settings

    if sys.stdout is None or sys.stderr is None:
        _log_to_file(settings.data_dir)

    port = args.port or settings.port
    local = "127.0.0.1" if settings.host in ("0.0.0.0", "::") else settings.host
    url = f"http://{local}:{port}/dashboard/"

    if _port_in_use(local, port):
        running = _running_version(local, port)
        if running is None:
            _tell(
                f"DividendCase can't start: another program is using port {port} on this computer. "
                "Close that program, then open DividendCase again."
            )
            return 1
        print(f"DividendCase {running} is already running at {url}", flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        return 0

    import uvicorn

    print(f"Starting DividendCase {__version__} at {url}", flush=True)
    print(f"Your data: {settings.data_dir}", flush=True)
    server = uvicorn.Server(uvicorn.Config(
        "dividendcase.main:app", host=settings.host, port=port, log_level=settings.log_level.lower(),
    ))
    # The notification-area icon needs the main thread, so the server takes another one
    # (uvicorn leaves Ctrl+C handling alone when it isn't on the main thread)
    stopped = threading.Event()

    def serve() -> None:
        try:
            server.run()
        finally:
            stopped.set()

    threading.Thread(target=serve, name="dividendcase-server").start()

    if not args.no_browser:
        threading.Thread(target=_open_when_ready, args=(url, local, port), daemon=True).start()

    def quit_app() -> None:
        server.should_exit = True

    try:
        if args.no_tray or not _tray(url, quit_app):
            # No icon to quit from: run until the server stops (signing out, or Ctrl+C).
            # An event, not Thread.join: after Ctrl+C interrupts a join, the next join returns
            # at once, and the app would exit without closing the database.
            while not stopped.wait(timeout=0.5):
                pass
    except KeyboardInterrupt:
        pass
    finally:
        quit_app()
        stopped.wait(timeout=30)  # the server finishes requests and closes the database
    return 0


if __name__ == "__main__":
    sys.exit(main())
