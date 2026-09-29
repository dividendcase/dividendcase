from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List


# ── Portfolio Group schemas ──────────────────────────────────────────────

class PortfolioCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class PortfolioUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class PortfolioItem(BaseModel):
    id: int
    name: str
    display_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Investment schemas ───────────────────────────────────────────────────

class InvestmentAdd(BaseModel):
    ticker: str
    purchase_date: date
    quantity: float = Field(gt=0, le=1_000_000)
    purchase_price: Optional[float] = Field(default=None, gt=0)
    purchase_currency: Optional[str] = None
    portfolio_id: Optional[int] = None


class InvestmentMove(BaseModel):
    target_portfolio_id: int


class InvestmentUpdate(BaseModel):
    quantity: Optional[float] = Field(default=None, gt=0, le=1_000_000)
    purchase_price: Optional[float] = Field(default=None, gt=0)
    purchase_date: Optional[date] = None
    purchase_currency: Optional[str] = None


class InvestmentItem(BaseModel):
    id: int
    ticker_symbol: str
    purchase_date: date
    purchase_price: Optional[float]
    purchase_currency: Optional[str] = None
    quantity: float
    portfolio_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PortfolioDataPoint(BaseModel):
    date: str
    stock_values: dict[str, float]
    stock_dividends: dict[str, float]
    total_investment_value: float
    total_dividends: float
    total_portfolio_value: float
    benchmark_value: float


class PortfolioAnalysisResponse(BaseModel):
    investments: list[InvestmentItem]
    total_initial_investment: float
    benchmark_ticker: str
    benchmark_name: str
    currency: str
    # True when every amount was converted into `currency`; otherwise each stays in its own
    converted: bool = False
    unconverted_currencies: list[str] = []
    exchange_map: dict[str, str]
    currency_map: dict[str, str]
    purchase_currency_map: dict[str, str] = {}
    sector_map: dict[str, str] = {}
    country_map: dict[str, str] = {}
    industry_map: dict[str, str] = {}
    frequency_map: dict[str, str] = {}
    data_points: list[PortfolioDataPoint]


class CalendarEntry(BaseModel):
    ticker_symbol: str
    company_name: str
    expected_date: date
    estimated_amount: float       # per-share dividend × total shares
    amount_per_share: float       # last dividend per share
    total_shares: float
    currency: str
    payment_frequency: str
    # Withholding at source for the user's tax residence (services/withholding.py)
    source_country: Optional[str] = None     # "US", or a country name v1 doesn't estimate
    withholding_rate: Optional[float] = None  # percent; None = not estimated (shown gross)
    withholding_basis: Optional[str] = None   # treaty, statutory, domestic, none, override
    withholding_note: Optional[str] = None
    net_amount: float = 0.0                    # estimated_amount after withholding


class IncomeCalendarResponse(BaseModel):
    entries: List[CalendarEntry]
    monthly_totals: dict[str, float]   # {"2026-01": 125.50, ...}
    annual_total: float
    currency_totals: dict[str, float]  # {"USD": 500.0, "INR": 2000.0}
    monthly_totals_by_currency: dict[str, dict[str, float]] = {}  # {"USD": {"2026-01": 100.0, ...}}
    # After withholding, and what wasn't estimated
    residence: Optional[str] = None
    net_currency_totals: dict[str, float] = {}
    net_monthly_totals_by_currency: dict[str, dict[str, float]] = {}
    unestimated_sources: list[str] = []


# ── Excel Import/Export schemas ─────────────────────────────────────────

class ImportRowResult(BaseModel):
    sheet_name: str
    row_number: int
    ticker: str
    status: str  # "created" | "skipped_duplicate" | "skipped_invalid"
    reason: Optional[str] = None


class ImportSummary(BaseModel):
    total_rows_processed: int
    created: int
    skipped_duplicate: int
    skipped_invalid: int
    portfolios_created: list[str]
    portfolios_merged: list[str]
    has_unknown_stocks: bool
    details: list[ImportRowResult]
