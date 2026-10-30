import useSWR from "swr";
import { getPriceHistory } from "@/lib/api/backend";
import type { PriceHistory } from "@/lib/types";

/** Ten years of daily bars for a stored stock. Charts slice the range they show from these. */
export function usePriceHistory(ticker: string | null) {
  const { data, error, isLoading } = useSWR<PriceHistory>(
    ticker ? ["prices", ticker] : null,
    () => getPriceHistory(ticker!, 10),
    { revalidateOnFocus: false, dedupingInterval: 5 * 60_000, shouldRetryOnError: false }
  );
  return { data, error: error as Error | undefined, isLoading };
}
