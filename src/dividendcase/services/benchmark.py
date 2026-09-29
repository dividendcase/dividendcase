"""Did a stock beat its local index?

Total return (price change plus dividends) over the last ten years, or since the stock's
first stored payment if that's later, compared with the local index over the same period.
Needs at least three years of history; shorter records are left undecided.

The index histories come from Yahoo's chart API (a handful of requests, one per index),
fetched on this computer like everything else.
"""
import asyncio
import logging
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

import pandas as pd
from sqlalchemy import select

from dividendcase.database import AsyncSessionLocal
from dividendcase.models import DividendRecord, SchedulerRun, Stock

logger = logging.getLogger(__name__)

WINDOW_YEARS = 10
MIN_YEARS = 3
JOB_NAME = "beats_benchmark"
INDEX_PAUSE_SECONDS = 1  # between index downloads, to go easy on Yahoo

# The daily run and the one after a screener refresh can be asked for at once
_one_at_a_time = asyncio.Lock()


def index_return(monthly: pd.DataFrame, since: date) -> Optional[float]:
    """The index's total return from `since` to its latest month, as a ratio (1.5 = +50%)."""
    if monthly is None or monthly.empty:
        return None
    later = monthly[monthly.index >= pd.Timestamp(since)]
    if later.empty:
        return None
    start, end = later.iloc[0], monthly.iloc[-1]
    if not start["price"] or pd.isna(start["price"]) or pd.isna(end["price"]):
        return None
    return (float(end["price"]) + float(end["cumulative_divs"]) - float(start["cumulative_divs"])) / float(start["price"])


def stock_return(records: list[tuple[date, float, float]]) -> Optional[tuple[date, float]]:
    """(since, ratio) from (date, dividend, price) rows in date order: bought at the first
    price, holding to the last one, with every dividend paid after the first date."""
    priced = [r for r in records if r[2]]
    if len(priced) < 2:
        return None
    first_date, _, first_price = priced[0]
    last_price = priced[-1][2]
    dividends = sum(d for when, d, _ in records if when > first_date and d)
    return first_date, (last_price + dividends) / first_price


async def compute_beats_benchmark() -> tuple[int, int]:
    """Set beats_benchmark on every stored stock. Returns (beat, judged)."""
    async with _one_at_a_time:
        return await _compute()


async def _compute() -> tuple[int, int]:
    from dividendcase.api.v1 import investment  # benchmark tickers and the cached index fetch
    from dividendcase.services.yahoo_fetcher import is_cooled_down

    today = datetime.now().date()
    window_start = date(today.year - WINDOW_YEARS, today.month, 1)

    def benchmark_for(exchange: Optional[str]) -> str:
        return investment.EXCHANGE_BENCHMARKS.get(exchange or "", investment.DEFAULT_BENCHMARK)["ticker"]

    # Download the indices first (seconds, paced for Yahoo) and only then read the stocks, so
    # the verdicts are written onto the rows they were computed from, not onto rows that
    # changed or were replaced during the download
    async with AsyncSessionLocal() as db:
        exchanges = (await db.execute(select(Stock.exchange).distinct())).scalars().all()
    indices: dict[str, pd.DataFrame] = {}
    for bench in sorted({benchmark_for(e) for e in exchanges}):
        if is_cooled_down():
            logger.info("Yahoo asked for a pause; comparing with indices later")
            return 0, 0
        _, monthly = await asyncio.to_thread(investment._get_benchmark_data, bench, window_start.year)
        if monthly is not None and not monthly.empty:
            indices[bench] = monthly
        await asyncio.sleep(INDEX_PAUSE_SECONDS)

    async with AsyncSessionLocal() as db:
        stocks = (await db.execute(select(Stock))).scalars().all()
        rows = (await db.execute(
            select(DividendRecord.ticker_symbol, DividendRecord.dividend_date,
                   DividendRecord.dividend_per_share, DividendRecord.share_price_on_dividend_date)
            .where(DividendRecord.dividend_date >= window_start)
            .order_by(DividendRecord.ticker_symbol, DividendRecord.dividend_date)
        )).all()
        history: dict[str, list[tuple[date, float, float]]] = defaultdict(list)
        for ticker, when, dividend, price in rows:
            history[ticker].append((when, float(dividend or 0), float(price or 0)))

        beat = judged = 0
        for stock in stocks:
            bench = benchmark_for(stock.exchange)
            result = stock_return(history.get(stock.ticker_symbol, []))
            verdict = None
            if result and bench in indices:
                since, ratio = result
                if since <= today - timedelta(days=365 * MIN_YEARS):
                    index_ratio = index_return(indices[bench], since)
                    if index_ratio:
                        verdict = ratio > index_ratio
            stock.beats_benchmark = verdict
            stock.benchmark_ticker = bench
            if verdict is not None:
                judged += 1
                beat += verdict
        db.add(SchedulerRun(job_name=JOB_NAME, started_at=datetime.utcnow(), finished_at=datetime.utcnow(),
                            status="success" if indices else "partial", records_updated=judged))
        await db.commit()
    logger.info("Compared %d stocks with their index: %d beat it", judged, beat)
    return beat, judged


async def ensure_beats_benchmark(max_age: timedelta = timedelta(days=7)) -> None:
    """Recompute when the last comparison is older than a week (cheap to call daily)."""
    async with AsyncSessionLocal() as db:
        last = (await db.execute(
            select(SchedulerRun.finished_at).where(SchedulerRun.job_name == JOB_NAME)
            .order_by(SchedulerRun.finished_at.desc()).limit(1)
        )).scalar_one_or_none()
        has_stocks = (await db.execute(select(Stock.id).limit(1))).first() is not None
    if not has_stocks:
        return
    if last is not None:
        finished = last.replace(tzinfo=None) if last.tzinfo else last
        if datetime.utcnow() - finished < max_age:
            return
    try:
        await compute_beats_benchmark()
    except Exception as e:  # never let this stop the app
        logger.warning("Couldn't compare stocks with their index: %s", e)
