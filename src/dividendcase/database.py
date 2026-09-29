from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from dividendcase.config import settings

settings.data_dir.mkdir(parents=True, exist_ok=True)

engine = create_async_engine(settings.resolved_database_url, pool_pre_ping=True)


if engine.dialect.name == "sqlite":
    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")  # readers don't block the background refresh
        cursor.execute("PRAGMA foreign_keys=ON")  # the models rely on ON DELETE CASCADE
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()


AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
