from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from dividendcase.models.stock import Stock


async def get_stock(db: AsyncSession, ticker: str) -> Optional[Stock]:
    result = await db.execute(select(Stock).where(Stock.ticker_symbol == ticker))
    return result.scalar_one_or_none()


async def get_stocks(
    db: AsyncSession,
    exchange: Optional[str] = None,
    min_yield: Optional[float] = None,
    max_yield: Optional[float] = None,
    category: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[Stock], int]:
    query = select(Stock)
    count_query = select(func.count()).select_from(Stock)

    if exchange:
        query = query.where(Stock.exchange == exchange)
        count_query = count_query.where(Stock.exchange == exchange)
    if min_yield is not None:
        query = query.where(Stock.avg_dividend_yield >= min_yield)
        count_query = count_query.where(Stock.avg_dividend_yield >= min_yield)
    if max_yield is not None:
        query = query.where(Stock.avg_dividend_yield <= max_yield)
        count_query = count_query.where(Stock.avg_dividend_yield <= max_yield)
    if category:
        query = query.where(Stock.dividend_category == category)
        count_query = count_query.where(Stock.dividend_category == category)

    query = query.order_by(Stock.avg_dividend_yield.desc()).limit(limit).offset(offset)

    result = await db.execute(query)
    count_result = await db.execute(count_query)
    return result.scalars().all(), count_result.scalar()


async def get_top_performers(
    db: AsyncSession,
    exchanges: Optional[list[str]] = None,
    min_yield: Optional[float] = None,
    beats_benchmark: Optional[bool] = None,
    limit: int = 50,
) -> list[Stock]:
    query = select(Stock).where(Stock.avg_dividend_yield.isnot(None))
    if exchanges:
        query = query.where(Stock.exchange.in_(exchanges))
    if min_yield is not None:
        query = query.where(Stock.avg_dividend_yield >= min_yield)
    if beats_benchmark is not None:
        query = query.where(Stock.beats_benchmark == beats_benchmark)
    query = query.order_by(Stock.avg_dividend_yield.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def upsert_stock(db: AsyncSession, stock_data: dict) -> Stock:
    ticker = stock_data["ticker_symbol"]
    existing = await get_stock(db, ticker)
    if existing:
        for key, value in stock_data.items():
            if hasattr(existing, key):
                setattr(existing, key, value)
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        stock = Stock(**stock_data)
        db.add(stock)
        await db.commit()
        await db.refresh(stock)
        return stock
