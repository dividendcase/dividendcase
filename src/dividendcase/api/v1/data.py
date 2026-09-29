"""Data refresh status and controls, shown on the Data page."""
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from dividendcase.services.fx import rates_summary
from dividendcase.services.universe import markets
from dividendcase.services.refresh import data_summary, queue_holdings, queue_screener, refresher

router = APIRouter()


class RefreshRequest(BaseModel):
    scope: Literal["holdings", "screener"]
    # holdings only: refetch everything, not just what's missing or older than a day
    force: bool = False


@router.get("/status")
async def refresh_status():
    return {**refresher.status(), **await data_summary(), **await rates_summary()}


@router.get("/markets")
async def screener_markets():
    """The market groups the screener can download (first-run setup and Settings)."""
    return {"markets": markets()}


@router.post("/refresh", status_code=202)
async def start_refresh(body: RefreshRequest):
    queued = await queue_holdings(force=body.force) if body.scope == "holdings" else await queue_screener()
    return {"queued": queued}
