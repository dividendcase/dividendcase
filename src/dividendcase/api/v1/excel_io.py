"""
Excel import/export for portfolio investments.
- GET  /excel/template  — download blank template
- GET  /excel/export    — download user's portfolios and watchlists as Excel
- POST /excel/import    — upload Excel to bulk-create portfolios + investments
"""
import io
import logging
import re
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.chart import LineChart, BarChart, PieChart, Reference
from sqlalchemy import select, text, func as sa_func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from dividendcase.database import get_db
from dividendcase.models.user_portfolio import UserPortfolio
from dividendcase.models.user_investment import UserInvestment
from dividendcase.models.user_watchlist import UserWatchlist
from dividendcase.models.user_watchlist_group import UserWatchlistGroup
from dividendcase.models.stock import Stock
from dividendcase.schemas.user_investment import ImportRowResult, ImportSummary
from dividendcase.api.v1.deps import _get_user_id

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_PORTFOLIOS = 4
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_ROWS_PER_SHEET = 500
ALLOWED_CURRENCIES = {"USD", "CAD", "GBP", "EUR", "AUD", "INR", "JPY", "HKD"}

DATA_HEADERS = ["Ticker", "Purchase Date", "Quantity", "Price Per Share", "Total Cost", "Currency"]
# Exported portfolio sheets add Company for reference; import ignores unknown columns
EXPORT_HEADERS = ["Ticker", "Company", "Purchase Date", "Quantity", "Price Per Share", "Total Cost", "Currency"]
EXPORT_FORMAT = "DividendCase export, version 1"

# Exports add a Watchlists sheet; import recognises it by its first header, not its
# tab name, so a portfolio that happens to be called "Watchlists" still imports.
WATCHLIST_SHEET_NAME = "Watchlists"
WATCHLIST_HEADERS = ["Watchlist", "Ticker", "Company", "Added On"]
DEFAULT_WATCHLIST_NAME = "Watchlist"

# Characters Excel forbids in sheet (tab) names
INVALID_SHEET_CHARS = re.compile(r"[\\/?*\[\]:]")

# Flexible header matching — maps normalized names → canonical column index
HEADER_ALIASES = {
    "ticker": 0, "symbol": 0, "stock": 0,
    "purchase date": 1, "date": 1, "buy date": 1,
    "quantity": 2, "qty": 2, "shares": 2, "units": 2,
    "price per share": 3, "price": 3, "purchase price": 3, "unit price": 3,
    "total cost": 4, "total": 4, "cost": 4, "amount": 4,
    "currency": 5, "ccy": 5,
}


# ── Template / Instructions ────────────────────────────────────────────

def _build_instructions_sheet(ws, about: list[tuple[str, str]] | None = None) -> None:
    """Populate the Instructions sheet. Exports pass `about` to describe the file first."""
    ws.sheet_properties.tabColor = "4472C4"
    ws.column_dimensions["A"].width = 60
    ws.column_dimensions["B"].width = 50

    title_font = Font(name="Calibri", size=16, bold=True, color="FFFFFF")
    title_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_font = Font(name="Calibri", size=12, bold=True, color="4472C4")
    body_font = Font(name="Calibri", size=11)
    note_font = Font(name="Calibri", size=11, italic=True, color="666666")

    # Title row
    ws["A1"] = "DividendCase — Your Data Export" if about else "DividendCase — Portfolio Import Template"
    ws["A1"].font = title_font
    ws["A1"].fill = title_fill
    ws["B1"].fill = title_fill
    ws.row_dimensions[1].height = 36
    ws["A1"].alignment = Alignment(vertical="center")

    row = 3
    if about:
        ws.cell(row=row, column=1, value="About this export:").font = header_font
        for label, value in about:
            row += 1
            ws.cell(row=row, column=1, value=label).font = Font(name="Calibri", size=11, bold=True)
            ws.cell(row=row, column=2, value=value).font = body_font
        row += 1
        ws.cell(row=row, column=1,
                value="Keep this file. You can import it into DividendCase, including the upcoming "
                      "open-source app. The Company column is for reference and is ignored on import.").font = note_font
        row += 2

    ws.cell(row=row, column=1,
            value="How to import this file:" if about else "How to use this template:").font = header_font
    instructions = [
        "1. Each sheet (tab) in this file — except this Instructions sheet and the Watchlists sheet — "
        "becomes a portfolio.",
        "2. The sheet name is used as the portfolio name.",
        "3. You can have up to 4 portfolio sheets.",
        "4. Fill in your stock purchases using the columns described below.",
        "5. Upload the file on the Investments page in DividendCase.",
    ]
    for line in instructions:
        row += 1
        ws.cell(row=row, column=1, value=line).font = body_font

    row += 2
    ws.cell(row=row, column=1, value="Column Definitions:").font = header_font
    columns = [
        ("Ticker", "Stock ticker symbol — e.g. AAPL, MSFT, RY.TO, RELIANCE.NS (required)"),
        ("Purchase Date", "Date of purchase in YYYY-MM-DD format — e.g. 2024-01-15 (required)"),
        ("Quantity", "Number of shares purchased, must be > 0 (required)"),
        ("Price Per Share", "Price per share at purchase — provide this OR Total Cost"),
        ("Total Cost", "Total amount paid for all shares — provide this OR Price Per Share"),
        ("Currency", "Purchase currency code (optional, defaults to stock's market currency)"),
    ]
    for col_name, desc in columns:
        row += 1
        ws.cell(row=row, column=1, value=col_name).font = Font(name="Calibri", size=11, bold=True)
        ws.cell(row=row, column=2, value=desc).font = body_font

    row += 2
    ws.cell(row=row, column=1,
            value='Provide either "Price Per Share" or "Total Cost". '
                  'If both are given, "Price Per Share" takes priority.').font = note_font

    row += 2
    ws.cell(row=row, column=1, value="Supported Currencies:").font = header_font
    row += 1
    ws.cell(row=row, column=1, value=", ".join(sorted(ALLOWED_CURRENCIES))).font = body_font

    row += 2
    ws.cell(row=row, column=1, value="Important Notes:").font = header_font
    notes = [
        "• If a portfolio with the same name already exists, investments will be merged into it.",
        "• Duplicate investments (same ticker + purchase date) will be skipped.",
        "• Empty rows are ignored.",
        "• Dividend data for newly imported stocks is fetched in the background; "
        "the Data page shows progress.",
    ]
    for note in notes:
        row += 1
        ws.cell(row=row, column=1, value=note).font = note_font


