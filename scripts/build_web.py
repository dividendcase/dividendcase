"""Build the interface and copy it into the Python package.

    uv run python scripts/build_web.py

Installs the npm workspaces (frontend/, site/ and packages/) from the repository root if
needed, builds frontend/ (a Next.js static export to frontend/out/), then replaces
src/dividendcase/web/ with the result so `dividendcase` can serve it and the wheel ships it.
"""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
OUT = FRONTEND / "out"
WEB = ROOT / "src" / "dividendcase" / "web"


def run(*cmd: str) -> None:
    print("$", " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)


def main() -> None:
    npm = shutil.which("npm")
    if not npm:
        sys.exit("npm is required to build the interface (Node.js 20.9 or newer)")
    if not (ROOT / "node_modules").exists():
        run(npm, "ci", "--no-audit", "--no-fund")
    run(npm, "run", "build", "--workspace", "frontend")
    if not (OUT / "index.html").exists():
        sys.exit(f"Build finished but {OUT / 'index.html'} is missing")

    for item in WEB.iterdir():
        if item.name != ".gitkeep":
            shutil.rmtree(item) if item.is_dir() else item.unlink()
    shutil.copytree(OUT, WEB, dirs_exist_ok=True)
    files = sum(1 for p in WEB.rglob("*") if p.is_file())
    print(f"Copied {files} files into {WEB.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
