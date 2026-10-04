from sqlalchemy import Column, Integer, String, BigInteger, Boolean, Numeric, DateTime, Text, func
from dividendcase.database import Base


class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    ticker_symbol = Column(String(20), nullable=False, unique=True, index=True)
    company_name = Column(String(255), nullable=False)
    exchange = Column(String(20), nullable=False, index=True)
    country = Column(String(50))
    currency = Column(String(10), default="USD")
    sector = Column(String(100))
    industry = Column(String(100))
    description = Column(Text, nullable=True)
    market_cap = Column(BigInteger)
    # mortgage_reit, bdc, closed_end_fund, energy_trust, utility_reit, preferred, tobacco_telecom, index
    dividend_category = Column(String(50))
    # sp500, nifty50, tsx60, high_yield_discovery
    data_source = Column(String(50))
    avg_dividend_yield = Column(Numeric(6, 3))
    beats_benchmark = Column(Boolean, nullable=True)
    benchmark_ticker = Column(String(20), nullable=True)
    payment_frequency = Column(String(20))  # monthly, quarterly, annual
    yield_consistency_score = Column(Numeric(4, 2))
    # The latest close, from the fetch at last_fetched_at; stocks without dividends have only this
    last_price = Column(Numeric(12, 4))
    last_fetched_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
