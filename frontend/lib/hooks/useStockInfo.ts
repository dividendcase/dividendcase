import useSWR from "swr";

import { API_BASE as BASE } from "@/lib/api/backend";

export interface StockInfo {
  summary: string | null;
  sector: string | null;
  industry: string | null;
}

async function fetchStockInfo(ticker: string): Promise<StockInfo> {
  const res = await fetch(
    `${BASE}/api/v1/stocks/${encodeURIComponent(ticker)}/summary`
  );
  if (!res.ok) return { summary: null, sector: null, industry: null };
  return res.json();
}

export function useStockInfo(ticker: string | null) {
  const key = ticker ? `stock-info-${ticker}` : null;

  const { data, error, isLoading } = useSWR<StockInfo>(
    key,
    () => fetchStockInfo(ticker!),
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000,
    }
  );

  return { info: data ?? null, error, isLoading };
}