def _write_header_row(ws, headers: list[str], widths: list[int], color: str, border_color: str) -> None:
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
    header_border = Border(bottom=Side(style="thin", color=border_color))
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.border = header_border
        cell.alignment = Alignment(horizontal="center")
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w


def _build_data_sheet(ws) -> None:
    """Blank portfolio sheet with the import headers (template, or an export with no portfolios)."""
    _write_header_row(ws, DATA_HEADERS, [16, 16, 12, 16, 16, 12], "4472C4", "2F5496")


def _build_export_sheet(ws, investments: list, stock_info: dict[str, tuple[str, str]]) -> None:
    """Portfolio sheet for exports. stock_info maps ticker → (company name, trading currency)."""
    _write_header_row(ws, EXPORT_HEADERS, [16, 34, 16, 12, 16, 16, 12], "4472C4", "2F5496")
    for row_idx, inv in enumerate(investments, 2):
        company, market_currency = stock_info.get(inv.ticker_symbol, ("", ""))
        ws.cell(row=row_idx, column=1, value=inv.ticker_symbol)
        ws.cell(row=row_idx, column=2, value=company)
        date_cell = ws.cell(row=row_idx, column=3, value=inv.purchase_date)
        date_cell.number_format = "YYYY-MM-DD"
        ws.cell(row=row_idx, column=4, value=float(inv.quantity))
        if inv.purchase_price is not None:
            price = float(inv.purchase_price)
            ws.cell(row=row_idx, column=5, value=price)
            ws.cell(row=row_idx, column=6, value=round(price * float(inv.quantity), 4))
        # A blank purchase currency means "the stock's own currency"; write it out so the
        # file stands on its own
        ws.cell(row=row_idx, column=7, value=inv.purchase_currency or market_currency or "")


def _build_watchlist_sheet(ws, rows: list[tuple[str, str, str, Optional[datetime]]]) -> None:
    """Write watchlist rows: (watchlist name, ticker, company name, added at)."""
    ws.sheet_properties.tabColor = "70AD47"
    _write_header_row(ws, WATCHLIST_HEADERS, [22, 16, 36, 14], "70AD47", "507E32")

    for row_idx, (group_name, ticker, company, added_at) in enumerate(rows, 2):
        ws.cell(row=row_idx, column=1, value=group_name)
        ws.cell(row=row_idx, column=2, value=ticker)
        ws.cell(row=row_idx, column=3, value=company)
        if added_at is not None:
            added_cell = ws.cell(row=row_idx, column=4, value=added_at.date())
            added_cell.number_format = "YYYY-MM-DD"


def _safe_sheet_title(name: str, fallback: str) -> str:
    """Turn a portfolio name into a valid Excel sheet title (the import uses it as the name)."""
    title = INVALID_SHEET_CHARS.sub("-", name).strip().strip("'").strip()[:31].strip()
    if not title:
        return fallback
    if title.lower() == "instructions":
        return f"{title} (portfolio)"[:31]
    return title


def _is_watchlist_sheet(ws) -> bool:
    first_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), None)
    if not first_row or first_row[0] is None:
        return False
    return str(first_row[0]).strip().lower() == WATCHLIST_HEADERS[0].lower()


def _portfolio_sheet_names(wb) -> list[str]:
    """Sheets that hold portfolio data — everything except Instructions and Watchlists."""
    return [
        name for name in wb.sheetnames
        if name.strip().lower() != "instructions" and not _is_watchlist_sheet(wb[name])
    ]


def _plural(n: int, word: str) -> str:
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


async def _account_details(db: AsyncSession, user_id: UUID) -> tuple[Optional[str], Optional[datetime]]:
    """Email and sign-up time from Supabase Auth. Plain local Postgres has no auth schema."""
    try:
        row = (await db.execute(
            text("SELECT email, created_at FROM auth.users WHERE id = :uid"), {"uid": user_id}
        )).first()
    except Exception:
        await db.rollback()
        return None, None
    return (row[0], row[1]) if row else (None, None)


def _workbook_to_response(wb: Workbook, filename: str) -> StreamingResponse:
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Endpoints ───────────────────────────────────────────────────────────

