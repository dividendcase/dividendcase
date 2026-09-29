"""Start an installed `dividendcase` and check it works, then stop it.

    python scripts/smoke_test.py                 # the `dividendcase` on PATH
    python scripts/smoke_test.py uvx --from dist/dividendcase-0.1.0-py3-none-any.whl dividendcase

Runs with a temporary data folder and no network jobs, so it never touches real data.
CI runs it on Linux, macOS and Windows against the built wheel. Locally, pass the full path
to the installed command: `uv run` puts this repository's own environment first on PATH, so
a bare `dividendcase` would test the development copy instead.
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

PORT = 8799
BASE = f"http://127.0.0.1:{PORT}"


def get(path: str) -> tuple[int, bytes]:
    try:
        with urllib.request.urlopen(BASE + path, timeout=10) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def check(label: str, ok: bool, detail: str = "") -> bool:
    print(f"{'ok  ' if ok else 'FAIL'} {label}{f' ({detail})' if detail else ''}")
    return ok


def main() -> int:
    command = sys.argv[1:] or ["dividendcase"]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as data:
        env = {
            **os.environ,
            "DIVIDENDCASE_DATA_DIR": data,
            "DIVIDENDCASE_AUTO_REFRESH": "false",
            "DIVIDENDCASE_CHECK_UPDATES": "false",
        }
        server = subprocess.Popen([*command, "--no-browser", "--port", str(PORT)], env=env)
        try:
            deadline = time.time() + 120  # the first run of uvx may install dependencies
            while True:
                if server.poll() is not None:
                    print(f"FAIL the app exited with code {server.returncode}")
                    return 1
                try:
                    status, body = get("/health")
                    if status == 200:
                        break
                except (urllib.error.URLError, ConnectionError, TimeoutError):
                    pass
                if time.time() > deadline:
                    print("FAIL the app didn't answer within two minutes")
                    return 1
                time.sleep(0.5)

            results = [check("health", json.loads(body).get("status") == "ok", json.loads(body).get("version", ""))]
            for page in ["/dashboard/", "/dashboard/screener/", "/dashboard/stock/", "/dashboard/settings/"]:
                status, body = get(page)
                results.append(check(f"page {page}", status == 200 and b"<html" in body[:500].lower(), str(status)))
            status, body = get("/api/v1/user/preferences")
            results.append(check("database created and migrated", status == 200 and b"home_currency" in body, str(status)))
            status, body = get("/api/v1/app-info")
            results.append(check("app info", status == 200 and json.loads(body).get("data_dir") == data))
            status, _ = get("/api/v1/fx/rates")
            results.append(check("exchange rates endpoint", status == 200, str(status)))

            # Running it a second time opens the running app instead of failing on the port
            again = subprocess.run(
                [*command, "--no-browser", "--port", str(PORT)], env=env, capture_output=True, text=True, timeout=120
            )
            results.append(check("second start says it's already running",
                                 again.returncode == 0 and "already running" in again.stdout, again.stdout.strip()[:80]))
            backups = os.path.join(data, "backups")
            results.append(check("no backup for a new, empty database", not os.path.exists(backups)))
            return 0 if all(results) else 1
        finally:
            server.terminate()
            try:
                server.wait(timeout=30)
            except subprocess.TimeoutExpired:
                server.kill()


if __name__ == "__main__":
    sys.exit(main())
