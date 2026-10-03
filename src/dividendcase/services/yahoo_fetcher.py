"""
Yahoo Finance data fetcher — ported and refactored from v1's
index_dividend_fetcher.py and focused_dividend_scanner.py.
"""
import yfinance as yf
import pandas as pd
import requests
from datetime import datetime, timedelta, date
from typing import Optional
import logging
import time

from dividendcase.services.derived import payment_frequency, yield_consistency

try:
    from curl_cffi import requests as _curl_requests
    _CURL_AVAILABLE = True
except ImportError:
    _curl_requests = None
    _CURL_AVAILABLE = False

logger = logging.getLogger(__name__)


_profile_session = None


def _get_profile_session():
    """Return a curl_cffi session with crumb for quoteSummary calls (batch context)."""
    global _profile_session
    if _profile_session is not None:
        return _profile_session
    if not _CURL_AVAILABLE:
        return None
    try:
        s = _curl_requests.Session(impersonate="chrome120")
        s.get("https://fc.yahoo.com", timeout=10)
        time.sleep(0.3)
        crumb_resp = s.get(
            "https://query2.finance.yahoo.com/v1/test/getcrumb", timeout=10
        )
        if crumb_resp.status_code == 200:
            crumb = crumb_resp.text.strip()
            if crumb and "<" not in crumb and len(crumb) < 50 and "Too Many" not in crumb:
                s._crumb = crumb
                _profile_session = s
                return s
        logger.warning(f"Profile crumb fetch failed: status={crumb_resp.status_code}")
    except Exception as e:
        logger.warning(f"Profile session init failed: {e}")
    return None


def _fetch_profile_curl(symbol: str) -> dict:
    """Fetch assetProfile via curl_cffi (bypasses yfinance crumb issues). Never raises."""
    empty = {"sector": None, "industry": None, "country": None, "description": None}
    session = _get_profile_session()
    if session is None:
        return empty
    try:
        url = (
            f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/"
            f"{symbol}?modules=assetProfile&crumb={session._crumb}"
        )
        resp = session.get(url, timeout=10)
        if resp.status_code != 200:
            return empty
        data = resp.json()
        profile = (
            data.get("quoteSummary", {})
            .get("result", [{}])[0]
            .get("assetProfile", {})
        )
        raw = profile.get("longBusinessSummary", "")
        description = None
        if raw:
            sentences = raw.split(". ")
            description = ". ".join(sentences[:2]).strip()
            if not description.endswith("."):
                description += "."
        return {
            "sector": profile.get("sector") or None,
            "industry": profile.get("industry") or None,
            "country": profile.get("country") or None,
            "description": description,
        }
    except Exception as e:
        logger.debug(f"curl_cffi profile fetch failed for {symbol}: {e}")
        return empty


def _get_yf_info_safe(symbol: str) -> dict:
    """Fetch sector/industry/country/description. Tries curl_cffi first, falls back to yfinance."""
    # Try curl_cffi first — bypasses Yahoo's bot detection via Chrome TLS impersonation
    result = _fetch_profile_curl(symbol)
    if result["sector"] or result["description"]:
        return result

    # Fallback to yfinance
    try:
        info = yf.Ticker(symbol).info or {}
        raw = info.get("longBusinessSummary", "")
        description = None
        if raw:
            sentences = raw.split(". ")
            description = ". ".join(sentences[:2]).strip()
            if not description.endswith("."):
                description += "."
        return {
            "sector": info.get("sector") or None,
            "industry": info.get("industry") or None,
            "country": info.get("country") or None,
            "description": description,
        }
    except Exception as e:
        logger.debug(f"yf.info failed for {symbol}: {e}")
        return result if result["description"] else {"sector": None, "industry": None, "country": None, "description": None}


# ── Custom exception for cooldown state ──────────────────────────────────────
class CooldownActiveError(Exception):
    """Raised when a fetch is attempted during Yahoo Finance rate-limit cooldown."""
    def __init__(self, remaining_seconds: int):
        self.remaining_seconds = remaining_seconds
        super().__init__(
            f"Yahoo Finance rate-limit cooldown active — {remaining_seconds}s remaining"
        )


# ── Shared requests session ─────────────────────────────────────────────────
# A single persistent session means cookies (including the crumb) are fetched
# once and reused for every ticker, instead of a fresh handshake per symbol.
# This is the primary cause of 429s when processing many symbols in a loop.
_yf_session: Optional[requests.Session] = None

