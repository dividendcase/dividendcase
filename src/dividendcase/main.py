import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles

from dividendcase import __version__
from dividendcase.api.v1.router import api_router
from dividendcase.config import settings
from dividendcase.migrate import upgrade_database
from dividendcase.scheduler.tasks import scheduler
from dividendcase.services.refresh import fill_derived_fields, queue_holdings, queue_screener, refresher
from dividendcase.services.updates import check_for_update, update_status
from dividendcase.services.fx import refresh_rates
from dividendcase.services.benchmark import ensure_beats_benchmark

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

# The Next.js static export, copied here by scripts/build_web.py
WEB_DIR = Path(__file__).parent / "web"


@asynccontextmanager
async def lifespan(app: FastAPI):
    from dividendcase.database import engine

    # Create or upgrade the database, saving a copy first if it already holds data
    backup = await asyncio.to_thread(upgrade_database, settings.resolved_database_url, settings.backup_dir)
    if backup:
        logger.info("A copy of the database from before the upgrade is in %s", backup)
    logger.info("Database ready at %s", settings.resolved_database_url)
    await fill_derived_fields()

    refresher.start()
    if settings.auto_refresh:
        now = datetime.now(timezone.utc)
        # Holdings first (missing or older than a day), then the screener (older than a week).
        # The periodic checks are cheap: they only queue what is out of date.
        scheduler.add_job(queue_holdings, "date", run_date=now + timedelta(seconds=3))
        scheduler.add_job(queue_screener, "date", run_date=now + timedelta(seconds=20), kwargs={"scheduled": True})
        scheduler.add_job(queue_holdings, "interval", hours=6, coalesce=True, max_instances=1)
        scheduler.add_job(queue_screener, "interval", hours=24, coalesce=True, max_instances=1, kwargs={"scheduled": True})
        # Which stocks beat their local index: weekly, a handful of index requests
        scheduler.add_job(ensure_beats_benchmark, "date", run_date=now + timedelta(seconds=90))
        scheduler.add_job(ensure_beats_benchmark, "interval", hours=24, coalesce=True, max_instances=1)
        # Exchange rates: the full history once, then new days (cheap when up to date)
        scheduler.add_job(refresh_rates, "date", run_date=now + timedelta(seconds=5))
        scheduler.add_job(refresh_rates, "interval", hours=6, coalesce=True, max_instances=1)
    if settings.check_updates:
        # Once a day, and only if the user hasn't turned it off in Settings
        scheduler.add_job(check_for_update, "date", run_date=datetime.now(timezone.utc) + timedelta(seconds=30))
        scheduler.add_job(check_for_update, "interval", hours=24, coalesce=True, max_instances=1)
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)
    await refresher.stop()
    await engine.dispose()


app = FastAPI(
    title="DividendCase",
    description="Local API for the open-source DividendCase app",
    version=__version__,
    lifespan=lifespan,
)

# Only answer requests addressed to this machine, which blocks DNS-rebinding attacks
# from web pages the user visits while the app is running
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response


app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "version": __version__}


@app.get("/api/v1/app-info")
async def app_info():
    """Version, data folder and whether a newer release is out (Settings page and sidebar)."""
    return {
        "version": __version__,
        "data_dir": str(settings.data_dir),
        "backup_dir": str(settings.backup_dir),
        **update_status(),
    }


if (WEB_DIR / "index.html").exists():
    # Last, so /api and /health take precedence
    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
else:
    logger.warning("No built interface in %s: run `uv run python scripts/build_web.py`", WEB_DIR)
