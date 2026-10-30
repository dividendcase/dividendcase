/**
 * Chart maths on daily bars: moving averages, bands, momentum, drawdown, and how a stock's
 * dividends line up with its price. Pure functions, so every chart computes from the same code.
 * A series keeps one value per bar; null where there isn't enough history yet.
 */
import type { PriceBar } from "@/lib/types";

export type Series = (number | null)[];
export type Interval = "day" | "week" | "month";
export interface Dividend {
  date: string;
  amount: number;
}

const DAY_MS = 86_400_000;
const TRADING_DAYS = 252;

function toTime(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

// ── Bars ──────────────────────────────────────────────────────────────────────

/** Days into weeks or months: first open, highest high, lowest low, last close, summed volume. */
export function aggregate(bars: PriceBar[], interval: Interval): PriceBar[] {
  if (interval === "day") return bars;
  const keyOf = (iso: string) => {
    if (interval === "month") return iso.slice(0, 7);
    // The Monday of the bar's week
    const t = toTime(iso);
    const weekday = (new Date(t).getUTCDay() + 6) % 7;
    return new Date(t - weekday * DAY_MS).toISOString().slice(0, 10);
  };
  const out: PriceBar[] = [];
  let key = "";
  for (const b of bars) {
    const k = keyOf(b.date);
    const open = b.open ?? b.close;
    const high = b.high ?? b.close;
    const low = b.low ?? b.close;
    const last = out[out.length - 1];
    if (k !== key || !last) {
      out.push({ ...b, open, high, low });
      key = k;
    } else {
      last.date = b.date;
      last.high = Math.max(last.high ?? high, high);
      last.low = Math.min(last.low ?? low, low);
      last.close = b.close;
      last.adj_close = b.adj_close;
      last.volume = last.volume == null && b.volume == null ? null : (last.volume ?? 0) + (b.volume ?? 0);
    }
  }
  return out;
}

/** The bars from `months` months before the last bar onwards (all of them for null). */
export function lastMonths(bars: PriceBar[], months: number | null): PriceBar[] {
  if (months == null || bars.length === 0) return bars;
  const end = new Date(toTime(bars[bars.length - 1].date));
  end.setUTCMonth(end.getUTCMonth() - months);
  const cutoff = end.toISOString().slice(0, 10);
  const i = bars.findIndex((b) => b.date >= cutoff);
  return i <= 0 ? bars : bars.slice(i);
}

/** Weekly bars beyond a year and monthly beyond five, so candles stay wide enough to read. */
export function autoInterval(months: number | null): Interval {
  if (months != null && months <= 12) return "day";
  if (months != null && months <= 60) return "week";
  return "month";
}

/** How many bars of `interval` make roughly a year, for annualising. */
export function barsPerYear(interval: Interval): number {
  return interval === "day" ? TRADING_DAYS : interval === "week" ? 52 : 12;
}

// ── Averages and bands ───────────────────────────────────────────────────────

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential average, started from the simple average of the first `period` values. */
export function ema(values: Series | number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let seed: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (prev == null) {
      seed.push(v);
      if (seed.length === period) {
        prev = seed.reduce((a, b) => a + b, 0) / period;
        out[i] = prev;
        seed = [];
      }
      continue;
    }
    prev = v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Bollinger bands: the simple average, and `k` standard deviations either side of it. */
export function bollinger(values: number[], period = 20, k = 2): { mid: Series; upper: Series; lower: Series } {
  const mid = sma(values, period);
  const upper: Series = new Array(values.length).fill(null);
  const lower: Series = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const m = mid[i]!;
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) sq += (values[j] - m) ** 2;
    const sd = Math.sqrt(sq / period);
    upper[i] = m + k * sd;
    lower[i] = m - k * sd;
  }
  return { mid, upper, lower };
}

// ── Momentum ─────────────────────────────────────────────────────────────────

/** Relative strength index with Wilder's smoothing: above 70 often reads as stretched, below 30 as oversold. */
export function rsi(values: number[], period = 14): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gain += change;
    else loss -= change;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(change, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-change, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): { macd: Series; signal: Series; hist: Series } {
  const f = ema(values, fast);
  const s = ema(values, slow);
  const line: Series = values.map((_, i) => (f[i] != null && s[i] != null ? f[i]! - s[i]! : null));
  const signal = ema(line, signalPeriod);
  const hist: Series = line.map((v, i) => (v != null && signal[i] != null ? v - signal[i]! : null));
  return { macd: line, signal, hist };
}

