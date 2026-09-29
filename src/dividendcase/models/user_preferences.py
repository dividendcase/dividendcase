from sqlalchemy import JSON, Column, Boolean, String, DateTime, func, true, Uuid
from dividendcase.database import Base


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    user_id = Column(Uuid, primary_key=True)
    # Python-side defaults: the hosted Postgres set these in a migration, SQLite tables don't have them
    default_benchmark = Column(String(20), nullable=False, default="SP500")
    date_format = Column(String(20), nullable=False, default="DD/MM/YYYY")
    watchlist_collapsed = Column(Boolean, nullable=False, default=False)
    # Ask PyPI once a day whether a newer version exists (Settings → Check for updates)
    check_for_updates = Column(Boolean, nullable=False, default=True, server_default=true())
    # First-run setup. Totals are converted into home_currency; tax_residence (ISO country code)
    # will drive withholding estimates. screener_markets lists the index groups the screener
    # fetches (null = all). setup_completed_at stays empty until the setup screen is finished.
    home_currency = Column(String(3))
    tax_residence = Column(String(2))
    screener_markets = Column(JSON)
    setup_completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
