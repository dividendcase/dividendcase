from sqlalchemy import BigInteger, Column, Date, ForeignKey, Integer, Numeric, String, UniqueConstraint
from dividendcase.database import Base


class PriceBar(Base):
    """One trading day of a stock's prices, as Yahoo's daily chart gives them (services/prices.py)."""

    __tablename__ = "price_bars"

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    ticker_symbol = Column(String(20), nullable=False, index=True)
    bar_date = Column(Date, nullable=False)  # the trading day, in the exchange's own time zone
    # Yahoo sometimes leaves out open, high and low for a day; close is always there
    open = Column(Numeric(14, 4))
    high = Column(Numeric(14, 4))
    low = Column(Numeric(14, 4))
    close = Column(Numeric(14, 4), nullable=False)
    adj_close = Column(Numeric(14, 4), nullable=False)  # adjusted for splits and dividends
    volume = Column(BigInteger)

    __table_args__ = (
        UniqueConstraint("ticker_symbol", "bar_date", name="uq_price_bar_ticker_date"),
    )
