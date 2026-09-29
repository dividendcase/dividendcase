import useSWR from "swr";
import { getInvestments, addInvestment, removeInvestment, moveInvestment, updateInvestment } from "@/lib/api/backend";
import type { InvestmentItem } from "@/lib/types";


export function useInvestments(portfolioId?: number) {
  const swrKey = portfolioId != null ? ["investments", portfolioId] : "investments";

  const { data, error, isLoading, mutate } = useSWR<InvestmentItem[]>(
    swrKey,
    async () => {
      return getInvestments(portfolioId);
    },
    { revalidateOnFocus: false },
  );

  const add = async (ticker: string, purchaseDate: string, quantity: number, purchasePrice?: number, purchaseCurrency?: string) => {
    await addInvestment({ ticker, purchase_date: purchaseDate, quantity, purchase_price: purchasePrice, purchase_currency: purchaseCurrency, portfolio_id: portfolioId });
    mutate();
  };

  const remove = async (id: number) => {
    await removeInvestment(id);
    mutate();
  };

  const move = async (investmentId: number, targetPortfolioId: number) => {
    await moveInvestment(investmentId, targetPortfolioId);
    mutate();
  };

  const update = async (investmentId: number, updates: { quantity?: number; purchase_price?: number; purchase_date?: string; purchase_currency?: string }) => {
    await updateInvestment(investmentId, updates);
    mutate();
  };

  return { items: data ?? [], isLoading, error, add, remove, move, update, mutate };
}
