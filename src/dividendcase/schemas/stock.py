import math
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


def _nan_to_none(v):
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


class StockSummary(BaseModel):
    ticker_symbol: str
    company_name: str
    exchange: str
    country: Optional[str] = None
    currency: Optional[str] = "USD"
    sector: Optional[str] = None
    dividend_category: Optional[str] = None
    avg_dividend_yield: Optional[float] = None
    beats_benchmark: Optional[bool] = None
    benchmark_ticker: Optional[str] = None
    payment_frequency: Optional[str] = None
    yield_consistency_score: Optional[float] = None

    model_config = {"from_attributes": True}

    @field_validator("avg_dividend_yield", "yield_consistency_score", mode="before")
    @classmethod
    def clean_floats(cls, v):
        return _nan_to_none(v)


class StockDetail(StockSummary):
    industry: Optional[str] = None
    description: Optional[str] = None
    market_cap: Optional[int] = None
    data_source: Optional[str] = None
    last_fetched_at: Optional[datetime] = None


class StocksListResponse(BaseModel):
    stocks: list[StockSummary]
    total: int
    page: int
    page_size: int
