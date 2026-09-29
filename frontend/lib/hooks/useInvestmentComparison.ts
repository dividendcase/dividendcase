import useSWR from "swr";
import type { InvestmentComparisonResponse } from "@/lib/types";

import { API_BASE as BASE } from "@/lib/api/backend";

async function fetchComparison(
  ticker: string,
  startYear: number,
  shares: number,
  benchmarkOverride?: string,
): Promise<InvestmentComparisonResponse> {
  const q = new URLSearchParams({ start_year: String(startYear), shares: String(shares) });
  if (benchmarkOverride) q.set("benchmark_override", benchmarkOverride);
  const res = await fetch(`${BASE}/api/v1/investment/${encodeURIComponent(ticker)}/comparison?${q}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export function useInvestmentComparison(
  ticker: string | null,
  startYear: number,
  shares: number,
  benchmarkOverride?: string,
) {
  const key = ticker
    ? `invest-${ticker}-${startYear}-${shares}-${benchmarkOverride ?? "auto"}`
    : null;
  const { data, error, isLoading } = useSWR<InvestmentComparisonResponse>(
    key,
    () => fetchComparison(ticker!, startYear, shares, benchmarkOverride),
    { revalidateOnFocus: false, dedupingInterval: 120_000 }
  );
  return { data, error, isLoading };
}
