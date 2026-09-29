"use client";

import Link from "next/link";
import { currencyLabel } from "@/lib/format";
import type { FxRates } from "@/lib/types";

/** Currency picker value for "everything converted into the home currency". */
export const HOME_MODE = "__home";

/** Same currency once pence and other minor units are shown in their major unit (GBp = GBP). */
export function sameCurrency(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && currencyLabel(a) === currencyLabel(b);
}

/** The "All in EUR" option that goes first in a currency picker. */
export function homeOption(home: string) {
  return {
    value: HOME_MODE,
    label: <span>All in <span className="font-mono">{currencyLabel(home)}</span></span>,
    title: `Every amount converted into ${currencyLabel(home)}`,
  };
}

/**
 * Why amounts aren't shown in one currency yet: no home currency, or rates still downloading.
 * Nothing while the rates are loading or when they can already be converted.
 */
export function HomeCurrencyHint({
  home,
  fx,
  canConvert,
}: {
  home: string | null;
  fx: FxRates | undefined;
  canConvert: boolean;
}) {
  if (canConvert || fx === undefined) return null;
  if (!home) {
    return (
      <>
        <Link
          href="/dashboard/settings/"
          className="text-ink-2 underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-ink-3"
        >
          Set a home currency in Settings to see everything in one currency
        </Link>
        .
      </>
    );
  }
  if (!fx.date) return <span>Exchange rates are downloading…</span>;
  return <span>There are no European Central Bank rates for {currencyLabel(home)}, so amounts stay in their own currency.</span>;
}
