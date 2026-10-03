from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.dialects.sqlite import insert
from datetime import date, timedelta
from dividendcase.models.dividend import DividendRecord


async def get_dividends_for_ticker(
    db: AsyncSession,
    ticker: str,
    years: int = 10,
) -> list[DividendRecord]:
    cutoff = date.today() - timedelta(days=365 * years)
    result = await db.execute(
        select(DividendRecord)
        .where(
            DividendRecord.ticker_symbol == ticker,
            DividendRecord.dividend_date >= cutoff,
        )
        .order_by(DividendRecord.dividend_date.asc())
    )
    return result.scalars().all()


async def has_dividends(db: AsyncSession, ticker: str) -> bool:
    """Whether any dividend is stored for the stock (holdings are stored without any)."""
    result = await db.execute(select(DividendRecord.id).where(DividendRecord.ticker_symbol == ticker).limit(1))
    return result.first() is not None


async def upsert_dividend_records(
    db: AsyncSession,
    stock_id: int,
    ticker: str,
    records: list[dict],
) -> int:
    """Insert or update dividend records, each batch in one statement (see upsert_stock).
    Returns the number of records written."""
    rows = [{
        "stock_id": stock_id,
        "ticker_symbol": ticker,
        "dividend_date": r["dividend_date"],
        "dividend_per_share": r["dividend_per_share"],
        "share_price_on_dividend_date": r.get("share_price_on_dividend_date"),
        "dividend_yield_pct": r.get("dividend_yield_pct"),
    } for r in records]
    for start in range(0, len(rows), 500):  # well inside SQLite's limit on statement parameters
        stmt = insert(DividendRecord).values(rows[start:start + 500])
        await db.execute(stmt.on_conflict_do_update(
            index_elements=["ticker_symbol", "dividend_date"],
            set_={c: stmt.excluded[c] for c in ("dividend_per_share", "share_price_on_dividend_date", "dividend_yield_pct")},
        ))
    await db.commit()
    return len(rows)