# ── Global rate-limit cooldown ───────────────────────────────────────────────
# Track consecutive 429s. After COOLDOWN_THRESHOLD failures, pause ALL
# yfinance requests for COOLDOWN_SECONDS to let Yahoo Finance reset the block.
_consecutive_429s: int = 0
_cooldown_until: Optional[float] = None
COOLDOWN_THRESHOLD = 5       # consecutive failures before cooldown
COOLDOWN_SECONDS   = 300     # 5 minutes (reduced from 30 min — light fetches are single requests)
COOLDOWN_SECONDS_BATCH = 1800  # 30 minutes for batch operations (more aggressive)


def _record_429(batch: bool = False) -> None:
    global _consecutive_429s, _cooldown_until
    _consecutive_429s += 1
    if _consecutive_429s >= COOLDOWN_THRESHOLD:
        seconds = COOLDOWN_SECONDS_BATCH if batch else COOLDOWN_SECONDS
        _cooldown_until = time.time() + seconds
        logger.warning(
            f"Yahoo Finance rate-limit cooldown activated for {seconds // 60} min "
            f"({_consecutive_429s} consecutive failures)"
        )
        _reset_session()


def _record_success() -> None:
    global _consecutive_429s
    _consecutive_429s = 0


def is_cooled_down() -> bool:
    """Return True if we're in a cooldown period (should not make any YF requests)."""
    global _cooldown_until, _consecutive_429s
    if _cooldown_until is None:
        return False
    if time.time() < _cooldown_until:
        remaining = int(_cooldown_until - time.time())
        logger.debug(f"Yahoo Finance cooldown active — {remaining}s remaining")
        return True
    # Cooldown expired — reset
    _cooldown_until = None
    _consecutive_429s = 0
    logger.info("Yahoo Finance cooldown expired — resuming requests")
    return False


def get_cooldown_remaining() -> int:
    """Return seconds remaining in cooldown, or 0 if not in cooldown."""
    global _cooldown_until
    if _cooldown_until is None:
        return 0
    remaining = int(_cooldown_until - time.time())
    return max(remaining, 0)


def reset_cooldown() -> dict:
    """Manually clear the cooldown state. Returns status info."""
    global _cooldown_until, _consecutive_429s
    was_active = is_cooled_down()
    remaining = get_cooldown_remaining()
    _cooldown_until = None
    _consecutive_429s = 0
    _reset_session()
    logger.info(f"Cooldown manually reset (was_active={was_active}, remaining_was={remaining}s)")
    return {
        "was_active": was_active,
        "remaining_seconds_cleared": remaining,
        "status": "cooldown_cleared",
    }


def _get_session() -> requests.Session:
    """Return (and lazily warm-up) the shared yfinance session."""
    global _yf_session
    if _yf_session is not None:
        return _yf_session

    s = requests.Session()
    s.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/121.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
    })
    # Warm up: visit Yahoo Finance to get Cf_clearance / consent cookies
    # and obtain the crumb that yfinance needs for v10/quoteSummary calls.
    try:
        s.get("https://fc.yahoo.com", timeout=10)
        time.sleep(0.5)
        s.get("https://query2.finance.yahoo.com/v1/test/getcrumb", timeout=10)
        time.sleep(0.5)
    except Exception as e:
        logger.warning(f"Session warm-up partial failure (non-fatal): {e}")

    _yf_session = s
    return _yf_session


def _reset_session() -> None:
    """Force a fresh session on the next call (e.g. after persistent 429s)."""
    global _yf_session, _yf_crumb
    _yf_session = None
    _yf_crumb = None


# Cached crumb — fetched once and reused across requests
_yf_crumb: Optional[str] = None


def _get_crumb() -> str:
    """Return the cached Yahoo Finance crumb, fetching it if necessary."""
    global _yf_crumb
    if _yf_crumb:
        return _yf_crumb
    session = _get_session()
    resp = session.get("https://query2.finance.yahoo.com/v1/test/getcrumb", timeout=10)
    if resp.status_code == 429:
        # The A3 cookie is rate-limited — drop the session so next attempt gets fresh cookies
        _reset_session()
        raise RuntimeError("Yahoo Finance crumb endpoint rate-limited (429)")
    if resp.status_code != 200:
        raise RuntimeError(f"Yahoo Finance crumb fetch failed: HTTP {resp.status_code}")
    crumb = resp.text.strip()
    # A valid crumb is a short alphanumeric-ish string (no spaces, no HTML tags)
    if not crumb or " " in crumb or "<" in crumb or len(crumb) > 50:
        raise RuntimeError(f"Invalid Yahoo Finance crumb: {crumb[:80]!r}")
    _yf_crumb = crumb
    logger.debug("Yahoo Finance crumb refreshed")
    return _yf_crumb


