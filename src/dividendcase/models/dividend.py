from sqlalchemy import Column, Integer, String, Date, Numeric, ForeignKey, UniqueConstraint
from dividendcase.database import Base


class DividendRecord(Base):
    __tablename__ = "dividend_records"

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    ticker_symbol = Column(String(20), nullable=False, index=True)
    dividend_date = Column(Date, nullable=False, index=True)
    dividend_per_share = Column(Numeric(10, 4), nullable=False)
    share_price_on_dividend_date = Column(Numeric(12, 4))
    dividend_yield_pct = Column(Numeric(8, 4))

    __table_args__ = (
        UniqueConstraint("ticker_symbol", "dividend_date", name="uq_ticker_date"),
    )
