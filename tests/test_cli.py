"""The `dividendcase` command waits for the app before opening the browser."""
import socket
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from dividendcase import cli


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_waits_and_gives_up_when_nothing_answers():
    assert cli.wait_until_ready("127.0.0.1", _free_port(), timeout=0.6) is False


def test_ready_once_dividendcase_answers():
    class Health(BaseHTTPRequestHandler):
        def do_GET(self):
            body = b'{"status": "ok", "version": "9.9.9"}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Health)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        port = server.server_address[1]
        assert cli.wait_until_ready("127.0.0.1", port, timeout=5) is True
        assert cli._running_version("127.0.0.1", port) == "9.9.9"
    finally:
        server.shutdown()


def test_another_program_on_the_port_is_not_dividendcase():
    class Other(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(404)
            self.end_headers()

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Other)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        assert cli._running_version("127.0.0.1", server.server_address[1]) is None
    finally:
        server.shutdown()
