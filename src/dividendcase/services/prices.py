"""Daily price bars for a stock's price charts.

Downloaded from Yahoo Finance the first time a stock's prices are asked for, kept in price_bars,
and downloaded again once the copy is older than MAX_AGE. Every download takes ten years and
replaces the stock's stored bars, so a split adjusts the whole history at once. When Yahoo can't
be reached the stored bars are served marked stale; with nothing stored there is nothing to show.
"""
import asyncio
import logging
import math
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from dividendcase.models import PriceBar, Stock
from dividendcase.services.yahoo_fetcher import CooldownActiveError, YahooFetcher

logger = logging.getLogger(__name__)

MAX_AGE = timedelta(hours=12)
FETCH_YEARS = 10  # always downloaded in full; requests for fewer years are cut from it

_fetcher = YahooFetcher()
# One download per stock at a time: a second request for the same stock waits and reuses it
_locks: dict[str, asyncio.Lock] = {}


class PricesUnavailable(Exception):
    """No bars are stored and Yahoo Finance couldn't provide them; the message is for the user."""


class _NoPrices(Exception):
    """Yahoo answered, with no prices for the stock."""


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)  # stored naive, in UTC, like last_fetched_at


def _as_utc(moment: Optional[datetime]) -> Optional[datetime]:
    """SQLite hands back naive datetimes; they are UTC."""
    if moment is None or moment.tzinfo is None:
        return moment
    return moment.astimezone(timezone.utc).replace(tzinfo=None)


def _years_before(day: date, years: int) -> date:
    try:
        return day.replace(year=day.year - years)
    except ValueError:  # 29 February
        return day.replace(year=day.year - years, day=28)


async def _has_bars(db: AsyncSession, ticker: str) -> bool:
    result = await db.execute(select(PriceBar.id).where(PriceBar.ticker_symbol == ticker).limit(1))
    return result.first() is not None


async def _is_fresh(db: AsyncSession, stock: Stock) -> bool:
    fetched = _as_utc(stock.prices_fetched_at)
    return fetched is not None and _utcnow() - fetched < MAX_AGE and await _has_bars(db, stock.ticker_symbol)


def _unavailable_message(ticker: str, error: Exception) -> str:
    if isinstance(error, CooldownActiveError):
        minutes = max(1, math.ceil(error.remaining_seconds / 60))
        return (
            "Yahoo Finance asked this computer to slow down. Price history will load in about "
            f"{minutes} minute{'' if minutes == 1 else 's'}."
        )
    if isinstance(error, _NoPrices):
        return f"Yahoo Finance has no price history for {ticker}."
    return f"Couldn't download the price history for {ticker} from Yahoo Finance. Check your internet connection and try again."


async def _download(db: AsyncSession, stock: Stock) -> Optional[Exception]:
    """Download ten years of bars and replace the stored ones. Returns why it failed, if it did."""
    ticker = stock.ticker_symbol
    try:
        bars = await asyncio.to_thread(_fetcher.fetch_price_history, ticker, FETCH_YEARS)
    except Exception as e:  # CooldownActiveError included
        return e
    if not bars:
        return _NoPrices(f"no price history for {ticker}")

    rows = [{"stock_id": stock.id, "ticker_symbol": ticker, **bar} for bar in bars]
    try:
        await db.execute(delete(PriceBar).where(PriceBar.ticker_symbol == ticker))
        await db.execute(insert(PriceBar), rows)
        stock.prices_fetched_at = _utcnow()
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    logger.info("Stored %d daily prices for %s", len(rows), ticker)
    return None


async def get_price_bars(db: AsyncSession, stock: Stock, years: int) -> tuple[list[PriceBar], bool]:
    """The stock's daily bars for the last `years` years, oldest first, and whether they are stale
    (stored ones, served because a new download failed).

    Downloads first when nothing is stored or the stored bars are older than MAX_AGE. Raises
    PricesUnavailable when nothing is stored and the download fails.
    """
    ticker = stock.ticker_symbol
    stale = False
    if not await _is_fresh(db, stock):
        async with _locks.setdefault(ticker, asyncio.Lock()):
            await db.refresh(stock)  # a request that held the lock may have just downloaded them
            if not await _is_fresh(db, stock):
                error = await _download(db, stock)
                if error is not None:
                    if not await _has_bars(db, ticker):
                        logger.warning("No price history for %s: %s", ticker, error)
                        raise PricesUnavailable(_unavailable_message(ticker, error))
                    logger.warning("Serving stored prices for %s; the download failed: %s", ticker, error)
                    stale = True

    cutoff = _years_before(date.today(), years)
    result = await db.execute(
        select(PriceBar)
        .where(PriceBar.ticker_symbol == ticker, PriceBar.bar_date >= cutoff)
        .order_by(PriceBar.bar_date.asc())
    )
    return list(result.scalars().all()), stale
