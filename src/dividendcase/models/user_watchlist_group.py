from sqlalchemy import Column, Integer, String, DateTime, func, Uuid
from dividendcase.database import Base


class UserWatchlistGroup(Base):
    __tablename__ = "user_watchlist_groups"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Uuid, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
