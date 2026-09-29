"""
Investment comparison endpoint.
Computes cumulative dividend returns + portfolio value vs local benchmark equivalent.
"""
import asyncio
import logging
from datetime import date, datetime, timedelta
from typing import Optional

import pandas as pd
import requests as _stdlib_requests

try:
    from curl_cffi import requests as _curl_requests
    _CURL_AVAILABLE = True
except ImportError:
    _curl_requests = None
    _CURL_AVAILABLE = False
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from dividendcase.database import get_db
from dividendcase.crud.stock import get_stock
from dividendcase.crud.dividend import get_dividends_for_ticker
from dividendcase.schemas.investment import InvestmentComparisonResponse, InvestmentDataPoint

router = APIRouter()
logger = logging.getLogger(__name__)

# Exchange → local benchmark mapping
EXCHANGE_BENCHMARKS: dict[str, dict[str, str]] = {
    "NYSE":   {"ticker": "SPY",    "name": "S&P 500 (SPY)",      "currency": "USD"},
    "NASDAQ": {"ticker": "SPY",    "name": "S&P 500 (SPY)",      "currency": "USD"},
    "NSE":    {"ticker": "^NSEI",  "name": "Nifty 50",           "currency": "INR"},
    "BSE":    {"ticker": "^NSEI",  "name": "Nifty 50",           "currency": "INR"},
    "TSX":    {"ticker": "XIU.TO", "name": "S&P/TSX 60 (XIU)",   "currency": "CAD"},
    "LSE":    {"ticker": "ISF.L",  "name": "FTSE 100 (ISF)",     "currency": "GBp"},
    "ISE":    {"ticker": "^ISEQ",  "name": "ISEQ All-Share",     "currency": "EUR"},
    "ASX":    {"ticker": "STW.AX", "name": "S&P/ASX 200 (STW)",  "currency": "AUD"},
}
DEFAULT_BENCHMARK = {"ticker": "SPY", "name": "S&P 500 (SPY)", "currency": "USD"}

# In-memory cache keyed by (benchmark_ticker, start_year)
_benchmark_cache: dict = {}


def _get_benchmark_data(benchmark_ticker: str, start_year: int) -> tuple[Optional[float], pd.DataFrame]:
    """
    Fetch benchmark price + dividend history from start_year-01-01 to today
    using the Yahoo Finance v8 chart API with curl_cffi Chrome TLS impersonation.

    Returns (price_at_start, monthly_df) where monthly_df has columns:
      price, cumulative_divs (per share, accumulated since start).
    Only successful fetches are cached — failures are retried on next call.
    """
    cache_key = (benchmark_ticker, start_year)
    if cache_key in _benchmark_cache:
        return _benchmark_cache[cache_key]

    try:
        start_dt = datetime(start_year, 1, 1)
        years = max(1, datetime.now().year - start_year + 1)

        if _CURL_AVAILABLE:
            _do_get = lambda url, **kw: _curl_requests.get(
                url, impersonate="chrome120", **kw
            )
        else:
            _do_get = lambda url, **kw: _stdlib_requests.get(url, **kw)

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://finance.yahoo.com/",
        }
        params = {
            "interval": "1d",
            "range": f"{years}y",
            "events": "dividends",
        }

        encoded_ticker = benchmark_ticker.replace("^", "%5E")
        resp = _do_get(
            f"https://query2.finance.yahoo.com/v8/finance/chart/{encoded_ticker}",
            headers=headers, params=params, timeout=15,
        )
        if resp.status_code == 429:
            resp = _do_get(
                f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded_ticker}",
                headers=headers, params=params, timeout=15,
            )
        if resp.status_code != 200:
            logger.warning(f"{benchmark_ticker} v8 chart API returned HTTP {resp.status_code} for {start_year}")
            return None, pd.DataFrame()

        payload = resp.json()
        chart_result = (payload.get("chart", {}).get("result") or [None])[0]
        if chart_result is None:
            logger.warning(f"{benchmark_ticker} v8 chart API returned no result for {start_year}")
            return None, pd.DataFrame()

        timestamps = chart_result.get("timestamp", [])
        closes = (
            chart_result.get("indicators", {})
            .get("quote", [{}])[0]
            .get("close", [])
        )
        if not timestamps or not closes:
            logger.warning(f"{benchmark_ticker} v8 chart API returned empty price data for {start_year}")
            return None, pd.DataFrame()

        # Build daily DataFrame
        dates = [datetime.fromtimestamp(ts) for ts in timestamps]
        df = pd.DataFrame({"price": closes}, index=pd.DatetimeIndex(dates))
        df = df[df["price"].notna()]

        if hasattr(df.index, "tz") and df.index.tz is not None:
            df.index = df.index.tz_localize(None)

        start_ts = pd.Timestamp(start_dt)
        df = df[df.index >= start_ts]
        if df.empty:
            logger.warning(f"{benchmark_ticker}: no price data on/after {start_year}-01-01")
            return None, pd.DataFrame()

        price_at_start = float(df["price"].iloc[0])

        # Accumulate dividends per share since start (may be 0 for index tickers)
        df["cumulative_divs"] = 0.0
        raw_divs = chart_result.get("events", {}).get("dividends", {})
        if raw_divs:
            div_list = []
            for ts_str, d in raw_divs.items():
                div_dt = datetime.fromtimestamp(int(ts_str))
                if div_dt >= start_dt:
                    div_list.append((div_dt, float(d["amount"])))
            div_list.sort()

            running = 0.0
            for div_dt, div_amt in div_list:
                running += div_amt
                df.loc[df.index >= div_dt, "cumulative_divs"] = running

        # Resample to monthly (last trading day of each month)
        monthly = df.resample("ME").last()

        _benchmark_cache[cache_key] = (price_at_start, monthly)
        logger.info(
            f"{benchmark_ticker} data cached for {start_year}: "
            f"{len(monthly)} monthly points, start price {price_at_start:.2f}"
        )
        return price_at_start, monthly

    except Exception as e:
        logger.warning(f"Failed to fetch {benchmark_ticker} data for {start_year}: {e}")
        return None, pd.DataFrame()


