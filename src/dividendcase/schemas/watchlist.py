from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


# ── Watchlist Group schemas ──────────────────────────────────────────────

class WatchlistGroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class WatchlistGroupUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class WatchlistGroupItem(BaseModel):
    id: int
    name: str
    display_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Watchlist Item schemas ───────────────────────────────────────────────

class WatchlistAdd(BaseModel):
    ticker: str
    group_id: Optional[int] = None


class WatchlistMove(BaseModel):
    target_group_id: int


class WatchlistItem(BaseModel):
    id: int
    ticker_symbol: str
    watchlist_group_id: Optional[int] = None
    added_at: datetime

    model_config = {"from_attributes": True}
