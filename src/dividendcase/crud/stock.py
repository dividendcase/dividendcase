from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.dialects.sqlite import insert
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
    """Insert or update a stock in one statement, so two fetches of the same stock at once (a
    background refresh and adding a holding, say) can't both try to insert it. Only the fields
    in stock_data are written: a screener fetch without a profile leaves the profile alone."""
    columns = set(Stock.__table__.columns.keys()) - {"id", "created_at", "updated_at"}
    values = {k: v for k, v in stock_data.items() if k in columns}
    stmt = insert(Stock).values(**values)
    changes = {k: stmt.excluded[k] for k in values if k != "ticker_symbol"}
    changes["updated_at"] = func.now()
    await db.execute(stmt.on_conflict_do_update(index_elements=["ticker_symbol"], set_=changes))
    await db.commit()
    result = await db.execute(
        select(Stock).where(Stock.ticker_symbol == values["ticker_symbol"])
        .execution_options(populate_existing=True)  # a copy loaded earlier in this session is stale
    )
    return result.scalar_one()
