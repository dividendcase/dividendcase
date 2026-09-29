"""Background data refresh for the local app.

A single worker fetches one ticker at a time from Yahoo Finance, on this machine, for the
user's own use. Holdings and watchlist stocks go first and include company profiles;
screener stocks follow with chart data only. The worker paces itself and waits out
Yahoo's rate-limit cooldowns instead of retrying through them.
"""
import asyncio
import contextlib
import logging
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func, select, union

from dividendcase.crud.dividend import upsert_dividend_records
from dividendcase.crud.stock import upsert_stock
from dividendcase.database import AsyncSessionLocal
from dividendcase.api.v1.deps import LOCAL_USER_ID
from dividendcase.models import DividendRecord, SchedulerRun, Stock, UserInvestment, UserPreferences, UserWatchlist
from dividendcase.services.derived import payment_frequency, yield_consistency
from dividendcase.services.universe import screener_universe
from dividendcase.services.yahoo_fetcher import (
    CooldownActiveError,
    YahooFetcher,
    get_cooldown_remaining,
    is_cooled_down,
)

logger = logging.getLogger(__name__)

HOLDINGS = "holdings"  # the user's holdings and watchlists
SCREENER = "screener"  # index members and high-yield groups shown in the screener
KINDS = (HOLDINGS, SCREENER)
PRIORITY = {HOLDINGS: 0, SCREENER: 1}

HOLDINGS_MAX_AGE = timedelta(hours=20)
SCREENER_MAX_AGE = timedelta(days=7)
PACE_SECONDS = (1.0, 1.8)  # pause between Yahoo requests, randomised


@dataclass
class _Job:
    ticker: str
    kind: str
    source: Optional[str]
    enqueued_at: datetime


@dataclass
class _Progress:
    total: int = 0
    done: int = 0
    saved: int = 0  # stored: the stock pays dividends
    skipped: int = 0  # no dividend history found
    failed: int = 0
    started_at: Optional[datetime] = None

    def as_dict(self) -> dict:
        return {
            "total": self.total,
            "done": self.done,
            "saved": self.saved,
            "skipped": self.skipped,
            "failed": self.failed,
            "started_at": self.started_at.isoformat() + "Z" if self.started_at else None,
        }


class Refresher:
    def __init__(self) -> None:
        self._pending: dict[str, _Job] = {}
        self._wake = asyncio.Event()
        self._progress = {kind: _Progress() for kind in KINDS}
        self._current: Optional[_Job] = None
        self._state = "idle"  # idle | fetching | waiting
        self._message = ""
        self._task: Optional[asyncio.Task] = None
        self._fetcher = YahooFetcher()

    # ── lifecycle ────────────────────────────────────────────────────────
    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run(), name="dividendcase-refresh")

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None

    # ── queue ────────────────────────────────────────────────────────────
    def enqueue(self, tickers: list[str], kind: str, source: Optional[str] = None) -> int:
        """Queue tickers; a ticker already queued moves up if the new kind has priority."""
        added = 0
        now = datetime.utcnow()
        for raw in tickers:
            ticker = raw.upper().strip()
            if not ticker:
                continue
            existing = self._pending.get(ticker)
            if existing:
                if PRIORITY[kind] < PRIORITY[existing.kind]:
                    self._progress[existing.kind].total -= 1
                    self._count_in(kind)
                    existing.kind = kind
                continue
            self._pending[ticker] = _Job(ticker, kind, source, now)
            self._count_in(kind)
            added += 1
        if added:
            self._wake.set()
        return added

    def _count_in(self, kind: str) -> None:
        progress = self._progress[kind]
        if progress.started_at is None:
            progress.started_at = datetime.utcnow()
        progress.total += 1

    def status(self) -> dict:
        return {
            "state": self._state,
            "message": self._message,
            "current": {"ticker": self._current.ticker, "kind": self._current.kind} if self._current else None,
            "queued": len(self._pending),
            "cooldown_seconds": get_cooldown_remaining() if is_cooled_down() else 0,
            **{kind: self._progress[kind].as_dict() for kind in KINDS},
        }

    # ── worker ───────────────────────────────────────────────────────────
    async def _run(self) -> None:
        while True:
            if not self._pending:
                self._state, self._message, self._current = "idle", "", None
                self._wake.clear()
                await self._wake.wait()
                continue

            if is_cooled_down():
                wait = get_cooldown_remaining()
                self._state = "waiting"
                self._message = f"Yahoo Finance asked for a pause. Resuming in about {max(wait, 1)} seconds."
                self._current = None
                await asyncio.sleep(min(max(wait, 5), 60))
                continue

            job = min(self._pending.values(), key=lambda j: (PRIORITY[j.kind], j.enqueued_at))
            self._state, self._message, self._current = "fetching", "", job
            outcome = await self._fetch_and_store(job)
            if outcome == "retry":
                continue  # cooldown started mid-request; the job stays queued

            self._pending.pop(job.ticker, None)
            progress = self._progress[job.kind]
            progress.done += 1
            setattr(progress, outcome, getattr(progress, outcome) + 1)
            if not any(j.kind == job.kind for j in self._pending.values()):
                await self._finish_batch(job.kind)
            await asyncio.sleep(random.uniform(*PACE_SECONDS))

    async def _fetch_and_store(self, job: _Job) -> str:
        try:
            stock_data, records = await asyncio.to_thread(
                self._fetcher.fetch_stock_light, job.ticker, 10, job.kind == HOLDINGS
            )
        except CooldownActiveError:
            return "retry"
        except Exception as e:
            logger.warning("Refresh %s failed: %s", job.ticker, e)
            return "failed"
        if not stock_data:
            return "skipped"
        if job.kind == SCREENER and job.source:
            stock_data["data_source"] = job.source
        try:
            async with AsyncSessionLocal() as db:
                saved = await upsert_stock(db, stock_data)
                if records:
                    await upsert_dividend_records(db, saved.id, job.ticker, records)
        except Exception as e:
            logger.warning("Saving %s failed: %s", job.ticker, e)
            return "failed"
        return "saved"

    async def _finish_batch(self, kind: str) -> None:
        progress = self._progress[kind]
        try:
            async with AsyncSessionLocal() as db:
                db.add(SchedulerRun(
                    job_name=f"refresh_{kind}",
                    started_at=progress.started_at,
                    finished_at=datetime.utcnow(),
                    status="success" if progress.failed == 0 else "partial",
                    records_updated=progress.saved,
                    error_message=f"{progress.failed} of {progress.total} failed" if progress.failed else None,
                ))
                await db.commit()
        except Exception as e:
            logger.warning("Could not record the %s refresh: %s", kind, e)
        logger.info("Refresh %s finished: %d saved, %d without dividends, %d failed",
                    kind, progress.saved, progress.skipped, progress.failed)
        self._progress[kind] = _Progress()


