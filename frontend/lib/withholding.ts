import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { API_BASE } from "@/lib/api/backend";
import type { IncomeCalendarResponse, WithholdingTable } from "@/lib/types";

export type TaxView = "net" | "gross";

/**
 * The calendar with every amount after withholding at source: entries, totals and monthly
 * totals, with each entry's amount before withholding kept in `gross_amount`. Pages use it
 * in place of the raw calendar, so the rest of their code doesn't change.
 */
export function afterWithholding(calendar: IncomeCalendarResponse): IncomeCalendarResponse {
  return {
    ...calendar,
    entries: calendar.entries.map((e) => ({
      ...e,
      gross_amount: e.estimated_amount,
      estimated_amount: e.net_amount ?? e.estimated_amount,
    })),
    currency_totals: calendar.net_currency_totals ?? calendar.currency_totals,
    monthly_totals_by_currency: calendar.net_monthly_totals_by_currency ?? calendar.monthly_totals_by_currency,
  };
}

export function calendarFor(calendar: IncomeCalendarResponse | undefined, view: TaxView) {
  if (!calendar) return calendar;
  return view === "net" && calendar.residence ? afterWithholding(calendar) : calendar;
}

const KEY = "dividendcase:tax-view";
const EVENT = "dividendcase:tax-view";

/** Before or after withholding, remembered on this computer and shared between pages. */
export function useTaxView(): [TaxView, (v: TaxView) => void] {
  const [view, setView] = useState<TaxView>("net");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "net" || saved === "gross") setView(saved);
    } catch {
      // Storage can be blocked; after tax is the default
    }
    const sync = (e: Event) => setView((e as CustomEvent<TaxView>).detail);
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const choose = useCallback((v: TaxView) => {
    setView(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: v }));
  }, []);
  return [view, choose];
}

export const TAX_VIEW_OPTIONS = [
  { value: "net" as const, label: "After tax", title: "After tax withheld at source by the paying country" },
  { value: "gross" as const, label: "Before tax", title: "The dividends as declared, before any withholding" },
];

async function fetchTable(ticker?: string): Promise<WithholdingTable> {
  const q = ticker ? `?ticker=${encodeURIComponent(ticker)}` : "";
  const res = await fetch(`${API_BASE}/api/v1/withholding${q}`);
  if (!res.ok) throw new Error(`Withholding ${res.status}`);
  return res.json();
}

/** Rates for the user's residence (Settings), or for one stock (its page). */
export function useWithholding(ticker?: string) {
  const { data, mutate } = useSWR<WithholdingTable>(["withholding", ticker ?? ""], () => fetchTable(ticker), {
    revalidateOnFocus: false,
  });
  return { table: data, refresh: mutate };
}

const COUNTRY_NAMES: Record<string, string> = {
  US: "the United States", GB: "the United Kingdom", IE: "Ireland", IN: "India", CA: "Canada", AU: "Australia",
};

/** "US" → "the United States"; names v1 doesn't estimate come through as they are. */
export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}
