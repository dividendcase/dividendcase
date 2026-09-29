import useSWR from "swr";
import { getDividendHistory, fetchCustomStock } from "@/lib/api/backend";
import type { DividendHistoryResponse } from "@/lib/types";

/**
 * Fetches dividend history for a ticker.
 * First tries the DB (fast); if 404, falls back to live Yahoo Finance fetch.
 */
export function useStockData(ticker: string | null, years: 3 | 5 | 10 = 10) {
  const key = ticker ? `stock-${ticker}-${years}` : null;

  const { data, error, isLoading } = useSWR<DividendHistoryResponse>(
    key,
    async () => {
      try {
        return await getDividendHistory(ticker!, years);
      } catch (err: unknown) {
        // If 404, stock isn't in DB — fetch live from Yahoo Finance
        if (err instanceof Error && err.message.includes("404")) {
          return await fetchCustomStock(ticker!);
        }
        throw err;
      }
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000, // don't refetch same ticker within 1 minute
    }
  );

  return { data, error, isLoading };
}
