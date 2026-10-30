"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CandlestickChart } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdvancedChart, OVERLAYS, PANES, type OverlayKey, type PaneKey } from "@/components/charts/AdvancedChart";
import { DividendAnalysis } from "@/components/charts/DividendAnalysis";
import { StockSearchField } from "@/components/investments/StockSearchField";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat, StatGroup } from "@/components/ui/stat";
import { InfoTip } from "@/components/ui/tooltip";
import { useStockData } from "@/lib/hooks/useStockData";
import { usePriceHistory } from "@/lib/hooks/usePriceHistory";
import { useInvestments } from "@/lib/hooks/useInvestments";
import { useWatchlist } from "@/lib/hooks/useWatchlist";
import { aggregate, autoInterval, lastMonths, performance, type Interval } from "@/lib/indicators";
import { CHART_TYPES, RANGES, apiErrorDetail, rangeLabel, type ChartType } from "@/lib/priceChart";
import { formatMoney, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const INTERVALS: readonly { value: "auto" | Interval; label: string; title?: string }[] = [
  { value: "auto", label: "Auto", title: "Days up to a year, weeks up to five years, months beyond" },
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

interface Settings {
  type: ChartType;
  months: number;
  interval: "auto" | Interval;
  log: boolean;
  overlays: OverlayKey[];
  panes: PaneKey[];
}

const DEFAULTS: Settings = {
  type: "candles",
  months: 12,
  interval: "auto",
  log: false,
  overlays: ["sma50", "sma200", "dividends"],
  panes: ["volume", "yield"],
};

// A fund or stock without dividends has nothing for these overlays and this pane to show
const NEEDS_DIVIDENDS: readonly string[] = ["bands", "dividends", "yield"];

// The chosen indicators are remembered on this computer, for the next stock and the next visit
const KEY = "dividendcase:advanced-charts";

function useSettings(): [Settings, (change: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (saved && typeof saved === "object") setSettings((s) => ({ ...s, ...saved }));
    } catch {
      // Private windows and blocked storage start from the defaults
    }
  }, []);
  const update = (change: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...change };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Not remembered; still applied
      }
      return next;
    });
  return [settings, update];
}

function signed(v: number | null, decimals = 1) {
  if (v == null) return "—";
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(decimals)}%`;
}

function ChartsContent() {
  const router = useRouter();
  const ticker = (useSearchParams().get("t") ?? "").trim().toUpperCase() || null;
  const open = (symbol: string) => router.replace(`/dashboard/charts/?t=${encodeURIComponent(symbol)}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Advanced charts"
        description="Price, moving averages and momentum for one stock, and how its dividends have lined up with its price."
        actions={
          <StockSearchField
            key={ticker ?? "none"}
            onSelect={(r) => open(r.symbol)}
            placeholder={ticker ? "Chart another stock" : "Search a ticker or company"}
            className="w-full sm:w-80"
            clearOnSelect
          />
        }
      />
      {ticker ? <StockCharts ticker={ticker} /> : <PickAStock onPick={open} />}
    </div>
  );
}

function PickAStock({ onPick }: { onPick: (ticker: string) => void }) {
  const { items: holdings } = useInvestments();
  const { items: watchlist } = useWatchlist();
  const yours = Array.from(new Set([...holdings.map((h) => h.ticker_symbol), ...watchlist.map((w) => w.ticker_symbol)]));
  return (
    <EmptyState
      icon={<CandlestickChart />}
      title="Choose a stock to chart"
      description="Search above, or start with one of yours. Prices come from Yahoo Finance the first time you open a stock, then stay on this computer."
      action={
        yours.length > 0 && (
          <div className="flex max-w-xl flex-wrap justify-center gap-2">
            {yours.slice(0, 12).map((t) => (
              <Chip key={t} active={false} onClick={() => onPick(t)}>
                <span className="num">{t}</span>
              </Chip>
            ))}
          </div>
        )
      }
    />
  );
}

