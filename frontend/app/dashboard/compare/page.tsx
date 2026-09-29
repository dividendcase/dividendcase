"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, GitCompareArrows, Loader2, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Chip } from "@/components/ui/segmented";
import { TickerBadge } from "@/components/ui/ticker-badge";
import { DividendStreakChart } from "@/components/charts/DividendStreakChart";
import { EChart } from "@/components/charts/EChart";
import { StockSearchField } from "@/components/investments/StockSearchField";
import { stockHref } from "@/components/investments/stockDetail";
import { useStockData } from "@/lib/hooks/useStockData";
import { useInvestments } from "@/lib/hooks/useInvestments";
import { useWatchlist } from "@/lib/hooks/useWatchlist";
import { lineSeries } from "@/lib/chartTheme";
import { formatMoney, formatShortDate, frequencyLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DividendHistoryResponse, DividendMetrics } from "@/lib/types";

const MAX_STOCKS = 4;

function parseTickers(raw: string | null): string[] {
  if (!raw) return [];
  const list = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  return Array.from(new Set(list)).slice(0, MAX_STOCKS);
}

/* ── Data for up to four stocks (hooks can't run in a loop) ─────────────── */
function useComparisonData(tickers: string[]) {
  const d0 = useStockData(tickers[0] ?? null);
  const d1 = useStockData(tickers[1] ?? null);
  const d2 = useStockData(tickers[2] ?? null);
  const d3 = useStockData(tickers[3] ?? null);
  return [d0, d1, d2, d3];
}

/* ── Metric rows ───────────────────────────────────────────────────────── */
type Row = {
  label: string;
  hint?: string;
  /** A number to find the best value; leave out when "best" makes no sense */
  score?: (m: DividendMetrics) => number | null | undefined;
  render: (m: DividendMetrics) => React.ReactNode;
};

const dash = <span className="text-ink-3">—</span>;

function signedPct(v: number | null | undefined) {
  if (v == null) return dash;
  const up = v >= 0;
  return (
    <span className={up ? undefined : "text-cut"}>
      {!up && <span aria-hidden="true" className="mr-1 text-[0.8em]">▼</span>}
      {up ? "+" : "−"}
      {Math.abs(v).toFixed(1)}%
    </span>
  );
}

function safety(m: DividendMetrics) {
  if (m.dividend_safety_score == null) return dash;
  const tone = m.safety_label === "At Risk" ? "text-cut" : m.safety_label === "Moderate" ? "text-watch" : undefined;
  return (
    <span className={tone}>
      {m.dividend_safety_score.toFixed(0)}
      <span className="ml-1.5 font-sans text-[11.5px] opacity-80">{m.safety_label}</span>
    </span>
  );
}

const ROWS: Row[] = [
  {
    label: "TTM yield",
    hint: "Dividends paid in the last 12 months ÷ latest price",
    score: (m) => m.ttm_yield,
    render: (m) => (m.ttm_yield != null ? `${m.ttm_yield.toFixed(2)}%` : dash),
  },
  {
    label: "Projected yield",
    hint: "Latest payment × payments per year ÷ latest price",
    score: (m) => m.current_yield,
    render: (m) => (m.current_yield != null ? `${m.current_yield.toFixed(2)}%` : dash),
  },
  {
    label: "Safety score",
    hint: "0–100, from consistency, growth streak, history, cuts and yield level",
    score: (m) => m.dividend_safety_score,
    render: safety,
  },
  {
    label: "Consistency",
    hint: "0–100, how steady the yield has been",
    score: (m) => m.yield_consistency_score,
    render: (m) => (m.yield_consistency_score != null ? m.yield_consistency_score.toFixed(0) : dash),
  },
  { label: "Growth, 3 years", hint: "Yearly dividend growth (CAGR)", score: (m) => m.dividend_growth_cagr_3y, render: (m) => signedPct(m.dividend_growth_cagr_3y) },
  { label: "Growth, 5 years", hint: "Yearly dividend growth (CAGR)", score: (m) => m.dividend_growth_cagr_5y, render: (m) => signedPct(m.dividend_growth_cagr_5y) },
  { label: "Growth, 10 years", hint: "Yearly dividend growth (CAGR)", score: (m) => m.dividend_growth_cagr_10y, render: (m) => signedPct(m.dividend_growth_cagr_10y) },
  {
    label: "Growth streak",
    hint: "Years in a row the dividend held or grew",
    score: (m) => m.consecutive_growth_years,
    render: (m) =>
      m.consecutive_growth_years != null ? (
        <>
          {m.consecutive_growth_years}
          <span className="ml-1 font-sans text-[11.5px] text-ink-3">yr</span>
        </>
      ) : (
        dash
      ),
  },
  { label: "Pays", render: (m) => <span className="font-sans">{frequencyLabel(m.payment_frequency === "unknown" ? null : m.payment_frequency)}</span> },
  {
    label: "Yearly dividend",
    hint: "Latest payment × payments per year, per share",
    render: (m) =>
      m.annual_dividend_estimate != null
        ? formatMoney(m.annual_dividend_estimate, m.currency, { decimals: m.annual_dividend_estimate < 1 ? 4 : 2 })
        : dash,
  },
  {
    label: "Last paid",
    render: (m) =>
      m.last_dividend_date ? (
        <>
          {formatShortDate(m.last_dividend_date)}
          {m.last_dividend_amount != null && (
            <span className="ml-1.5 text-ink-3">{formatMoney(m.last_dividend_amount, m.currency, { decimals: m.last_dividend_amount < 1 ? 4 : 2 })}</span>
          )}
        </>
      ) : (
        dash
      ),
  },
  { label: "Payments on record", render: (m) => String(m.total_payments) },
];

