"""Alembic environment for the DividendCase database.

The app runs migrations itself when it starts (see dividendcase/migrate.py), so there is no
alembic.ini. To write a new migration: add the change to the models, then run
`uv run python -m dividendcase.migrate new "what changed"`.
"""
from alembic import context
from sqlalchemy import create_engine

import dividendcase.models  # noqa: F401 — registers every table on Base.metadata
from dividendcase.database import Base

target_metadata = Base.metadata


def _run(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # SQLite can't alter most columns in place; batch mode copies the table instead
        render_as_batch=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


connection = context.config.attributes.get("connection")
if connection is not None:
    _run(connection)
else:
    engine = create_engine(context.config.get_main_option("sqlalchemy.url"))
    with engine.connect() as conn:
        _run(conn)
    engine.dispose()
