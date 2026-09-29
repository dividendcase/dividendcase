"""
APScheduler, started inside FastAPI's lifespan so background work runs in the same
process as the local server. Data-refresh jobs are registered here as they are added.
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler(timezone="UTC")
