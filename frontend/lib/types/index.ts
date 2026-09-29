export interface StockSummary {
  ticker_symbol: string;
  company_name: string;
  exchange: string;
  country?: string;
  currency?: string;
  sector?: string;
  dividend_category?: string;
  avg_dividend_yield?: number;
  beats_benchmark?: boolean;
  benchmark_ticker?: string;
  payment_frequency?: string;
  yield_consistency_score?: number;
}

export interface DividendRecord {
  ticker_symbol: string;
  dividend_date: string;
  dividend_per_share: number;
  share_price_on_dividend_date?: number;
  dividend_yield_pct?: number;
}

export interface DividendMetrics {
  ticker_symbol: string;
  company_name: string;
  /** TTM yield: sum of last 12 months dividends / last price × 100 (industry standard) */
  ttm_yield?: number;
  /** Projected yield: last payment × payments_per_year / last price × 100 */
  current_yield?: number;
  /** Historical avg annualised yield over selected period */
  avg_yield?: number;
  yield_consistency_score?: number;
  payment_frequency?: string;
  payments_per_year?: number;
  total_payments: number;
  last_dividend_date?: string;
  last_dividend_amount?: number;
  annual_dividend_estimate?: number;
  currency?: string;
  /** Dividend safety score 0-100 */
  dividend_safety_score?: number;
  /** "Safe" / "Moderate" / "At Risk" */
  safety_label?: string;
  /** Dividend growth CAGR over 3 years (%) */
  dividend_growth_cagr_3y?: number;
  /** Dividend growth CAGR over 5 years (%) */
  dividend_growth_cagr_5y?: number;
  /** Dividend growth CAGR over 10 years (%) */
  dividend_growth_cagr_10y?: number;
  /** Consecutive years of dividend growth */
  consecutive_growth_years?: number;
  /** Annual dividend totals per share by year {2015: 3.20, ...} */
  annual_dividends?: Record<string, number>;
}

export interface DividendHistoryResponse {
  ticker_symbol: string;
  company_name: string;
  exchange: string;
  currency: string;
  records: DividendRecord[];
  metrics: DividendMetrics;
}

export interface WatchlistGroup {
  id: number;
  name: string;
  display_order: number;
  created_at: string;
}

export interface WatchlistItem {
  id: number;
  ticker_symbol: string;
  watchlist_group_id?: number;
  added_at: string;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export interface InvestmentDataPoint {
  date: string;
  cumulative_divs: number;
  portfolio_value: number;
  benchmark_value: number;
}

export interface InvestmentComparisonResponse {
  ticker: string;
  start_year: number;
  shares: number;
  initial_investment: number;
  benchmark_initial_investment: number;
  benchmark_ticker: string;
  benchmark_name: string;
  currency: string;
  data_points: InvestmentDataPoint[];
}

export interface Portfolio {
  id: number;
  name: string;
  display_order: number;
  created_at: string;
}

export interface InvestmentItem {
  id: number;
  ticker_symbol: string;
  purchase_date: string;
  purchase_price?: number;
  purchase_currency?: string;
  quantity: number;
  portfolio_id?: number;
  created_at: string;
}

export interface PortfolioDataPoint {
  date: string;
  stock_values: Record<string, number>;
  stock_dividends: Record<string, number>;
  total_investment_value: number;
  total_dividends: number;
  total_portfolio_value: number;
  benchmark_value: number;
}

export interface PortfolioAnalysisResponse {
  investments: InvestmentItem[];
  total_initial_investment: number;
  benchmark_ticker: string;
  benchmark_name: string;
  currency: string;
  /** True when every amount was converted into `currency` (each at the rate on its date) */
  converted?: boolean;
  unconverted_currencies?: string[];
  exchange_map: Record<string, string>;
  currency_map: Record<string, string>;
  purchase_currency_map: Record<string, string>;
  sector_map: Record<string, string>;
  country_map: Record<string, string>;
  industry_map: Record<string, string>;
  frequency_map: Record<string, string>;
  data_points: PortfolioDataPoint[];
}

export interface CalendarEntry {
  ticker_symbol: string;
  company_name: string;
  expected_date: string;
  estimated_amount: number;
  amount_per_share: number;
  total_shares: number;
  currency: string;
  payment_frequency: string;
}

export interface IncomeCalendarResponse {
  entries: CalendarEntry[];
  monthly_totals: Record<string, number>;
  annual_total: number;
  currency_totals: Record<string, number>;
  monthly_totals_by_currency: Record<string, Record<string, number>>;
}

export interface ImportRowResult {
  sheet_name: string;
  row_number: number;
  ticker: string;
  status: "created" | "skipped_duplicate" | "skipped_invalid";
  reason?: string;
}

export interface ImportSummary {
  total_rows_processed: number;
  created: number;
  skipped_duplicate: number;
  skipped_invalid: number;
  portfolios_created: string[];
  portfolios_merged: string[];
  has_unknown_stocks: boolean;
  details: ImportRowResult[];
}

export interface UserPreferences {
  default_benchmark: string;
  date_format: string;
  watchlist_collapsed: boolean;
  check_for_updates: boolean;
  /** Totals are converted into this currency (null until first-run setup) */
  home_currency: string | null;
  /** ISO country code, or "ZZ" for somewhere else */
  tax_residence: string | null;
  /** Screener market keys; null means every market */
  screener_markets: string[] | null;
  setup_completed_at: string | null;
}

export interface UserPreferencesUpdate {
  default_benchmark?: string;
  date_format?: string;
  watchlist_collapsed?: boolean;
  check_for_updates?: boolean;
  home_currency?: string;
  tax_residence?: string;
  screener_markets?: string[] | null;
  complete_setup?: boolean;
}

/** European Central Bank reference rates: how much of each currency one euro buys */
export interface FxRates {
  base: "EUR";
  date: string | null;
  rates: Record<string, number>;
  source: string;
}

export interface ScreenerMarket {
  key: string;
  name: string;
  country: string;
  currency: string;
  stocks: number;
}

export interface PortfolioCost {
  currency: string;
  total: number;
  by_ticker: Record<string, number>;
  lots_without_price: number;
  unconverted_currencies: string[];
  rates_available: boolean;
}

export interface AppInfo {
  version: string;
  data_dir: string;
  backup_dir: string;
  latest_version: string | null;
  update_available: boolean;
  update_checked_at: string | null;
  upgrade_command: string;
  /** The notes for the newer version when there is one, otherwise the list of releases */
  releases_url: string;
  install_method: "uv" | "docker" | string;
}
