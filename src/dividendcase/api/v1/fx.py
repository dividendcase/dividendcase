"""Exchange rates stored on this computer (European Central Bank reference rates)."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Query

from dividendcase.services import fx

router = APIRouter()


@router.get("/rates")
async def rates(on: Optional[date] = Query(None, alias="date")):
    """How much of each currency one euro buys on a day (the latest stored day if none is given)."""
    table = await fx.get_table()
    used = table.day_for(on)
    return {
        "base": "EUR",
        "date": used.isoformat() if used else None,
        "rates": {"EUR": 1.0, **table.on(on)} if used else {},
        "source": fx.SOURCE,
    }


@router.get("/currencies")
async def currencies():
    """Currencies that totals can be shown in."""
    table = await fx.get_table()
    return {"currencies": table.currencies() if table else ["EUR"]}
