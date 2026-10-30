"use client";

import { useState, useRef, useEffect } from "react";
import { EChart } from "@/components/charts/EChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { chartColors } from "@/lib/chartTheme";
import { useInvestmentComparison } from "@/lib/hooks/useInvestmentComparison";
import { useUserPreferences } from "@/lib/hooks/useUserPreferences";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", CAD: "C$", GBP: "£", EUR: "€",
  AUD: "A$", INR: "₹", JPY: "¥", HKD: "HK$",
};

/** Full product description for each benchmark ticker */
const BENCHMARK_PRODUCTS: Record<string, string> = {
  "SPY":    "SPDR S&P 500 ETF Trust (SPY)",
  "^NSEI":  "Nifty 50 Index (^NSEI)",
  "XIU.TO": "iShares S&P/TSX 60 Index ETF (XIU.TO)",
  "ISF.L":  "iShares Core FTSE 100 UCITS ETF (ISF.L)",
  "STW.AX": "SPDR S&P/ASX 200 Fund (STW.AX)",
};

/** Maps user preference key → API benchmark ticker */
const PREF_TO_TICKER: Record<string, string> = {
  SP500:   "SPY",
  FTSE100: "ISF.L",
  NIFTY50: "^NSEI",
  ASX200:  "STW.AX",
  TSX60:   "XIU.TO",
};

const BENCHMARK_OPTIONS = [
  { value: "SPY",    label: "S&P 500 (SPY)" },
  { value: "ISF.L",  label: "FTSE 100 (ISF.L)" },
  { value: "^NSEI",  label: "Nifty 50 (^NSEI)" },
  { value: "STW.AX", label: "ASX 200 (STW.AX)" },
  { value: "XIU.TO", label: "TSX 60 (XIU.TO)" },
];

interface Props {
  ticker: string;
  currency: string;
  /** Earliest year for which data is available (derived from records). */
  minYear: number;
  isLoading: boolean;
}

