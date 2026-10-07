"""Broker exports: read a file the user downloaded from their broker, show what it holds, add it.

POST /imports/zerodha/preview   tradebook files → the holdings and lots they add up to
POST /imports/zerodha           the same files (+ portfolio_id) → adds the lots not already there
POST /imports/revolut/preview   account statements (PDF, CSV or Excel) → holdings and lots, checked
                                against the holdings Revolut lists
POST /imports/revolut           the same files (+ portfolio_id) → adds the lots not already there
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
from dividendcase.services.brokers import Positions, Trade, angelone, open_lots, revolut
from dividendcase.services.brokers import zerodha

router = APIRouter()

MAX_FILES = 20
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB each


async def _uploads(files: list[UploadFile], extensions: tuple[str, ...], what: str) -> list[tuple[str, bytes]]:
    """The chosen files' names and contents, after checking how many there are, their type and size"""
    if not files:
        raise HTTPException(status_code=400, detail=f"Choose at least one {what}")
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Choose up to {MAX_FILES} files at a time")
    found = []
    for f in files:
        name = f.filename or "file"
        if not name.lower().endswith(extensions):
            raise HTTPException(status_code=400, detail=f"{name}: choose a {' or '.join(extensions)} {what}")
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"{name} is larger than 5 MB")
        found.append((name, content))
    return found


def _fresh(trades: list[Trade], seen: set[str]) -> list[Trade]:
    """Files for overlapping dates repeat trades; each trade ID counts once"""
    fresh = [t for t in trades if t.trade_id not in seen]
    seen.update(t.trade_id for t in fresh)
    return fresh


async def _read_zerodha(files: list[UploadFile]) -> tuple[Positions, list[ImportedFile], dict]:
    trades: list[Trade] = []
    seen: set[str] = set()
    described: list[ImportedFile] = []
    counts = {"not_equity": 0, "duplicate_trades": 0, "unreadable": []}
    for name, content in await _uploads(files, (".csv", ".xlsx"), "tradebook"):
        try:
            book = zerodha.parse(content, name)
        except zerodha.TradebookError as e:
            raise HTTPException(status_code=400, detail=f"{name}: {e}")
        fresh = _fresh(book.trades, seen)
        counts["duplicate_trades"] += len(book.trades) - len(fresh)
        trades.extend(fresh)
        counts["not_equity"] += book.not_equity
        counts["unreadable"].extend(f"{name}: {line}" for line in book.unreadable)
        described.append(ImportedFile(name=name, trades=len(book.trades), first=book.first, last=book.last))
    return open_lots(trades), described, counts


def _shares(n: float) -> str:
    return f"{n:,.6f}".rstrip("0").rstrip(".")


async def _read_revolut(files: list[UploadFile]) -> tuple[Positions, list[ImportedFile], dict]:
    trades: list[Trade] = []
    seen: set[str] = set()
    described: list[ImportedFile] = []
    counts = {"duplicate_trades": 0, "unreadable": [], "notes": [], "left_out": {}}
    held: dict[str, revolut.Position] = {}  # Revolut's own list of holdings, from the latest statement
    latest_end = None
    other: dict[str, int] = counts["left_out"]
    for name, content in await _uploads(files, (".pdf", ".csv", ".xlsx"), "statement"):
        try:
            book = revolut.parse(content, name)
        except revolut.StatementError as e:
            raise HTTPException(status_code=400, detail=f"{name}: {e}")
        fresh = _fresh(book.trades, seen)
        counts["duplicate_trades"] += len(book.trades) - len(fresh)
        trades.extend(fresh)
        counts["unreadable"].extend(f"{name}: {line}" for line in book.unreadable)
        for kind, n in book.other.items():
            other[kind] = other.get(kind, 0) + n
        for currency in book.held_at_start:
            counts["notes"].append(
                f"{name} starts on {book.period[0]:%d %b %Y} with {currency} holdings already in the account, so "
                "the trades before then are missing. Add a statement that starts on the day you opened the account."
            )
        end = book.period[1] if book.period else book.last
        if book.positions and (latest_end is None or (end and end >= latest_end)):
            held, latest_end = book.positions, end
        described.append(ImportedFile(name=name, trades=len(book.trades), first=book.first, last=book.last))
    positions = open_lots(trades)

    # Check what the trades add up to against what Revolut says is held
    adds_up = {h.ticker: h.quantity for h in positions.holdings}
    for symbol, p in sorted(held.items()):
        ticker = revolut.ticker_for(symbol, p.currency)
        mine = adds_up.get(ticker, 0.0)
        if abs(mine - p.quantity) > 1e-4:
            counts["notes"].append(
                f"{ticker}: Revolut shows {_shares(p.quantity)} shares held, but the trades in these statements "
                f"add up to {_shares(mine)}. A split, a transfer or trades from before these statements would "
                "explain it; check this holding after importing."
            )
    foreign = sorted({h.currency for h in positions.holdings if h.currency != "USD"})
    if foreign:
        counts["notes"].append(
            f"Holdings in {', '.join(foreign)} use Revolut's symbols as tickers: check them after importing."
        )
    return positions, described, counts


def _preview(broker: str, positions: Positions, described: list[ImportedFile], counts: dict, existing: set) -> BrokerPreview:
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
        broker=broker,
        files=described,
        holdings=holdings,
        new_lots=sum(1 for h in holdings for lot in h.lots if not lot.already_there),
        closed=positions.closed,
        oversold=positions.oversold,
        not_equity=counts.get("not_equity", 0),
        duplicate_trades=counts["duplicate_trades"],
        unreadable=counts["unreadable"],
        notes=counts.get("notes", []),
        left_out=counts.get("left_out", {}),
    )


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
    return _preview("zerodha", positions, described, counts, await _existing_lots(db, user_id))


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


@router.post("/revolut/preview", response_model=BrokerPreview)
async def preview_revolut(
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    positions, described, counts = await _read_revolut(files)
    return _preview("revolut", positions, described, counts, await _existing_lots(db, user_id))


@router.post("/revolut", response_model=BrokerImportResult)
async def import_revolut(
    files: list[UploadFile] = File(...),
    portfolio_id: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    positions, _, _ = await _read_revolut(files)
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
