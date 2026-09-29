from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from dividendcase.database import get_db
from dividendcase.models.scheduler_run import SchedulerRun
from sqlalchemy import select

router = APIRouter()


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    db_connected = False
    try:
        await db.execute(text("SELECT 1"))
        db_connected = True
    except Exception:
        pass

    last_run = None
    try:
        result = await db.execute(
            select(SchedulerRun)
            .where(SchedulerRun.status == "success")
            .order_by(SchedulerRun.finished_at.desc())
            .limit(1)
        )
        run = result.scalar_one_or_none()
        if run:
            last_run = run.finished_at.isoformat() if run.finished_at else None
    except Exception:
        pass

    return {
        "status": "ok" if db_connected else "degraded",
        "db_connected": db_connected,
        "last_data_update": last_run,
    }
