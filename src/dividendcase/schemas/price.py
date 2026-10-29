import datetime as dt
from typing import Optional

from pydantic import BaseModel


class PriceBar(BaseModel):
    """One trading day. Yahoo sometimes leaves out open, high and low; close is always there."""

    date: dt.date
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: float
    adj_close: float  # adjusted for splits and dividends: for total return and moving averages
    volume: Optional[int] = None


class PriceHistoryResponse(BaseModel):
    ticker: str
    currency: str
    # When the bars were downloaded (UTC); with stale true, the download that just failed was newer
    fetched_at: Optional[dt.datetime] = None
    stale: bool
    bars: list[PriceBar]
