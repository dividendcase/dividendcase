"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Clock, GitCompareArrows, Search, SearchX } from "lucide-react";
import { MetricsPanel } from "@/components/dashboard/MetricsPanel";
import { CompanyInfoCard } from "@/components/dashboard/CompanyInfoCard";
import { WatchlistButton } from "@/components/dashboard/WatchlistButton";
import { DividendYieldTimeline } from "@/components/charts/DividendYieldTimeline";
import { DividendPriceChart } from "@/components/charts/DividendPriceChart";
import { InvestmentComparisonChart } from "@/components/charts/InvestmentComparisonChart";
import { DividendStreakChart } from "@/components/charts/DividendStreakChart";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppActions } from "@/components/layout/AppActions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TickerBadge } from "@/components/ui/ticker-badge";
import { useStockData } from "@/lib/hooks/useStockData";

const YEARS = [
  { value: 3 as const, label: "3Y" },
  { value: 5 as const, label: "5Y" },
  { value: 10 as const, label: "10Y" },
];

function StockContent() {
  const router = useRouter();
  const ticker = (useSearchParams().get("t") ?? "").trim().toUpperCase() || null;
  const [years, setYears] = useState<3 | 5 | 10>(10);
  const { data, isLoading, error } = useStockData(ticker, years);
  const { openCommand } = useAppActions();

  if (!ticker) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stock" />
        <EmptyState
          icon={<Search />}
          title="Pick a stock to analyse"
          description="Search any stock or ETF by ticker or name, or browse the screener."
          action={
            <>
              <Button onClick={openCommand}><Search className="size-4" />Search</Button>
              <Button variant="outline" asChild><Link href="/dashboard/screener/">Open the screener</Link></Button>
            </>
          }
        />
      </div>
    );
  }

  const back = (
    <button
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/dashboard/screener/"))}
      className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 transition-colors hover:text-ink"
    >
      <ArrowLeft className="size-3.5" />
      Back
    </button>
  );

  if (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const rateLimited = msg.includes("503") || msg.toLowerCase().includes("rate");
    const noDividends = msg.includes("404") || msg.includes("not pay dividends");
    return (
      <div className="space-y-6">
        {back}
        <PageHeader title={<span className="num">{ticker}</span>} />
        <EmptyState
          icon={rateLimited ? <Clock /> : noDividends ? <SearchX /> : <AlertTriangle />}
          title={
            rateLimited
              ? "Yahoo Finance asked us to slow down"
              : noDividends
                ? `No dividend history for ${ticker}`
                : `Couldn't load ${ticker}`
          }
          description={
            rateLimited
              ? "The app is waiting before it asks again. Try this stock in a few minutes, or open one that is already stored."
              : noDividends
                ? "This stock may not pay dividends, or the ticker may need a market suffix such as .TO, .L, .NS or .AX."
                : msg
          }
          action={<Button variant="outline" onClick={openCommand}><Search className="size-4" />Search again</Button>}
        />
      </div>
    );
  }

  const records = data?.records ?? [];
  const minYear = records.length > 0 ? new Date(records[0].dividend_date).getFullYear() : new Date().getFullYear() - 10;

  return (
    <div className="space-y-6">
      {back}
      <PageHeader
        eyebrow={
          data ? (
            <span className="flex items-center gap-2">
              <span className="num text-ink-2">{data.ticker_symbol}</span>
              <span>·</span>
              <span>{data.exchange}</span>
              <span>·</span>
              <span>{data.currency}</span>
            </span>
          ) : (
            <span className="num">{ticker}</span>
          )
        }
        title={
          data ? (
            <span className="flex items-center gap-3">
              <TickerBadge ticker={data.ticker_symbol} className="hidden h-9 w-11 text-[11px] sm:inline-flex" />
              <span className="min-w-0">{data.company_name}</span>
              {(data.metrics.ttm_yield ?? 0) >= 10 && <Badge variant="amber" title="Very high yields are often cut">High yield</Badge>}
            </span>
          ) : (
            <Skeleton className="h-8 w-64" />
          )
        }
        actions={
          <>
            {data && <WatchlistButton ticker={data.ticker_symbol} />}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/compare/?tickers=${encodeURIComponent(ticker)}`}>
                <GitCompareArrows className="size-4" />
                Compare
              </Link>
            </Button>
            <Segmented value={years} onChange={setYears} options={YEARS} aria-label="History length" />
          </>
        }
      />

      <MetricsPanel metrics={data?.metrics ?? null} isLoading={isLoading} />

      <CompanyInfoCard data={data} isLoading={isLoading} />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <DividendYieldTimeline records={records} ticker={ticker} isLoading={isLoading} years={years} />
        <DividendPriceChart records={records} currency={data?.currency ?? "USD"} ticker={ticker} isLoading={isLoading} />
      </div>

      {data?.metrics && <DividendStreakChart metrics={data.metrics} />}

      <InvestmentComparisonChart ticker={ticker} currency={data?.currency ?? "USD"} minYear={minYear} isLoading={isLoading} />

      <p className="text-center text-[12px] text-ink-3">
        Past dividends don&apos;t guarantee future payments. For information only, not investment advice.
      </p>
    </div>
  );
}

export default function StockPage() {
  return (
    <Suspense>
      <StockContent />
    </Suspense>
  );
}