@router.get("/template")
async def download_template(
    user_id: UUID = Depends(_get_user_id),
):
    """Download a blank Excel template with instructions."""
    wb = Workbook()

    # Instructions sheet (first sheet)
    ws_instr = wb.active
    ws_instr.title = "Instructions"
    _build_instructions_sheet(ws_instr)

    # One blank data sheet
    ws_data = wb.create_sheet("Portfolio 1")
    _build_data_sheet(ws_data)

    return _workbook_to_response(wb, "dividendcase_template.xlsx")


@router.get("/export")
async def export_portfolios(
    user_id: UUID = Depends(_get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Export all user portfolios, investments and watchlists as an Excel file."""
    # First, because a failed auth lookup rolls the session back and expires loaded rows
    email, signed_up_at = await _account_details(db, user_id)

    result = await db.execute(
        select(UserPortfolio)
        .where(UserPortfolio.user_id == user_id)
        .order_by(UserPortfolio.display_order)
    )
    portfolios = result.scalars().all()

    result = await db.execute(
        select(UserInvestment)
        .where(UserInvestment.user_id == user_id)
        .order_by(UserInvestment.created_at)
    )
    all_investments = result.scalars().all()

    inv_by_portfolio: dict[int | None, list] = {}
    for inv in all_investments:
        inv_by_portfolio.setdefault(inv.portfolio_id, []).append(inv)

    # Watchlists — one row per stock, grouped in the user's list order
    result = await db.execute(
        select(UserWatchlistGroup)
        .where(UserWatchlistGroup.user_id == user_id)
        .order_by(UserWatchlistGroup.display_order)
    )
    group_names = {g.id: g.name for g in result.scalars().all()}
    group_rank = {group_id: rank for rank, group_id in enumerate(group_names)}

    result = await db.execute(
        select(UserWatchlist)
        .where(UserWatchlist.user_id == user_id)
        .order_by(UserWatchlist.added_at)
    )
    watch_items = sorted(
        result.scalars().all(),
        key=lambda w: group_rank.get(w.watchlist_group_id, len(group_rank)),
    )

    tickers = {inv.ticker_symbol for inv in all_investments} | {w.ticker_symbol for w in watch_items}
    stock_info: dict[str, tuple[str, str]] = {}
    if tickers:
        result = await db.execute(
            select(Stock.ticker_symbol, Stock.company_name, Stock.currency)
            .where(Stock.ticker_symbol.in_(tickers))
        )
        stock_info = {ticker: (name or "", ccy or "") for ticker, name, ccy in result.all()}

    watch_rows = [
        (
            group_names.get(w.watchlist_group_id, DEFAULT_WATCHLIST_NAME),
            w.ticker_symbol,
            stock_info.get(w.ticker_symbol, ("", ""))[0],
            w.added_at,
        )
        for w in watch_items
    ]
    list_count = len({row[0] for row in watch_rows})

    about = [
        ("Exported", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")),
        ("Account email", email or "—"),
        ("Account created", signed_up_at.strftime("%Y-%m-%d") if signed_up_at else "—"),
        ("Contents", f"{_plural(len(portfolios), 'portfolio')} · {_plural(len(all_investments), 'purchase')} · "
                     f"{_plural(len(watch_rows), 'watchlist item')} in {_plural(list_count, 'list')}"),
        ("Format", EXPORT_FORMAT),
    ]

    wb = Workbook()
    ws_instr = wb.active
    ws_instr.title = "Instructions"
    _build_instructions_sheet(ws_instr, about)

    if portfolios:
        for i, p in enumerate(portfolios, 1):
            # openpyxl renames duplicate titles, e.g. "A/B" and "A-B" both clean to "A-B"
            ws = wb.create_sheet(_safe_sheet_title(p.name, f"Portfolio {i}"))
            _build_export_sheet(ws, inv_by_portfolio.get(p.id, []), stock_info)
    else:
        # No portfolios — return a single empty data sheet
        _build_data_sheet(wb.create_sheet("Portfolio 1"))

    if watch_rows:
        _build_watchlist_sheet(wb.create_sheet(WATCHLIST_SHEET_NAME), watch_rows)

    return _workbook_to_response(wb, "dividendcase_export.xlsx")


@router.post("/import", response_model=ImportSummary)
async def import_portfolios(
    file: UploadFile = File(...),
    user_id: UUID = Depends(_get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Import portfolios and investments from an uploaded Excel file."""
    # ── Validate file ───────────────────────────────────────────────────
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")

    try:
        wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not parse the Excel file. Ensure it is a valid .xlsx file.",
        )

    # ── Identify data sheets ────────────────────────────────────────────
    data_sheets = _portfolio_sheet_names(wb)

    if not data_sheets:
        raise HTTPException(
            status_code=400,
            detail="No portfolio sheets found. The file must have at least one sheet besides "
                   "Instructions and Watchlists.",
        )

    if len(data_sheets) > MAX_PORTFOLIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Too many portfolio sheets ({len(data_sheets)}). Maximum is {MAX_PORTFOLIOS}.",
        )

    # ── Check portfolio limit ───────────────────────────────────────────
    result = await db.execute(
        select(UserPortfolio).where(UserPortfolio.user_id == user_id)
    )
    existing_portfolios = result.scalars().all()
    existing_names = {p.name.strip().lower(): p for p in existing_portfolios}

    import_names = {name.strip().lower() for name in data_sheets}
    new_names = import_names - set(existing_names.keys())
    total_after = len(existing_names) + len(new_names)

    if total_after > MAX_PORTFOLIOS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Import would result in {total_after} portfolios (max {MAX_PORTFOLIOS}). "
                f"You have {len(existing_names)} existing portfolio(s) and the file "
                f"contains {len(new_names)} new portfolio name(s): "
                f"{', '.join(sorted(new_names))}"
            ),
        )

    # ── Fetch existing investments for duplicate checking ───────────────
    result = await db.execute(
        select(UserInvestment.ticker_symbol, UserInvestment.purchase_date)
        .where(UserInvestment.user_id == user_id)
    )
    existing_investments = {(row[0], row[1]) for row in result.all()}

    # ── Fetch known stock tickers ───────────────────────────────────────
    result = await db.execute(select(Stock.ticker_symbol))
    known_tickers = {row[0] for row in result.all()}

    # ── Parse sheets ────────────────────────────────────────────────────
    details: list[ImportRowResult] = []
    created = 0
    skipped_duplicate = 0
    skipped_invalid = 0
    total_rows = 0
    portfolios_created: list[str] = []
    portfolios_merged: list[str] = []
    has_unknown_stocks = False

    # Resolve or create portfolios first
    portfolio_map: dict[str, int] = {}  # lowercase name → portfolio_id
    next_order = max((p.display_order for p in existing_portfolios), default=-1) + 1

    for sheet_name in data_sheets:
        key = sheet_name.strip().lower()
        if key in existing_names:
            portfolio_map[key] = existing_names[key].id
            if sheet_name not in portfolios_merged:
                portfolios_merged.append(sheet_name)
        elif key not in portfolio_map:
            new_portfolio = UserPortfolio(
                user_id=user_id,
                name=sheet_name.strip(),
                display_order=next_order,
            )
            db.add(new_portfolio)
            await db.flush()
            portfolio_map[key] = new_portfolio.id
            portfolios_created.append(sheet_name.strip())
            next_order += 1

    # Track new investments added during this import for intra-file duplicate detection
    new_investment_keys: set[tuple[str, date]] = set()

    for sheet_name in data_sheets:
        ws = wb[sheet_name]
        portfolio_id = portfolio_map[sheet_name.strip().lower()]

        # ── Parse headers ───────────────────────────────────────────────
        header_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), None)
        if not header_row:
            continue

        col_map: dict[int, int] = {}  # canonical column index → actual Excel column index
        for excel_col, cell_val in enumerate(header_row):
            if cell_val is None:
                continue
            normalized = str(cell_val).strip().lower()
            if normalized in HEADER_ALIASES:
                canonical = HEADER_ALIASES[normalized]
                if canonical not in col_map:
                    col_map[canonical] = excel_col

        # Must have at least Ticker column
        if 0 not in col_map:
            raise HTTPException(
                status_code=400,
                detail=f"Sheet '{sheet_name}': Required column 'Ticker' not found in headers",
            )

        # ── Parse data rows ─────────────────────────────────────────────
        row_count = 0
        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if row_count >= MAX_ROWS_PER_SHEET:
                break

            # Skip empty rows
            if all(v is None for v in row):
                continue

            def _get(canonical_idx: int) -> Optional[str]:
                excel_idx = col_map.get(canonical_idx)
                if excel_idx is None or excel_idx >= len(row):
                    return None
                val = row[excel_idx]
                return val if val is not None else None

            total_rows += 1
            row_count += 1

            # ── Ticker ──────────────────────────────────────────────────
            raw_ticker = _get(0)
            if not raw_ticker or not str(raw_ticker).strip():
                skipped_invalid += 1
                details.append(ImportRowResult(
                    sheet_name=sheet_name, row_number=row_idx,
                    ticker="", status="skipped_invalid", reason="Missing ticker",
                ))
                continue
            ticker = str(raw_ticker).strip().upper()[:20]

            # ── Purchase Date ───────────────────────────────────────────
            raw_date = _get(1)
            purchase_date: Optional[date] = None
            if isinstance(raw_date, datetime):
                purchase_date = raw_date.date()
            elif isinstance(raw_date, date):
                purchase_date = raw_date
            elif raw_date:
                try:
                    purchase_date = datetime.strptime(str(raw_date).strip(), "%Y-%m-%d").date()
                except ValueError:
                    pass

            if not purchase_date:
                skipped_invalid += 1
                details.append(ImportRowResult(
                    sheet_name=sheet_name, row_number=row_idx,
                    ticker=ticker, status="skipped_invalid",
                    reason="Invalid or missing purchase date (use YYYY-MM-DD)",
                ))
                continue

            # ── Quantity ────────────────────────────────────────────────
            raw_qty = _get(2)
            try:
                quantity = float(raw_qty)
                if quantity <= 0 or quantity > 1_000_000:
                    raise ValueError
            except (TypeError, ValueError):
                skipped_invalid += 1
                details.append(ImportRowResult(
                    sheet_name=sheet_name, row_number=row_idx,
                    ticker=ticker, status="skipped_invalid",
                    reason="Invalid quantity (must be > 0 and ≤ 1,000,000)",
                ))
                continue

            # ── Price (per share or total cost) ─────────────────────────
            raw_pps = _get(3)
            raw_total = _get(4)
            price_per_share: Optional[float] = None

            if raw_pps is not None:
                try:
                    pps = float(raw_pps)
                    if pps > 0:
                        price_per_share = pps
                except (TypeError, ValueError):
                    pass

            if price_per_share is None and raw_total is not None:
                try:
                    total = float(raw_total)
                    if total > 0:
                        price_per_share = round(total / quantity, 4)
                except (TypeError, ValueError):
                    pass

            if price_per_share is None:
                skipped_invalid += 1
                details.append(ImportRowResult(
                    sheet_name=sheet_name, row_number=row_idx,
                    ticker=ticker, status="skipped_invalid",
                    reason="Missing or invalid price (provide Price Per Share or Total Cost)",
                ))
                continue

            # ── Currency ────────────────────────────────────────────────
            raw_currency = _get(5)
            purchase_currency: Optional[str] = None
            if raw_currency:
                currency_str = str(raw_currency).strip().upper()
                if currency_str and currency_str in ALLOWED_CURRENCIES:
                    purchase_currency = currency_str
                elif currency_str:
                    skipped_invalid += 1
                    details.append(ImportRowResult(
                        sheet_name=sheet_name, row_number=row_idx,
                        ticker=ticker, status="skipped_invalid",
                        reason=f"Invalid currency '{currency_str}'. "
                               f"Supported: {', '.join(sorted(ALLOWED_CURRENCIES))}",
                    ))
                    continue

            # ── Duplicate check ─────────────────────────────────────────
            inv_key = (ticker, purchase_date)
            if inv_key in existing_investments or inv_key in new_investment_keys:
                skipped_duplicate += 1
                details.append(ImportRowResult(
                    sheet_name=sheet_name, row_number=row_idx,
                    ticker=ticker, status="skipped_duplicate",
                    reason=f"{ticker} on {purchase_date} already exists",
                ))
                continue

            # ── Check if stock is known ─────────────────────────────────
            if ticker not in known_tickers:
                has_unknown_stocks = True

            # ── Create investment ───────────────────────────────────────
            investment = UserInvestment(
                user_id=user_id,
                ticker_symbol=ticker,
                purchase_date=purchase_date,
                purchase_price=price_per_share,
                quantity=quantity,
                purchase_currency=purchase_currency,
                portfolio_id=portfolio_id,
            )
            db.add(investment)
            new_investment_keys.add(inv_key)
            created += 1
            details.append(ImportRowResult(
                sheet_name=sheet_name, row_number=row_idx,
                ticker=ticker, status="created",
            ))

    wb.close()

    if created == 0 and total_rows > 0:
        # All rows were skipped — commit portfolio creations and return summary
        await db.commit()
        return ImportSummary(
            total_rows_processed=total_rows,
            created=0,
            skipped_duplicate=skipped_duplicate,
            skipped_invalid=skipped_invalid,
            portfolios_created=portfolios_created,
            portfolios_merged=portfolios_merged,
            has_unknown_stocks=False,
            details=details,
        )

    if total_rows == 0:
        raise HTTPException(
            status_code=400,
            detail="No data rows found in the file. All sheets are empty.",
        )

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Some investments conflicted with existing data. Please try again.",
        )

    # Fetch market data for any imported stock the app doesn't have yet
    from dividendcase.services.refresh import queue_holdings
    await queue_holdings()

    return ImportSummary(
        total_rows_processed=total_rows,
        created=created,
        skipped_duplicate=skipped_duplicate,
        skipped_invalid=skipped_invalid,
        portfolios_created=portfolios_created,
        portfolios_merged=portfolios_merged,
        has_unknown_stocks=has_unknown_stocks,
        details=details,
    )


