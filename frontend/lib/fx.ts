import useSWR from "swr";
import { getFxRates, getPortfolioCost } from "@/lib/api/backend";
import { useUserPreferences } from "@/lib/hooks/useUserPreferences";
import type { FxRates, PortfolioCost } from "@/lib/types";

// Yahoo quotes some markets in minor units; they convert through the major currency
const MINOR_UNITS: Record<string, [string, number]> = {
  GBp: ["GBP", 100],
  GBX: ["GBP", 100],
  ZAc: ["ZAR", 100],
  ILA: ["ILS", 100],
};

function perEuro(rates: Record<string, number>, currency: string): number | null {
  const minor = MINOR_UNITS[currency];
  if (minor) {
    const major = perEuro(rates, minor[0]);
    return major ? major * minor[1] : null;
  }
  if (currency === "EUR") return 1;
  return rates[currency] ?? null;
}

/** `amount` in `from` expressed in `to` at the given rates (null when either has no rate). */
export function convertAmount(amount: number, from: string, to: string, fx: FxRates | undefined | null): number | null {
  if (from === to) return amount;
  if (!fx?.date) return null;
  const src = perEuro(fx.rates, from);
  const dst = perEuro(fx.rates, to);
  if (!src || !dst) return null;
  return (amount / src) * dst;
}

/** The latest stored exchange rates (European Central Bank). */
export function useFxRates() {
  const { data, error, isLoading } = useSWR<FxRates>("fx-rates", getFxRates, {
    revalidateOnFocus: false,
    refreshInterval: 60 * 60 * 1000,
  });
  return { fx: data, ready: !!data?.date, error, isLoading };
}

/** The user's home currency, once rates exist to convert into it. */
export function useHomeCurrency() {
  const { preferences, isLoading } = useUserPreferences();
  const { fx, ready } = useFxRates();
  const home = preferences.home_currency;
  const canConvert = !!home && ready && perEuro(fx!.rates, home) !== null;
  return { home, fx, canConvert, isLoading };
}

/** What the holdings cost in `currency`, each lot at its purchase-date rate. */
export function usePortfolioCost(currency: string | null | undefined, portfolioId?: number) {
  const { data } = useSWR<PortfolioCost>(
    currency ? ["portfolio-cost", currency, portfolioId ?? "all"] : null,
    () => getPortfolioCost(currency!, portfolioId),
    { revalidateOnFocus: false }
  );
  return data;
}
