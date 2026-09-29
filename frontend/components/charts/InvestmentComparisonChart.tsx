"use client";

import { useState, useRef, useEffect } from "react";
import { EChart } from "@/components/charts/EChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  const benchmarkLabel = `${benchmarkName} Equivalent`;

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Investment Returns Comparison</CardTitle></CardHeader>
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
          backgroundColor: "#1c1c25",
          borderColor: "#282834",
          textStyle: { color: "#ececf3", fontSize: 12 },
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
          data: ["Cumulative Dividends", "Your Portfolio", benchmarkLabel],
          textStyle: { color: "#80809a", fontSize: 12 },
          bottom: 0,
        },
        xAxis: {
          type: "category",
          data: data.data_points.map((d) => d.date),
          axisLabel: { fontSize: 10, color: "#80809a", interval: "auto", rotate: 30 },
          axisLine: { lineStyle: { color: "#282834" } },
          axisTick: { show: false },
        },
        yAxis: {
          type: "value",
          axisLabel: {
            formatter: (v: number) => formatCurrency(v),
            fontSize: 11,
            color: "#80809a",
          },
          splitLine: { lineStyle: { color: "#22222c", type: "dashed" } },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        series: [
          {
            name: "Cumulative Dividends",
            type: "line",
            smooth: true,
            data: data.data_points.map((d) => d.cumulative_divs),
            symbol: "none",
            lineStyle: { color: "#7abf50", width: 2 },
            itemStyle: { color: "#7abf50" },
            areaStyle: {
              color: {
                type: "linear", x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: "rgba(122,191,80,0.25)" },
                  { offset: 1, color: "rgba(122,191,80,0.02)" },
                ],
              },
            },
          },
          {
            name: "Your Portfolio",
            type: "line",
            smooth: true,
            data: data.data_points.map((d) => d.portfolio_value),
            symbol: "none",
            lineStyle: { color: "#b3b3e6", width: 2.5 },
            itemStyle: { color: "#b3b3e6" },
          },
          {
            name: benchmarkLabel,
            type: "line",
            smooth: true,
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
        <CardTitle className="flex flex-wrap items-center gap-4 justify-between">
          <span>Investment Returns vs {benchmarkName}</span>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm">
              <label className="text-muted-foreground text-xs">Benchmark</label>
              <select
                value={benchmarkOverride ?? ""}
                onChange={(e) => setBenchmarkOverride(e.target.value || undefined)}
                className="bg-muted text-foreground text-xs rounded px-2 py-1 border border-border"
              >
                <option value="">Auto</option>
                {BENCHMARK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-sm">
              <label className="text-muted-foreground text-xs">From</label>
              <select
                value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
                className="bg-muted text-foreground text-xs rounded px-2 py-1 border border-border"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-sm">
              <label className="text-muted-foreground text-xs">Shares</label>
              <input
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
                className="bg-muted text-foreground text-xs rounded px-2 py-1 border border-border w-20 text-right"
              />
            </div>

            {data && (
              <span className="text-xs text-muted-foreground">
                Initial: {sym}{data.initial_investment.toLocaleString()}
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {dataLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : error ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
            Could not load comparison data for {ticker} from {startYear}
          </div>
        ) : !option ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
            No data available for {ticker} from {startYear}
          </div>
        ) : (
          <EChart option={option} style={{ height: 300 }} />
        )}
      </CardContent>

      {option && data && (
        <CardContent className="pt-0">
          <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
            <p className="font-medium text-foreground/80">How this comparison works</p>
            <p>
              The benchmark is the <span className="font-medium">{BENCHMARK_PRODUCTS[data.benchmark_ticker] ?? data.benchmark_name}</span>.
              Both portfolios start with the same initial investment — your selected number of shares × the stock
              price at the first dividend date in the chosen start year. The same dollar amount is hypothetically
              invested in the benchmark on that date.
            </p>
            <p>
              <span className="font-medium text-dial-hi">Your Portfolio</span> = current stock value + all
              dividends received. <span className="font-medium text-watch">{benchmarkLabel}</span> = benchmark
              value + dividends accumulated over the same period. Changing the number of shares scales
              both investments equally, so the relative performance comparison remains the same.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
