import { convertAmount } from "@/lib/fx";
import type { CalendarEntry, FxRates, IncomeCalendarResponse, InvestmentItem } from "@/lib/types";

export interface Payer {
  ticker: string;
  company: string;
  frequency: string;
  shares: number;
  perShare: number;
  annual: number;
  /** Share of this currency's income, 0–1 */
  share: number;
  nextDate: string;
  /** Set in the home-currency view: what the payer pays in its own currency */
  original?: { currency: string; annual: number };
}

export interface MonthIncome {
  key: string; // YYYY-MM
  total: number;
  byTicker: Record<string, number>;
}

export interface CurrencyIncome {
  currency: string;
  annual: number;
  months: MonthIncome[];
  payers: Payer[];
  /** What the lots in this currency cost, when purchase prices are known */
  cost: number | null;
  /** True for the view with everything converted into the home currency */
  isHome?: boolean;
  /** Currencies left out of the home view because there's no rate for them */
  skipped?: string[];
}

export interface IncomeModel {
  currencies: string[];
  byCurrency: Record<string, CurrencyIncome>;
  upcoming: CalendarEntry[];
  holdings: string[];
  nonPayers: string[];
}

/** Everything the Income page shows, derived from the calendar and the holdings. */
export function buildIncomeModel(calendar: IncomeCalendarResponse | undefined, investments: InvestmentItem[]): IncomeModel {
  const entries = calendar?.entries ?? [];
  const holdings = Array.from(new Set(investments.map((i) => i.ticker_symbol))).sort();
  const payingTickers = new Set(entries.map((e) => e.ticker_symbol));
  const tickerCurrency: Record<string, string> = {};
  for (const e of entries) tickerCurrency[e.ticker_symbol] = e.currency;

  const byCurrency: Record<string, CurrencyIncome> = {};
  const countByCurrency: Record<string, number> = {};
  for (const e of entries) {
    const cur = e.currency;
    countByCurrency[cur] = (countByCurrency[cur] ?? 0) + 1;
    const ci = (byCurrency[cur] ??= { currency: cur, annual: 0, months: [], payers: [], cost: null });
    ci.annual += e.estimated_amount;
  }

  for (const cur of Object.keys(byCurrency)) {
    const ci = byCurrency[cur];
    const mine = entries.filter((e) => e.currency === cur);

    // Months from the calendar's own keys, so they match the Calendar page
    const monthKeys = Object.keys(calendar?.monthly_totals_by_currency?.[cur] ?? {}).sort();
    ci.months = monthKeys.map((key) => {
      const inMonth = mine.filter((e) => e.expected_date.slice(0, 7) === key);
      const byTicker: Record<string, number> = {};
      for (const e of inMonth) byTicker[e.ticker_symbol] = (byTicker[e.ticker_symbol] ?? 0) + e.estimated_amount;
      return { key, total: inMonth.reduce((s, e) => s + e.estimated_amount, 0), byTicker };
    });

    const perTicker = new Map<string, Payer>();
    for (const e of mine) {
      const p = perTicker.get(e.ticker_symbol);
      if (p) {
        p.annual += e.estimated_amount;
        if (e.expected_date < p.nextDate) p.nextDate = e.expected_date;
      } else {
        perTicker.set(e.ticker_symbol, {
          ticker: e.ticker_symbol,
          company: e.company_name,
          frequency: e.payment_frequency,
          shares: e.total_shares,
          perShare: e.amount_per_share,
          annual: e.estimated_amount,
          share: 0,
          nextDate: e.expected_date,
        });
      }
    }
    ci.payers = Array.from(perTicker.values())
      .map((p) => ({ ...p, share: ci.annual > 0 ? p.annual / ci.annual : 0 }))
      .sort((a, b) => b.annual - a.annual);

    let cost = 0;
    let priced = false;
    for (const inv of investments) {
      const lotCurrency = inv.purchase_currency || tickerCurrency[inv.ticker_symbol];
      if (lotCurrency !== cur || inv.purchase_price == null) continue;
      cost += inv.purchase_price * inv.quantity;
      priced = true;
    }
    ci.cost = priced && cost > 0 ? cost : null;
  }

  const currencies = Object.keys(byCurrency).sort(
    (a, b) => (countByCurrency[b] ?? 0) - (countByCurrency[a] ?? 0) || byCurrency[b].annual - byCurrency[a].annual
  );

  return {
    currencies,
    byCurrency,
    upcoming: [...entries].sort((a, b) => a.expected_date.localeCompare(b.expected_date)),
    holdings,
    nonPayers: holdings.filter((t) => !payingTickers.has(t)),
  };
}

export function monthLabel(key: string, opts: { withYear?: boolean } = {}): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", ...(opts.withYear ? { year: "numeric" } : {}) });
}

export function monthName(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long" });
}

/**
 * Everything in one currency: each payment converted at the latest rate (they're all in the
 * future). `cost` comes from the server, where each lot converts at its purchase-date rate.
 */
export function toHomeCurrency(
  calendar: IncomeCalendarResponse | undefined,
  home: string,
  fx: FxRates,
  cost: number | null
): CurrencyIncome {
  const entries = calendar?.entries ?? [];
  const skipped = new Set<string>();
  const monthKeys = new Set<string>();
  for (const byMonth of Object.values(calendar?.monthly_totals_by_currency ?? {})) {
    for (const key of Object.keys(byMonth)) monthKeys.add(key);
  }
  const months = new Map<string, MonthIncome>(
    Array.from(monthKeys).sort().map((key) => [key, { key, total: 0, byTicker: {} }])
  );
  const payers = new Map<string, Payer>();
  let annual = 0;

  for (const e of entries) {
    const amount = convertAmount(e.estimated_amount, e.currency, home, fx);
    if (amount == null) {
      skipped.add(e.currency);
      continue;
    }
    annual += amount;
    const month = months.get(e.expected_date.slice(0, 7));
    if (month) {
      month.total += amount;
      month.byTicker[e.ticker_symbol] = (month.byTicker[e.ticker_symbol] ?? 0) + amount;
    }
    const p = payers.get(e.ticker_symbol);
    if (p) {
      p.annual += amount;
      p.original!.annual += e.estimated_amount;
      if (e.expected_date < p.nextDate) p.nextDate = e.expected_date;
    } else {
      payers.set(e.ticker_symbol, {
        ticker: e.ticker_symbol,
        company: e.company_name,
        frequency: e.payment_frequency,
        shares: e.total_shares,
        perShare: e.amount_per_share,
        annual: amount,
        share: 0,
        nextDate: e.expected_date,
        original: { currency: e.currency, annual: e.estimated_amount },
      });
    }
  }

  return {
    currency: home,
    annual,
    months: Array.from(months.values()),
    payers: Array.from(payers.values())
      .map((p) => ({ ...p, share: annual > 0 ? p.annual / annual : 0 }))
      .sort((a, b) => b.annual - a.annual),
    cost,
    isHome: true,
    skipped: Array.from(skipped).sort(),
  };
}