/** How far below its highest point so far each value is, in percent (0 at a new high). */
export function drawdown(values: number[]): number[] {
  let peak = -Infinity;
  return values.map((v) => {
    peak = Math.max(peak, v);
    return peak > 0 ? ((v - peak) / peak) * 100 : 0;
  });
}

// ── Performance over a range ─────────────────────────────────────────────────

export interface Performance {
  priceReturn: number;
  totalReturn: number;
  /** Total return as a yearly rate; null for less than a year */
  cagr: number | null;
  /** Yearly volatility of returns with dividends, in percent */
  volatility: number | null;
  maxDrawdown: number;
  /** Return per unit of risk: CAGR over volatility, with no risk-free rate taken off */
  returnPerRisk: number | null;
  /** The part of the total return that came from dividends, in percentage points */
  fromDividends: number;
}

export function performance(bars: PriceBar[], interval: Interval = "day"): Performance | null {
  if (bars.length < 2) return null;
  const first = bars[0];
  const last = bars[bars.length - 1];
  const priceReturn = (last.close / first.close - 1) * 100;
  const totalReturn = (last.adj_close / first.adj_close - 1) * 100;
  const years = (toTime(last.date) - toTime(first.date)) / (365.25 * DAY_MS);
  // A "1 year" range runs from the first trading day after the date a year ago, a few days short
  const cagr = years >= 0.97 ? ((last.adj_close / first.adj_close) ** (1 / years) - 1) * 100 : null;

  const logs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    if (bars[i - 1].adj_close > 0 && bars[i].adj_close > 0) logs.push(Math.log(bars[i].adj_close / bars[i - 1].adj_close));
  }
  let volatility: number | null = null;
  if (logs.length > 10) {
    const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
    const variance = logs.reduce((a, b) => a + (b - mean) ** 2, 0) / (logs.length - 1);
    volatility = Math.sqrt(variance * barsPerYear(interval)) * 100;
  }
  const maxDrawdown = Math.min(...drawdown(bars.map((b) => b.close)));
  return {
    priceReturn,
    totalReturn,
    cagr,
    volatility,
    maxDrawdown,
    returnPerRisk: cagr != null && volatility ? cagr / volatility : null,
    fromDividends: totalReturn - priceReturn,
  };
}

// ── Dividends against price ──────────────────────────────────────────────────

/** Dividends with an ex-date in the 365 days up to and including each bar. */
export function trailingDividends(bars: PriceBar[], dividends: Dividend[]): Series {
  const divs = [...dividends].sort((a, b) => a.date.localeCompare(b.date));
  const firstDiv = divs[0]?.date;
  const out: Series = new Array(bars.length).fill(null);
  let start = 0;
  let end = 0;
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    const t = toTime(bars[i].date);
    // A full year of dividend history is needed before the sum means anything
    if (!firstDiv || t - toTime(firstDiv) < 365 * DAY_MS) continue;
    while (end < divs.length && toTime(divs[end].date) <= t) sum += divs[end++].amount;
    while (start < end && toTime(divs[start].date) <= t - 365 * DAY_MS) sum -= divs[start++].amount;
    out[i] = sum;
  }
  return out;
}

/** Trailing twelve-month yield at each bar, in percent. */
export function trailingYield(bars: PriceBar[], dividends: Dividend[]): Series {
  const ttm = trailingDividends(bars, dividends);
  return bars.map((b, i) => (ttm[i] != null && ttm[i]! > 0 && b.close > 0 ? (ttm[i]! / b.close) * 100 : null));
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
}

export function stdev(values: number[]): number {
  if (values.length < 2) return NaN;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1));
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Pearson correlation: +1 move together, −1 opposite, 0 no straight-line relation. */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

/** Least-squares line through the points. */
export function linearFit(xs: number[], ys: number[]): { slope: number; intercept: number } | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

/** "Yield bands": the price at which today's trailing dividend would give the stock's usual yields. */
export function yieldBands(bars: PriceBar[], dividends: Dividend[]): { fair: Series; cheap: Series; dear: Series; average: number; spread: number } | null {
  const ttm = trailingDividends(bars, dividends);
  const yields = bars.map((b, i) => (ttm[i] && b.close > 0 ? ttm[i]! / b.close : null)).filter((y): y is number => y != null && y > 0);
  if (yields.length < 60) return null;
  const average = mean(yields);
  const spread = stdev(yields);
  if (!(average - spread > 0)) return null;
  const at = (y: number): Series => ttm.map((d) => (d && d > 0 ? d / y : null));
  return { fair: at(average), cheap: at(average + spread), dear: at(average - spread), average: average * 100, spread: spread * 100 };
}

