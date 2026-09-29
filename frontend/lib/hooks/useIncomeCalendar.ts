import useSWR from "swr";
import { getIncomeCalendar } from "@/lib/api/backend";
import type { IncomeCalendarResponse } from "@/lib/types";


export function useIncomeCalendar(portfolioId?: number) {
  const swrKey = portfolioId != null
    ? ["income-calendar", portfolioId]
    : "income-calendar";

  const { data, error, isLoading } = useSWR<IncomeCalendarResponse>(
    swrKey,
    async () => {
      return getIncomeCalendar(portfolioId);
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  return { data, error, isLoading };
}
