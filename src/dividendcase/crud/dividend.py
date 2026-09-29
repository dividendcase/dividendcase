from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
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


async def upsert_dividend_records(
    db: AsyncSession,
    stock_id: int,
    ticker: str,
    records: list[dict],
) -> int:
    """Insert or update dividend records. Returns count of inserted records."""
    inserted = 0
    for record in records:
        # Check if exists
        existing = await db.execute(
            select(DividendRecord).where(
                DividendRecord.ticker_symbol == ticker,
                DividendRecord.dividend_date == record["dividend_date"],
            )
        )
        row = existing.scalar_one_or_none()
        if row:
            row.dividend_per_share = record["dividend_per_share"]
            row.share_price_on_dividend_date = record.get("share_price_on_dividend_date")
            row.dividend_yield_pct = record.get("dividend_yield_pct")
        else:
            db.add(DividendRecord(
                stock_id=stock_id,
                ticker_symbol=ticker,
                dividend_date=record["dividend_date"],
                dividend_per_share=record["dividend_per_share"],
                share_price_on_dividend_date=record.get("share_price_on_dividend_date"),
                dividend_yield_pct=record.get("dividend_yield_pct"),
            ))
            inserted += 1

    await db.commit()
    return inserted
