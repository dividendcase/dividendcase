import useSWR from "swr";
import { API_BASE } from "@/lib/api/backend";

/** The stored details of one stock (GET /api/v1/stocks/{ticker}); null when it isn't stored yet. */
export interface StockDetail {
  ticker_symbol: string;
  company_name: string;
  exchange: string;
  currency?: string | null;
  sector?: string | null;
  industry?: string | null;
  /** Trailing 12-month yield in percent, from the last refresh */
  avg_dividend_yield?: number | null;
  payment_frequency?: string | null;
}

async function fetchStockDetail(ticker: string): Promise<StockDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/stocks/${encodeURIComponent(ticker)}`);
    if (!res.ok) return null;
    return (await res.json()) as StockDetail;
  } catch {
    return null;
  }
}

/** Company name, yield and so on for a ticker. Reads the local database only, never Yahoo. */
export function useStockDetail(ticker: string | null) {
  const { data, isLoading } = useSWR<StockDetail | null>(
    ticker ? ["stock-detail", ticker] : null,
    () => fetchStockDetail(ticker!),
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );
  return { detail: data ?? null, isLoading };
}

/** The analysis page of a stock. */
export function stockHref(ticker: string): string {
  return `/dashboard/stock/?t=${encodeURIComponent(ticker)}`;
}