# ── Report Generation ─────────────────────────────────────────────────────

# Shared styles for report sheets
_RPT_TITLE_FONT = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
_RPT_TITLE_FILL = PatternFill(start_color="2F5496", end_color="2F5496", fill_type="solid")
_RPT_HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
_RPT_HEADER_FILL = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
_RPT_BODY_FONT = Font(name="Calibri", size=11)
_RPT_NUM_FMT = "#,##0.00"
_RPT_PCT_FMT = "0.0%"


def _rpt_header_row(ws, row: int, headers: list[str], widths: list[int] | None = None):
    """Write a styled header row."""
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=row, column=col, value=h)
        cell.font = _RPT_HEADER_FONT
        cell.fill = _RPT_HEADER_FILL
        cell.alignment = Alignment(horizontal="center")
    if widths:
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = w


def _rpt_title(ws, text: str):
    """Merge row 1 as a title bar."""
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=8)
    cell = ws.cell(row=1, column=1, value=text)
    cell.font = _RPT_TITLE_FONT
    cell.fill = _RPT_TITLE_FILL
    cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 28


@router.get("/report")
async def generate_report(
    portfolio_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    """Generate a comprehensive Excel report with data tables and charts."""
    from dividendcase.api.v1.portfolio import portfolio_analysis, income_calendar
    from dividendcase.models.user_preferences import UserPreferences as _Prefs
    from dividendcase.services import fx

    # Totals in the home currency when one is set and rates exist (each amount at its date)
    prefs = (await db.execute(select(_Prefs).where(_Prefs.user_id == user_id))).scalar_one_or_none()
    table = await fx.get_table()
    home = prefs.home_currency if prefs else None
    report_currency = home if home and table and fx.can_convert(home, table) else None

    # ── Fetch analysis data ───────────────────────────────────────────
    try:
        analysis = await portfolio_analysis(portfolio_id=portfolio_id, currency=report_currency, db=db, user_id=user_id)
    except HTTPException:
        raise HTTPException(status_code=404, detail="No portfolio data found. Add investments first.")

    try:
        calendar = await income_calendar(portfolio_id=portfolio_id, db=db, user_id=user_id)
    except HTTPException:
        calendar = None

    # ── Determine portfolio name ──────────────────────────────────────
    portfolio_name = "All Portfolios"
    if portfolio_id is not None:
        result = await db.execute(
            select(UserPortfolio).where(UserPortfolio.id == portfolio_id, UserPortfolio.user_id == user_id)
        )
        p = result.scalar_one_or_none()
        if p:
            portfolio_name = p.name

    wb = Workbook()

    # ================================================================
    # Sheet 1: Summary
    # ================================================================
    ws_summary = wb.active
    ws_summary.title = "Summary"
    _rpt_title(ws_summary, f"DividendCase Report — {portfolio_name}")

    dp = analysis.data_points
    last_dp = dp[-1] if dp else None

    total_invested = analysis.total_initial_investment
    current_value = last_dp.total_investment_value if last_dp else 0
    total_divs = last_dp.total_dividends if last_dp else 0
    total_portfolio = last_dp.total_portfolio_value if last_dp else 0
    benchmark_value = last_dp.benchmark_value if last_dp else total_invested
    gain_loss = total_portfolio - total_invested if total_invested else 0
    gain_pct = (gain_loss / total_invested) if total_invested else 0

    summary_data = [
        ("Portfolio", portfolio_name),
        ("Report Date", datetime.now().strftime("%Y-%m-%d %H:%M")),
        ("Currency", analysis.currency),
        ("", ""),
        ("Total Invested", total_invested),
        ("Current Market Value", current_value),
        ("Total Dividends Earned", total_divs),
        ("Total Portfolio Value", total_portfolio),
        ("Gain / Loss", gain_loss),
        ("Gain / Loss %", gain_pct),
        ("", ""),
        ("Benchmark", f"{analysis.benchmark_name} ({analysis.benchmark_ticker})"),
        ("Benchmark Equivalent Value", benchmark_value),
    ]

    ws_summary.column_dimensions["A"].width = 28
    ws_summary.column_dimensions["B"].width = 30
    label_font = Font(name="Calibri", size=11, bold=True)
    for i, (label, value) in enumerate(summary_data, 3):
        ws_summary.cell(row=i, column=1, value=label).font = label_font
        cell = ws_summary.cell(row=i, column=2, value=value)
        cell.font = _RPT_BODY_FONT
        if isinstance(value, float):
            cell.number_format = _RPT_NUM_FMT
        if label == "Gain / Loss %":
            cell.number_format = _RPT_PCT_FMT

    # ================================================================
    # Sheet 2: Holdings
    # ================================================================
    ws_holdings = wb.create_sheet("Holdings")
    _rpt_title(ws_holdings, "Portfolio Holdings")

    tickers = sorted(set(inv.ticker_symbol for inv in analysis.investments))
    h_headers = ["Ticker", "Exchange", "Shares", "Avg Price", "Currency", "Invested", "Current Value", "Dividends", "Gain/Loss %"]
    h_widths = [14, 12, 10, 14, 10, 16, 16, 14, 14]
    _rpt_header_row(ws_holdings, 3, h_headers, h_widths)

    row = 4
    for ticker in tickers:
        ticker_invs = [inv for inv in analysis.investments if inv.ticker_symbol == ticker]
        total_shares = sum(inv.quantity for inv in ticker_invs)
        with_price = [inv for inv in ticker_invs if inv.purchase_price is not None]
        avg_price = (
            sum(inv.quantity * inv.purchase_price for inv in with_price) / sum(inv.quantity for inv in with_price)
            if with_price else None
        )
        invested = sum(inv.quantity * (inv.purchase_price or 0) for inv in with_price)
        cur_val = last_dp.stock_values.get(ticker, 0) if last_dp else 0
        divs = last_dp.stock_dividends.get(ticker, 0) if last_dp else 0
        gl_pct = ((cur_val + divs - invested) / invested) if invested > 0 else 0

        ws_holdings.cell(row=row, column=1, value=ticker).font = _RPT_BODY_FONT
        ws_holdings.cell(row=row, column=2, value=analysis.exchange_map.get(ticker, "")).font = _RPT_BODY_FONT
        ws_holdings.cell(row=row, column=3, value=total_shares).font = _RPT_BODY_FONT
        c = ws_holdings.cell(row=row, column=4, value=avg_price)
        c.font = _RPT_BODY_FONT
        c.number_format = _RPT_NUM_FMT
        ws_holdings.cell(row=row, column=5, value=analysis.currency_map.get(ticker, "")).font = _RPT_BODY_FONT
        c = ws_holdings.cell(row=row, column=6, value=invested)
        c.font = _RPT_BODY_FONT
        c.number_format = _RPT_NUM_FMT
        c = ws_holdings.cell(row=row, column=7, value=cur_val)
        c.font = _RPT_BODY_FONT
        c.number_format = _RPT_NUM_FMT
        c = ws_holdings.cell(row=row, column=8, value=divs)
        c.font = _RPT_BODY_FONT
        c.number_format = _RPT_NUM_FMT
        c = ws_holdings.cell(row=row, column=9, value=gl_pct)
        c.font = _RPT_BODY_FONT
        c.number_format = _RPT_PCT_FMT
        row += 1

    # ================================================================
    # Sheet 3: Investment Value Over Time
    # ================================================================
    if dp:
        ws_value = wb.create_sheet("Value Over Time")
        _rpt_title(ws_value, "Investment Value Over Time")

        val_headers = ["Date"] + tickers + ["Total Portfolio", "Benchmark"]
        _rpt_header_row(ws_value, 3, val_headers, [14] + [14] * len(tickers) + [16, 16])

        for i, point in enumerate(dp, 4):
            ws_value.cell(row=i, column=1, value=point.date).font = _RPT_BODY_FONT
            for j, ticker in enumerate(tickers, 2):
                c = ws_value.cell(row=i, column=j, value=point.stock_values.get(ticker, 0))
                c.number_format = _RPT_NUM_FMT
            c = ws_value.cell(row=i, column=len(tickers) + 2, value=point.total_portfolio_value)
            c.number_format = _RPT_NUM_FMT
            c = ws_value.cell(row=i, column=len(tickers) + 3, value=point.benchmark_value)
            c.number_format = _RPT_NUM_FMT

        # Line chart
        if len(dp) >= 2:
            chart = LineChart()
            chart.title = "Portfolio Value vs Benchmark"
            chart.y_axis.title = analysis.currency
            chart.x_axis.title = "Date"
            chart.width = 28
            chart.height = 14
            chart.style = 10

            data_ref = Reference(ws_value, min_col=len(tickers) + 2, min_row=3, max_col=len(tickers) + 3, max_row=3 + len(dp))
            cats = Reference(ws_value, min_col=1, min_row=4, max_row=3 + len(dp))
            chart.add_data(data_ref, titles_from_data=True)
            chart.set_categories(cats)
            chart.series[0].graphicalProperties.line.width = 20000
            chart.series[1].graphicalProperties.line.width = 20000
            ws_value.add_chart(chart, f"A{4 + len(dp) + 2}")

    # ================================================================
    # Sheet 4: Dividends Received
    # ================================================================
    if dp:
        ws_divs = wb.create_sheet("Dividends Received")
        _rpt_title(ws_divs, "Cumulative Dividends Received")

        div_headers = ["Date"] + tickers + ["Total Cumulative"]
        _rpt_header_row(ws_divs, 3, div_headers, [14] + [14] * len(tickers) + [18])

        for i, point in enumerate(dp, 4):
            ws_divs.cell(row=i, column=1, value=point.date).font = _RPT_BODY_FONT
            for j, ticker in enumerate(tickers, 2):
                c = ws_divs.cell(row=i, column=j, value=point.stock_dividends.get(ticker, 0))
                c.number_format = _RPT_NUM_FMT
            c = ws_divs.cell(row=i, column=len(tickers) + 2, value=point.total_dividends)
            c.number_format = _RPT_NUM_FMT

        # Bar chart for total dividends
        if len(dp) >= 2:
            chart = BarChart()
            chart.title = "Cumulative Dividends"
            chart.y_axis.title = analysis.currency
            chart.width = 28
            chart.height = 14
            chart.style = 10

            data_ref = Reference(ws_divs, min_col=len(tickers) + 2, min_row=3, max_row=3 + len(dp))
            cats = Reference(ws_divs, min_col=1, min_row=4, max_row=3 + len(dp))
            chart.add_data(data_ref, titles_from_data=True)
            chart.set_categories(cats)
            ws_divs.add_chart(chart, f"A{4 + len(dp) + 2}")

    # ================================================================
    # Sheet 5: Diversification
    # ================================================================
    ws_div = wb.create_sheet("Diversification")
    _rpt_title(ws_div, "Portfolio Diversification")

    # Calculate weights from last data point
    total_val = sum(last_dp.stock_values.values()) if last_dp else 1

    def _write_breakdown(ws, start_row: int, title: str, mapping: dict, col_offset: int = 0):
        """Write a category → tickers → weight breakdown table."""
        c1 = 1 + col_offset
        c2 = c1 + 1
        c3 = c1 + 2
        ws.cell(row=start_row, column=c1, value=title).font = Font(name="Calibri", size=12, bold=True)
        _rpt_header_row(ws, start_row + 1, ["Category", "Tickers", "Weight"], [20, 30, 12])
        # Adjust header positions if offset
        if col_offset > 0:
            for ci, h in enumerate(["Category", "Tickers", "Weight"], c1):
                cell = ws.cell(row=start_row + 1, column=ci, value=h)
                cell.font = _RPT_HEADER_FONT
                cell.fill = _RPT_HEADER_FILL

        # Group tickers by category
        from collections import defaultdict
        cat_tickers = defaultdict(list)
        for t, cat in mapping.items():
            cat_tickers[cat].append(t)

        r = start_row + 2
        for cat in sorted(cat_tickers.keys()):
            cat_tick = cat_tickers[cat]
            cat_val = sum(last_dp.stock_values.get(t, 0) for t in cat_tick) if last_dp else 0
            weight = cat_val / total_val if total_val > 0 else 0
            ws.cell(row=r, column=c1, value=cat).font = _RPT_BODY_FONT
            ws.cell(row=r, column=c2, value=", ".join(sorted(cat_tick))).font = _RPT_BODY_FONT
            c = ws.cell(row=r, column=c3, value=weight)
            c.font = _RPT_BODY_FONT
            c.number_format = _RPT_PCT_FMT
            r += 1
        return r

    r = 3
    if analysis.sector_map:
        r = _write_breakdown(ws_div, r, "By Sector", analysis.sector_map)
        # Pie chart for sector
        if len(analysis.sector_map) > 0:
            from collections import defaultdict
            sect_vals = defaultdict(float)
            for t, s in analysis.sector_map.items():
                sect_vals[s] += last_dp.stock_values.get(t, 0) if last_dp else 0
            # Write pie data in hidden columns
            pie_start = r + 1
            for idx, (s, v) in enumerate(sorted(sect_vals.items())):
                ws_div.cell(row=pie_start + idx, column=7, value=s)
                ws_div.cell(row=pie_start + idx, column=8, value=v)
            pie = PieChart()
            pie.title = "Sector Allocation"
            pie.width = 16
            pie.height = 12
            data_ref = Reference(ws_div, min_col=8, min_row=pie_start, max_row=pie_start + len(sect_vals) - 1)
            cats = Reference(ws_div, min_col=7, min_row=pie_start, max_row=pie_start + len(sect_vals) - 1)
            pie.add_data(data_ref)
            pie.set_categories(cats)
            ws_div.add_chart(pie, f"E{3}")
        r += 2

    if analysis.country_map:
        r = _write_breakdown(ws_div, r, "By Country", analysis.country_map)
        r += 2

    if analysis.industry_map:
        r = _write_breakdown(ws_div, r, "By Industry", analysis.industry_map)
        r += 2

    if analysis.frequency_map:
        _write_breakdown(ws_div, r, "By Payment Frequency", analysis.frequency_map)

    # ================================================================
    # Sheet 6: Income Calendar
    # ================================================================
    if calendar and calendar.entries:
        ws_cal = wb.create_sheet("Income Calendar")
        _rpt_title(ws_cal, "Projected Dividend Income (Next 12 Months)")

        cal_headers = ["Month", "Ticker", "Company", "Expected Date", "Amount/Share", "Shares", "Est. Income", "Currency"]
        cal_widths = [12, 12, 24, 14, 14, 10, 14, 10]
        _rpt_header_row(ws_cal, 3, cal_headers, cal_widths)

        row = 4
        for entry in calendar.entries:
            ed = entry.expected_date
            ws_cal.cell(row=row, column=1, value=ed.strftime("%b %Y") if hasattr(ed, 'strftime') else str(ed)[:7]).font = _RPT_BODY_FONT
            ws_cal.cell(row=row, column=2, value=entry.ticker_symbol).font = _RPT_BODY_FONT
            ws_cal.cell(row=row, column=3, value=entry.company_name).font = _RPT_BODY_FONT
            ws_cal.cell(row=row, column=4, value=ed.strftime("%Y-%m-%d") if hasattr(ed, 'strftime') else str(ed)).font = _RPT_BODY_FONT
            c = ws_cal.cell(row=row, column=5, value=entry.amount_per_share)
            c.number_format = _RPT_NUM_FMT
            ws_cal.cell(row=row, column=6, value=entry.total_shares).font = _RPT_BODY_FONT
            c = ws_cal.cell(row=row, column=7, value=entry.estimated_amount)
            c.number_format = _RPT_NUM_FMT
            ws_cal.cell(row=row, column=8, value=entry.currency).font = _RPT_BODY_FONT
            row += 1

        # Monthly totals
        row += 1
        ws_cal.cell(row=row, column=1, value="Monthly Totals").font = Font(name="Calibri", size=12, bold=True)
        row += 1
        _rpt_header_row(ws_cal, row, ["Month", "Total Income"], [14, 16])
        chart_start = row
        row += 1
        for month_key in sorted(calendar.monthly_totals.keys()):
            ws_cal.cell(row=row, column=1, value=month_key).font = _RPT_BODY_FONT
            c = ws_cal.cell(row=row, column=2, value=calendar.monthly_totals[month_key])
            c.number_format = _RPT_NUM_FMT
            row += 1

        # Annual total
        row += 1
        ws_cal.cell(row=row, column=1, value="Annual Total").font = Font(name="Calibri", size=11, bold=True)
        c = ws_cal.cell(row=row, column=2, value=calendar.annual_total)
        c.number_format = _RPT_NUM_FMT
        c.font = Font(name="Calibri", size=11, bold=True)

        # Bar chart for monthly income
        num_months = len(calendar.monthly_totals)
        if num_months >= 2:
            chart = BarChart()
            chart.title = "Monthly Dividend Income"
            chart.width = 24
            chart.height = 12
            chart.style = 10
            data_ref = Reference(ws_cal, min_col=2, min_row=chart_start, max_row=chart_start + num_months)
            cats = Reference(ws_cal, min_col=1, min_row=chart_start + 1, max_row=chart_start + num_months)
            chart.add_data(data_ref, titles_from_data=True)
            chart.set_categories(cats)
            ws_cal.add_chart(chart, f"D{chart_start}")

    # ── Write to buffer ───────────────────────────────────────────────
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    safe_name = portfolio_name.replace(" ", "_").lower()
    filename = f"dividendcase_report_{safe_name}.xlsx"

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
