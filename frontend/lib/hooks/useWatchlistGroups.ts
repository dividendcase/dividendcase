import useSWR from "swr";
import {
  getWatchlistGroups,
  createWatchlistGroup,
  renameWatchlistGroup,
  deleteWatchlistGroup,
} from "@/lib/api/backend";
import type { WatchlistGroup } from "@/lib/types";


export function useWatchlistGroups() {
  const { data, error, isLoading, mutate } = useSWR<WatchlistGroup[]>(
    "watchlist-groups",
    async () => {
      return getWatchlistGroups();
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const create = async (name: string): Promise<WatchlistGroup> => {
    const newGroup = await createWatchlistGroup(name);
    mutate();
    return newGroup;
  };

  const rename = async (groupId: number, name: string) => {
    await renameWatchlistGroup(groupId, name);
    mutate();
  };

  const remove = async (groupId: number) => {
    await deleteWatchlistGroup(groupId);
    mutate();
  };

  return {
    groups: data ?? [],
    isLoading,
    error,
    create,
    rename,
    remove,
    mutate,
  };
}
