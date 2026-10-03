"""The app's ticker for an Indian ISIN.

Indian brokers' holdings files name each security by ISIN and a shortened company name ("Reliance
Inds."), not by ticker. NSE publishes the ISIN of every equity and ETF it lists, so those lists come
first: INE002A01018 → RELIANCE.NS. Anything not on them (a company listed only on BSE) is looked up
with Yahoo's symbol search by ISIN. Names are never searched: shortened names match the wrong company.

The lists are downloaded when an import needs them and kept in memory for a day.
"""
import csv
import io
import logging
import re
import time
from dataclasses import dataclass
from typing import Iterable, Optional

import requests

from dividendcase.services.yahoo_fetcher import search_quotes

logger = logging.getLogger(__name__)

NSE_LISTS = (
    "https://archives.nseindia.com/content/equities/EQUITY_L.csv",  # equities
    "https://archives.nseindia.com/content/equities/eq_etfseclist.csv",  # ETFs
)
CACHE_SECONDS = 24 * 3600
ISIN = re.compile(r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$")

_cache: Optional[tuple[float, dict[str, str]]] = None


@dataclass(frozen=True)
class Found:
    ticker: str
    source: str  # "nse" or "yahoo"


def _key(header: str) -> str:
    return re.sub(r"[^a-z]+", "", header.lower())


def _parse_nse_list(text: str) -> dict[str, str]:
    """ISIN → NSE symbol from one of NSE's lists (columns found by name: SYMBOL, ISIN NUMBER)"""
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return {}
    columns = {_key(h): i for i, h in enumerate(rows[0])}
    symbol_at, isin_at = columns.get("symbol"), columns.get("isinnumber")
    if symbol_at is None or isin_at is None:
        return {}
    found = {}
    for row in rows[1:]:
        if len(row) > max(symbol_at, isin_at):
            isin, symbol = row[isin_at].strip().upper(), row[symbol_at].strip().upper()
            if ISIN.match(isin) and symbol:
                found.setdefault(isin, symbol)
    return found


def _download_nse_lists() -> dict[str, str]:
    headers = {
        # NSE turns away clients that don't look like a browser
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/csv,*/*",
    }
    found: dict[str, str] = {}
    for url in NSE_LISTS:
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            resp.raise_for_status()
            found.update(_parse_nse_list(resp.content.decode("utf-8-sig", errors="replace")))
        except Exception as e:
            logger.warning(f"Couldn't download NSE's list {url}: {e}")
    return found


def nse_symbols() -> dict[str, str]:
    """ISIN → NSE symbol for everything NSE lists ({} if NSE can't be reached)"""
    global _cache
    if _cache and time.monotonic() - _cache[0] < CACHE_SECONDS:
        return _cache[1]
    found = _download_nse_lists()
    if found:  # a failed download is tried again next time
        _cache = (time.monotonic(), found)
    return found


def _yahoo_lookup(isin: str) -> Optional[str]:
    """Yahoo's ticker for an ISIN on an Indian exchange, NSE before BSE"""
    symbols = [q.get("symbol", "") for q in search_quotes(isin, limit=5)]
    for suffix in (".NS", ".BO"):
        for symbol in symbols:
            if symbol.endswith(suffix):
                return symbol
    return None


def resolve(isins: Iterable[str]) -> dict[str, Optional[Found]]:
    """The ticker for each ISIN, or None where neither NSE nor Yahoo knows it (unlisted, delisted)"""
    wanted = [i.strip().upper() for i in isins]
    nse = nse_symbols() if wanted else {}
    result: dict[str, Optional[Found]] = {}
    for isin in wanted:
        if isin in result:
            continue
        if isin in nse:
            result[isin] = Found(f"{nse[isin]}.NS", "nse")
        elif ISIN.match(isin) and (ticker := _yahoo_lookup(isin)):
            result[isin] = Found(ticker, "yahoo")
        else:
            result[isin] = None
    return result
