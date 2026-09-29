from pydantic import BaseModel
from typing import Optional
from datetime import date


class DividendRecord(BaseModel):
    ticker_symbol: str
    dividend_date: date
    dividend_per_share: float
    share_price_on_dividend_date: Optional[float] = None
    dividend_yield_pct: Optional[float] = None

    model_config = {"from_attributes": True}


class DividendMetrics(BaseModel):
    ticker_symbol: str
    company_name: str
    # TTM yield: sum of all dividends paid in the last 365 days / last known price × 100
    # This is the industry-standard "current yield" shown by Yahoo Finance, Morningstar, etc.
    ttm_yield: Optional[float] = None
    # Projected yield: last single payment × annual frequency / last known price × 100
    # Forward-looking; more stable than TTM for stocks that recently changed payout
    current_yield: Optional[float] = None
    # Annualised average: mean per-payment yield × payments_per_year, averaged over selected period
    avg_yield: Optional[float] = None
    yield_consistency_score: Optional[float] = None
    payment_frequency: Optional[str] = None
    payments_per_year: Optional[int] = None
    total_payments: int
    last_dividend_date: Optional[date] = None
    last_dividend_amount: Optional[float] = None
    annual_dividend_estimate: Optional[float] = None
    currency: Optional[str] = "USD"
    # ── Safety & Growth metrics ──────────────────────────────────────────────
    dividend_safety_score: Optional[float] = None       # 0-100
    safety_label: Optional[str] = None                  # "Safe" / "Moderate" / "At Risk"
    dividend_growth_cagr_3y: Optional[float] = None     # % CAGR over 3 years
    dividend_growth_cagr_5y: Optional[float] = None     # % CAGR over 5 years
    dividend_growth_cagr_10y: Optional[float] = None    # % CAGR over 10 years
    consecutive_growth_years: Optional[int] = None      # Years of consecutive dividend growth
    annual_dividends: Optional[dict] = None             # {2015: 3.20, 2016: 3.40, ...}


class DividendHistoryResponse(BaseModel):
    ticker_symbol: str
    company_name: str
    exchange: str
    currency: str
    records: list[DividendRecord]
    metrics: DividendMetrics


class FetchStockRequest(BaseModel):
    ticker: str
