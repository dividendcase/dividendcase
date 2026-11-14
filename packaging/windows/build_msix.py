"""Build the Microsoft Store package (.msix) from the wheel. Runs on Windows.

    uv build
    uv run --no-project python packaging/windows/build_msix.py dist/dividendcase-1.0.0-py3-none-any.whl

The package holds its own Python and every library at the versions in uv.lock, so installing
it needs no terminal, no uv and no Python on the computer. Its Start menu entry runs
`pythonw -m dividendcase.desktop --store` (see AppxManifest.xml).

The identity must match the app reserved in Partner Center (Product identity), or the Store
refuses the upload. It comes from three environment variables:

    MSIX_IDENTITY_NAME            Package/Identity/Name
    MSIX_PUBLISHER                Package/Identity/Publisher, "CN=…"
    MSIX_PUBLISHER_DISPLAY_NAME   Package/Properties/PublisherDisplayName

Without them the package gets a test identity: fine for installing on your own PC once it is
signed with a certificate of the same name (CI does that), no use for the Store. The Store
signs the package it publishes, so the upload itself is unsigned.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path
from xml.sax.saxutils import quoteattr

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PYTHON_VERSION = "3.13"
TEST_IDENTITY = {
    "identity_name": "DividendCase.Test",
    "publisher": "CN=DividendCase Test",
    "publisher_display_name": "DividendCase (test build)",
}
# Parts of Python the app never uses
UNUSED = ["tcl", "include", "libs", "Scripts", "Doc", "Lib/tkinter", "Lib/idlelib", "Lib/turtledemo",
          "Lib/ensurepip", "Lib/test", "Lib/EXTERNALLY-MANAGED", "DLLs/tcl86t.dll", "DLLs/tk86t.dll",
          "DLLs/_tkinter.pyd"]


def msix_version(version: str) -> str:
    """1.0.1 → 1.0.1.0: our version, with the fourth part the Store keeps for itself.
    Pre-release tags (.dev0, rc1) are dropped. The Store refuses a first part of 0, which is
    why DividendCase went from 0.4 to 1.0."""
    match = re.match(r"(\d+)\.(\d+)(?:\.(\d+))?", version)
    if not match:
        raise ValueError(f"Can't read the version {version!r}")
    major, minor, patch = (int(part or 0) for part in match.groups())
    if major == 0:
        raise ValueError(f"The Microsoft Store doesn't accept a version that starts with 0 ({version})")
    return f"{major}.{minor}.{patch}.0"


def identity() -> dict[str, str]:
    given = {
        "identity_name": os.environ.get("MSIX_IDENTITY_NAME", "").strip(),
        "publisher": os.environ.get("MSIX_PUBLISHER", "").strip(),
        "publisher_display_name": os.environ.get("MSIX_PUBLISHER_DISPLAY_NAME", "").strip(),
    }
    if not any(given.values()):
        return dict(TEST_IDENTITY)
    missing = [name for name, value in given.items() if not value]
    if missing:
        raise SystemExit(f"Set all three MSIX_* variables or none (missing: {', '.join(missing)})")
    return given


def manifest(version: str, who: dict[str, str]) -> str:
    """AppxManifest.xml with the identity and version filled in."""
    text = (HERE / "AppxManifest.xml").read_text(encoding="utf-8")
    values = {**who, "version": msix_version(version)}
    for key, value in values.items():
        # quoteattr escapes &, < and quotes; the template supplies the surrounding quotes
        text = text.replace("{" + key + "}", quoteattr(value)[1:-1])
    return text


def run(*command: str | Path, check: bool = True) -> None:
    print("+", " ".join(str(part) for part in command), flush=True)
    result = subprocess.run([str(part) for part in command])
    if check and result.returncode:
        raise SystemExit(f"{Path(str(command[0])).name} failed with exit code {result.returncode}")


def sdk_tool(name: str) -> Path:
    """makeappx.exe and makepri.exe from the newest Windows SDK installed."""
    kits = Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Windows Kits" / "10" / "bin"
    found = sorted(kits.glob(f"10.*/x64/{name}"), key=lambda p: [int(n) for n in p.parts[-3].split(".")])
    if not found:
        raise SystemExit(f"{name} not found under {kits}: install the Windows SDK")
    return found[-1]


def bundle_python(stage: Path, wheel: Path, work: Path) -> None:
    """A copy of Python with DividendCase and its libraries installed, ready to run from a
    folder nothing can write to."""
    run("uv", "python", "install", PYTHON_VERSION)
    found = subprocess.run(
        ["uv", "python", "find", "--python-preference", "only-managed", PYTHON_VERSION],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    home = Path(os.path.realpath(found)).parent
    python = stage / "python"
    shutil.copytree(home, python)
    for unused in UNUSED:
        path = python / unused
        if path.is_dir():
            shutil.rmtree(path)
        elif path.exists():
            path.unlink()

    # The same library versions as uv.lock, with the notification-area icon's (the desktop extra)
    constraints = work / "constraints.txt"
    run("uv", "export", "--frozen", "--no-dev", "--no-emit-project", "--no-hashes", "--extra", "desktop",
        "--format", "requirements-txt", "-o", constraints, "--directory", ROOT)
    run("uv", "pip", "install", "--python", python / "python.exe", "--break-system-packages",
        "--constraint", constraints, f"dividendcase[desktop] @ {wheel.resolve().as_uri()}")

    site = python / "Lib" / "site-packages"
    for leftover in [*site.glob("pip"), *site.glob("pip-*.dist-info"), python / "Scripts"]:
        shutil.rmtree(leftover, ignore_errors=True)  # command launchers hold this build's paths
    for cache in python.rglob("__pycache__"):
        shutil.rmtree(cache, ignore_errors=True)
    # The installed package is read-only, so Python can't save compiled files on first use and
    # would compile every module at every start. Compile now; "unchecked-hash" files stay valid
    # whatever dates the files get when they are installed. A few libraries carry files that
    # aren't meant to compile, so failures here don't stop the build.
    run(python / "python.exe", "-I", "-m", "compileall", "-q", "--invalidation-mode", "unchecked-hash",
        python / "Lib", check=False)
    # It starts, from the folder it was copied to
    run(python / "python.exe", "-I", "-c",
        "import dividendcase.desktop, dividendcase.main, pystray, PIL; print('bundle imports ok')")


def resource_index(stage: Path, work: Path) -> None:
    """resources.pri: lets Windows pick Square44x44Logo.targetsize-32.png and friends when the
    manifest says Square44x44Logo.png. Indexed from a folder holding only the icons, or every
    file of Python would be listed as a resource."""
    makepri = sdk_tool("makepri.exe")
    project = work / "pri"
    shutil.copytree(stage / "Assets", project / "Assets")
    shutil.copy(stage / "AppxManifest.xml", project / "AppxManifest.xml")
    config = work / "priconfig.xml"
    run(makepri, "createconfig", "/cf", config, "/dq", "en-US", "/o")
    # The default config splits scales and languages into extra .pri files; keep one
    text = config.read_text(encoding="utf-8")
    config.write_text(re.sub(r"<packaging>.*?</packaging>", "", text, flags=re.S), encoding="utf-8")
    run(makepri, "new", "/pr", project, "/cf", config, "/mn", project / "AppxManifest.xml",
        "/of", stage / "resources.pri", "/o")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("wheel", type=Path, help="the built wheel, dist/dividendcase-<version>-py3-none-any.whl")
    parser.add_argument("--out", type=Path, default=ROOT / "dist", help="folder for the .msix (default dist/)")
    args = parser.parse_args()
    if sys.platform != "win32":
        raise SystemExit("The Microsoft Store package can only be built on Windows.")

    version = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))["project"]["version"]
    who = identity()
    work = ROOT / "build" / "msix"
    shutil.rmtree(work, ignore_errors=True)
    stage = work / "package"
    stage.mkdir(parents=True)

    bundle_python(stage, args.wheel, work)
    shutil.copytree(HERE / "assets", stage / "Assets")
    (stage / "AppxManifest.xml").write_text(manifest(version, who), encoding="utf-8")
    resource_index(stage, work)

    args.out.mkdir(parents=True, exist_ok=True)
    package = args.out / f"DividendCase-{version}-x64.msix"
    run(sdk_tool("makeappx.exe"), "pack", "/d", stage, "/p", package, "/o")
    size = package.stat().st_size / 1_000_000
    print(f"{package} ({size:.0f} MB), version {msix_version(version)}, publisher {who['publisher']}")
    if who == TEST_IDENTITY:
        print("Test identity: not for the Store. Set MSIX_IDENTITY_NAME, MSIX_PUBLISHER and "
              "MSIX_PUBLISHER_DISPLAY_NAME for that.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