function StockCharts({ ticker }: { ticker: string }) {
  const [settings, update] = useSettings();
  const stock = useStockData(ticker, 10);
  // A stock opened here for the first time is stored by the dividend lookup; ask for prices after it
  const settled = !!stock.data || !!stock.error;
  const prices = usePriceHistory(settled ? ticker : null);

  const dividends = useMemo(
    () => (stock.data?.records ?? []).map((r) => ({ date: r.dividend_date, amount: Number(r.dividend_per_share) })),
    [stock.data]
  );
  const interval: Interval = settings.interval === "auto" ? autoInterval(settings.months) : settings.interval;
  const view = useMemo(() => {
    const daily = prices.data?.bars ?? [];
    if (daily.length < 2) return null;
    const bars = aggregate(daily, interval);
    const start = bars.length - lastMonths(bars, settings.months).length;
    const range = lastMonths(daily, settings.months);
    return { daily, bars, start, perf: performance(range, "day"), last: range[range.length - 1] };
  }, [prices.data, interval, settings.months]);

  const hasDividends = dividends.length > 0;
  const overlays = useMemo(
    () => new Set(settings.overlays.filter((o) => hasDividends || !NEEDS_DIVIDENDS.includes(o))),
    [settings.overlays, hasDividends]
  );
  const panes = settings.panes.filter((p) => hasDividends || !NEEDS_DIVIDENDS.includes(p));
  const toggleOverlay = (k: OverlayKey) =>
    update({ overlays: overlays.has(k) ? settings.overlays.filter((o) => o !== k) : [...settings.overlays, k] });
  const togglePane = (k: PaneKey) =>
    update({ panes: settings.panes.includes(k) ? settings.panes.filter((p) => p !== k) : PANES.map((p) => p.key).filter((p) => p === k || settings.panes.includes(p)) });

  const currency = prices.data?.currency ?? stock.data?.currency ?? "USD";
  const name = stock.data?.company_name;
  const priceError = apiErrorDetail(prices.error);
  const noDividends = !stock.data && !!stock.error;
  const short = (key: OverlayKey) => {
    const need = key === "sma200" ? 200 : key === "sma50" ? 50 : 0;
    return need > 0 && view != null && view.bars.length < need;
  };

  if (priceError) {
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title={`No prices for ${ticker}`}
        description={priceError.includes("not found") ? `${ticker} isn't stored on this computer yet. Open it from the search above to fetch it.` : priceError}
        action={<Button variant="outline" asChild><Link href="/dashboard/screener/">Open the screener</Link></Button>}
      />
    );
  }

  return (
    <>
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] text-ink-2">
                <span className="num font-medium text-ink">{ticker}</span>
                {name && <span className="text-ink-3"> {name}</span>}
              </p>
              {view?.last && view.perf ? (
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2.5">
                  <span className="num text-[26px] font-medium tracking-[-0.03em] text-ink">{formatMoney(view.last.close, currency, { decimals: 2 })}</span>
                  <span className={cn("num text-[13px]", view.perf.priceReturn >= 0 ? "text-money" : "text-cut")}>
                    <span aria-hidden="true">{view.perf.priceReturn >= 0 ? "▲" : "▼"}</span> {signed(view.perf.priceReturn, 2)}
                  </span>
                  <span className="text-[12.5px] text-ink-3">over {rangeLabel(settings.months)}, close of {new Date(`${view.last.date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                </p>
              ) : (
                <Skeleton className="mt-1 h-8 w-56" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented value={settings.type} onChange={(type) => update({ type })} options={CHART_TYPES} aria-label="Chart type" />
              <Segmented value={settings.months} onChange={(months) => update({ months })} options={RANGES} aria-label="Range" />
              <Segmented value={settings.interval} onChange={(interval) => update({ interval })} options={INTERVALS} aria-label="One bar is" />
              <Chip active={settings.log} onClick={() => update({ log: !settings.log })} title="Equal distances are equal percentage moves, which suits long ranges">
                Log scale
              </Chip>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[12px] font-medium text-ink-3">On the price</span>
              {OVERLAYS.map((o) => (
                <Chip
                  key={o.key}
                  active={overlays.has(o.key)}
                  onClick={() => toggleOverlay(o.key)}
                  disabled={!hasDividends && NEEDS_DIVIDENDS.includes(o.key)}
                  title={
                    !hasDividends && NEEDS_DIVIDENDS.includes(o.key)
                      ? `${ticker} has no dividends on record`
                      : short(o.key)
                        ? `${o.title}. This range and interval give fewer bars than that: pick daily or weekly bars.`
                        : o.title
                  }
                  className={cn(short(o.key) && overlays.has(o.key) && "opacity-60")}
                >
                  <span className="size-2 rounded-full" style={{ background: o.color }} aria-hidden="true" />
                  {o.label}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[12px] font-medium text-ink-3">Below</span>
              {PANES.map((p) => (
                <Chip
                  key={p.key}
                  active={panes.includes(p.key)}
                  onClick={() => togglePane(p.key)}
                  disabled={!hasDividends && NEEDS_DIVIDENDS.includes(p.key)}
                  title={!hasDividends && NEEDS_DIVIDENDS.includes(p.key) ? `${ticker} has no dividends on record` : p.title}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>

          {!view ? (
            <Skeleton className="h-[520px] w-full rounded-xl" />
          ) : (
            <AdvancedChart
              bars={view.bars}
              start={view.start}
              interval={interval}
              dividends={dividends}
              currency={currency}
              type={settings.type}
              log={settings.log}
              overlays={overlays}
              panes={panes}
            />
          )}

          <p className="text-[12px] leading-relaxed text-ink-3">
            Averages count bars, so SMA 50 is 50 days on a daily chart and 50 weeks on a weekly one. Scroll or pinch on the chart to
            zoom; drag the strip below it to move through the range.
            {prices.data?.stale && (
              <span className="text-watch"> ▲ Yahoo Finance didn&apos;t answer, so these prices are from {timeAgo(prices.data.fetched_at)}.</span>
            )}
          </p>
        </div>
      </Card>

      {view?.perf && (
        <section className="space-y-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Over {rangeLabel(settings.months)}</h2>
            <InfoTip>
              From the close on the first day of the range to the latest close. Total return adds the dividends paid along the way,
              as if each one was reinvested that day (Yahoo&apos;s adjusted close).
            </InfoTip>
          </div>
          <StatGroup className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Stat bare label="Price change" value={signed(view.perf.priceReturn)} sub="Close to close" />
            <Stat bare label="Total return" value={signed(view.perf.totalReturn)} tone={view.perf.totalReturn >= 0 ? "money" : "default"} sub="With dividends reinvested" />
            <Stat bare label="From dividends" value={signed(view.perf.fromDividends)} sub="Points of the total return" tone="money" />
            <Stat bare label="A year" value={view.perf.cagr == null ? "—" : signed(view.perf.cagr)} sub={view.perf.cagr == null ? "For ranges of a year or more" : "Total return as a yearly rate"} />
            <Stat bare label="Volatility" value={view.perf.volatility == null ? "—" : `${view.perf.volatility.toFixed(1)}%`} sub="Yearly, from daily moves" />
            <Stat bare label="Deepest fall" value={signed(view.perf.maxDrawdown)} sub="From a high, by close" />
          </StatGroup>
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Dividends and the price</h2>
          <p className="text-[12.5px] text-ink-3">
            Over all {view ? <span className="num">{Math.round(view.daily.length / 252)}</span> : "the"} years of stored prices, not just the range above.
          </p>
        </div>
        {noDividends ? (
          <p className="glass-panel rounded-xl border px-4 py-6 text-center text-[13px] text-ink-3">
            {ticker} has no dividends on record, so there is nothing to compare its price with.
          </p>
        ) : !view || !stock.data ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[380px] rounded-xl" />)}
          </div>
        ) : (
          <DividendAnalysis bars={view.daily} dividends={dividends} ticker={ticker} />
        )}
        <p className="text-[12px] text-ink-3">How a stock behaved in the past says nothing certain about what it will do next.</p>
      </section>
    </>
  );
}

export default function ChartsPage() {
  return (
    <Suspense>
      <ChartsContent />
    </Suspense>
  );
}
