from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update, func as sa_func
from uuid import UUID
from typing import Optional
from dividendcase.database import get_db
from dividendcase.models.user_watchlist import UserWatchlist
from dividendcase.models.user_watchlist_group import UserWatchlistGroup
from dividendcase.schemas.watchlist import (
    WatchlistItem,
    WatchlistAdd,
    WatchlistMove,
    WatchlistGroupCreate,
    WatchlistGroupUpdate,
    WatchlistGroupItem,
)
from dividendcase.api.v1.deps import _get_user_id

router = APIRouter()

MAX_WATCHLIST_GROUPS = 4


# ── Helper: ensure default group exists (lazy migration) ────────────────

async def _ensure_default_group(
    db: AsyncSession, user_id: UUID
) -> UserWatchlistGroup:
    """If the user has no groups yet, create 'Watchlist 1' and backfill
    any orphan watchlist items into it."""
    result = await db.execute(
        select(UserWatchlistGroup)
        .where(UserWatchlistGroup.user_id == user_id)
        .order_by(UserWatchlistGroup.display_order)
    )
    groups = result.scalars().all()

    if groups:
        return groups[0]

    # Create default group
    group = UserWatchlistGroup(user_id=user_id, name="Watchlist 1", display_order=0)
    db.add(group)
    await db.flush()

    # Backfill any existing items that have no group
    await db.execute(
        update(UserWatchlist)
        .where(
            UserWatchlist.user_id == user_id,
            UserWatchlist.watchlist_group_id.is_(None),
        )
        .values(watchlist_group_id=group.id)
    )
    await db.commit()
    await db.refresh(group)
    return group


# ── Group CRUD ──────────────────────────────────────────────────────────

@router.get("/groups", response_model=list[WatchlistGroupItem])
async def list_watchlist_groups(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    await _ensure_default_group(db, user_id)
    result = await db.execute(
        select(UserWatchlistGroup)
        .where(UserWatchlistGroup.user_id == user_id)
        .order_by(UserWatchlistGroup.display_order)
    )
    return result.scalars().all()


@router.post("/groups", response_model=WatchlistGroupItem, status_code=201)
async def create_watchlist_group(
    body: WatchlistGroupCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    # Enforce max
    count_result = await db.execute(
        select(sa_func.count())
        .select_from(UserWatchlistGroup)
        .where(UserWatchlistGroup.user_id == user_id)
    )
    if count_result.scalar() >= MAX_WATCHLIST_GROUPS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum of {MAX_WATCHLIST_GROUPS} watchlists allowed",
        )

    # Determine next display_order
    max_order = await db.execute(
        select(sa_func.coalesce(sa_func.max(UserWatchlistGroup.display_order), -1))
        .where(UserWatchlistGroup.user_id == user_id)
    )
    next_order = max_order.scalar() + 1

    group = UserWatchlistGroup(
        user_id=user_id,
        name=body.name.strip(),
        display_order=next_order,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@router.patch("/groups/{group_id}", response_model=WatchlistGroupItem)
async def rename_watchlist_group(
    group_id: int,
    body: WatchlistGroupUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    result = await db.execute(
        select(UserWatchlistGroup).where(
            UserWatchlistGroup.id == group_id,
            UserWatchlistGroup.user_id == user_id,
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Watchlist group not found")

    group.name = body.name.strip()
    await db.commit()
    await db.refresh(group)
    return group


@router.delete("/groups/{group_id}", status_code=204)
async def delete_watchlist_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    result = await db.execute(
        select(UserWatchlistGroup).where(
            UserWatchlistGroup.id == group_id,
            UserWatchlistGroup.user_id == user_id,
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Watchlist group not found")

    # Delete items in the group (cascade should handle it, but be explicit)
    await db.execute(
        delete(UserWatchlist).where(UserWatchlist.watchlist_group_id == group_id)
    )
    await db.delete(group)
    await db.commit()


# ── Watchlist Items ─────────────────────────────────────────────────────

@router.get("", response_model=list[WatchlistItem])
async def get_watchlist(
    group_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    query = select(UserWatchlist).where(UserWatchlist.user_id == user_id)
    if group_id is not None:
        query = query.where(UserWatchlist.watchlist_group_id == group_id)
    query = query.order_by(UserWatchlist.added_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=WatchlistItem, status_code=201)
async def add_to_watchlist(
    body: WatchlistAdd,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    ticker = body.ticker.upper().strip()

    # Resolve group — if none provided, use (or create) the default
    group_id = body.group_id
    if group_id is None:
        default_group = await _ensure_default_group(db, user_id)
        group_id = default_group.id
    else:
        group_check = await db.execute(
            select(UserWatchlistGroup).where(
                UserWatchlistGroup.id == group_id,
                UserWatchlistGroup.user_id == user_id,
            )
        )
        if not group_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Watchlist group not found")

    # Check duplicate within the same group
    existing = await db.execute(
        select(UserWatchlist).where(
            UserWatchlist.user_id == user_id,
            UserWatchlist.ticker_symbol == ticker,
            UserWatchlist.watchlist_group_id == group_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"{ticker} is already in this watchlist",
        )

    item = UserWatchlist(
        user_id=user_id,
        ticker_symbol=ticker,
        watchlist_group_id=group_id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    # Fetch market data in the background if the app doesn't have this stock yet
    from dividendcase.services.refresh import queue_holdings
    await queue_holdings()
    return item


@router.patch("/{item_id}/move", response_model=WatchlistItem)
async def move_watchlist_item(
    item_id: int,
    body: WatchlistMove,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    # Find the item
    result = await db.execute(
        select(UserWatchlist).where(
            UserWatchlist.id == item_id,
            UserWatchlist.user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")

    # Validate target group belongs to user
    group_result = await db.execute(
        select(UserWatchlistGroup).where(
            UserWatchlistGroup.id == body.target_group_id,
            UserWatchlistGroup.user_id == user_id,
        )
    )
    if not group_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Target watchlist group not found")

    # Check for duplicate ticker in target group
    dup = await db.execute(
        select(UserWatchlist).where(
            UserWatchlist.user_id == user_id,
            UserWatchlist.ticker_symbol == item.ticker_symbol,
            UserWatchlist.watchlist_group_id == body.target_group_id,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"{item.ticker_symbol} is already in the target watchlist",
        )

    item.watchlist_group_id = body.target_group_id
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{ticker}", status_code=204)
async def remove_from_watchlist(
    ticker: str,
    group_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    query = delete(UserWatchlist).where(
        UserWatchlist.user_id == user_id,
        UserWatchlist.ticker_symbol == ticker.upper(),
    )
    if group_id is not None:
        query = query.where(UserWatchlist.watchlist_group_id == group_id)
    await db.execute(query)
    await db.commit()
