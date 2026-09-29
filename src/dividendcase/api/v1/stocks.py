from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
import logging
from dividendcase.database import get_db
from dividendcase.crud.stock import get_stock, get_stocks, get_top_performers
from dividendcase.schemas.stock import StockSummary, StockDetail, StocksListResponse
from dividendcase.models.stock import Stock

import requests as _std_requests

try:
    from curl_cffi import requests as _curl_requests
    _CURL_AVAILABLE = True
except ImportError:
    _curl_requests = None
    _CURL_AVAILABLE = False

logger = logging.getLogger(__name__)
router = APIRouter()

_BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


@router.get("/top-performers", response_model=list[StockSummary])
async def top_performers(
    exchange: Optional[List[str]] = Query(default=None),
    min_yield: Optional[float] = Query(None, alias="minYield"),
    beats_benchmark: Optional[bool] = Query(None, alias="beatsBenchmark"),
    limit: int = Query(50, le=2000),
    db: AsyncSession = Depends(get_db),
):
    stocks = await get_top_performers(
        db, exchanges=exchange, min_yield=min_yield, beats_benchmark=beats_benchmark, limit=limit,
    )
    return stocks


@router.get("/search", response_model=list[StockSummary])
async def search_stocks(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, le=20),
    db: AsyncSession = Depends(get_db),
):
    pattern = f"%{q}%"
    result = await db.execute(
        select(Stock)
        .where(
            (Stock.ticker_symbol.ilike(pattern)) |
            (Stock.company_name.ilike(pattern))
        )
        .order_by(Stock.avg_dividend_yield.desc().nullslast())
        .limit(limit)
    )
    return result.scalars().all()


_summary_session = None


def _get_summary_session():
    """Return a curl_cffi session with cookies + crumb for quoteSummary calls."""
    global _summary_session
    if _summary_session is not None:
        return _summary_session

    if _CURL_AVAILABLE:
        import time
        s = _curl_requests.Session(impersonate="chrome120")
        s.get("https://fc.yahoo.com", timeout=10)
        time.sleep(0.3)
        crumb_resp = s.get(
            "https://query2.finance.yahoo.com/v1/test/getcrumb", timeout=10
        )
        if crumb_resp.status_code == 200:
            crumb = crumb_resp.text.strip()
            if crumb and "<" not in crumb and len(crumb) < 50:
                s._crumb = crumb
                _summary_session = s
                return s

    # Fallback: plain requests session with browser User-Agent
    logger.info("curl_cffi unavailable, using plain requests fallback for Yahoo Finance")
    s = _std_requests.Session()
    s.headers.update({"User-Agent": _BROWSER_UA})
    s.get("https://fc.yahoo.com", timeout=10)
    crumb_resp = s.get(
        "https://query2.finance.yahoo.com/v1/test/getcrumb", timeout=10
    )
    if crumb_resp.status_code == 200:
        crumb = crumb_resp.text.strip()
        if crumb and "<" not in crumb and len(crumb) < 50:
            s._crumb = crumb
            _summary_session = s
            return s

    return None


def _reset_summary_session():
    global _summary_session
    _summary_session = None


def _parse_profile_dict(profile: dict) -> dict:
    """Extract summary/sector/industry/country from a Yahoo Finance assetProfile dict."""
    raw_summary = profile.get("longBusinessSummary", "")
    summary = None
    if raw_summary:
        sentences = raw_summary.split(". ")
        summary = ". ".join(sentences[:2]).strip()
        if not summary.endswith("."):
            summary += "."
    return {
        "summary": summary,
        "sector": profile.get("sector") or None,
        "industry": profile.get("industry") or None,
        "country": profile.get("country") or None,
    }


def _fetch_asset_profile_yfinance(ticker: str) -> dict:
    """Fallback: fetch via yfinance when curl_cffi is unavailable."""
    empty = {"summary": None, "sector": None, "industry": None, "country": None}
    try:
        import yfinance as yf
        info = yf.Ticker(ticker).info
        if not info:
            return empty
        raw_summary = info.get("longBusinessSummary", "")
        summary = None
        if raw_summary:
            sentences = raw_summary.split(". ")
            summary = ". ".join(sentences[:2]).strip()
            if not summary.endswith("."):
                summary += "."
        return {
            "summary": summary,
            "sector": info.get("sector") or None,
            "industry": info.get("industry") or None,
            "country": info.get("country") or None,
        }
    except Exception as e:
        logger.warning(f"yfinance fallback failed for {ticker}: {e}")
        return empty


