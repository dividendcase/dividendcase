from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func, Uuid
from dividendcase.database import Base


class UserWatchlist(Base):
    __tablename__ = "user_watchlists"

    id = Column(Integer, primary_key=True, index=True)
    # Supabase auth.users UUID
    user_id = Column(Uuid, nullable=False, index=True)
    ticker_symbol = Column(String(20), nullable=False)
    watchlist_group_id = Column(
        Integer,
        ForeignKey("user_watchlist_groups.id", ondelete="CASCADE"),
        nullable=True,
    )
    added_at = Column(DateTime(timezone=True), server_default=func.now())
