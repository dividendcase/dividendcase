"""Keeps the user's database file up to date with the app.

`upgrade_database()` runs when the app starts. It brings the SQLite file up to the newest
migration, and before changing a file that already holds data it saves a copy in
<data folder>/backups/ with SQLite's VACUUM INTO. The newest few copies are kept.

For developers:
    uv run python -m dividendcase.migrate new "add a column"   # autogenerate from the models
    uv run python -m dividendcase.migrate check                 # models and migrations agree?
"""
import logging
import sqlite3
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import make_url

logger = logging.getLogger(__name__)
# Alembic narrates every step at INFO; the app logs the outcome itself
logging.getLogger("alembic").setLevel(logging.WARNING)

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
# Databases made by 0.1.0.dev builds (tables from create_all, no alembic_version) match this
BASELINE = "0001"
KEEP_BACKUPS = 5


def sync_url(database_url: str) -> str:
    """Alembic runs synchronously: sqlite+aiosqlite:///x.db → sqlite:///x.db."""
    return database_url.replace("+aiosqlite", "")


def _config(url: str) -> Config:
    cfg = Config()
    # Config values go through ConfigParser, which treats % as special
    cfg.set_main_option("script_location", str(MIGRATIONS_DIR).replace("%", "%%"))
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    return cfg


def head_revision() -> str:
    return ScriptDirectory.from_config(_config("sqlite://")).get_current_head()


def current_revision(database_url: str) -> Optional[str]:
    engine = create_engine(sync_url(database_url))
    try:
        with engine.connect() as conn:
            return MigrationContext.configure(conn).get_current_revision()
    finally:
        engine.dispose()


def upgrade_database(database_url: str, backup_dir: Path) -> Optional[Path]:
    """Bring the database up to the newest migration. Returns the backup file, if one was made."""
    url = sync_url(database_url)
    cfg = _config(url)
    head = ScriptDirectory.from_config(cfg).get_current_head()
    engine = create_engine(url)
    try:
        with engine.connect() as conn:
            current = MigrationContext.configure(conn).get_current_revision()
            tables = set(inspect(conn).get_table_names()) - {"alembic_version"}

        if current is None and tables:
            # Made before migrations existed: the tables already match the baseline
            with engine.begin() as conn:
                cfg.attributes["connection"] = conn
                command.stamp(cfg, BASELINE)
            current = BASELINE
            logger.info("Marked the existing database as migration %s", BASELINE)

        if current == head:
            return None

        backup = None
        if tables and engine.dialect.name == "sqlite":
            backup = backup_database(url, backup_dir, label=f"before-{head}")

        with engine.begin() as conn:
            cfg.attributes["connection"] = conn
            command.upgrade(cfg, "head")
        logger.info("Database upgraded from %s to %s", current or "empty", head)
        return backup
    finally:
        engine.dispose()


def backup_database(url: str, backup_dir: Path, label: str) -> Path:
    """Copy the SQLite file with VACUUM INTO (safe while the app runs) and prune old copies."""
    source = make_url(sync_url(url)).database
    backup_dir.mkdir(parents=True, exist_ok=True)
    target = backup_dir / f"dividendcase-{datetime.now():%Y%m%d-%H%M%S}-{label}.db"
    conn = sqlite3.connect(source)
    try:
        conn.execute("VACUUM INTO ?", (str(target),))
    finally:
        conn.close()
    logger.info("Saved a copy of the database to %s", target)

    copies = sorted(backup_dir.glob("dividendcase-*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in copies[KEEP_BACKUPS:]:
        old.unlink(missing_ok=True)
    return target


def schema_differences(database_url: str) -> list:
    """Differences between the models and a database migrated to head (empty when they agree)."""
    import dividendcase.models  # noqa: F401
    from dividendcase.database import Base

    engine = create_engine(sync_url(database_url))
    try:
        with engine.connect() as conn:
            ctx = MigrationContext.configure(conn, opts={"compare_type": True})
            return compare_metadata(ctx, Base.metadata)
    finally:
        engine.dispose()


def _scratch_url(folder: str) -> str:
    return f"sqlite:///{Path(folder) / 'scratch.db'}"


def _main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "new":
        # Autogenerate against a scratch database migrated to head, so only the new changes appear
        with tempfile.TemporaryDirectory() as folder:
            url = _scratch_url(folder)
            upgrade_database(url, Path(folder) / "backups")
            cfg = _config(url)
            revisions = ScriptDirectory.from_config(cfg).get_revisions("head")
            next_id = f"{int(revisions[0].revision) + 1:04d}" if revisions else BASELINE
            command.revision(cfg, message=" ".join(argv[1:]), autogenerate=True, rev_id=next_id)
        return 0
    if argv == ["check"]:
        with tempfile.TemporaryDirectory() as folder:
            url = _scratch_url(folder)
            upgrade_database(url, Path(folder) / "backups")
            diffs = schema_differences(url)
        for diff in diffs:
            print(diff)
        print("Models and migrations agree" if not diffs else f"{len(diffs)} differences")
        return 1 if diffs else 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("alembic").setLevel(logging.INFO)
    sys.exit(_main(sys.argv[1:]))
