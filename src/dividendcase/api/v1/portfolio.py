"""
Portfolio management endpoints.
CRUD for user investments + aggregated portfolio analysis with benchmark comparison.
"""
import asyncio
import logging
from datetime import date, datetime
from typing import Optional
from uuid import UUID

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from dividendcase.database import get_db
from dividendcase.models.user_investment import UserInvestment
from dividendcase.models.user_portfolio import UserPortfolio
from dividendcase.crud.stock import get_stock, upsert_stock
from dividendcase.crud.dividend import get_dividends_for_ticker, upsert_dividend_records
from dividendcase.schemas.user_investment import (
    InvestmentAdd,
    InvestmentItem,
    InvestmentMove,
    InvestmentUpdate,
    PortfolioDataPoint,
    PortfolioAnalysisResponse,
    CalendarEntry,
    IncomeCalendarResponse,
)
from dividendcase.api.v1.deps import _get_user_id
from dividendcase.api.v1.investment import EXCHANGE_BENCHMARKS, DEFAULT_BENCHMARK, _get_benchmark_data
from dividendcase.services import fx, withholding
from dividendcase.models.user_preferences import UserPreferences
from dividendcase.models.stock import Stock

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=list[InvestmentItem])
async def list_investments(
    portfolio_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    query = select(UserInvestment).where(UserInvestment.user_id == user_id)
    if portfolio_id is not None:
        query = query.where(UserInvestment.portfolio_id == portfolio_id)
    query = query.order_by(UserInvestment.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=InvestmentItem, status_code=201)
async def add_investment(
    body: InvestmentAdd,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    ticker = body.ticker.upper().strip()

    # Ensure stock + dividend data exists in DB (fetch from Yahoo if needed)
    stock = await get_stock(db, ticker)
    if not stock:
        logger.info(f"Stock {ticker} not in DB, attempting auto-fetch from Yahoo Finance")
        try:
            from dividendcase.services.yahoo_fetcher import YahooFetcher
            fetcher = YahooFetcher()
            stock_data, dividend_records = await asyncio.to_thread(
                fetcher.fetch_stock_light, ticker
            )
            if stock_data:
                stock = await upsert_stock(db, stock_data)
                if dividend_records:
                    await upsert_dividend_records(db, stock.id, ticker, dividend_records)
                logger.info(f"Auto-fetched {ticker} into database: {len(dividend_records)} dividend records")
            else:
                logger.warning(f"Yahoo Finance returned no data for {ticker}")
        except Exception as e:
            logger.warning(f"Could not auto-fetch {ticker}: {type(e).__name__}: {e}")
            await db.rollback()  # the holding is still added; the refresh retries the fetch
    else:
        logger.info(f"Stock {ticker} already in DB, skipping fetch")

    existing = await db.execute(
        select(UserInvestment).where(
            UserInvestment.user_id == user_id,
            UserInvestment.ticker_symbol == ticker,
            UserInvestment.purchase_date == body.purchase_date,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"{ticker} purchased on {body.purchase_date} is already in your portfolio",
        )

    # Resolve portfolio_id — if provided, verify it belongs to this user
    portfolio_id = body.portfolio_id
    if portfolio_id is None:
        from dividendcase.api.v1.portfolios import _ensure_default_portfolio
        default_portfolio = await _ensure_default_portfolio(db, user_id)
        portfolio_id = default_portfolio.id
    else:
        portfolio_check = await db.execute(
            select(UserPortfolio).where(
                UserPortfolio.id == portfolio_id,
                UserPortfolio.user_id == user_id,
            )
        )
        if not portfolio_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Portfolio not found")

    item = UserInvestment(
        user_id=user_id,
        ticker_symbol=ticker,
        purchase_date=body.purchase_date,
        purchase_price=body.purchase_price,
        purchase_currency=body.purchase_currency,
        quantity=body.quantity,
        portfolio_id=portfolio_id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    # If the fetch above failed (for example Yahoo asked for a pause), the background worker retries it
    from dividendcase.services.refresh import queue_holdings
    await queue_holdings()
    return item


@router.patch("/{investment_id}/move", response_model=InvestmentItem)
async def move_investment(
    investment_id: int,
    body: InvestmentMove,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    # Find the investment
    result = await db.execute(
        select(UserInvestment).where(
            UserInvestment.id == investment_id,
            UserInvestment.user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Investment not found")

    # Validate target portfolio belongs to user
    portfolio_result = await db.execute(
        select(UserPortfolio).where(
            UserPortfolio.id == body.target_portfolio_id,
            UserPortfolio.user_id == user_id,
        )
    )
    if not portfolio_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Target portfolio not found")

    item.portfolio_id = body.target_portfolio_id
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/{investment_id}", response_model=InvestmentItem)
async def update_investment(
    investment_id: int,
    body: InvestmentUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    # Find the investment
    result = await db.execute(
        select(UserInvestment).where(
            UserInvestment.id == investment_id,
            UserInvestment.user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Investment not found")

    # If purchase_date is changing, check UNIQUE constraint
    if body.purchase_date is not None and body.purchase_date != item.purchase_date:
        dup = await db.execute(
            select(UserInvestment).where(
                UserInvestment.user_id == user_id,
                UserInvestment.ticker_symbol == item.ticker_symbol,
                UserInvestment.purchase_date == body.purchase_date,
                UserInvestment.id != investment_id,
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"{item.ticker_symbol} purchased on {body.purchase_date} already exists",
            )

    # Apply non-None fields
    if body.quantity is not None:
        item.quantity = body.quantity
    if body.purchase_price is not None:
        item.purchase_price = body.purchase_price
    if body.purchase_date is not None:
        item.purchase_date = body.purchase_date
    if body.purchase_currency is not None:
        item.purchase_currency = body.purchase_currency

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{investment_id}", status_code=204)
async def remove_investment(
    investment_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    await db.execute(
        delete(UserInvestment).where(
            UserInvestment.id == investment_id,
            UserInvestment.user_id == user_id,
        )
    )
    await db.commit()


@router.get("/cost")
async def portfolio_cost(
    currency: str = Query(..., pattern=r"^[A-Z]{3}$"),
    portfolio_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    """What the holdings cost, in one currency, each lot at the rate on its purchase date."""
    query = select(UserInvestment).where(UserInvestment.user_id == user_id)
    if portfolio_id is not None:
        query = query.where(UserInvestment.portfolio_id == portfolio_id)
    investments = (await db.execute(query)).scalars().all()
    tickers = {inv.ticker_symbol for inv in investments}
    stock_currency = {
        row[0]: row[1] for row in (await db.execute(
            select(Stock.ticker_symbol, Stock.currency).where(Stock.ticker_symbol.in_(tickers))
        )).all()
    } if tickers else {}

    table = await fx.get_table()
    total = 0.0
    by_ticker: dict[str, float] = {}
    unpriced = 0
    unconverted: set[str] = set()
    for inv in investments:
        if inv.purchase_price is None:
            unpriced += 1
            continue
        lot_currency = inv.purchase_currency or stock_currency.get(inv.ticker_symbol) or "USD"
        amount = float(inv.quantity) * float(inv.purchase_price)
        value = fx.convert(amount, lot_currency, currency, table, inv.purchase_date)
        if value is None:
            unconverted.add(lot_currency)
            continue
        total += value
        by_ticker[inv.ticker_symbol] = by_ticker.get(inv.ticker_symbol, 0.0) + value
    return {
        "currency": currency,
        "total": round(total, 2),
        "by_ticker": {t: round(v, 2) for t, v in by_ticker.items()},
        "lots_without_price": unpriced,
        "unconverted_currencies": sorted(unconverted),
        "rates_available": bool(table),
    }


@router.get("/analysis", response_model=PortfolioAnalysisResponse)
async def portfolio_analysis(
    portfolio_id: Optional[int] = Query(None),
    currency: Optional[str] = Query(None, pattern=r"^[A-Z]{3}$", description="Convert every amount into this currency"),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    # 1. Fetch user investments (optionally filtered by portfolio)
    query = (
        select(UserInvestment)
        .where(UserInvestment.user_id == user_id)
        .order_by(UserInvestment.created_at.asc())
    )
    if portfolio_id is not None:
        query = query.where(UserInvestment.portfolio_id == portfolio_id)
    result = await db.execute(query)
    investments = result.scalars().all()
    if not investments:
        raise HTTPException(status_code=404, detail="No investments found")

    # 2. For each investment, fetch stock info + dividend records
    stock_data = {}  # ticker -> {stock, records, investments}
    earliest_date = date(9999, 1, 1)
    primary_exchange = None
    primary_currency = "USD"
    exchange_map: dict[str, str] = {}
    currency_map: dict[str, str] = {}

    for inv in investments:
        ticker = inv.ticker_symbol
        if ticker not in stock_data:
            stock = await get_stock(db, ticker)
            if not stock:
                logger.warning(f"Stock {ticker} not in database, skipping")
                continue
            records = await get_dividends_for_ticker(db, ticker, years=20)
            stock_data[ticker] = {
                "stock": stock,
                "records": records,
                "investments": [],
            }
            exchange_map[ticker] = stock.exchange or ""
            currency_map[ticker] = stock.currency or "USD"
            if primary_exchange is None:
                primary_exchange = stock.exchange
                primary_currency = stock.currency or "USD"

        stock_data[ticker]["investments"].append(inv)
        if inv.purchase_date < earliest_date:
            earliest_date = inv.purchase_date

    # Build purchase_currency_map: ticker -> purchase currency (from investment, fallback to stock currency)
    purchase_currency_map: dict[str, str] = {}
    for inv in investments:
        ticker = inv.ticker_symbol
        if ticker not in purchase_currency_map:
            purchase_currency_map[ticker] = inv.purchase_currency or currency_map.get(ticker, "USD")

    # Build diversification maps from stock metadata
    sector_map: dict[str, str] = {}
    country_map: dict[str, str] = {}
    industry_map: dict[str, str] = {}
    frequency_map: dict[str, str] = {}

    # First pass: try to backfill missing sector/country/industry from Yahoo Finance
    from dividendcase.api.v1.stocks import _fetch_asset_profile
    for ticker, info in stock_data.items():
        stock = info["stock"]
        needs_update = (not stock.sector or stock.sector == "Unknown")
        if needs_update:
            try:
                profile = await asyncio.to_thread(_fetch_asset_profile, ticker)
                sector = profile.get("sector")
                country = profile.get("country")
                industry = profile.get("industry")
                description = profile.get("summary")
                if sector or country or industry or description:
                    stock.sector = sector or stock.sector
                    stock.country = country or stock.country
                    stock.industry = industry or stock.industry
                    if description:
                        stock.description = description
                    await db.commit()
                    logger.info(f"Backfilled metadata for {ticker}: sector={sector}, country={country}")
            except Exception as e:
                logger.debug(f"Could not backfill metadata for {ticker}: {e}")

    for ticker, info in stock_data.items():
        stock = info["stock"]
        # Filter out "Unknown" — treat same as NULL
        if stock.sector and stock.sector != "Unknown":
            sector_map[ticker] = stock.sector
        if stock.country and stock.country != "Unknown":
            country_map[ticker] = stock.country
        if stock.industry and stock.industry != "Unknown":
            industry_map[ticker] = stock.industry
        # Compute payment frequency from dividend records (rarely stored on stock)
        if stock.payment_frequency and stock.payment_frequency != "Unknown":
            frequency_map[ticker] = stock.payment_frequency
        else:
            records = info["records"]
            if len(records) >= 2:
                sorted_recs = sorted(records, key=lambda r: r.dividend_date)
                dates = [r.dividend_date for r in sorted_recs]
                gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
                avg_gap = sum(gaps) / len(gaps)
                if avg_gap < 45:
                    frequency_map[ticker] = "monthly"
                elif avg_gap < 120:
                    frequency_map[ticker] = "quarterly"
                elif avg_gap < 270:
                    frequency_map[ticker] = "semi-annual"
                else:
                    frequency_map[ticker] = "annual"

    if not stock_data:
        raise HTTPException(status_code=404, detail="None of the invested stocks found in database")

    # 3. Determine benchmark
    bench = EXCHANGE_BENCHMARKS.get(primary_exchange or "", DEFAULT_BENCHMARK)
    bench_ticker = bench["ticker"]
    bench_name = bench["name"]

    # 4. Build unified monthly time series
    all_dates: set[date] = set()
    for ticker, info in stock_data.items():
        for r in info["records"]:
            if r.dividend_date and r.share_price_on_dividend_date:
                for inv in info["investments"]:
                    if r.dividend_date >= inv.purchase_date:
                        all_dates.add(r.dividend_date)

    if not all_dates:
        inv_items = [InvestmentItem.model_validate(inv) for inv in investments]
        return PortfolioAnalysisResponse(
            investments=inv_items,
            total_initial_investment=0,
            benchmark_ticker=bench_ticker,
            benchmark_name=bench_name,
            currency=primary_currency,
            exchange_map=exchange_map,
            currency_map=currency_map,
            purchase_currency_map=purchase_currency_map,
            sector_map=sector_map,
            country_map=country_map,
            industry_map=industry_map,
            frequency_map=frequency_map,
            data_points=[],
        )

    sorted_dates = sorted(all_dates)

    # Amounts are converted into `currency` at the rate on their own date (a 2019 purchase
    # at the 2019 rate, today's value at today's). Without a currency, or before any rates
    # are stored, each amount stays in its own currency as before.
    fx_table = await fx.get_table() if currency else None
    converting = bool(currency and fx_table)
    if converting and not fx.can_convert(currency, fx_table):
        raise HTTPException(status_code=422, detail=f"No exchange rates for {currency}")
    unconverted: set[str] = set()

    def conv(amount: float, from_currency: str, when: date) -> float:
        if not converting:
            return amount
        value = fx.convert(amount, from_currency, currency, fx_table, when)
        if value is None:
            unconverted.add(from_currency)
            return amount
        return value

    # 5. Calculate initial investments and benchmark shares
    total_initial_investment = 0.0
    # Per-investment tracking keyed by investment id
    inv_tracking: dict[int, dict] = {}

    for ticker, info in stock_data.items():
        for inv in info["investments"]:
            qty = float(inv.quantity)
            # Use user-entered purchase_price if available, else find first dividend record price
            if inv.purchase_price:
                first_price = float(inv.purchase_price)
                price_currency = inv.purchase_currency or currency_map.get(ticker, "USD")
            else:
                first_price = 0.0
                price_currency = currency_map.get(ticker, "USD")
                for r in info["records"]:
                    if r.dividend_date >= inv.purchase_date and r.share_price_on_dividend_date:
                        first_price = float(r.share_price_on_dividend_date)
                        break
            initial = conv(qty * first_price, price_currency, inv.purchase_date)
            total_initial_investment += initial
            inv_tracking[inv.id] = {
                "ticker": ticker,
                "quantity": qty,
                "purchase_date": inv.purchase_date,
                "initial_investment": initial,
            }

    # Fetch benchmark data
    earliest_year = earliest_date.year
    bench_price_at_start, bench_monthly = await asyncio.to_thread(
        _get_benchmark_data, bench_ticker, earliest_year
    )
    bench_currency = bench.get("currency", "USD")
    if converting:
        # The same money, changed into the benchmark's currency on the first purchase day
        start_money = fx.convert(total_initial_investment, currency, bench_currency, fx_table, earliest_date)
    else:
        start_money = total_initial_investment
    bench_shares = (start_money / bench_price_at_start) if bench_price_at_start and start_money else None

    # 6. Build data points
    cumulative_divs_tracker: dict[int, float] = {
        inv_id: 0.0 for inv_id in inv_tracking
    }
    last_price: dict[str, float] = {}

    data_points: list[PortfolioDataPoint] = []

    for d in sorted_dates:
        stock_values: dict[str, float] = {}
        stock_dividends: dict[str, float] = {}

        for ticker, info in stock_data.items():
            record = None
            for r in info["records"]:
                if r.dividend_date == d:
                    record = r
                    break

            if record and record.share_price_on_dividend_date:
                last_price[ticker] = float(record.share_price_on_dividend_date)

            ticker_value = 0.0
            ticker_divs = 0.0

            for inv in info["investments"]:
                if d < inv.purchase_date:
                    continue

                qty = float(inv.quantity)
                price = last_price.get(ticker, 0.0)
                ticker_value += conv(qty * price, currency_map.get(ticker, "USD"), d)

                if record and record.dividend_per_share and d >= inv.purchase_date:
                    # Each payment at the rate on the day it was paid
                    cumulative_divs_tracker[inv.id] += conv(
                        float(record.dividend_per_share) * qty, currency_map.get(ticker, "USD"), d
                    )

                ticker_divs += cumulative_divs_tracker[inv.id]

            if ticker_value > 0 or ticker_divs > 0:
                stock_values[ticker] = round(ticker_value, 2)
                stock_dividends[ticker] = round(ticker_divs, 2)

        total_inv_value = sum(stock_values.values())
        total_divs = sum(stock_dividends.values())
        total_portfolio = total_inv_value + total_divs

        benchmark_value = total_initial_investment
        if bench_shares is not None and not bench_monthly.empty:
            try:
                rec_ts = pd.Timestamp(d)
                bench_before = bench_monthly[bench_monthly.index <= rec_ts]
                if not bench_before.empty:
                    row = bench_before.iloc[-1]
                    bench_local = bench_shares * float(row["price"]) + bench_shares * float(row["cumulative_divs"])
                    if converting:
                        bench_local = fx.convert(bench_local, bench_currency, currency, fx_table, d) or bench_local
                    benchmark_value = round(bench_local, 2)
            except Exception as e:
                logger.warning(f"Benchmark lookup failed at {d}: {e}")

        date_label = datetime.combine(d, datetime.min.time()).strftime("%b %Y")
        data_points.append(PortfolioDataPoint(
            date=date_label,
            stock_values=stock_values,
            stock_dividends=stock_dividends,
            total_investment_value=round(total_inv_value, 2),
            total_dividends=round(total_divs, 2),
            total_portfolio_value=round(total_portfolio, 2),
            benchmark_value=benchmark_value,
        ))

    inv_items = [InvestmentItem.model_validate(inv) for inv in investments]

    return PortfolioAnalysisResponse(
        investments=inv_items,
        total_initial_investment=round(total_initial_investment, 2),
        benchmark_ticker=bench_ticker,
        benchmark_name=bench_name,
        currency=currency if converting else primary_currency,
        converted=converting,
        unconverted_currencies=sorted(unconverted),
        exchange_map=exchange_map,
        currency_map=currency_map,
        purchase_currency_map=purchase_currency_map,
        sector_map=sector_map,
        country_map=country_map,
        industry_map=industry_map,
        frequency_map=frequency_map,
        data_points=data_points,
    )


# ── Income Calendar ──────────────────────────────────────────────────────────

FREQ_MONTHS = {
    "monthly": 1,
    "quarterly": 3,
    "semi-annual": 6,
    "annual": 12,
}


@router.get("/calendar", response_model=IncomeCalendarResponse)
async def income_calendar(
    portfolio_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(_get_user_id),
):
    """Project the next 12 months of dividend income for the user's portfolio."""
    from dateutil.relativedelta import relativedelta
    from collections import defaultdict

    query = (
        select(UserInvestment)
        .where(UserInvestment.user_id == user_id)
        .order_by(UserInvestment.created_at.asc())
    )
    if portfolio_id is not None:
        query = query.where(UserInvestment.portfolio_id == portfolio_id)
    result = await db.execute(query)
    investments = result.scalars().all()
    if not investments:
        return IncomeCalendarResponse(
            entries=[], monthly_totals={}, annual_total=0, currency_totals={},
            monthly_totals_by_currency={},
        )

    # Aggregate shares per ticker
    shares_per_ticker: dict[str, float] = defaultdict(float)
    for inv in investments:
        shares_per_ticker[inv.ticker_symbol] += float(inv.quantity)

    today = date.today()
    entries: list[CalendarEntry] = []

    # Withholding at source depends on where the user is resident for tax
    prefs = (await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    )).scalar_one_or_none()
    residence = prefs.tax_residence if prefs else None
    overrides = (prefs.withholding_overrides or {}) if prefs else {}
    rules: dict[str, tuple] = {}  # ticker → (source, rule)

    for ticker, total_shares in shares_per_ticker.items():
        stock = await get_stock(db, ticker)
        if not stock:
            continue

        # Get dividend metrics via the metrics calculator
        records = await get_dividends_for_ticker(db, ticker, years=3)
        if not records:
            continue

        sorted_records = sorted(records, key=lambda r: r.dividend_date)
        last_record = sorted_records[-1]
        last_div_date = last_record.dividend_date
        last_div_amount = float(last_record.dividend_per_share) if last_record.dividend_per_share else None

        if not last_div_amount or last_div_amount <= 0:
            continue

        # Detect payment frequency
        dates = [r.dividend_date for r in sorted_records]
        if len(dates) >= 2:
            gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
            avg_gap = sum(gaps) / len(gaps)
            if avg_gap < 45:
                freq = "monthly"
            elif avg_gap < 120:
                freq = "quarterly"
            elif avg_gap < 270:
                freq = "semi-annual"
            else:
                freq = "annual"
        else:
            freq = "quarterly"

        month_step = FREQ_MONTHS.get(freq, 3)
        currency = stock.currency or "USD"
        source = withholding.source_country(stock.country, stock.exchange)
        rules[ticker] = (source, withholding.rule_for(source, residence, overrides))

        # Project next 12 months of payments
        next_date = last_div_date + relativedelta(months=month_step)
        # If next_date is in the past, fast-forward
        while next_date < today:
            next_date += relativedelta(months=month_step)

        projected_end = today + relativedelta(months=12)
        while next_date <= projected_end:
            entries.append(CalendarEntry(
                ticker_symbol=ticker,
                company_name=stock.company_name,
                expected_date=next_date,
                estimated_amount=round(last_div_amount * total_shares, 2),
                amount_per_share=last_div_amount,
                total_shares=total_shares,
                currency=currency,
                payment_frequency=freq,
            ))
            next_date += relativedelta(months=month_step)

    # Sort by date
    entries.sort(key=lambda e: e.expected_date)

    # India's TDS for residents applies only above ₹10,000 a year from one company
    yearly_inr: dict[str, float] = defaultdict(float)
    for e in entries:
        if e.currency == "INR":
            yearly_inr[e.ticker_symbol] += e.estimated_amount
    unestimated: set[str] = set()
    for e in entries:
        source, rule = rules.get(e.ticker_symbol, (None, None))
        e.source_country = source
        if rule is None:
            e.net_amount = e.estimated_amount
            if source:
                unestimated.add(source)
            continue
        rate = withholding.withheld_rate(rule, source, residence, yearly_inr.get(e.ticker_symbol))
        e.withholding_rate = rate
        e.withholding_basis = rule.basis
        e.withholding_note = rule.note
        e.net_amount = round(e.estimated_amount * (1 - rate / 100), 2)

    # Compute monthly, currency, and monthly-by-currency totals
    monthly_totals: dict[str, float] = defaultdict(float)
    currency_totals: dict[str, float] = defaultdict(float)
    monthly_by_currency: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    net_currency_totals: dict[str, float] = defaultdict(float)
    net_monthly_by_currency: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for e in entries:
        key = e.expected_date.strftime("%Y-%m")
        monthly_totals[key] += e.estimated_amount
        currency_totals[e.currency] += e.estimated_amount
        monthly_by_currency[e.currency][key] += e.estimated_amount
        net_currency_totals[e.currency] += e.net_amount
        net_monthly_by_currency[e.currency][key] += e.net_amount

    annual_total = sum(e.estimated_amount for e in entries)

    return IncomeCalendarResponse(
        entries=entries,
        monthly_totals=dict(monthly_totals),
        annual_total=round(annual_total, 2),
        currency_totals={k: round(v, 2) for k, v in currency_totals.items()},
        monthly_totals_by_currency={
            curr: {m: round(v, 2) for m, v in months.items()}
            for curr, months in monthly_by_currency.items()
        },
        residence=residence,
        net_currency_totals={k: round(v, 2) for k, v in net_currency_totals.items()},
        net_monthly_totals_by_currency={
            curr: {m: round(v, 2) for m, v in months.items()}
            for curr, months in net_monthly_by_currency.items()
        },
        unestimated_sources=sorted(unestimated),
    )
