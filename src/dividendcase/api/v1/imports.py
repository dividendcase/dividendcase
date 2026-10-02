"""Broker exports: read a file the user downloaded from their broker, show what it holds, add it.

POST /imports/zerodha/preview   tradebook files → the holdings and lots they add up to
POST /imports/zerodha           the same files (+ portfolio_id) → adds the lots not already there

The app never connects to a broker: the user downloads the export and chooses it here. The files are
read in memory and not kept; the preview and the import each read them, so nothing is stored between.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dividendcase.api.v1.deps import _get_user_id
from dividendcase.database import get_db
from dividendcase.models.user_investment import UserInvestment
from dividendcase.models.user_portfolio import UserPortfolio
from dividendcase.schemas.imports import BrokerImportResult, BrokerPreview, ImportedFile, ImportedHolding, ImportedLot
from dividendcase.services.brokers import Positions, Trade, open_lots
from dividendcase.services.brokers import zerodha

router = APIRouter()

MAX_FILES = 20
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB each


async def _read_zerodha(files: list[UploadFile]) -> tuple[Positions, list[ImportedFile], dict]:
    if not files:
        raise HTTPException(status_code=400, detail="Choose at least one tradebook file")
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Choose up to {MAX_FILES} files at a time")
    trades: list[Trade] = []
    seen: set[str] = set()
    described: list[ImportedFile] = []
    counts = {"not_equity": 0, "duplicate_trades": 0, "unreadable": []}
    for f in files:
        name = f.filename or "file"
        if not name.lower().endswith((".csv", ".xlsx")):
            raise HTTPException(status_code=400, detail=f"{name}: choose a .csv or .xlsx tradebook")
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"{name} is larger than 5 MB")
        try:
            book = zerodha.parse(content, name)
        except zerodha.TradebookError as e:
            raise HTTPException(status_code=400, detail=f"{name}: {e}")
        # Tradebooks for overlapping dates repeat trades; each trade ID counts once
        fresh = [t for t in book.trades if t.trade_id not in seen]
        counts["duplicate_trades"] += len(book.trades) - len(fresh)
        seen.update(t.trade_id for t in fresh)
        trades.extend(fresh)
        counts["not_equity"] += book.not_equity
        counts["unreadable"].extend(f"{name}: {line}" for line in book.unreadable)
        described.append(ImportedFile(name=name, trades=len(book.trades), first=book.first, last=book.last))
    return open_lots(trades), described, counts


async def _existing_lots(db: AsyncSession, user_id: UUID) -> set:
    rows = await db.execute(
        select(UserInvestment.ticker_symbol, UserInvestment.purchase_date).where(UserInvestment.user_id == user_id)
    )
    return {(t, d) for t, d in rows.all()}


@router.post("/zerodha/preview", response_model=BrokerPreview)
async def preview_zerodha(
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    positions, described, counts = await _read_zerodha(files)
    existing = await _existing_lots(db, user_id)
    holdings = [
        ImportedHolding(
            ticker=h.ticker,
            isin=h.isin,
            currency=h.currency,
            quantity=round(h.quantity, 6),
            average_price=round(h.average_price, 4),
            lots=[
                ImportedLot(
                    purchase_date=lot.purchase_date,
                    quantity=lot.quantity,
                    price=lot.price,
                    already_there=(h.ticker, lot.purchase_date) in existing,
                )
                for lot in h.lots
            ],
        )
        for h in positions.holdings
    ]
    return BrokerPreview(
        broker="zerodha",
        files=described,
        holdings=holdings,
        new_lots=sum(1 for h in holdings for lot in h.lots if not lot.already_there),
        closed=positions.closed,
        oversold=positions.oversold,
        not_equity=counts["not_equity"],
        duplicate_trades=counts["duplicate_trades"],
        unreadable=counts["unreadable"],
    )


@router.post("/zerodha", response_model=BrokerImportResult)
async def import_zerodha(
    files: list[UploadFile] = File(...),
    portfolio_id: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    positions, _, _ = await _read_zerodha(files)

    if portfolio_id is None:
        from dividendcase.api.v1.portfolios import _ensure_default_portfolio

        portfolio_id = (await _ensure_default_portfolio(db, user_id)).id
    else:
        owned = await db.execute(
            select(UserPortfolio.id).where(UserPortfolio.id == portfolio_id, UserPortfolio.user_id == user_id)
        )
        if owned.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Portfolio not found")

    existing = await _existing_lots(db, user_id)
    created = already = 0
    for h in positions.holdings:
        for lot in h.lots:
            if (h.ticker, lot.purchase_date) in existing:
                already += 1
                continue
            db.add(UserInvestment(
                user_id=user_id,
                ticker_symbol=h.ticker,
                purchase_date=lot.purchase_date,
                purchase_price=lot.price,
                quantity=lot.quantity,
                purchase_currency=h.currency,
                portfolio_id=portfolio_id,
            ))
            existing.add((h.ticker, lot.purchase_date))
            created += 1
    await db.commit()

    # Fetch prices and dividends for stocks the app doesn't have yet
    from dividendcase.services.refresh import queue_holdings

    await queue_holdings()
    return BrokerImportResult(
        created=created, already_there=already, holdings=len(positions.holdings), portfolio_id=portfolio_id
    )
