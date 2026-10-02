/**
 * The example portfolio the film shows. Every number here is invented and the page labels it as
 * an example: never market data (see "Never ship Yahoo data" in CLAUDE.md).
 */

export type ExampleHolding = {
  ticker: string;
  /** Short form for the badge, as the app's ticker badges show it */
  badge: string;
  name: string;
  exchange: string;
  currency: string;
  shares: number;
};

export const HOLDINGS: ExampleHolding[] = [
  { ticker: "KO", badge: "KO", name: "The Coca-Cola Company", exchange: "NYSE", currency: "USD", shares: 120 },
  { ticker: "O", badge: "O", name: "Realty Income", exchange: "NYSE", currency: "USD", shares: 85 },
  { ticker: "ENB", badge: "ENB", name: "Enbridge", exchange: "TSX", currency: "CAD", shares: 150 },
  { ticker: "ULVR", badge: "ULVR", name: "Unilever", exchange: "LSE", currency: "GBP", shares: 60 },
  { ticker: "KRZ", badge: "KRZ", name: "Kerry Group", exchange: "Euronext Dublin", currency: "EUR", shares: 30 },
  { ticker: "HDFCBANK", badge: "HDFC", name: "HDFC Bank", exchange: "NSE", currency: "INR", shares: 75 },
  { ticker: "JNJ", badge: "JNJ", name: "Johnson & Johnson", exchange: "NYSE", currency: "USD", shares: 40 },
  { ticker: "ITC", badge: "ITC", name: "ITC Limited", exchange: "NSE", currency: "INR", shares: 400 },
  { ticker: "BHP", badge: "BHP", name: "BHP Group", exchange: "ASX", currency: "AUD", shares: 110 },
];

export const EXCHANGE_COUNT = new Set(HOLDINGS.map((h) => h.exchange)).size;

/**
 * The next 12 months in euros: what each month pays before tax, and what the paying countries
 * keep at source for a resident of Ireland. `label` marks a month whose tax the film names.
 */
export const MONTHS: { month: string; gross: number; withheld: number; label?: string }[] = [
  { month: "Oct", gross: 468.2, withheld: 58.4 },
  { month: "Nov", gross: 301.55, withheld: 33.1 },
  { month: "Dec", gross: 512.9, withheld: 61.25, label: "Canada 15%" },
  { month: "Jan", gross: 355.1, withheld: 40.8 },
  { month: "Feb", gross: 289.75, withheld: 31.95 },
  { month: "Mar", gross: 498.6, withheld: 60.15, label: "Ireland 25%" },
  { month: "Apr", gross: 402.35, withheld: 47.3 },
  { month: "May", gross: 276.4, withheld: 29.85 },
  { month: "Jun", gross: 531.85, withheld: 64.7, label: "US 15%" },
  { month: "Jul", gross: 380.2, withheld: 44.1 },
  { month: "Aug", gross: 312.65, withheld: 35.4 },
  { month: "Sep", gross: 482.85, withheld: 58.25 },
];

const cents = (n: number) => Math.round(n * 100) / 100;
export const GROSS_TOTAL = cents(MONTHS.reduce((sum, m) => sum + m.gross, 0));
export const WITHHELD_TOTAL = cents(MONTHS.reduce((sum, m) => sum + m.withheld, 0));
export const NET_TOTAL = cents(GROSS_TOTAL - WITHHELD_TOTAL);
/** The tallest column; bars are drawn as a share of it */
export const CHART_MAX = 540;

/** What each paying country keeps for a resident of Ireland (the app's withholding table) */
export const RATES = ["US 15%", "Canada 15%", "UK 0%", "Ireland 25%", "India 10%", "Australia 0%"];

const EURO = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
export const formatEuro = (n: number) => EURO.format(n);
