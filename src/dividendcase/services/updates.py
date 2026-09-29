"""Tells the user when a newer DividendCase is out.

Once a day, unless the user has turned it off in Settings, the app asks PyPI's public JSON API
for the list of released versions. The request carries nothing about the user or their
portfolio: PyPI sees an IP address and the app's version, as with any download.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Iterable, Optional

import requests
from packaging.version import InvalidVersion, Version
from sqlalchemy import select

from dividendcase import __version__
from dividendcase.api.v1.deps import LOCAL_USER_ID
from dividendcase.database import AsyncSessionLocal
from dividendcase.models import UserPreferences

logger = logging.getLogger(__name__)

PYPI_URL = "https://pypi.org/pypi/dividendcase/json"
UPGRADE_COMMAND = "uv tool upgrade dividendcase"
RELEASES_URL = "https://github.com/dividendcase/dividendcase/releases"

_latest: dict = {"version": None, "checked_at": None}


def newest_release(versions: Iterable[str], current: str) -> Optional[str]:
    """The highest released version, skipping pre-releases unless this build is one."""
    try:
        allow_pre = Version(current).is_prerelease
    except InvalidVersion:
        allow_pre = False
    parsed = []
    for v in versions:
        try:
            version = Version(v)
        except InvalidVersion:
            continue
        if version.is_prerelease and not allow_pre:
            continue
        parsed.append(version)
    return str(max(parsed)) if parsed else None


def is_newer(latest: Optional[str], current: str) -> bool:
    if not latest:
        return False
    try:
        return Version(latest) > Version(current)
    except InvalidVersion:
        return False


def _fetch_versions() -> list[str]:
    resp = requests.get(PYPI_URL, timeout=10, headers={"User-Agent": f"dividendcase/{__version__}"})
    if resp.status_code == 404:
        return []  # not published yet
    resp.raise_for_status()
    releases = resp.json().get("releases", {})
    # A release counts if it has at least one file that hasn't been yanked
    return [v for v, files in releases.items() if any(not f.get("yanked") for f in files)]


async def _wanted() -> bool:
    async with AsyncSessionLocal() as db:
        prefs = (await db.execute(
            select(UserPreferences).where(UserPreferences.user_id == LOCAL_USER_ID)
        )).scalar_one_or_none()
    return prefs is None or bool(prefs.check_for_updates)


async def check_for_update() -> Optional[str]:
    """Ask PyPI for the newest version (if the user allows it) and remember the answer."""
    if not await _wanted():
        forget()
        return None
    try:
        versions = await asyncio.to_thread(_fetch_versions)
    except Exception as e:  # offline, PyPI down: try again tomorrow
        logger.info("Couldn't check for a newer version: %s", e)
        return _latest["version"]
    _latest["version"] = newest_release(versions, __version__)
    _latest["checked_at"] = datetime.now(timezone.utc)
    if is_newer(_latest["version"], __version__):
        logger.info("DividendCase %s is available (this is %s)", _latest["version"], __version__)
    return _latest["version"]


_tasks: set = set()


def check_soon() -> None:
    """Start a check in the background (after the user turns checking back on)."""
    task = asyncio.create_task(check_for_update())
    _tasks.add(task)  # keep a reference until it finishes
    task.add_done_callback(_tasks.discard)


def forget() -> None:
    _latest["version"] = None
    _latest["checked_at"] = None


def update_status() -> dict:
    checked = _latest["checked_at"]
    return {
        "latest_version": _latest["version"],
        "update_available": is_newer(_latest["version"], __version__),
        "update_checked_at": checked.isoformat() if checked else None,
        "upgrade_command": UPGRADE_COMMAND,
        "releases_url": RELEASES_URL,
    }
