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

/** Payments arriving at the dial in the hero: the example portfolio's next payment from each holding */
export const PAYMENTS: { ticker: string; amount: string }[] = [
  { ticker: "KO", amount: "+$61.19" },
  { ticker: "ENB", amount: "+C$141.02" },
  { ticker: "HDFCBANK", amount: "+₹1,609.18" },
  { ticker: "ULVR", amount: "+£22.51" },
  { ticker: "O", amount: "+$22.36" },
  { ticker: "BHP", amount: "+A$96.71" },
  { ticker: "KRZ", amount: "+€25.89" },
  { ticker: "ITC", amount: "+₹3,052.88" },
  { ticker: "JNJ", amount: "+$49.44" },
];

export const EXCHANGE_COUNT = new Set(HOLDINGS.map((h) => h.exchange)).size;

/**
 * The next 12 months in euros, as the app shows them for the example portfolio (scripts/demo_server.py):
 * what each month pays before tax, and what the paying countries keep at source for a resident of
 * Ireland. Twelve months from early October run into the next October, so there are 13 columns.
 * `label` marks a month whose tax the film names.
 */
export const MONTHS: { month: string; gross: number; withheld: number; label?: string }[] = [
  { month: "Oct", gross: 21.51, withheld: 3.22 },
  { month: "Nov", gross: 47.4, withheld: 9.69, label: "Ireland 25%" },
  { month: "Dec", gross: 224.3, withheld: 28.19 },
  { month: "Jan", gross: 80.38, withheld: 12.05 },
  { month: "Feb", gross: 21.51, withheld: 3.22 },
  { month: "Mar", gross: 249.49, withheld: 24.93, label: "Canada 15%" },
  { month: "Apr", gross: 80.38, withheld: 12.05 },
  { month: "May", gross: 47.4, withheld: 9.69 },
  { month: "Jun", gross: 241.51, withheld: 29.91 },
  { month: "Jul", gross: 80.38, withheld: 12.05, label: "US 15%" },
  { month: "Aug", gross: 21.51, withheld: 3.22 },
  { month: "Sep", gross: 249.49, withheld: 24.93 },
  { month: "Oct", gross: 58.86, withheld: 8.83 },
];

const cents = (n: number) => Math.round(n * 100) / 100;
export const GROSS_TOTAL = cents(MONTHS.reduce((sum, m) => sum + m.gross, 0));
export const WITHHELD_TOTAL = cents(MONTHS.reduce((sum, m) => sum + m.withheld, 0));
export const NET_TOTAL = cents(GROSS_TOTAL - WITHHELD_TOTAL);
/** The tallest column; bars are drawn as a share of it */
export const CHART_MAX = 260;

/** What each paying country keeps for a resident of Ireland (the app's withholding table) */
export const RATES = ["US 15%", "Canada 15%", "UK 0%", "Ireland 25%", "India 10%", "Australia 0%"];

/** Whole euros, as the app shows totals */
const EURO = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const formatEuro = (n: number) => EURO.format(n);
