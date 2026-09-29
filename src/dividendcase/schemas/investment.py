from pydantic import BaseModel
from typing import Optional


class InvestmentDataPoint(BaseModel):
    date: str                    # "Jan 2016"
    cumulative_divs: float       # total dividends received so far × shares
    portfolio_value: float       # shares × current price + cumulative_divs
    benchmark_value: float       # benchmark equivalent portfolio value


class InvestmentComparisonResponse(BaseModel):
    ticker: str
    start_year: int
    shares: float
    initial_investment: float    # shares × price at start
    benchmark_initial_investment: float
    benchmark_ticker: str        # e.g. "SPY", "^NSEI", "XIU.TO"
    benchmark_name: str          # e.g. "S&P 500 (SPY)", "Nifty 50"
    currency: str
    data_points: list[InvestmentDataPoint]
