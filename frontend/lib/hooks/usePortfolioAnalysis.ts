import useSWR from "swr";
import { getPortfolioAnalysis } from "@/lib/api/backend";
import type { PortfolioAnalysisResponse } from "@/lib/types";

/** Portfolio history and diversification; with `currency`, every amount is converted into it. */
export function usePortfolioAnalysis(enabled: boolean, portfolioId?: number, currency?: string | null) {
  const swrKey = enabled ? ["portfolio-analysis", portfolioId ?? "all", currency ?? "own"] : null;

  const { data, error, isLoading, mutate } = useSWR<PortfolioAnalysisResponse>(
    swrKey,
    () => getPortfolioAnalysis(portfolioId, currency ?? undefined),
    { revalidateOnFocus: false, dedupingInterval: 120_000 },
  );

  return { data: data ?? null, isLoading, error, refresh: mutate };
}