export function InvestmentComparisonChart({ ticker, currency, minYear, isLoading }: Props) {
  const currentYear = new Date().getFullYear();
  const defaultYear = Math.max(minYear, currentYear - 10);

  const [startYear, setStartYear] = useState(defaultYear);
  const [shares, setShares] = useState(100);
  const [sharesInput, setSharesInput] = useState("100");
  // undefined = let backend auto-select by exchange; a ticker value = user override
  const [benchmarkOverride, setBenchmarkOverride] = useState<string | undefined>(undefined);
  const benchmarkInitialized = useRef(false);

  const { preferences, isLoading: prefsLoading } = useUserPreferences();

  // Apply the default_benchmark preference once preferences have loaded
  useEffect(() => {
    if (benchmarkInitialized.current || prefsLoading) return;
    benchmarkInitialized.current = true;
    const ticker = PREF_TO_TICKER[preferences.default_benchmark];
    if (ticker) setBenchmarkOverride(ticker);
  }, [preferences.default_benchmark, prefsLoading]);

  const { data, isLoading: dataLoading, error } = useInvestmentComparison(
    ticker,
    startYear,
    shares,
    benchmarkOverride,
  );

  const sym = CURRENCY_SYMBOLS[currency] ?? currency + " ";
  const benchmarkName = data?.benchmark_name ?? "Benchmark";
  const benchmarkLabel = `${benchmarkName}, with dividends`;
  const stockLabel = `${ticker}, with dividends`;

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Total return against the index</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-72 w-full" /></CardContent>
      </Card>
    );
  }

  const years = Array.from(
    { length: currentYear - minYear },
    (_, i) => minYear + i,
  );

  const formatCurrency = (v: number) =>
    `${sym}${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0)}`;

  const option = data?.data_points?.length
    ? {
        backgroundColor: "transparent",
        grid: { top: 32, right: 24, bottom: 56, left: 64 },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "cross", crossStyle: { color: "rgba(255,255,255,0.15)" } },
          formatter: (params: { seriesName: string; value: number; color: string; name: string }[]) => {
            if (!params?.length) return "";
            let html = `<div style="font-weight:500;margin-bottom:4px">${params[0]?.name ?? ""}</div>`;
            for (const p of params) {
              html += `<div style="color:${p.color}">${p.seriesName}: ${sym}${Number(p.value).toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>`;
            }
            return html;
          },
        },
        legend: {
          data: [stockLabel, benchmarkLabel, "Dividends received"],
          bottom: 0,
        },
        xAxis: {
          type: "category",
          data: data.data_points.map((d) => d.date),
          axisLabel: { interval: "auto", rotate: 30 },
          axisTick: { show: false },
        },
        yAxis: {
          type: "value",
          axisLabel: {
            formatter: (v: number) => formatCurrency(v),
          },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        series: [
          {
            name: "Dividends received",
            type: "line",
            data: data.data_points.map((d) => d.cumulative_divs),
            symbol: "none",
            lineStyle: { color: chartColors.sprout, width: 1.5 },
            itemStyle: { color: chartColors.sprout },
            areaStyle: { color: "rgba(122,191,80,0.08)" },
          },
          {
            name: stockLabel,
            type: "line",
            data: data.data_points.map((d) => d.portfolio_value),
            symbol: "none",
            lineStyle: { color: chartColors.ink, width: 2 },
            itemStyle: { color: chartColors.ink },
          },
          {
            name: benchmarkLabel,
            type: "line",
            data: data.data_points.map((d) => d.benchmark_value),
            symbol: "none",
            lineStyle: { color: "#a9a9bd", width: 2, type: "dashed" },
            itemStyle: { color: "#a9a9bd" },
          },
        ],
        dataZoom: [{ type: "inside" }],
      }
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Total return against {benchmarkName}</CardTitle>
          <div className="flex flex-wrap items-center gap-2.5 text-[12.5px] text-ink-3">
            <label className="flex items-center gap-1.5">
              Index
              <Select value={benchmarkOverride ?? "auto"} onValueChange={(v) => setBenchmarkOverride(v === "auto" ? undefined : v)}>
                <SelectTrigger className="h-8 w-auto min-w-36 text-[12.5px]" aria-label="Index">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">The stock&apos;s own market</SelectItem>
                  {BENCHMARK_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex items-center gap-1.5">
              From
              <Select value={String(startYear)} onValueChange={(v) => setStartYear(Number(v))}>
                <SelectTrigger className="h-8 w-auto min-w-20 text-[12.5px]" aria-label="Start year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex items-center gap-1.5">
              Shares
              <Input
                type="number"
                min={1}
                max={100000}
                value={sharesInput}
                onChange={(e) => setSharesInput(e.target.value)}
                onBlur={() => {
                  const n = Math.max(1, Math.min(100000, Number(sharesInput) || 100));
                  setShares(n);
                  setSharesInput(String(n));
                }}
                className="num h-8 w-20 text-right text-[12.5px]"
              />
            </label>
            {data && (
              <span>
                Starting with <span className="num text-ink-2">{sym}{data.initial_investment.toLocaleString()}</span>
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {dataLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : error ? (
          <div className="flex h-72 items-center justify-center text-[13px] text-ink-3">
            Couldn&apos;t load the comparison for {ticker} from {startYear}. The index history may still be downloading.
          </div>
        ) : !option ? (
          <div className="flex h-72 items-center justify-center text-[13px] text-ink-3">
            No price history for {ticker} from {startYear}. Try a later year.
          </div>
        ) : (
          <EChart option={option} style={{ height: 300 }} />
        )}
      </CardContent>

      {option && data && (
        <CardContent className="pt-0">
          <div className="space-y-1.5 border-t border-white/[0.06] pt-3 text-[12px] leading-relaxed text-ink-3">
            <p className="font-medium text-ink-2">How this comparison works</p>
            <p>
              Both lines start with the same amount: your number of shares times the price on the first dividend date of
              the start year. The same amount goes into the{" "}
              {BENCHMARK_PRODUCTS[data.benchmark_ticker] ?? data.benchmark_name} on that day. Each line is the holding&apos;s
              value plus every dividend it paid since, not reinvested. Changing the number of shares scales both lines
              together, so the comparison stays the same.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