/* ── Radar ─────────────────────────────────────────────────────────────── */
function ComparisonRadar({ stocks }: { stocks: { ticker: string; color: string; metrics: DividendMetrics }[] }) {
  const maxYield = Math.max(...stocks.map((s) => s.metrics.ttm_yield ?? 0), 1);
  const option = {
    tooltip: { trigger: "item" },
    legend: { data: stocks.map((s) => s.ticker), bottom: 0 },
    radar: {
      indicator: [
        { name: "Yield", max: maxYield * 1.2 },
        { name: "Consistency", max: 100 },
        { name: "Safety", max: 100 },
        { name: "Growth (5y)", max: 30 },
        { name: "Streak", max: 25 },
      ],
      shape: "circle",
      radius: "62%",
      center: ["50%", "46%"],
      axisName: { fontSize: 11 },
    },
    series: [
      {
        type: "radar",
        symbol: "circle",
        symbolSize: 4,
        data: stocks.map((s) => ({
          name: s.ticker,
          value: [
            s.metrics.ttm_yield ?? 0,
            s.metrics.yield_consistency_score ?? 0,
            s.metrics.dividend_safety_score ?? 0,
            Math.max(0, s.metrics.dividend_growth_cagr_5y ?? s.metrics.dividend_growth_cagr_3y ?? 0),
            s.metrics.consecutive_growth_years ?? 0,
          ],
          lineStyle: { color: s.color, width: 2 },
          areaStyle: { color: s.color, opacity: 0.08 },
          itemStyle: { color: s.color },
        })),
      },
    ],
  };
  return <EChart option={option} style={{ height: 340 }} />;
}