refresher = Refresher()


# ── what to queue ────────────────────────────────────────────────────────────
async def _user_tickers(db) -> list[str]:
    rows = await db.execute(union(
        select(UserInvestment.ticker_symbol),
        select(UserWatchlist.ticker_symbol),
    ))
    return sorted({row[0].upper() for row in rows.all()})


async def _fresh_tickers(db, max_age: timedelta) -> set[str]:
    cutoff = datetime.utcnow() - max_age
    rows = await db.execute(select(Stock.ticker_symbol).where(Stock.last_fetched_at >= cutoff))
    return {row[0] for row in rows.all()}


async def queue_holdings(force: bool = False) -> int:
    """Queue holdings and watchlist stocks that are missing or older than a day (all if force)."""
    async with AsyncSessionLocal() as db:
        tickers = await _user_tickers(db)
        if not force:
            fresh = await _fresh_tickers(db, HOLDINGS_MAX_AGE)
            tickers = [t for t in tickers if t not in fresh]
    return refresher.enqueue(tickers, HOLDINGS)


async def queue_screener(scheduled: bool = False) -> int:
    """Queue screener stocks not fetched in the last week, from the markets the user chose.

    The scheduled runs wait until first-run setup is done, so a new install doesn't start
    downloading markets the user is about to switch off.
    """
    async with AsyncSessionLocal() as db:
        prefs = (await db.execute(
            select(UserPreferences).where(UserPreferences.user_id == LOCAL_USER_ID)
        )).scalar_one_or_none()
    if scheduled and (prefs is None or prefs.setup_completed_at is None):
        logger.info("Screener download waits for first-run setup")
        return 0
    selected = prefs.screener_markets if prefs is not None else None
    universe = await asyncio.to_thread(screener_universe, selected)  # may read Wikipedia
    async with AsyncSessionLocal() as db:
        fresh = await _fresh_tickers(db, SCREENER_MAX_AGE)
    return sum(refresher.enqueue([symbol], SCREENER, source)
               for symbol, source in universe if symbol not in fresh)


async def fill_derived_fields() -> int:
    """Work out payment frequency and yield consistency for stocks stored before the fetch
    recorded them, from the dividends already on disk (no network)."""
    async with AsyncSessionLocal() as db:
        stocks = (await db.execute(select(Stock).where(Stock.payment_frequency.is_(None)))).scalars().all()
        filled = 0
        for stock in stocks:
            rows = (await db.execute(
                select(DividendRecord.dividend_date, DividendRecord.dividend_yield_pct)
                .where(DividendRecord.ticker_symbol == stock.ticker_symbol)
            )).all()
            freq = payment_frequency(row[0] for row in rows)
            if freq is None:
                continue
            stock.payment_frequency = freq
            stock.yield_consistency_score = yield_consistency(row[1] for row in rows)
            filled += 1
        await db.commit()
    if filled:
        logger.info("Filled payment frequency for %d stored stocks", filled)
    return filled


_background: set = set()


def run_soon(coro) -> None:
    """Start a coroutine in the background, keeping a reference until it finishes."""
    task = asyncio.create_task(coro)
    _background.add(task)
    task.add_done_callback(_background.discard)


async def data_summary() -> dict:
    """Counts and last-run times for the Data page."""
    async with AsyncSessionLocal() as db:
        stocks = await db.scalar(select(func.count()).select_from(Stock))
        dividends = await db.scalar(select(func.count()).select_from(DividendRecord))
        user = await _user_tickers(db)
        known = {row[0] for row in (await db.execute(select(Stock.ticker_symbol))).all()}
        last_runs = {}
        for kind in KINDS:
            run = (await db.execute(
                select(SchedulerRun)
                .where(SchedulerRun.job_name == f"refresh_{kind}")
                .order_by(SchedulerRun.finished_at.desc())
                .limit(1)
            )).scalar_one_or_none()
            last_runs[kind] = {
                "finished_at": run.finished_at.isoformat() + "Z" if run and run.finished_at else None,
                "status": run.status if run else None,
                "saved": run.records_updated if run else None,
                "note": run.error_message if run else None,
            }
    return {
        "stocks": stocks or 0,
        "dividend_records": dividends or 0,
        "your_tickers": len(user),
        "your_tickers_missing": len([t for t in user if t not in known]),
        "last_runs": last_runs,
    }
