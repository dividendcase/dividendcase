"""The database file must survive every upgrade: migrations, stamping old files, backups."""
import sqlite3
from pathlib import Path

from alembic import command
from sqlalchemy import create_engine, text

from dividendcase import migrate


def _url(folder: Path) -> str:
    return f"sqlite+aiosqlite:///{folder / 'dividendcase.db'}"


def test_fresh_database_matches_the_models(tmp_path):
    url = _url(tmp_path)
    assert migrate.upgrade_database(url, tmp_path / "backups") is None  # nothing to back up
    assert migrate.current_revision(url) == migrate.head_revision()
    assert migrate.schema_differences(url) == []


def test_upgrading_twice_does_nothing(tmp_path):
    url = _url(tmp_path)
    migrate.upgrade_database(url, tmp_path / "backups")
    assert migrate.upgrade_database(url, tmp_path / "backups") is None
    assert not (tmp_path / "backups").exists()


def _database_from_first_builds(folder: Path) -> str:
    """A file like the ones 0.1.0.dev builds made: baseline tables, no alembic_version."""
    url = _url(folder)
    sync = migrate.sync_url(url)
    engine = create_engine(sync)
    with engine.begin() as conn:
        cfg = migrate._config(sync)
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, migrate.BASELINE)
        conn.execute(text("DROP TABLE alembic_version"))
        conn.execute(text(
            "INSERT INTO user_preferences (user_id, default_benchmark, date_format, watchlist_collapsed) "
            "VALUES ('00000000000000000000000000000001', 'FTSE100', 'YYYY-MM-DD', 0)"
        ))
        conn.execute(text(
            "INSERT INTO stocks (ticker_symbol, company_name, exchange) VALUES ('TEST', 'Test plc', 'LSE')"
        ))
    engine.dispose()
    return url


def test_database_from_first_builds_is_stamped_backed_up_and_upgraded(tmp_path):
    url = _database_from_first_builds(tmp_path)
    backup = migrate.upgrade_database(url, tmp_path / "backups")

    assert migrate.current_revision(url) == migrate.head_revision()
    assert migrate.schema_differences(url) == []

    con = sqlite3.connect(tmp_path / "dividendcase.db")
    prefs = con.execute("SELECT default_benchmark, date_format, check_for_updates FROM user_preferences").fetchall()
    assert prefs == [("FTSE100", "YYYY-MM-DD", 1)]  # kept, with the new column's default
    assert con.execute("SELECT ticker_symbol FROM stocks").fetchall() == [("TEST",)]
    con.close()

    # The copy is the file as it was before the upgrade
    assert backup is not None and backup.exists()
    old = sqlite3.connect(backup)
    columns = [row[1] for row in old.execute("PRAGMA table_info(user_preferences)")]
    assert "check_for_updates" not in columns
    assert old.execute("SELECT count(*) FROM stocks").fetchone() == (1,)
    old.close()


def test_only_the_newest_backups_are_kept(tmp_path):
    url = _url(tmp_path)
    migrate.upgrade_database(url, tmp_path / "backups")
    for i in range(migrate.KEEP_BACKUPS + 3):
        migrate.backup_database(url, tmp_path / "backups", label=f"test-{i}")
    assert len(list((tmp_path / "backups").glob("dividendcase-*.db"))) == migrate.KEEP_BACKUPS


def test_the_app_database_is_at_the_newest_migration(client):
    from dividendcase.config import settings

    assert migrate.current_revision(settings.resolved_database_url) == migrate.head_revision()
