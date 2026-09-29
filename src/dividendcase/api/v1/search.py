from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from dividendcase.database import get_db
from dividendcase.crud.stock import get_stock, upsert_stock
from dividendcase.crud.dividend import upsert_dividend_records
from dividendcase.schemas.dividend import FetchStockRequest, DividendHistoryResponse, DividendMetrics
from dividendcase.services.yahoo_fetcher import YahooFetcher, CooldownActiveError
from dividendcase.api.v1.dividends import _calculate_metrics
import logging

try:
    from curl_cffi import requests as _curl_requests
    _CURL_AVAILABLE = True
except ImportError:
    _curl_requests = None
    _CURL_AVAILABLE = False

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/symbols")
async def search_symbols(q: str = Query(..., min_length=1), limit: int = Query(10, le=20)):
    """Search Yahoo Finance for ticker symbols using curl_cffi to bypass TLS fingerprint blocking."""
    url = (
        f"https://query1.finance.yahoo.com/v1/finance/search"
        f"?q={q}&quotesCount={limit}&newsCount=0&enableFuzzyQuery=true"
        f"&enableNavLinks=false&enableEnhancedTriviaInfo=false"
    )
    headers = {
        "Accept": "application/json",
        "Referer": "https://finance.yahoo.com/",
    }
    try:
        if _CURL_AVAILABLE:
            resp = _curl_requests.get(url, impersonate="chrome120", headers=headers, timeout=5)
        else:
            import requests as _stdlib
            headers["User-Agent"] = (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            resp = _stdlib.get(url, headers=headers, timeout=5)

        if resp.status_code != 200:
            return []

        quotes = resp.json().get("quotes", [])
        return [
            {
                "symbol": r["symbol"],
                "name": r.get("longname") or r.get("shortname") or r["symbol"],
                "exchange": r.get("exchDisp", ""),
                "type": r.get("typeDisp", "Equity"),
            }
            for r in quotes
            if (r.get("typeDisp", "Equity") or "Equity").lower() in ("equity", "etf", "fund", "")
        ]
    except Exception as e:
        logger.warning(f"Yahoo Finance symbol search failed: {e}")
        return []


# Track how many times each custom ticker has been requested
_fetch_counter: dict[str, int] = {}
PERSIST_THRESHOLD = 1


@router.post("/fetch-stock", response_model=DividendHistoryResponse)
async def fetch_custom_stock(
    body: FetchStockRequest,
    db: AsyncSession = Depends(get_db),
):
    """Fetch dividend history for any ticker via yfinance.
    If the ticker is already in the DB, returns from DB (fast path).
    Otherwise fetches from Yahoo Finance (slow path, ~2-5s).
    Auto-persists to DB after PERSIST_THRESHOLD requests.
    """
    ticker = body.ticker.upper().strip()

    # Fast path: already in DB
    stock = await get_stock(db, ticker)
    if stock:
        from dividendcase.crud.dividend import get_dividends_for_ticker
        records = await get_dividends_for_ticker(db, ticker, years=10)
        metrics = _calculate_metrics(ticker, stock.company_name, stock.currency or "USD", records)
        return DividendHistoryResponse(
            ticker_symbol=ticker,
            company_name=stock.company_name,
            exchange=stock.exchange,
            currency=stock.currency or "USD",
            records=records,
            metrics=metrics,
        )

    # Slow path: fetch from Yahoo Finance.
    # Use the light fetch (v8 chart API only) to avoid crumb/quoteSummary 429s.
    from dividendcase.services.yahoo_fetcher import is_cooled_down
    if is_cooled_down():
        raise HTTPException(
            status_code=503,
            detail=(
                f"Yahoo Finance is currently rate-limited. "
                f"Data for {ticker} will be available again shortly. "
                f"Try a stock already in our database or check back in a few minutes."
            ),
        )

    fetcher = YahooFetcher()
    try:
        stock_data, dividend_records = fetcher.fetch_stock_light(ticker)
    except CooldownActiveError as e:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Yahoo Finance is currently rate-limited ({e.remaining_seconds}s remaining). "
                f"Data for {ticker} will be available again shortly. "
                f"Try a stock already in our database or check back in a few minutes."
            ),
        )
    except Exception as e:
        # Transient Yahoo Finance fetch failure (empty response, timezone error, etc.)
        # Don't return 404 — the stock may well exist and pay dividends.
        logger.warning(f"Transient fetch failure for {ticker}: {e}")
        raise HTTPException(
            status_code=503,
            detail=(
                f"Yahoo Finance returned an error for {ticker}. "
                f"This is usually temporary — please try again in a moment."
            ),
        )

    if not stock_data:
        # At this point we know it's genuinely "no dividends" — not a rate-limit issue,
        # because CooldownActiveError would have been raised above.
        raise HTTPException(
            status_code=404,
            detail=f"No dividend data found for {ticker}. This stock may not pay dividends, or Yahoo Finance is temporarily unavailable.",
        )

    # Track request count and auto-persist if threshold reached
    _fetch_counter[ticker] = _fetch_counter.get(ticker, 0) + 1
    if _fetch_counter[ticker] >= PERSIST_THRESHOLD:
        try:
            saved_stock = await upsert_stock(db, stock_data)
            if dividend_records:
                await upsert_dividend_records(db, saved_stock.id, ticker, dividend_records)
            logger.info(f"Auto-persisted {ticker} after {_fetch_counter[ticker]} requests")
            del _fetch_counter[ticker]
        except Exception as e:
            logger.warning(f"Failed to auto-persist {ticker}: {e}")

    # Build response from fetched data
    from dividendcase.schemas.dividend import DividendRecord
    from datetime import date

    records_out = [
        DividendRecord(
            ticker_symbol=ticker,
            dividend_date=r["dividend_date"],
            dividend_per_share=r["dividend_per_share"],
            share_price_on_dividend_date=r.get("share_price_on_dividend_date"),
            dividend_yield_pct=r.get("dividend_yield_pct"),
        )
        for r in dividend_records
    ]

    metrics = _calculate_metrics(
        ticker,
        stock_data.get("company_name", ticker),
        stock_data.get("currency", "USD"),
        records_out,
    )

    return DividendHistoryResponse(
        ticker_symbol=ticker,
        company_name=stock_data.get("company_name", ticker),
        exchange=stock_data.get("exchange", "UNKNOWN"),
        currency=stock_data.get("currency", "USD"),
        records=records_out,
        metrics=metrics,
    )