def _fetch_asset_profile(ticker: str) -> dict:
    """Fetch sector/industry/country/summary from Yahoo Finance.

    Tries curl_cffi quoteSummary first; falls back to yfinance.
    Returns dict with keys: summary, sector, industry, country.
    All values may be None on failure.
    """
    empty = {"summary": None, "sector": None, "industry": None, "country": None}

    session = _get_summary_session()
    if session is None:
        # curl_cffi and plain-requests both unavailable/rate-limited — use yfinance
        return _fetch_asset_profile_yfinance(ticker)

    url = (
        f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/"
        f"{ticker}?modules=assetProfile&crumb={session._crumb}"
    )

    try:
        resp = session.get(url, timeout=10)

        # If crumb expired, reset and retry once
        if resp.status_code in (401, 429):
            _reset_summary_session()
            session = _get_summary_session()
            if session is None:
                return _fetch_asset_profile_yfinance(ticker)
            url = (
                f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/"
                f"{ticker}?modules=assetProfile&crumb={session._crumb}"
            )
            resp = session.get(url, timeout=10)

        if resp.status_code != 200:
            return _fetch_asset_profile_yfinance(ticker)

        data = resp.json()
        profile = (
            data.get("quoteSummary", {})
            .get("result", [{}])[0]
            .get("assetProfile", {})
        )
        result = _parse_profile_dict(profile)

        # quoteSummary sometimes returns summary but omits sector/industry;
        # supplement from yfinance if those fields are missing
        if result["summary"] and not result["sector"]:
            yf_result = _fetch_asset_profile_yfinance(ticker)
            if yf_result["sector"]:
                result["sector"] = yf_result["sector"]
            if yf_result["industry"]:
                result["industry"] = yf_result["industry"]
            if yf_result["country"] and not result["country"]:
                result["country"] = yf_result["country"]

        return result

    except Exception as e:
        logger.warning(f"Stock summary fetch failed for {ticker}: {e}")
        _reset_summary_session()
        return _fetch_asset_profile_yfinance(ticker)


@router.get("/{ticker}/summary")
async def stock_summary(ticker: str, db: AsyncSession = Depends(get_db)):
    """Return description/sector/industry — reads from DB first, fetches from Yahoo only if missing."""
    import asyncio
    ticker = ticker.upper().strip()

    # Try DB first — fast, no external calls
    stock = await get_stock(db, ticker)

    def _clean(val: str | None) -> str | None:
        return val if val and val not in ("Unknown", "") else None

    if stock and stock.description:
        # Description cached — return immediately, don't hammer Yahoo from Render
        # Sector/industry will be populated by the daily batch (GitHub Actions)
        return {
            "summary": stock.description,
            "sector": _clean(stock.sector),
            "industry": _clean(stock.industry),
        }

    # DB has no description — fetch from Yahoo Finance in background thread
    result = await asyncio.to_thread(_fetch_asset_profile, ticker)

    # Persist to DB so next request is instant
    if stock and (result["sector"] or result["summary"]):
        if result["sector"]:
            stock.sector = result["sector"]
        if result["industry"]:
            stock.industry = result["industry"]
        if result["summary"]:
            stock.description = result["summary"]
        if result["country"]:
            stock.country = result["country"]
        await db.commit()

    return {
        "summary": result["summary"] or (stock.description if stock else None),
        "sector": result["sector"] or (_clean(stock.sector) if stock else None),
        "industry": result["industry"] or (_clean(stock.industry) if stock else None),
    }


@router.get("/{ticker}", response_model=StockDetail)
async def stock_detail(ticker: str, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    stock = await get_stock(db, ticker.upper())
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {ticker} not found")
    return stock


@router.get("", response_model=StocksListResponse)
async def list_stocks(
    exchange: Optional[str] = Query(None),
    min_yield: Optional[float] = Query(None, alias="minYield"),
    max_yield: Optional[float] = Query(None, alias="maxYield"),
    category: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    stocks, total = await get_stocks(
        db,
        exchange=exchange,
        min_yield=min_yield,
        max_yield=max_yield,
        category=category,
        limit=limit,
        offset=offset,
    )
    return StocksListResponse(
        stocks=stocks,
        total=total,
        page=offset // limit + 1,
        page_size=limit,
    )
