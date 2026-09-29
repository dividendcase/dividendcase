import useSWR from "swr";
import {
  getPortfolios,
  createPortfolio,
  renamePortfolio,
  deletePortfolio,
} from "@/lib/api/backend";
import type { Portfolio } from "@/lib/types";


export function usePortfolios() {
  const { data, error, isLoading, mutate } = useSWR<Portfolio[]>(
    "portfolios",
    async () => {
      return getPortfolios();
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const create = async (name: string) => {
    await createPortfolio(name);
    mutate();
  };

  const rename = async (portfolioId: number, name: string) => {
    await renamePortfolio(portfolioId, name);
    mutate();
  };

  const remove = async (portfolioId: number) => {
    await deletePortfolio(portfolioId);
    mutate();
  };

  return {
    portfolios: data ?? [],
    isLoading,
    error,
    create,
    rename,
    remove,
    mutate,
  };
}