def _strip_tz(index):
    """Remove timezone info from a DatetimeIndex."""
    if hasattr(index, "tz") and index.tz is not None:
        return index.tz_localize(None)
    return index


def _naive(dt):
    """Convert a possibly tz-aware datetime to naive."""
    if hasattr(dt, "tz") and dt.tz is not None:
        return dt.tz_localize(None)
    if hasattr(dt, "tzinfo") and dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


class YahooFetcher:
    """Fetches dividend and price data from Yahoo Finance via yfinance."""

    # ------------------------------------------------------------------ #
    # Exchange detection                                                   #
    # ------------------------------------------------------------------ #

    EXCHANGE_MAP = {
        ".NS": "NSE",
        ".BO": "BSE",
        ".TO": "TSX",
        ".L":  "LSE",
        ".AX": "ASX",
        ".IR": "ISE",
        ".T":  "JPX",
        ".HK": "HKG",
    }

    # Raw yfinance exchange codes → display names used by the UI filters
    YF_CODE_NORMALIZE = {
        "NYQ": "NYSE",
        "NYB": "NYSE",
        "PCX": "NYSE",   # NYSE Arca
        "ASE": "NYSE",   # NYSE American
        "NMS": "NASDAQ", # Nasdaq Global Select
        "NGM": "NASDAQ", # Nasdaq Global Market
        "NCM": "NASDAQ", # Nasdaq Capital Market
        "NasdaqGS": "NASDAQ",
        "NasdaqGM": "NASDAQ",
        "NasdaqCM": "NASDAQ",
        "TOR": "TSX",
        "IOB": "LSE",    # London Int'l Order Book
    }

    def _infer_exchange(self, symbol: str, yf_exchange: Optional[str] = None) -> str:
        for suffix, exchange in self.EXCHANGE_MAP.items():
            if symbol.endswith(suffix):
                return exchange
        if yf_exchange:
            return self.YF_CODE_NORMALIZE.get(yf_exchange, yf_exchange)
        # Guess NYSE vs NASDAQ for US tickers
        return "NASDAQ" if len(symbol) <= 4 else "NYSE"

    # ------------------------------------------------------------------ #
    # On-demand fetch (v8 chart API only — avoids quoteSummary/crumb)     #
    # ------------------------------------------------------------------ #

    def fetch_stock_light(
        self,
        symbol: str,
        years: int = 10,
        with_profile: bool = True,
    ) -> tuple[Optional[dict], list[dict]]:
        """
        Fetch dividend history by calling the Yahoo Finance v8 chart API directly.
        Bypasses yfinance's session management, which fails in containerised environments
        (Docker) due to yfinance's broken cookie/crumb initialisation flow, even though
        the underlying API endpoints work fine.

        Returns (stock_dict, dividend_records). A stock that paid no dividends in the period
        comes back with its latest price and no records; (None, []) means Yahoo has neither.

        Raises CooldownActiveError if Yahoo Finance rate-limit cooldown is active.
        """
        if is_cooled_down():
            remaining = get_cooldown_remaining()
            logger.warning(f"fetch_light {symbol}: cooldown active ({remaining}s remaining)")
            raise CooldownActiveError(remaining)
        try:
            # The v8 chart API does not require cookies or a crumb — only
            # quoteSummary (v10) and similar endpoints need authentication.
            # curl_cffi impersonates Chrome's TLS fingerprint, bypassing Yahoo
            # Finance's bot detection that blocks Python requests on datacenter IPs.
            if _CURL_AVAILABLE:
                _do_get = lambda url, **kw: _curl_requests.get(
                    url, impersonate="chrome120", **kw
                )
            else:
                _do_get = lambda url, **kw: requests.get(url, **kw)

            _HEADERS = {
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
                "events": "dividends,splits",
            }
            # Try query2 first, fall back to query1
            chart_resp = _do_get(
                f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}",
                headers=_HEADERS,
                params=params,
                timeout=15,
            )
            if chart_resp.status_code == 429:
                chart_resp = _do_get(
                    f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
                    headers=_HEADERS,
                    params=params,
                    timeout=15,
                )
            if chart_resp.status_code == 429:
                global _yf_crumb
                _yf_crumb = None  # invalidate crumb so next attempt fetches a fresh one
                _record_429()
                if is_cooled_down():
                    raise CooldownActiveError(get_cooldown_remaining())
                raise RuntimeError("Yahoo Finance rate-limited (429)")
            chart_resp.raise_for_status()

            payload = chart_resp.json()
            result = (payload.get("chart", {}).get("result") or [None])[0]
            if result is None:
                logger.debug(f"fetch_light {symbol}: no chart result")
                return None, []

            meta = result.get("meta", {})
            currency = meta.get("currency", "USD") or "USD"
            exchange = self._infer_exchange(symbol, meta.get("exchangeName"))
            company_name = meta.get("longName") or meta.get("shortName") or symbol

            # Price timestamps and closes from the chart payload
            timestamps = result.get("timestamp", [])
            closes = (
                result.get("indicators", {})
                .get("quote", [{}])[0]
                .get("close", [])
            )
            # Build a simple sorted list of (datetime, price) for lookups
            prices: list[tuple[datetime, float]] = []
            for ts, cl in zip(timestamps, closes):
                if ts is not None and cl is not None:
                    prices.append((datetime.fromtimestamp(ts), float(cl)))
            prices.sort()

            # Dividend events, {unix_ts_str: {amount, date}}, as a sorted list of (date, amount)
            # within the requested range
            start_dt = datetime.now() - timedelta(days=365 * years)
            div_list: list[tuple[datetime, float]] = []
            for ts_str, d in result.get("events", {}).get("dividends", {}).items():
                dt = datetime.fromtimestamp(int(ts_str))
                if dt >= start_dt:
                    div_list.append((dt, float(d["amount"])))
            div_list.sort()

            # A stock without dividends still has a price, which holdings need for their value;
            # the caller decides whether to keep it
            if not div_list and not prices:
                logger.debug(f"fetch_light {symbol}: no prices or dividends in chart response")
                return None, []

            def _closest_price(target: datetime) -> Optional[float]:
                """Return the most recent close on or before target."""
                best = None
                for pt, pr in prices:
                    if pt <= target:
                        best = pr
                    else:
                        break
                return best

            dividend_records = []
            for div_dt, div_amount in div_list:
                price = _closest_price(div_dt)
                yld = round((div_amount / price) * 100, 4) if price and price > 0 else None
                dividend_records.append({
                    "dividend_date": div_dt.date(),
                    "dividend_per_share": round(div_amount, 4),
                    "share_price_on_dividend_date": round(price, 4) if price else None,
                    "dividend_yield_pct": yld,
                })

            _record_success()

            current_price = prices[-1][1] if prices else 0.0
            if div_list:
                trailing_cutoff = datetime.now() - timedelta(days=366)
                ttm_total = sum(a for dt, a in div_list if dt >= trailing_cutoff)
                avg_yield = (
                    round((ttm_total / current_price) * 100, 3)
                    if ttm_total and current_price > 0
                    else round((div_list[-1][1] / current_price) * 100, 3) if current_price > 0 else 0.0
                )
            else:
                avg_yield = None  # no yield at all, which also keeps it out of the screener

            stock_dict = {
                "ticker_symbol": symbol,
                "company_name": company_name,
                "exchange": exchange,
                "currency": currency,
                "market_cap": 0,
                "avg_dividend_yield": avg_yield,
                "last_price": round(current_price, 4) if prices else None,
                "last_fetched_at": datetime.utcnow(),
            }
            if with_profile:
                # The profile lookup (quoteSummary) is what Yahoo rate-limits first. Bulk
                # refreshes skip it, and leaving the keys out keeps existing profiles intact.
                meta = _get_yf_info_safe(symbol)
                stock_dict.update({
                    "country": meta["country"] or "Unknown",
                    "sector": meta["sector"] or "Unknown",
                    "industry": meta["industry"] or "Unknown",
                    "description": meta["description"],
                })
            return stock_dict, dividend_records

        except CooldownActiveError:
            raise
        except Exception as e:
            err_str = str(e)
            _TRANSIENT_KEYWORDS = ("429", "Too Many", "Expecting value", "EOF")
            if any(kw in err_str for kw in _TRANSIENT_KEYWORDS):
                _record_429()
                if is_cooled_down():
                    raise CooldownActiveError(get_cooldown_remaining()) from e
            logger.error(f"fetch_light {symbol}: {e}")
            raise

    # ------------------------------------------------------------------ #
    # Single ticker — full fetch                                           #
    # ------------------------------------------------------------------ #

    def fetch_stock_full(
        self,
        symbol: str,
        years: int = 10,
        min_yield: float = 0.0,
        min_payments: int = 1,
    ) -> tuple[Optional[dict], list[dict]]:
        """
        Fetch stock metadata + full dividend history.
        Returns:
            (stock_dict, dividend_records)
            stock_dict  – ready to pass into crud.upsert_stock()
            dividend_records – list of dicts matching DividendRecord columns
        """
        if is_cooled_down():
            logger.warning(f"Skipping {symbol} — Yahoo Finance rate-limit cooldown active")
            return None, []

        # Retry up to 3 times with exponential backoff on rate-limit errors
        max_retries = 3
        info: dict = {}
        ticker_obj = None
        for attempt in range(max_retries):
            try:
                session = _get_session()
                ticker_obj = yf.Ticker(symbol, session=session)
                info = ticker_obj.info or {}
                if info.get("quoteType") is None and attempt < max_retries - 1:
                    # Empty info = rate-limited crumb; reset session and back off
                    _record_429()
                    _reset_session()
                    wait = 2 ** attempt * 5
                    logger.warning(f"{symbol}: empty info on attempt {attempt + 1}, resetting session, retrying in {wait}s")
                    time.sleep(wait)
                    continue
                _record_success()
                break
            except Exception as e:
                err_str = str(e)
                retryable = any(kw in err_str for kw in (
                    "429", "Too Many", "EOF", "Expecting value", "JSONDecodeError",
                    "ConnectionError", "RemoteDisconnected", "timeout",
                ))
                if retryable:
                    _record_429()
                    _reset_session()  # force new cookie/crumb on next attempt
                if attempt < max_retries - 1 and retryable:
                    wait = 2 ** attempt * 5
                    logger.warning(f"{symbol}: {e}, retrying in {wait}s (attempt {attempt + 1})")
                    time.sleep(wait)
                else:
                    logger.error(f"{symbol}: {e} (giving up after {attempt + 1} attempts)")
                    return None, []

        if is_cooled_down():
            return None, []

        if ticker_obj is None:
            return None, []

        # ── Dividend history ──
        try:
            hist = ticker_obj.history(period=f"{years}y", auto_adjust=False, actions=True)
        except Exception as e:
            logger.error(f"{symbol} history: {e}")
            return None, []

        if hist is None or hist.empty:
            return None, []

        hist.index = _strip_tz(hist.index)

        if "Dividends" not in hist.columns:
            return None, []

        divs = hist[hist["Dividends"] > 0]
        if len(divs) < min_payments:
            return None, []

        dividend_records = []
        for idx, row in divs.iterrows():
            try:
                div_amount = float(row["Dividends"])
                price = float(row["Close"])
                yld = round((div_amount / price) * 100, 4) if price > 0 else None
                dividend_records.append({
                    "dividend_date": idx.date() if hasattr(idx, "date") else idx,
                    "dividend_per_share": round(div_amount, 4),
                    "share_price_on_dividend_date": round(price, 4),
                    "dividend_yield_pct": yld,
                })
            except Exception as ex:
                logger.debug(f"{symbol} row {idx}: {ex}")

        if not dividend_records:
            return None, []

        # ── Yield calculation ──
        last_price = float(hist["Close"].iloc[-1]) if not hist.empty else 0.0
        trailing_cutoff = datetime.now() - timedelta(days=366)
        ttm_divs = divs[divs.index >= trailing_cutoff]["Dividends"]
        if not ttm_divs.empty and last_price > 0:
            avg_yield = round((float(ttm_divs.sum()) / last_price) * 100, 3)
        elif last_price > 0:
            avg_yield = round((float(divs["Dividends"].iloc[-1]) / last_price) * 100, 3)
        else:
            avg_yield = 0.0

        if avg_yield < min_yield:
            logger.debug(f"{symbol}: yield {avg_yield:.2f}% < threshold, skipping")
            return None, []

        # ── Stock metadata ──
        raw_summary = info.get("longBusinessSummary", "")
        description = None
        if raw_summary:
            sentences = raw_summary.split(". ")
            description = ". ".join(sentences[:2]).strip()
            if not description.endswith("."):
                description += "."
        stock_dict = {
            "ticker_symbol": symbol,
            "company_name": info.get("longName") or info.get("shortName") or symbol,
            "exchange": self._infer_exchange(symbol, info.get("exchange")),
            "country": info.get("country", "Unknown"),
            "currency": info.get("currency", "USD"),
            "sector": info.get("sector", "Unknown"),
            "industry": info.get("industry", "Unknown"),
            "description": description,
            "market_cap": info.get("marketCap", 0) or 0,
            "avg_dividend_yield": avg_yield,
            "payment_frequency": payment_frequency(r["dividend_date"] for r in dividend_records),
            "yield_consistency_score": yield_consistency(r["dividend_yield_pct"] for r in dividend_records),
            "last_fetched_at": datetime.utcnow(),
        }

        return stock_dict, dividend_records

    # ------------------------------------------------------------------ #
    # Batch fetch for index constituents                                   #
    # ------------------------------------------------------------------ #

    def fetch_batch(
        self,
        symbols: list[str],
        index_config: dict,
        years: int = 10,
        min_yield: float = 0.0,
        min_payments: int = 1,
        chunk_size: int = 50,  # kept for API compatibility, unused
    ) -> list[tuple[dict, list[dict]]]:
        """
        Download dividend + price data for a list of symbols using the v8 chart API directly.
        Replaced yf.download() which requires crumb/cookie initialisation that gets
        rate-limited in containerised/cloud environments (Docker, Render).
        Each symbol makes one direct call to the Yahoo Finance v8 chart endpoint.
        """
        if is_cooled_down():
            logger.warning("fetch_batch: cooldown active — skipping entire batch")
            return []

        # curl_cffi impersonates Chrome's TLS fingerprint, bypassing Yahoo Finance's
        # bot detection that blocks Python requests regardless of headers/cookies/IPs.
        # Falls back to the shared requests session if curl_cffi is not installed.
        if _CURL_AVAILABLE:
            logger.info("fetch_batch: using curl_cffi Chrome impersonation")
            _do_get = lambda url, **kw: _curl_requests.get(
                url, impersonate="chrome120", **kw
            )
        else:
            logger.warning("fetch_batch: curl_cffi not available, falling back to requests (may be blocked)")
            session = _get_session()
            _do_get = lambda url, **kw: session.get(url, **kw)

        _HEADERS = {
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
            "events": "dividends,splits",
        }
        start_dt = datetime.now() - timedelta(days=365 * years)
        trailing_cutoff = datetime.now() - timedelta(days=366)

        results: list[tuple[dict, list[dict]]] = []

        for i, symbol in enumerate(symbols):
            if is_cooled_down():
                logger.warning("fetch_batch: cooldown triggered mid-batch — stopping")
                break

            try:
                chart_resp = _do_get(
                    f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}",
                    headers=_HEADERS, params=params, timeout=15,
                )
                if chart_resp.status_code == 429:
                    time.sleep(2)
                    chart_resp = _do_get(
                        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
                        headers=_HEADERS, params=params, timeout=15,
                    )
                if chart_resp.status_code == 429:
                    _record_429(batch=True)
                    time.sleep(5)
                    if is_cooled_down():
                        break
                    logger.warning(f"fetch_batch {symbol}: rate-limited (429), skipping")
                    continue
                if chart_resp.status_code == 404:
                    logger.debug(f"fetch_batch {symbol}: not found (404), skipping")
                    continue
                chart_resp.raise_for_status()

                payload = chart_resp.json()
                result = (payload.get("chart", {}).get("result") or [None])[0]
                if result is None:
                    logger.debug(f"fetch_batch {symbol}: no chart result")
                    continue

                meta = result.get("meta", {})
                currency = index_config.get("currency") or meta.get("currency", "USD") or "USD"
                exchange = self._infer_exchange(symbol, meta.get("exchangeName"))
                company_name = meta.get("longName") or meta.get("shortName") or symbol

                raw_divs = result.get("events", {}).get("dividends", {})
                if not raw_divs:
                    logger.debug(f"fetch_batch {symbol}: no dividends")
                    continue

                div_list: list[tuple[datetime, float]] = []
                for ts_str, d in raw_divs.items():
                    dt = datetime.fromtimestamp(int(ts_str))
                    if dt >= start_dt:
                        div_list.append((dt, float(d["amount"])))
                div_list.sort()

                if len(div_list) < min_payments:
                    logger.debug(f"fetch_batch {symbol}: {len(div_list)} dividends < min {min_payments}, skipping")
                    continue

                timestamps = result.get("timestamp", [])
                closes = (
                    result.get("indicators", {}).get("quote", [{}])[0].get("close", [])
                )
                prices: list[tuple[datetime, float]] = []
                for ts, cl in zip(timestamps, closes):
                    if ts is not None and cl is not None:
                        prices.append((datetime.fromtimestamp(ts), float(cl)))
                prices.sort()

                def _closest_price(target: datetime) -> Optional[float]:
                    best = None
                    for pt, pr in prices:
                        if pt <= target:
                            best = pr
                        else:
                            break
                    return best

                dividend_records = []
                for div_dt, div_amount in div_list:
                    price = _closest_price(div_dt)
                    yld = round((div_amount / price) * 100, 4) if price and price > 0 else None
                    dividend_records.append({
                        "dividend_date": div_dt.date(),
                        "dividend_per_share": round(div_amount, 4),
                        "share_price_on_dividend_date": round(price, 4) if price else None,
                        "dividend_yield_pct": yld,
                    })

                current_price = prices[-1][1] if prices else 0.0
                ttm_total = sum(a for dt, a in div_list if dt >= trailing_cutoff)
                avg_yield = (
                    round((ttm_total / current_price) * 100, 3)
                    if ttm_total and current_price > 0
                    else round((div_list[-1][1] / current_price) * 100, 3) if current_price > 0 else 0.0
                )

                if avg_yield < min_yield:
                    logger.debug(f"fetch_batch {symbol}: yield {avg_yield:.2f}% < threshold, skipping")
                    continue

                meta = _get_yf_info_safe(symbol)
                stock_dict = {
                    "ticker_symbol": symbol,
                    "company_name": company_name,
                    "exchange": exchange,
                    "country": meta["country"] or index_config.get("country", "Unknown"),
                    "currency": currency,
                    "sector": meta["sector"] or "Unknown",
                    "industry": meta["industry"] or "Unknown",
                    "description": meta["description"],
                    "market_cap": 0,
                    "data_source": index_config.get("name", "bulk"),
                    "avg_dividend_yield": avg_yield,
                    "last_fetched_at": datetime.utcnow(),
                }
                results.append((stock_dict, dividend_records))
                _record_success()

            except Exception as e:
                err_str = str(e)
                if any(kw in err_str for kw in ("429", "Too Many", "Expecting value", "EOF")):
                    _record_429(batch=True)
                    if is_cooled_down():
                        break
                logger.warning(f"fetch_batch {symbol}: {e}")

            # Pause between symbols to avoid rate-limiting
            if i < len(symbols) - 1:
                time.sleep(2)

        return results

    def get_sp500_symbols(self, limit: int = 100) -> list[str]:
        """Fetch S&P 500 symbols from Wikipedia table."""
        try:
            tables = pd.read_html("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies")
            symbols = tables[0]["Symbol"].head(limit).tolist()
            logger.info(f"Fetched {len(symbols)} S&P 500 symbols from Wikipedia")
            return symbols
        except Exception as e:
            logger.warning(f"Wikipedia fetch failed, using fallback list: {e}")
            return [
                "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "JPM", "JNJ", "XOM",
                "PG", "HD", "MA", "CVX", "ABBV", "PFE", "KO", "PEP", "COST",
                "WMT", "ABT", "DHR", "ACN", "NEE", "VZ", "TXN", "LIN", "MRK",
                "T", "IBM", "MDT", "HON", "UPS", "QCOM", "PM", "LOW", "C",
                "CAT", "GE", "MMM", "CVS", "MO", "SO", "DUK", "PLD", "AMT",
                "CL", "CSX", "EOG", "APD", "CCI", "NSC", "WM", "PGR", "MMC",
            ]