export interface ExDividendMove {
  date: string;
  amount: number;
  /** Close the day before the ex-date */
  before: number;
  /** Change from that close to the ex-date's open, in percent */
  drop: number;
  /** The dividend as a percentage of the close before */
  dividendPct: number;
  /** Trading days until a close at or above the close before; null if not within a year */
  recoveryDays: number | null;
}

/** What the price did around each ex-dividend date in the bars. */
export function exDividendMoves(bars: PriceBar[], dividends: Dividend[]): ExDividendMove[] {
  const out: ExDividendMove[] = [];
  for (const d of dividends) {
    const i = bars.findIndex((b) => b.date >= d.date);
    if (i <= 0) continue;
    const before = bars[i - 1].close;
    if (!(before > 0)) continue;
    const opened = bars[i].open ?? bars[i].close;
    let recoveryDays: number | null = null;
    for (let j = i; j < Math.min(bars.length, i + TRADING_DAYS); j++) {
      if (bars[j].close >= before) {
        recoveryDays = j - i;
        break;
      }
    }
    // Too close to the end of the history to know: leave it out rather than call it unrecovered
    if (recoveryDays == null && bars.length - i < TRADING_DAYS) continue;
    out.push({
      date: d.date,
      amount: d.amount,
      before,
      drop: (opened / before - 1) * 100,
      dividendPct: (d.amount / before) * 100,
      recoveryDays,
    });
  }
  return out;
}

export interface YearRow {
  year: number;
  priceReturn: number;
  totalReturn: number;
  dividends: number;
  /** Change in dividends paid from the year before, in percent */
  dividendGrowth: number | null;
  /** The year isn't over, or the history starts part-way through it */
  partial: boolean;
}

/** Calendar years: price change, total return and dividend growth side by side. */
export function yearByYear(bars: PriceBar[], dividends: Dividend[]): YearRow[] {
  if (bars.length < 2) return [];
  const lastOfYear = new Map<number, PriceBar>();
  const firstOfYear = new Map<number, PriceBar>();
  for (const b of bars) {
    const y = Number(b.date.slice(0, 4));
    if (!firstOfYear.has(y)) firstOfYear.set(y, b);
    lastOfYear.set(y, b);
  }
  const paid = new Map<number, number>();
  for (const d of dividends) paid.set(Number(d.date.slice(0, 4)), (paid.get(Number(d.date.slice(0, 4))) ?? 0) + d.amount);

  const thisYear = new Date().getFullYear();
  // The first year of dividend history may start part-way through, so growth starts the year after next
  const firstDivYear = Math.min(...dividends.map((d) => Number(d.date.slice(0, 4))));
  const years = [...lastOfYear.keys()].sort((a, b) => a - b);
  const rows: YearRow[] = [];
  for (const y of years) {
    const end = lastOfYear.get(y)!;
    const start = lastOfYear.get(y - 1) ?? firstOfYear.get(y)!;
    const partial = y === thisYear || !lastOfYear.has(y - 1);
    const div = paid.get(y) ?? 0;
    const prevDiv = paid.get(y - 1);
    rows.push({
      year: y,
      priceReturn: (end.close / start.close - 1) * 100,
      totalReturn: (end.adj_close / start.adj_close - 1) * 100,
      dividends: div,
      dividendGrowth: prevDiv && y - 1 > firstDivYear && y < thisYear ? (div / prevDiv - 1) * 100 : null,
      partial,
    });
  }
  return rows;
}

export interface YieldReturnPoint {
  date: string;
  yield: number;
  forward: number;
}

/**
 * The trailing yield on each date against the total return over the following year, sampled
 * every `step` bars. Neighbouring points share most of their year, so they aren't independent.
 */
export function yieldThenReturn(bars: PriceBar[], dividends: Dividend[], step = 5): YieldReturnPoint[] {
  const yields = trailingYield(bars, dividends);
  const out: YieldReturnPoint[] = [];
  for (let i = 0; i < bars.length; i += step) {
    const y = yields[i];
    if (y == null) continue;
    const target = toTime(bars[i].date) + 365 * DAY_MS;
    let j = i;
    while (j < bars.length && toTime(bars[j].date) < target) j++;
    if (j >= bars.length) break;
    out.push({ date: bars[i].date, yield: y, forward: (bars[j].adj_close / bars[i].adj_close - 1) * 100 });
  }
  return out;
}
