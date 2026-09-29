from sqlalchemy import JSON, Column, Date, DateTime, String, func

from dividendcase.database import Base


class FxRate(Base):
    """One day of European Central Bank reference rates: how much of each currency one euro buys."""

    __tablename__ = "fx_rates"

    date = Column(Date, primary_key=True)
    rates = Column(JSON, nullable=False)  # {"USD": 1.0852, "GBP": 0.8391, ...}
    source = Column(String(20), nullable=False, default="ECB")
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())
