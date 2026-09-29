from sqlalchemy import Column, Integer, String, DateTime, Text
from dividendcase.database import Base


class SchedulerRun(Base):
    __tablename__ = "scheduler_runs"

    id = Column(Integer, primary_key=True, index=True)
    job_name = Column(String(100))
    started_at = Column(DateTime(timezone=True))
    finished_at = Column(DateTime(timezone=True))
    status = Column(String(20))  # success, partial, failed
    records_updated = Column(Integer)
    error_message = Column(Text)