/* ── Page ──────────────────────────────────────────────────────────────── */
function CompareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawParam = searchParams.get("tickers");
  const [tickers, setTickers] = useState<string[]>(() => parseTickers(rawParam));
  const results = useComparisonData(tickers);
  const { items: holdings } = useInvestments();
  const { items: watchlist } = useWatchlist();

  // Follow the link when it changes (the stock page links here with ?tickers=KO)
  useEffect(() => {
    const fromUrl = parseTickers(rawParam);
    if (fromUrl.join(",") !== tickers.join(",")) setTickers(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawParam]);

  const update = (next: string[]) => {
    setTickers(next);
    const q = next.length ? `?tickers=${next.map(encodeURIComponent).join(",")}` : "";
    router.replace(`/dashboard/compare/${q}`, { scroll: false });
  };
  const add = (ticker: string) => {
    const t = ticker.toUpperCase();
    if (tickers.includes(t) || tickers.length >= MAX_STOCKS) return;
    update([...tickers, t]);
  };
  const remove = (ticker: string) => update(tickers.filter((t) => t !== ticker));

  const slots = tickers.map((ticker, i) => ({ ticker, color: lineSeries[i % lineSeries.length], result: results[i] }));
  const loaded = slots.filter((s) => s.result.data) as (typeof slots[number] & { result: { data: DividendHistoryResponse } })[];
  const anyLoading = slots.some((s) => s.result.isLoading);

  const suggestions = useMemo(() => {
    const seen = new Set(tickers);
    const out: string[] = [];
    for (const t of [...holdings.map((h) => h.ticker_symbol), ...watchlist.map((w) => w.ticker_symbol)]) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    return out.slice(0, 8);
  }, [holdings, watchlist, tickers]);

  // Best value per row: highest, among two or more, and only when it's above zero
  const best = useMemo(() => {
    const map = new Map<string, number>();
    if (loaded.length < 2) return map;
    for (const row of ROWS) {
      if (!row.score) continue;
      const values = loaded.map((s) => row.score!(s.result.data.metrics)).filter((v): v is number => v != null);
      if (values.length < 2) continue;
      const max = Math.max(...values);
      if (max > 0 && values.some((v) => v !== max)) map.set(row.label, max);
    }
    return map;
  }, [loaded]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compare"
        description={
          <>
            Up to <span className="num">{MAX_STOCKS}</span> dividend stocks side by side: yield, safety, growth and consistency.
          </>
        }
      />

      {/* Picker */}
      <Card>
        <CardContent className="space-y-3 pt-4 sm:pt-5">
          <div className="flex flex-wrap items-center gap-2">
            {slots.map(({ ticker, color, result }) => (
              <span
                key={ticker}
                className={cn(
                  "inline-flex h-9 max-w-full items-center gap-2 rounded-full border bg-raised pl-1.5 pr-1",
                  result.error ? "border-cut/40" : "border-line"
                )}
              >
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <Link href={stockHref(ticker)} className="num text-[13px] font-medium text-ink hover:text-sprout">
                  {ticker}
                </Link>
                {result.isLoading ? (
                  <Loader2 className="size-3.5 animate-spin text-ink-3" aria-label="Loading" />
                ) : result.error ? (
                  <span className="flex items-center gap-1 text-[12px] text-cut">
                    <AlertTriangle className="size-3.5" /> No data
                  </span>
                ) : (
                  result.data && (
                    <span className="hidden max-w-[12rem] truncate text-[12.5px] text-ink-3 sm:inline">{result.data.company_name}</span>
                  )
                )}
                <button
                  onClick={() => remove(ticker)}
                  aria-label={`Remove ${ticker}`}
                  className="rounded-full p-1 text-ink-3 transition-colors hover:bg-overlay hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            {tickers.length < MAX_STOCKS && (
              <StockSearchField
                id="compare-add"
                clearOnSelect
                className="w-full sm:w-72"
                placeholder={tickers.length === 0 ? "Add a stock, such as KO" : "Add another stock"}
                onSelect={(r) => add(r.symbol)}
              />
            )}
          </div>
          {tickers.length < MAX_STOCKS && suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[12px] text-ink-3">Your stocks</span>
              {suggestions.map((t) => (
                <Chip key={t} active={false} onClick={() => add(t)} className="h-6 gap-1 px-2.5 text-[12px]">
                  <Plus className="size-3" />
                  <span className="num">{t}</span>
                </Chip>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {loaded.length < 2 && (
        anyLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        ) : (
          <EmptyState
            icon={<GitCompareArrows />}
            title={tickers.length === 0 ? "Pick two to four stocks" : "Add one more stock to compare"}
            description="Search above, or tap one of your own stocks. The table marks the best value in each row."
          />
        )
      )}

      {loaded.length >= 2 && (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader className="border-b border-line">
                <CardTitle>Side by side</CardTitle>
                <CardDescription className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-sprout" /> marks the best value in a row
                </CardDescription>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-[13px]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 border-b border-line bg-surface px-4 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3">
                        Metric
                      </th>
                      {loaded.map((s) => (
                        <th key={s.ticker} className="border-b border-line px-3 py-2.5 text-right last:pr-4">
                          <span className="inline-flex items-center justify-end gap-2">
                            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                            <TickerBadge ticker={s.ticker} className="hidden sm:inline-flex" />
                            <span className="num text-[13px] font-medium text-ink">{s.ticker}</span>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row) => (
                      <tr key={row.label} className="border-t border-line first:border-t-0 hover:bg-raised/40">
                        <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left font-normal">
                          <span className="block text-ink-2">{row.label}</span>
                          {row.hint && <span className="hidden text-[11.5px] text-ink-3 md:block">{row.hint}</span>}
                        </th>
                        {loaded.map((s) => {
                          const m = s.result.data.metrics;
                          const isBest = row.score != null && best.get(row.label) != null && row.score(m) === best.get(row.label);
                          return (
                            <td key={s.ticker} className={cn("num whitespace-nowrap px-3 py-2.5 text-right last:pr-4", isBest ? "text-money" : "text-ink")}>
                              {isBest && (
                                <>
                                  <span aria-hidden="true" className="mr-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-sprout align-middle" />
                                  <span className="sr-only">Best: </span>
                                </>
                              )}
                              {row.render(m)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Shape</CardTitle>
                <CardDescription>
                  Yield, consistency, safety, 5-year growth (capped at 30%) and streak (capped at 25 years).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ComparisonRadar stocks={loaded.map((s) => ({ ticker: s.ticker, color: s.color, metrics: s.result.data.metrics }))} />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {loaded.map((s) => (
              <DividendStreakChart key={s.ticker} metrics={s.result.data.metrics} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={null}>
      <CompareContent />
    </Suspense>
  );
}
