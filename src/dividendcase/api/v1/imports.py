"""Broker exports: read a file the user downloaded from their broker, show what it holds, add it.

POST /imports/zerodha/preview   tradebook files → the holdings and lots they add up to
POST /imports/zerodha           the same files (+ portfolio_id) → adds the lots not already there
POST /imports/angelone/preview  a holdings file (+ its password) → holdings, tickers found by ISIN,
                                and lots dated as late as each part could have been bought
POST /imports/lots              the lots the user confirmed (tickers and dates edited) → adds them

The app never connects to a broker: the user downloads the export and chooses it here. The files are
read in memory and not kept, and neither is a file's password.
"""
import asyncio
from datetime import date
from typing import Iterable, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dividendcase.api.v1.deps import _get_user_id
from dividendcase.database import get_db
from dividendcase.models.user_investment import UserInvestment
from dividendcase.models.user_portfolio import UserPortfolio
from dividendcase.schemas.imports import (
    BrokerImportResult,
    BrokerPreview,
    HoldingsFileLot,
    HoldingsFilePreview,
    HoldingsFileRow,
    ImportedFile,
    ImportedHolding,
    ImportedLot,
    LotsToAdd,
)
from dividendcase.services import isin
from dividendcase.services.brokers import Positions, Trade, angelone, open_lots
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


async def _portfolio_id(db: AsyncSession, user_id: UUID, portfolio_id: Optional[int]) -> int:
    """The portfolio to add to: the one asked for (it must be the user's), else the default one"""
    if portfolio_id is None:
        from dividendcase.api.v1.portfolios import _ensure_default_portfolio

        return (await _ensure_default_portfolio(db, user_id)).id
    owned = await db.execute(
        select(UserPortfolio.id).where(UserPortfolio.id == portfolio_id, UserPortfolio.user_id == user_id)
    )
    if owned.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return portfolio_id


async def _add_lots(
    db: AsyncSession,
    user_id: UUID,
    portfolio_id: int,
    lots: Iterable[tuple[str, date, float, Optional[float], str]],
) -> tuple[int, int]:
    """Add (ticker, purchase date, quantity, price, currency) lots, skipping any stock already in the app
    on that date, then fetch prices and dividends for new stocks. Returns (created, already there)."""
    existing = await _existing_lots(db, user_id)
    created = already = 0
    for ticker, purchase_date, quantity, price, currency in lots:
        if (ticker, purchase_date) in existing:
            already += 1
            continue
        db.add(UserInvestment(
            user_id=user_id,
            ticker_symbol=ticker,
            purchase_date=purchase_date,
            purchase_price=price,
            quantity=quantity,
            purchase_currency=currency,
            portfolio_id=portfolio_id,
        ))
        existing.add((ticker, purchase_date))
        created += 1
    await db.commit()

    from dividendcase.services.refresh import queue_holdings

    await queue_holdings()
    return created, already


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
    portfolio_id = await _portfolio_id(db, user_id, portfolio_id)
    created, already = await _add_lots(
        db,
        user_id,
        portfolio_id,
        ((h.ticker, lot.purchase_date, lot.quantity, lot.price, h.currency) for h in positions.holdings for lot in h.lots),
    )
    return BrokerImportResult(
        created=created, already_there=already, holdings=len(positions.holdings), portfolio_id=portfolio_id
    )


@router.post("/angelone/preview", response_model=HoldingsFilePreview)
async def preview_angelone(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    name = file.filename or "file"
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"{name} is larger than 5 MB")
    try:
        book = angelone.parse(content, name, password or None)
    except angelone.PasswordRequired as e:
        raise HTTPException(status_code=400, detail={"code": "password_required", "message": str(e)})
    except angelone.WrongPassword as e:
        raise HTTPException(status_code=400, detail={"code": "wrong_password", "message": str(e)})
    except angelone.HoldingsFileError as e:
        raise HTTPException(status_code=400, detail=str(e))

    as_of = book.as_of or date.today()
    today = date.today()
    found = await asyncio.to_thread(isin.resolve, [p.isin for p in book.positions])
    existing = await _existing_lots(db, user_id)
    holdings = []
    for p in book.positions:
        match = found.get(p.isin)
        ticker = match.ticker if match else None
        holdings.append(HoldingsFileRow(
            name=p.name,
            isin=p.isin,
            ticker=ticker,
            found_by=match.source if match else None,
            currency="INR",
            quantity=p.quantity,
            average_price=round(p.average_price, 4) if p.average_price > 0 else None,
            lots=[
                HoldingsFileLot(
                    held=lot.held,
                    purchase_date=day,
                    quantity=lot.quantity,
                    price=lot.price,
                    already_there=(ticker, day) in existing,
                )
                for lot in angelone.lots(p, as_of)
                # A file dated tomorrow (India is ahead) mustn't give a purchase date in the future
                for day in [min(lot.purchase_date, today)]
            ],
        ))
    return HoldingsFilePreview(broker="angelone", as_of=book.as_of, holdings=holdings, unreadable=book.unreadable)


@router.post("/lots", response_model=BrokerImportResult)
async def import_lots(
    body: LotsToAdd,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    if any(lot.purchase_date > date.today() for lot in body.lots):
        raise HTTPException(status_code=400, detail="A purchase date can't be in the future")
    portfolio_id = await _portfolio_id(db, user_id, body.portfolio_id)
    created, already = await _add_lots(
        db,
        user_id,
        portfolio_id,
        ((lot.ticker.strip().upper(), lot.purchase_date, lot.quantity, lot.price, lot.currency.upper()) for lot in body.lots),
    )
    return BrokerImportResult(
        created=created,
        already_there=already,
        holdings=len({lot.ticker.strip().upper() for lot in body.lots}),
        portfolio_id=portfolio_id,
    )
