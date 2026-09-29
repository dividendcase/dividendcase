"""Withholding tax estimates for the user's tax residence (Settings, stock pages)."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dividendcase.api.v1.deps import _get_user_id
from dividendcase.database import get_db
from dividendcase.models import Stock, UserInvestment, UserPreferences
from dividendcase.services import withholding

router = APIRouter()


@router.get("")
async def withholding_table(
    ticker: Optional[str] = Query(None, description="Also say what applies to this stock"),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    """The rate for each supported source country, and where the user's holdings pay from."""
    prefs = (await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    )).scalar_one_or_none()
    residence = prefs.tax_residence if prefs else None
    overrides = (prefs.withholding_overrides or {}) if prefs else {}

    held = (await db.execute(
        select(Stock.ticker_symbol, Stock.country, Stock.exchange)
        .join(UserInvestment, UserInvestment.ticker_symbol == Stock.ticker_symbol)
        .where(UserInvestment.user_id == user_id)
        .distinct()
    )).all()
    sources: dict[str, list[str]] = {}
    for held_ticker, country, exchange in held:
        source = withholding.source_country(country, exchange)
        if source:
            sources.setdefault(source, []).append(held_ticker)

    rows = withholding.table_for(residence, overrides)
    known = {row["source"] for row in rows}
    for source in sorted(set(sources) - known):
        rule = withholding.rule_for(source, residence, overrides)
        rows.append({
            "source": source, "name": source,
            "rate": rule.rate if rule else None, "basis": rule.basis if rule else None,
            "note": rule.note if rule else "Not estimated yet: dividends from here are shown before tax. Set the rate your broker withholds to include it.",
            "default_rate": None, "default_note": None,
        })
    for row in rows:
        row["your_stocks"] = sorted(sources.get(row["source"], []))
    for_stock = None
    if ticker:
        stock = (await db.execute(select(Stock).where(Stock.ticker_symbol == ticker.upper()))).scalar_one_or_none()
        if stock is not None:
            source = withholding.source_country(stock.country, stock.exchange)
            rule = withholding.rule_for(source, residence, overrides)
            for_stock = {
                "ticker": stock.ticker_symbol,
                "source": source,
                "source_name": withholding.NAMES.get(source or "", source),
                "rate": rule.rate if rule else None,
                "basis": rule.basis if rule else None,
                "note": rule.note if rule else None,
            }
    return {
        "residence": residence,
        "residence_name": withholding.NAMES.get(residence or "", residence),
        "rows": rows,
        "for_stock": for_stock,
    }
