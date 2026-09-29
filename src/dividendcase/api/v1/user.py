"""User preferences and account management endpoints."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from uuid import UUID

from dividendcase.database import get_db
from dividendcase.models.user_preferences import UserPreferences as UserPreferencesModel
from dividendcase.models.user_watchlist import UserWatchlist
from dividendcase.models.user_watchlist_group import UserWatchlistGroup
from dividendcase.models.user_investment import UserInvestment
from dividendcase.models.user_portfolio import UserPortfolio
from dividendcase.schemas.user_preferences import UserPreferences, UserPreferencesUpdate
from dividendcase.api.v1.deps import _get_user_id

router = APIRouter()


@router.get("/preferences", response_model=UserPreferences)
async def get_preferences(
    user_id: UUID = Depends(_get_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreferencesModel).where(UserPreferencesModel.user_id == user_id)
    )
    prefs = result.scalar_one_or_none()
    if prefs is None:
        prefs = UserPreferencesModel(user_id=user_id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
    return prefs


@router.patch("/preferences", response_model=UserPreferences)
async def update_preferences(
    updates: UserPreferencesUpdate,
    user_id: UUID = Depends(_get_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreferencesModel).where(UserPreferencesModel.user_id == user_id)
    )
    prefs = result.scalar_one_or_none()
    if prefs is None:
        prefs = UserPreferencesModel(user_id=user_id)
        db.add(prefs)

    if updates.default_benchmark is not None:
        prefs.default_benchmark = updates.default_benchmark
    if updates.date_format is not None:
        prefs.date_format = updates.date_format
    if updates.watchlist_collapsed is not None:
        prefs.watchlist_collapsed = updates.watchlist_collapsed
    if updates.check_for_updates is not None:
        prefs.check_for_updates = updates.check_for_updates
    if updates.home_currency is not None:
        from dividendcase.services import fx
        table = await fx.get_table()
        if table and not fx.can_convert(updates.home_currency, table):
            raise HTTPException(status_code=422, detail=f"No exchange rates for {updates.home_currency}")
        prefs.home_currency = updates.home_currency
    if updates.tax_residence is not None:
        prefs.tax_residence = updates.tax_residence
    if "screener_markets" in updates.model_fields_set:
        # An empty list is allowed (no screener downloads); null means every market
        prefs.screener_markets = updates.screener_markets
    if updates.complete_setup:
        prefs.setup_completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(prefs)

    from dividendcase.config import settings
    if settings.auto_refresh and (updates.complete_setup or "screener_markets" in updates.model_fields_set):
        # Download the chosen markets now rather than at the next daily check
        from dividendcase.services.refresh import queue_screener, run_soon
        run_soon(queue_screener())

    if updates.check_for_updates is not None:
        from dividendcase.services.updates import check_soon, forget
        if not updates.check_for_updates:
            forget()
        elif settings.check_updates:
            check_soon()
    return prefs


@router.delete("/account", status_code=204)
async def delete_account(
    user_id: UUID = Depends(_get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete everything the user entered: portfolios, holdings, watchlists and settings.

    Market data (stocks, dividend history) stays, since it can be fetched again.
    """
    await db.execute(delete(UserInvestment).where(UserInvestment.user_id == user_id).execution_options(synchronize_session=False))
    await db.execute(delete(UserWatchlist).where(UserWatchlist.user_id == user_id).execution_options(synchronize_session=False))
    await db.execute(delete(UserWatchlistGroup).where(UserWatchlistGroup.user_id == user_id).execution_options(synchronize_session=False))
    await db.execute(delete(UserPortfolio).where(UserPortfolio.user_id == user_id).execution_options(synchronize_session=False))
    await db.execute(delete(UserPreferencesModel).where(UserPreferencesModel.user_id == user_id).execution_options(synchronize_session=False))
    await db.commit()

    return Response(status_code=204)
