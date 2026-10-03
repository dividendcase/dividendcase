from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from dividendcase.database import get_db
from dividendcase.crud.stock import get_stock
from dividendcase.crud.dividend import get_dividends_for_ticker, has_dividends
from dividendcase.schemas.dividend import DividendHistoryResponse, DividendMetrics

router = APIRouter()


def no_dividends_message(ticker: str) -> str:
    """For a stock stored for its price only (a holding that pays no dividends)."""
    return f"No dividend history for {ticker}: this stock does not pay dividends."


CURRENCY_SYMBOLS = {
    "USD": "$", "CAD": "C$", "GBP": "£", "EUR": "€",
    "AUD": "A$", "INR": "₹", "JPY": "¥", "HKD": "HK$",
    "SGD": "S$", "CHF": "CHF",
}


def _calculate_metrics(ticker: str, company_name: str, currency: str, records) -> DividendMetrics:
    if not records:
        return DividendMetrics(
            ticker_symbol=ticker, company_name=company_name,
            total_payments=0, currency=currency,
        )

    from datetime import datetime, timedelta
    import statistics

    sorted_records = sorted(records, key=lambda r: r.dividend_date)
    last_record = sorted_records[-1]
    per_payment_yields = [float(r.dividend_yield_pct) for r in sorted_records if r.dividend_yield_pct]
    last_price = float(last_record.share_price_on_dividend_date) if last_record.share_price_on_dividend_date else None
    last_amount = float(last_record.dividend_per_share) if last_record.dividend_per_share else None

    # ── Payment frequency ────────────────────────────────────────────────────
    dates = [r.dividend_date for r in sorted_records]
    if len(dates) >= 2:
        gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
        avg_gap = sum(gaps) / len(gaps)
        if avg_gap < 45:
            freq, payments_per_year = "monthly", 12
        elif avg_gap < 120:
            freq, payments_per_year = "quarterly", 4
        elif avg_gap < 270:
            freq, payments_per_year = "semi-annual", 2
        else:
            freq, payments_per_year = "annual", 1
    else:
        freq, payments_per_year = "unknown", 4

    # Annual dividend estimate: last payment × frequency
    # e.g. ORC $0.12/month × 12 = $1.44/year
    annual_estimate = round(last_amount * payments_per_year, 4) if last_amount else None

    # TTM yield (Trailing 12-Month) — industry standard "current yield"
    # Sum of all dividends paid in the last 365 days ÷ last known price × 100
    # This is what Yahoo Finance, Morningstar, and Bloomberg show as "yield"
    # e.g. ORC: $1.44 paid in last 12 months / $4.75 price = 30.3%
    today = datetime.now().date()
    ttm_amount = sum(
        float(r.dividend_per_share)
        for r in sorted_records
        if r.dividend_date >= (today - timedelta(days=365)) and r.dividend_per_share
    )
    ttm_yield = round(ttm_amount / last_price * 100, 2) if last_price and ttm_amount > 0 else None

    # Projected yield: last payment annualised at last known price
    # Answers: "what yield would I earn if the most recent payment repeats for a year?"
    # More forward-looking than TTM; same as TTM when payout is stable
    current_yield = (
        round(last_amount * payments_per_year / last_price * 100, 2)
        if last_amount and last_price and last_price > 0
        else None
    )

    # Historical average annualised yield over the selected period
    # Per-payment yield × annual frequency, averaged across all records
    avg_yield = (
        round((sum(per_payment_yields) / len(per_payment_yields)) * payments_per_year, 2)
        if per_payment_yields
        else None
    )

    # Consistency score: 100 = perfectly stable yield, 0 = highly erratic
    # Based on coefficient of variation of per-payment yields
    consistency = None
    if len(per_payment_yields) > 1:
        try:
            std = statistics.stdev(per_payment_yields)
            mean = statistics.mean(per_payment_yields)
            cv = std / mean if mean else 1.0
            consistency = round(max(0.0, min(100.0, (1 - cv) * 100)), 1)
        except Exception:
            pass

    # ── Annual dividends aggregation ─────────────────────────────────────────
    from collections import defaultdict
    annual_sums: dict[int, float] = defaultdict(float)
    for r in sorted_records:
        annual_sums[r.dividend_date.year] += float(r.dividend_per_share)
    annual_dividends = {yr: round(amt, 4) for yr, amt in sorted(annual_sums.items())}

    # ── Dividend Growth CAGR ─────────────────────────────────────────────────
    def _cagr(annual_divs: dict[int, float], n_years: int):
        """Compute CAGR over the last n_years of annual dividend data."""
        current_year = today.year
        # Use previous full year as end (current year may be incomplete)
        end_year = current_year - 1
        start_year = end_year - n_years
        if start_year in annual_divs and end_year in annual_divs:
            start_val = annual_divs[start_year]
            end_val = annual_divs[end_year]
            if start_val > 0 and end_val > 0:
                return round(((end_val / start_val) ** (1 / n_years) - 1) * 100, 2)
        return None

    cagr_3y = _cagr(annual_dividends, 3)
    cagr_5y = _cagr(annual_dividends, 5)
    cagr_10y = _cagr(annual_dividends, 10)

    # ── Consecutive growth streak ────────────────────────────────────────────
    sorted_years = sorted(annual_dividends.keys(), reverse=True)
    consecutive_growth = 0
    if len(sorted_years) >= 2:
        # Skip current (possibly incomplete) year
        check_years = [y for y in sorted_years if y < today.year]
        for i in range(len(check_years) - 1):
            yr = check_years[i]
            prev_yr = check_years[i + 1]
            if prev_yr == yr - 1 and annual_dividends[yr] >= annual_dividends[prev_yr] * 0.98:
                consecutive_growth += 1
            else:
                break

    # ── Dividend Safety Score (0-100) ────────────────────────────────────────
    # Weighted composite:
    #   Yield consistency (40%) + Growth streak (25%) + History length (15%)
    #   + No cuts penalty (10%) + Yield sustainability (10%)
    safety_score = None
    safety_label = None
    if len(sorted_records) >= 2:
        # Yield consistency component (40%)
        consistency_component = (consistency or 0) * 0.40

        # Growth streak component (25%): max at 10+ years
        streak_component = min(consecutive_growth / 10, 1.0) * 100 * 0.25

        # History length component (15%): max at 10+ years of data
        years_of_data = len(annual_dividends)
        history_component = min(years_of_data / 10, 1.0) * 100 * 0.15

        # No cuts penalty (10%): look at last 5 full years
        recent_years = [y for y in sorted_years if y < today.year][:6]  # up to 6 to check 5 transitions
        cuts_count = 0
        for i in range(len(recent_years) - 1):
            yr = recent_years[i]
            prev_yr = recent_years[i + 1]
            if prev_yr == yr - 1 and annual_dividends[yr] < annual_dividends[prev_yr] * 0.95:
                cuts_count += 1
        if cuts_count == 0:
            cuts_component = 100 * 0.10
        elif cuts_count == 1:
            cuts_component = 50 * 0.10
        else:
            cuts_component = 0

        # Yield sustainability (10%): flag extreme yields as risky
        effective_yield = ttm_yield or (current_yield if current_yield else 0)
        if effective_yield < 8:
            sustain_component = 100 * 0.10
        elif effective_yield < 15:
            sustain_component = 50 * 0.10
        else:
            sustain_component = 0

        safety_score = round(
            consistency_component + streak_component + history_component
            + cuts_component + sustain_component,
            1,
        )
        safety_score = max(0.0, min(100.0, safety_score))

        if safety_score >= 70:
            safety_label = "Safe"
        elif safety_score >= 40:
            safety_label = "Moderate"
        else:
            safety_label = "At Risk"

    return DividendMetrics(
        ticker_symbol=ticker,
        company_name=company_name,
        ttm_yield=ttm_yield,
        current_yield=current_yield,
        avg_yield=avg_yield,
        yield_consistency_score=consistency,
        payment_frequency=freq,
        payments_per_year=payments_per_year,
        total_payments=len(records),
        last_dividend_date=last_record.dividend_date,
        last_dividend_amount=last_amount,
        annual_dividend_estimate=annual_estimate,
        currency=currency,
        dividend_safety_score=safety_score,
        safety_label=safety_label,
        dividend_growth_cagr_3y=cagr_3y,
        dividend_growth_cagr_5y=cagr_5y,
        dividend_growth_cagr_10y=cagr_10y,
        consecutive_growth_years=consecutive_growth,
        annual_dividends=annual_dividends if annual_dividends else None,
    )


@router.get("/{ticker}", response_model=DividendHistoryResponse)
async def dividend_history(
    ticker: str,
    years: int = Query(10, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    ticker = ticker.upper()
    stock = await get_stock(db, ticker)
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {ticker} not found in database")

    records = await get_dividends_for_ticker(db, ticker, years=years)
    if not records and not await has_dividends(db, ticker):
        raise HTTPException(status_code=404, detail=no_dividends_message(ticker))
    metrics = _calculate_metrics(
        ticker,
        stock.company_name,
        stock.currency or "USD",
        records,
    )

    return DividendHistoryResponse(
        ticker_symbol=ticker,
        company_name=stock.company_name,
        exchange=stock.exchange,
        currency=stock.currency or "USD",
        records=records,
        metrics=metrics,
    )
