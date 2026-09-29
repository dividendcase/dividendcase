"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowDown, ArrowUp, Database, Loader2, RefreshCw, Search, SearchX, TrendingUp, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppActions } from "@/components/layout/AppActions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TickerBadge } from "@/components/ui/ticker-badge";
import { InfoTip } from "@/components/ui/tooltip";
import { EXCHANGE_NAMES } from "@/components/dashboard/CompanyInfoCard";
import { getTopPerformers } from "@/lib/api/backend";
import { isBusy, useDataStatus } from "@/lib/hooks/useDataStatus";
import { frequencyLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StockSummary } from "@/lib/types";

const MARKETS = [
  { code: "NYSE", label: "NYSE" },
  { code: "NASDAQ", label: "Nasdaq" },
  { code: "LSE", label: "London" },
  { code: "ISE", label: "Dublin" },
  { code: "TSX", label: "Toronto" },
  { code: "NSE", label: "NSE" },
  { code: "BSE", label: "BSE" },
  { code: "ASX", label: "ASX" },
];

const YIELDS = [
  { value: 0, label: "Any" },
  { value: 2, label: "2%+" },
  { value: 4, label: "4%+" },
  { value: 6, label: "6%+" },
  { value: 10, label: "10%+" },
];

const FREQUENCIES = [
  { value: "any", label: "Any" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi-annual", label: "Half-yearly" },
  { value: "annual", label: "Yearly" },
];

type SortKey = "ticker" | "yield" | "consistency";
const PAGE = 60;

export default function ScreenerPage() {
  const { openCommand } = useAppActions();
  const { status, startRefresh } = useDataStatus();
  const [markets, setMarkets] = useState<Set<string>>(new Set());
  const [minYield, setMinYield] = useState(0);
  const [frequency, setFrequency] = useState("any");
  const [beatsOnly, setBeatsOnly] = useState(false);
  const [text, setText] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "yield", dir: "desc" });
  const [shown, setShown] = useState(PAGE);

  // All stored payers at once; filtering happens here so it is instant. While the
  // background fetch adds stocks, reload the list every 25 new stocks.
  const { data: stocks, isLoading } = useSWR<StockSummary[]>(
    ["screener", Math.floor((status?.stocks ?? 0) / 25)],
    () => getTopPerformers({ limit: 2000 }),
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const rows = useMemo(() => {
    const q = text.trim().toLowerCase();
    const filtered = (stocks ?? []).filter((s) => {
      if (markets.size > 0 && !markets.has(s.exchange)) return false;
      if ((s.avg_dividend_yield ?? 0) < minYield) return false;
      if (frequency !== "any" && s.payment_frequency !== frequency) return false;
      if (beatsOnly && s.beats_benchmark !== true) return false;
      if (q && !s.ticker_symbol.toLowerCase().includes(q) && !s.company_name.toLowerCase().includes(q)) return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sort.key === "ticker") return a.ticker_symbol.localeCompare(b.ticker_symbol) * dir;
      const av = sort.key === "yield" ? a.avg_dividend_yield : a.yield_consistency_score;
      const bv = sort.key === "yield" ? b.avg_dividend_yield : b.yield_consistency_score;
      return ((av ?? -1) - (bv ?? -1)) * dir;
    });
  }, [stocks, markets, minYield, frequency, beatsOnly, text, sort]);

  const toggleMarket = (code: string) => {
    setShown(PAGE);
    setMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };
  const toggleSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "ticker" ? "asc" : "desc" }));

  const filtersOn = markets.size > 0 || minYield > 0 || frequency !== "any" || beatsOnly || text.trim() !== "";
  const resetFilters = () => {
    setMarkets(new Set());
    setMinYield(0);
    setFrequency("any");
    setBeatsOnly(false);
    setText("");
    setShown(PAGE);
  };

  const total = stocks?.length ?? 0;
  const compared = (stocks ?? []).some((s) => s.beats_benchmark != null);
  const screenerRunning = !!status && status.screener.total > 0;
  const marketsPresent = new Set((stocks ?? []).map((s) => s.exchange));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Screener"
        description={
          <>
            Dividend payers from the S&amp;P 500, NIFTY 50, TSX 60, FTSE 100, ISEQ 20 and ASX 200, stored on this computer.
            {total > 0 && <> <span className="num text-ink">{total.toLocaleString()}</span> stocks so far.</>}
          </>
        }
        actions={
          <Button variant="outline" size="sm" onClick={openCommand}>
            <Search className="size-4" />
            Any stock or ETF
          </Button>
        }
      />

      {screenerRunning && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-ink-2">
          <Loader2 className="size-4 shrink-0 animate-spin text-sprout" />
          <span className="min-w-0 flex-1">
            Fetching screener stocks in the background:{" "}
            <span className="num text-ink">{status!.screener.done}</span> of <span className="num text-ink">{status!.screener.total}</span>. New
            stocks appear here as they arrive.
          </span>
          <Link href="/dashboard/data/" className="shrink-0 text-ink-3 hover:text-ink">Details</Link>
        </div>
      )}

      {/* Filters */}
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setShown(PAGE);
              }}
              placeholder="Filter by ticker or name"
              className="pl-9"
              aria-label="Filter by ticker or name"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 lg:ml-auto">
            <div className="flex items-center gap-2">
              <span className="eyebrow">Yield</span>
              <Segmented value={minYield} onChange={(v) => { setMinYield(v); setShown(PAGE); }} options={YIELDS} aria-label="Minimum yield" />
            </div>
            <div className="flex items-center gap-2">
              <span className="eyebrow">Pays</span>
              <Segmented value={frequency} onChange={(v) => { setFrequency(v); setShown(PAGE); }} options={FREQUENCIES} aria-label="Payment frequency" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">Markets</span>
          <Chip active={markets.size === 0} onClick={() => { setMarkets(new Set()); setShown(PAGE); }}>All</Chip>
          {MARKETS.filter((m) => marketsPresent.size === 0 || marketsPresent.has(m.code) || markets.has(m.code)).map((m) => (
            <Chip key={m.code} active={markets.has(m.code)} onClick={() => toggleMarket(m.code)} title={EXCHANGE_NAMES[m.code]}>
              {m.label}
            </Chip>
          ))}
          <span className="mx-1 hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
          <Chip
            active={beatsOnly}
            onClick={() => { setBeatsOnly((v) => !v); setShown(PAGE); }}
            title={
              compared
                ? "Stocks whose price change plus dividends beat their local index over the last 10 years (or since their first stored payment)"
                : "The comparison with each market's index runs after the screener data has downloaded"
            }
          >
            <TrendingUp className="size-3.5" />
            Beat their index
          </Chip>
          {filtersOn && (
            <button onClick={resetFilters} className="ml-auto inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink">
              <X className="size-3.5" />
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Results */}
      {isLoading && !stocks ? (
        <Card className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </Card>
      ) : total === 0 ? (
        <EmptyState
          icon={<Database />}
          title={screenerRunning || isBusy(status) ? "Screener data is on its way" : "No screener data yet"}
          description={
            screenerRunning || isBusy(status)
              ? "Your computer is fetching index members from Yahoo Finance, about one a second. Stocks appear here as they arrive."
              : "Fetch the index members once (15 to 30 minutes in the background). After that they update every week while the app is open."
          }
          action={
            !(screenerRunning || isBusy(status)) && (
              <Button onClick={() => startRefresh("screener")}>
                <RefreshCw className="size-4" />
                Fetch screener data
              </Button>
            )
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title="No stocks match these filters"
          description="Try a lower yield, another market, or search every stock with ⌘K."
          action={<Button variant="outline" onClick={resetFilters}>Clear filters</Button>}
        />
      ) : (
        <Card>
          <div className="flex items-center justify-between border-b border-line px-4 py-3 text-[12.5px] text-ink-3">
            <span>
              <span className="num text-ink">{rows.length.toLocaleString()}</span> {rows.length === 1 ? "stock" : "stocks"}
              {filtersOn && <> of <span className="num">{total.toLocaleString()}</span></>}
            </span>
            <span className="hidden sm:inline">Yield = last 12 months of dividends ÷ price at the last update</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <SortTH label="Stock" active={sort.key === "ticker"} dir={sort.dir} onClick={() => toggleSort("ticker")} className="pl-4 text-left" />
                  <th className="px-3 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3">Market</th>
                  <th className="px-3 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3">Pays</th>
                  <SortTH label="Consistency" active={sort.key === "consistency"} dir={sort.dir} onClick={() => toggleSort("consistency")} className="text-right" />
                  <th className="px-3 py-2.5 text-right font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-3">
                    <span className="inline-flex items-center gap-1">
                      Vs index
                      <InfoTip>
                        Price change plus dividends over the last 10 years (or since the first stored payment, if at least
                        3 years ago), against the stock&apos;s local index over the same period.
                      </InfoTip>
                    </span>
                  </th>
                  <SortTH label="Yield" active={sort.key === "yield"} dir={sort.dir} onClick={() => toggleSort("yield")} className="pr-4 text-right" />
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, shown).map((s) => {
                  const href = `/dashboard/stock/?t=${encodeURIComponent(s.ticker_symbol)}`;
                  const y = s.avg_dividend_yield;
                  return (
                    <tr key={s.ticker_symbol} className="group border-t border-line transition-colors hover:bg-raised/50">
                      <td className="py-2 pl-4 pr-3">
                        <Link href={href} className="flex min-w-0 items-center gap-3">
                          <TickerBadge ticker={s.ticker_symbol} />
                          <span className="min-w-0">
                            <span className="num block font-medium text-ink group-hover:text-sprout-hi">{s.ticker_symbol}</span>
                            <span className="block max-w-[320px] truncate text-[12px] text-ink-3">{s.company_name}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-ink-2" title={EXCHANGE_NAMES[s.exchange] ?? s.exchange}>
                        <span className="font-mono text-[12px]">{s.exchange}</span>
                        <span className="ml-1.5 text-[11.5px] text-ink-3">{s.currency}</span>
                      </td>
                      <td className="px-3 py-2 text-ink-2">{s.payment_frequency ? frequencyLabel(s.payment_frequency) : <span className="text-ink-3">—</span>}</td>
                      <td className="px-3 py-2 text-right">
                        {s.yield_consistency_score != null ? <ConsistencyBar value={s.yield_consistency_score} /> : <span className="text-ink-3">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-[12.5px]" title={s.benchmark_ticker ? `Compared with ${s.benchmark_ticker}` : undefined}>
                        {s.beats_benchmark === true ? (
                          <span className="text-money">▲ Beat</span>
                        ) : s.beats_benchmark === false ? (
                          <span className="text-ink-3">▼ Behind</span>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className="py-2 pl-3 pr-4 text-right">
                        <span className={cn("num text-[13.5px] font-medium", y != null && y >= 10 ? "text-watch" : "text-money")}>
                          {y != null ? `${y.toFixed(2)}%` : "—"}
                        </span>
                        {y != null && y >= 10 && <span className="sr-only"> (very high, check it can be sustained)</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > shown && (
            <div className="border-t border-line p-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setShown((n) => n + PAGE * 2)}>
                Show more <span className="num text-ink-3">({(rows.length - shown).toLocaleString()} left)</span>
              </Button>
            </div>
          )}
        </Card>
      )}
      {rows.some((s) => (s.avg_dividend_yield ?? 0) >= 10) && (
        <p className="text-[12px] text-ink-3">
          Yields of 10% or more are shown in amber: very high yields are often a sign the market expects a cut.
        </p>
      )}
    </div>
  );
}

function SortTH({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void; className?: string }) {
  return (
    <th className={cn("px-3 py-2.5", className)} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] transition-colors",
          active ? "text-ink" : "text-ink-3 hover:text-ink-2"
        )}
      >
        {label}
        {active && (dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
}

function ConsistencyBar({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-2" title={`Yield consistency ${value.toFixed(0)} of 100`}>
      <span className="hidden h-1 w-14 overflow-hidden rounded-full bg-raised sm:block" aria-hidden="true">
        <span className="block h-full rounded-full bg-ink-3" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </span>
      <span className="num w-7 text-right text-ink-2">{value.toFixed(0)}</span>
    </span>
  );
}