@router.get("/{ticker}/comparison", response_model=InvestmentComparisonResponse)
async def investment_comparison(
    ticker: str,
    start_year: int = Query(..., ge=2000, le=2025),
    shares: float = Query(100.0, gt=0, le=100_000),
    benchmark_override: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    ticker = ticker.upper()
    stock = await get_stock(db, ticker)
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {ticker} not found in database")

    # Determine benchmark from stock's exchange, or use override if provided
    if benchmark_override:
        bench_ticker = benchmark_override.upper()
        bench_name = next(
            (b["name"] for b in EXCHANGE_BENCHMARKS.values() if b["ticker"] == bench_ticker),
            bench_ticker,
        )
    else:
        bench = EXCHANGE_BENCHMARKS.get(stock.exchange, DEFAULT_BENCHMARK)
        bench_ticker = bench["ticker"]
        bench_name = bench["name"]

    # Fetch all available records (up to 20 years)
    records = await get_dividends_for_ticker(db, ticker, years=20)
    if not records:
        raise HTTPException(status_code=404, detail=f"No dividend records for {ticker}")

    start_dt = date(start_year, 1, 1)

    # Find the first record on/after start date with a valid share price
    records_after = [
        r for r in records
        if r.dividend_date >= start_dt and r.share_price_on_dividend_date
    ]
    if not records_after:
        raise HTTPException(
            status_code=422,
            detail=f"No dividend records with price data for {ticker} from {start_year}"
        )

    first_record = records_after[0]
    initial_price = float(first_record.share_price_on_dividend_date)
    initial_investment = round(shares * initial_price, 2)

    # Fetch benchmark comparison data
    bench_price_at_start, bench_monthly = await asyncio.to_thread(
        _get_benchmark_data, bench_ticker, start_year
    )
    bench_shares = (initial_investment / bench_price_at_start) if bench_price_at_start else None

    # Build time series from records after start date
    cumulative_divs = 0.0
    data_points: list[InvestmentDataPoint] = []

    for r in records_after:
        if not r.dividend_per_share or not r.share_price_on_dividend_date:
            continue

        cumulative_divs += float(r.dividend_per_share) * shares
        stock_value = float(r.share_price_on_dividend_date) * shares
        portfolio_value = round(stock_value + cumulative_divs, 2)

        # Find benchmark value at this date
        benchmark_value = initial_investment  # fallback: flat
        if bench_shares is not None and not bench_monthly.empty:
            try:
                rec_ts = pd.Timestamp(r.dividend_date)
                # Find nearest monthly observation on or before dividend date
                bench_before = bench_monthly[bench_monthly.index <= rec_ts]
                if not bench_before.empty:
                    row = bench_before.iloc[-1]
                    bench_portfolio = bench_shares * float(row["price"]) + bench_shares * float(row["cumulative_divs"])
                    benchmark_value = round(bench_portfolio, 2)
            except Exception as e:
                logger.warning(f"{bench_ticker} value lookup failed for {ticker} at {r.dividend_date}: {e}")

        date_label = datetime.combine(r.dividend_date, datetime.min.time()).strftime("%b %Y")
        data_points.append(InvestmentDataPoint(
            date=date_label,
            cumulative_divs=round(cumulative_divs, 2),
            portfolio_value=portfolio_value,
            benchmark_value=benchmark_value,
        ))

    return InvestmentComparisonResponse(
        ticker=ticker,
        start_year=start_year,
        shares=shares,
        initial_investment=initial_investment,
        benchmark_initial_investment=initial_investment,
        benchmark_ticker=bench_ticker,
        benchmark_name=bench_name,
        currency=stock.currency or "USD",
        data_points=data_points,
    )
