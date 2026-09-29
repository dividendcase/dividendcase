import useSWR from "swr";
import { getWatchlist, addToWatchlist, removeFromWatchlist, moveWatchlistItem } from "@/lib/api/backend";
import type { WatchlistItem } from "@/lib/types";


export function useWatchlist(groupId?: number) {
  const { data, error, isLoading, mutate } = useSWR<WatchlistItem[]>(
    groupId != null ? ["watchlist", groupId] : "watchlist",
    async () => {
      return getWatchlist(groupId) as Promise<WatchlistItem[]>;
    },
    { revalidateOnFocus: false }
  );

  const add = async (ticker: string, targetGroupId?: number) => {
    await addToWatchlist(ticker, targetGroupId ?? groupId);
    mutate();
  };

  const remove = async (ticker: string) => {
    await removeFromWatchlist(ticker, groupId);
    mutate();
  };

  const move = async (itemId: number, targetGroupId: number) => {
    await moveWatchlistItem(itemId, targetGroupId);
    mutate();
  };

  const isInWatchlist = (ticker: string) =>
    (data ?? []).some((item) => item.ticker_symbol === ticker);

  return { items: data ?? [], isLoading, error, add, remove, move, isInWatchlist, mutate };
}
