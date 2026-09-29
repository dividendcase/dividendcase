"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Loader2, Lock } from "lucide-react";
import { LogoMark } from "@dividendcase/brand/logo";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getScreenerMarkets } from "@/lib/api/backend";
import { useFxRates } from "@/lib/fx";
import { useUserPreferences } from "@/lib/hooks/useUserPreferences";
import { CURRENCY_NAMES, TAX_RESIDENCES, guessResidence } from "@/lib/regions";
import type { ScreenerMarket } from "@/lib/types";

const LATER_KEY = "dividendcase:setup-later";

/** Three questions on first launch: tax residence, home currency, screener markets. */
export function FirstRunSetup() {
  const { preferences, loaded } = useUserPreferences();
  const [later, setLater] = useState(false);

  useEffect(() => {
    try {
      setLater(sessionStorage.getItem(LATER_KEY) === "1");
    } catch {
      // Storage can be blocked; the setup simply shows again
    }
  }, []);

  if (!loaded || preferences.setup_completed_at || later) return null;

  return (
    <SetupDialog
      onLater={() => {
        try {
          sessionStorage.setItem(LATER_KEY, "1");
        } catch {
          // ignore
        }
        setLater(true);
      }}
    />
  );
}

function SetupDialog({ onLater }: { onLater: () => void }) {
  const { preferences, savePreferences } = useUserPreferences();
  const { fx } = useFxRates();
  const { data: markets } = useSWR<ScreenerMarket[]>("screener-markets", getScreenerMarkets, { revalidateOnFocus: false });

  const initialResidence = preferences.tax_residence ?? guessResidence() ?? "IE";
  const [residence, setResidence] = useState(initialResidence);
  const [currency, setCurrency] = useState(
    preferences.home_currency ?? TAX_RESIDENCES.find((r) => r.code === initialResidence)?.currency ?? "EUR"
  );
  const [currencyTouched, setCurrencyTouched] = useState(!!preferences.home_currency);
  const [selected, setSelected] = useState<Set<string> | null>(
    preferences.screener_markets ? new Set(preferences.screener_markets) : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every market is chosen until the user changes something
  const chosen = useMemo(() => selected ?? new Set((markets ?? []).map((m) => m.key)), [selected, markets]);
  const stockCount = (markets ?? []).filter((m) => chosen.has(m.key)).reduce((sum, m) => sum + m.stocks, 0);
  const minutes = Math.max(1, Math.round((stockCount * 1.4) / 60));

  const currencies = useMemo(() => {
    const available = fx?.date ? Object.keys(fx.rates) : Object.keys(CURRENCY_NAMES);
    return Array.from(new Set(["EUR", ...available]))
      .filter((c) => CURRENCY_NAMES[c])
      .sort((a, b) => CURRENCY_NAMES[a].localeCompare(CURRENCY_NAMES[b]));
  }, [fx]);

  const pickResidence = (code: string) => {
    setResidence(code);
    if (!currencyTouched) setCurrency(TAX_RESIDENCES.find((r) => r.code === code)?.currency ?? currency);
  };

  const toggleMarket = (key: string) =>
    setSelected(() => {
      const next = new Set(chosen);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const start = async () => {
    setSaving(true);
    setError(null);
    try {
      const all = markets && chosen.size === markets.length;
      await savePreferences({
        tax_residence: residence,
        home_currency: currency,
        screener_markets: all ? null : Array.from(chosen),
        complete_setup: true,
      });
    } catch {
      setError("That didn't save. Is DividendCase still running? Try again.");
      setSaving(false);
    }
  };

  return (
    <DialogPrimitive.Root open>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ground/80 backdrop-blur-md" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          aria-describedby="setup-intro"
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-pop"
        >
          <div className="overflow-y-auto px-6 pb-2 pt-7 sm:px-8">
            <LogoMark className="size-10" />
            <DialogPrimitive.Title className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.03em] text-ink">
              Welcome to <span className="text-sprout">Dividend</span>Case
            </DialogPrimitive.Title>
            <p id="setup-intro" className="mt-1.5 flex items-center gap-2 text-[13.5px] text-ink-2">
              <Lock className="size-3.5 shrink-0 text-sprout" />
              Three questions. The answers stay on this computer.
            </p>

            <div className="mt-7 space-y-7">
              <Question n={1} title="Where are you resident for tax?" help="Later versions use this to show income after withholding tax.">
                <Select value={residence} onValueChange={pickResidence}>
                  <SelectTrigger aria-label="Tax residence" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_RESIDENCES.map((r) => (
                      <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Question>

              <Question n={2} title="Show totals in" help="Amounts in other currencies are converted with the European Central Bank's daily rates.">
                <Select
                  value={currency}
                  onValueChange={(v) => {
                    setCurrency(v);
                    setCurrencyTouched(true);
                  }}
                >
                  <SelectTrigger aria-label="Home currency" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c} value={c}>
                        <span className="num mr-2 text-ink">{c}</span>
                        {CURRENCY_NAMES[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Question>

              <Question
                n={3}
                title="Which markets should the screener cover?"
                help={
                  markets
                    ? chosen.size === 0
                      ? "None: the screener only shows stocks you add yourself."
                      : `About ${stockCount.toLocaleString()} stocks, downloaded in the background (roughly ${minutes} min the first time).`
                    : "Loading…"
                }
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(markets ?? []).map((m) => {
                    const on = chosen.has(m.key);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggleMarket(m.key)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                          on ? "border-sprout/40 bg-sprout/[0.07]" : "border-line hover:border-line-strong"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border",
                            on ? "border-sprout bg-sprout text-sprout-ink" : "border-line-strong"
                          )}
                        >
                          {on && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-ink">{m.name}</span>
                          <span className="block truncate text-[11.5px] text-ink-3">
                            {m.country} · <span className="num">{m.stocks}</span> stocks
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Question>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <button onClick={onLater} className="text-[12.5px] text-ink-3 hover:text-ink" disabled={saving}>
              Set up later
            </button>
            <div className="flex items-center gap-3">
              {error && <span className="text-[12.5px] text-cut">{error}</span>}
              <Button onClick={start} disabled={saving || !markets} size="lg">
                {saving && <Loader2 className="size-4 animate-spin" />}
                Start
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Question({ n, title, help, children }: { n: number; title: string; help: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline gap-2.5">
        <span className="num text-[12px] text-ink-3">0{n}</span>
        <h3 className="text-[14.5px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
      </div>
      {children}
      <p className="text-[12px] leading-relaxed text-ink-3">{help}</p>
    </section>
  );
}
