"""The Windows app: the windowless launcher (dividendcase.desktop), what a Microsoft Store
install changes, and the parts of the package build that don't need Windows."""
import importlib.util
import sys
import types
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from dividendcase import desktop

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def opened(monkeypatch):
    """The addresses the launcher asked the browser to open."""
    urls: list[str] = []
    monkeypatch.setattr(desktop.webbrowser, "open", urls.append)
    return urls


def test_second_start_opens_the_running_app(monkeypatch, opened, capsys):
    from dividendcase import cli

    monkeypatch.setattr(cli, "_port_in_use", lambda host, port: True)
    monkeypatch.setattr(cli, "_running_version", lambda host, port: "9.9.9")
    assert desktop.main(["--port", "8799"]) == 0
    assert opened == ["http://127.0.0.1:8799/dashboard/"]
    assert "already running" in capsys.readouterr().out


def test_port_taken_by_another_program_is_explained(monkeypatch, opened):
    from dividendcase import cli

    told: list[str] = []
    monkeypatch.setattr(cli, "_port_in_use", lambda host, port: True)
    monkeypatch.setattr(cli, "_running_version", lambda host, port: None)
    monkeypatch.setattr(desktop, "_tell", told.append)
    assert desktop.main(["--port", "8799"]) == 1
    assert opened == [] and "port 8799" in told[0]


def test_tray_icon_opens_and_quits(monkeypatch, opened):
    """With stand-ins for pystray and Pillow: Open is the default action, Quit stops the app."""
    made = {}

    class Icon:
        def __init__(self, name, image, title, menu):
            made.update(title=title, items=menu, stopped=False)

        def run(self):
            open_item, quit_item = made["items"]
            assert open_item["default"] and open_item["text"] == "Open DividendCase"
            open_item["action"]()
            quit_item["action"](self, quit_item)

        def stop(self):
            made["stopped"] = True

    pystray = types.SimpleNamespace(
        Icon=Icon,
        Menu=lambda *items: items,
        MenuItem=lambda text, action, default=False: {"text": text, "action": action, "default": default},
    )
    monkeypatch.setitem(sys.modules, "pystray", pystray)
    monkeypatch.setitem(sys.modules, "PIL", types.SimpleNamespace(Image=types.SimpleNamespace(open=lambda path: path)))
    quits: list[bool] = []
    assert desktop._tray("http://127.0.0.1:8765/dashboard/", lambda: quits.append(True)) is True
    assert opened == ["http://127.0.0.1:8765/dashboard/"]
    assert quits == [True] and made["stopped"] and made["title"] == "DividendCase"


def test_without_pystray_there_is_no_icon_and_no_crash(monkeypatch):
    monkeypatch.setitem(sys.modules, "pystray", None)  # importing it fails
    assert desktop._tray("http://127.0.0.1:8765/dashboard/", lambda: None) is False


def test_tray_icon_file_ships_with_the_package():
    assert desktop.ICON.is_file()


def test_windowless_output_goes_to_a_log_file(tmp_path, monkeypatch):
    monkeypatch.setattr(sys, "stdout", None)
    monkeypatch.setattr(sys, "stderr", None)
    log = tmp_path / "data" / desktop.LOG_NAME
    log.parent.mkdir()
    log.write_text("x" * (desktop.LOG_MAX_BYTES + 1))
    desktop._log_to_file(log.parent)
    stream = sys.stdout
    try:
        print("hello")
        assert sys.stderr is stream
    finally:
        stream.close()
    assert log.read_text() == "hello\n"
    assert log.with_suffix(".log.1").stat().st_size > desktop.LOG_MAX_BYTES  # the older file is kept


def test_store_installs_leave_updates_to_the_store(client, monkeypatch):
    from dividendcase.config import settings
    from dividendcase.services import updates

    def no_request():
        raise AssertionError("a Store install mustn't ask PyPI")

    monkeypatch.setattr(settings, "install_method", "store")
    monkeypatch.setattr(updates, "_fetch_versions", no_request)
    assert client.portal.call(updates.check_for_update) is None
    info = client.get("/api/v1/app-info").json()
    assert info["install_method"] == "store"
    assert info["upgrade_command"] == "" and info["update_available"] is False


# The package build (packaging/windows/build_msix.py)

@pytest.fixture(scope="module")
def build_msix():
    spec = importlib.util.spec_from_file_location("build_msix", ROOT / "packaging" / "windows" / "build_msix.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("version, expected", [
    ("1.0.0", "1.0.0.0"),
    ("1.0.1", "1.0.1.0"),
    ("1.0.0.dev0", "1.0.0.0"),
    ("2.3.0rc1", "2.3.0.0"),
    ("1.2", "1.2.0.0"),
])
def test_store_version_is_ours(build_msix, version, expected):
    assert build_msix.msix_version(version) == expected


def test_store_refuses_a_version_starting_with_zero(build_msix):
    with pytest.raises(ValueError, match="starts with 0"):
        build_msix.msix_version("0.5.0")


def test_identity_is_all_or_nothing(build_msix, monkeypatch):
    for name in ("MSIX_IDENTITY_NAME", "MSIX_PUBLISHER", "MSIX_PUBLISHER_DISPLAY_NAME"):
        monkeypatch.delenv(name, raising=False)
    assert build_msix.identity() == build_msix.TEST_IDENTITY
    monkeypatch.setenv("MSIX_PUBLISHER", "CN=1234")
    with pytest.raises(SystemExit, match="identity_name"):
        build_msix.identity()


def test_manifest_is_filled_in_and_names_icons_that_exist(build_msix):
    who = {"identity_name": "12345Example.DividendCase", "publisher": "CN=ABC, O=R&D",
           "publisher_display_name": "Example <dev>"}
    text = build_msix.manifest("1.0.0", who)
    assert "{" not in text.split("-->", 1)[1]  # nothing left to fill in
    ns = {"m": "http://schemas.microsoft.com/appx/manifest/foundation/windows10",
          "uap": "http://schemas.microsoft.com/appx/manifest/uap/windows10"}
    package = ET.fromstring(text)
    ident = package.find("m:Identity", ns)
    assert ident.attrib == {"Name": who["identity_name"], "Publisher": who["publisher"],
                            "Version": "1.0.0.0", "ProcessorArchitecture": "x64"}
    assert package.find("m:Properties/m:PublisherDisplayName", ns).text == who["publisher_display_name"]
    app = package.find("m:Applications/m:Application", ns)
    params = app.attrib["{http://schemas.microsoft.com/appx/manifest/uap/windows10/10}Parameters"]
    assert app.attrib["Executable"] == r"python\pythonw.exe" and params.endswith("-m dividendcase.desktop --store")
    # Each logo the manifest names has files at the scales Windows asks for
    assets = ROOT / "packaging" / "windows" / "assets"
    visual = app.find("uap:VisualElements", ns)
    logos = [package.find("m:Properties/m:Logo", ns).text, visual.attrib["Square150x150Logo"], visual.attrib["Square44x44Logo"]]
    for logo in logos:
        stem = logo.split("\\")[-1].removesuffix(".png")
        assert (assets / f"{stem}.scale-100.png").is_file() and (assets / f"{stem}.scale-200.png").is_file()
