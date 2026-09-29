from sqlalchemy import Column, Integer, String, Date, DateTime, Numeric, ForeignKey, UniqueConstraint, func, Uuid
from dividendcase.database import Base


class UserInvestment(Base):
    __tablename__ = "user_investments"
    __table_args__ = (
        UniqueConstraint("user_id", "ticker_symbol", "purchase_date", name="uq_user_investment"),
    )

    id = Column(Integer, primary_key=True, index=True)
    # Supabase auth.users UUID
    user_id = Column(Uuid, nullable=False, index=True)
    ticker_symbol = Column(String(20), nullable=False)
    purchase_date = Column(Date, nullable=False)
    purchase_price = Column(Numeric(14, 4), nullable=True)
    quantity = Column(Numeric(12, 4), nullable=False)
    purchase_currency = Column(String(10), nullable=True)
    portfolio_id = Column(
        Integer,
        ForeignKey("user_portfolios.id", ondelete="CASCADE"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
