"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { EChart } from "@/components/charts/EChart";
import { categorical, chartColors } from "@/lib/chartTheme";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { currencyLabel, formatMoney } from "@/lib/format";
import type { PortfolioAnalysisResponse } from "@/lib/types";

interface Props {
  data: PortfolioAnalysisResponse | null;
  isLoading: boolean;
  exchangeFilter?: string | null;
  exchangeMap?: Record<string, string>;
  currencyMap?: Record<string, string>;
}

type View = "benchmark" | "value" | "dividends";

/** Short axis labels: 1.2M, 34k, 950 */
function compactMoney(v: number, currency: string): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return formatMoney(v / 1_000_000, currency, { decimals: 1 }) + "M";
  if (abs >= 1000) return formatMoney(v / 1000, currency, { decimals: 0 }) + "k";
  return formatMoney(v, currency, { decimals: 0 });
}

type TooltipParam = { seriesName: string; value: number; color: string; name: string; marker: string };

function tooltip(currency: string, withTotal: boolean, currencyOf: (series: string) => string = () => currency) {
  return (params: TooltipParam[]) => {
    if (!params?.length) return "";
    const rows = [...params].sort((a, b) => Number(b.value) - Number(a.value));
    const total = rows.reduce((s, p) => s + Number(p.value || 0), 0);
    const row = (marker: string, label: string, value: number, cur: string, bold = false) =>
      `<div style="display:flex;justify-content:space-between;gap:16px;${bold ? "font-weight:600" : ""}">` +
      `<span>${marker}${label}</span><span style="font-variant-numeric:tabular-nums">${formatMoney(value, cur, { decimals: 0 })}</span></div>`;
    let html = `<div style="margin-bottom:4px;color:${chartColors.ink3}">${params[0].name}</div>`;
    if (withTotal) html += row("", "Total", total, currency, true);
    for (const p of rows) html += row(p.marker, p.seriesName, Number(p.value), currencyOf(p.seriesName));
    return html;
  };
}

export function PortfolioCharts({ data, isLoading, exchangeFilter, exchangeMap, currencyMap }: Props) {
  const [view, setView] = useState<View>("benchmark");

  const prepared = useMemo(() => {
    if (!data || data.data_points.length === 0) return null;
    const allTickers = Array.from(new Set(data.data_points.flatMap((d) => Object.keys(d.stock_values)))).sort();
    const tickers = exchangeFilter && exchangeMap ? allTickers.filter((t) => exchangeMap[t] === exchangeFilter) : allTickers;

    // Recompute totals when only some markets are shown
    const points = data.data_points.map((d) => {
      const sv: Record<string, number> = {};
      const sd: Record<string, number> = {};
      for (const t of tickers) {
        if (d.stock_values[t] != null) sv[t] = d.stock_values[t];
        if (d.stock_dividends[t] != null) sd[t] = d.stock_dividends[t];
      }
      const totalValue = Object.values(sv).reduce((a, b) => a + b, 0);
      const totalDivs = Object.values(sd).reduce((a, b) => a + b, 0);
      return {
        ...d,
        stock_values: sv,
        stock_dividends: sd,
        total_investment_value: exchangeFilter ? totalValue : d.total_investment_value,
        total_dividends: exchangeFilter ? totalDivs : d.total_dividends,
        total_portfolio_value: exchangeFilter ? totalValue + totalDivs : d.total_portfolio_value,
      };
    });
    // Converted data is all in one currency, apart from any the server had no rates for
    const currencies = data.converted
      ? []
      : currencyMap
        ? Array.from(new Set(tickers.map((t) => currencyMap[t]).filter(Boolean)))
        : [];
    return { tickers, points, currencies };
  }, [data, exchangeFilter, exchangeMap, currencyMap]);

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-1 h-3 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[320px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!prepared) return null;

  const { tickers, points, currencies } = prepared;
  const currency = data.currency;
  const converted = !!data.converted;
  const unconverted = converted ? (data.unconverted_currencies ?? []).map(currencyLabel) : [];
  const dates = points.map((d) => d.date);
  const colorOf = (i: number) => categorical[i % categorical.length];
  // Each stock's line is in its own currency, unless everything was converted
  const currencyOf = (series: string) => (converted ? currency : currencyMap?.[series] ?? currency);

  const base = {
    grid: { top: 16, right: 12, bottom: 8, left: 8, containLabel: true },
    xAxis: { type: "category" as const, data: dates, boundaryGap: false, axisLabel: { hideOverlap: true } },
    yAxis: { type: "value" as const, axisLabel: { formatter: (v: number) => compactMoney(v, currency) } },
    dataZoom: [{ type: "inside" as const }],
  };

  const benchmarkLabel = converted ? `Same money in ${data.benchmark_name}` : `${data.benchmark_name} equivalent`;
  const options: Record<View, Record<string, unknown>> = {
    benchmark: {
      ...base,
      tooltip: { trigger: "axis", formatter: tooltip(currency, false) },
      legend: { data: ["Your portfolio", benchmarkLabel], bottom: 0 },
      grid: { ...base.grid, bottom: 36 },
      series: [
        {
          name: "Your portfolio",
          type: "line",
          smooth: true,
          data: points.map((d) => d.total_portfolio_value),
          lineStyle: { color: chartColors.sprout, width: 2.5 },
          itemStyle: { color: chartColors.sprout },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(122,191,80,0.22)" },
                { offset: 1, color: "rgba(122,191,80,0.01)" },
              ],
            },
          },
        },
        {
          name: benchmarkLabel,
          type: "line",
          smooth: true,
          data: points.map((d) => d.benchmark_value),
          lineStyle: { color: chartColors.ink2, width: 1.75, type: "dashed" },
          itemStyle: { color: chartColors.ink2 },
        },
      ],
    },
    value: {
      ...base,
      tooltip: { trigger: "axis", formatter: tooltip(currency, false, currencyOf) },
      legend: { data: [...tickers, "Total"], bottom: 0, type: "scroll" },
      grid: { ...base.grid, bottom: 36 },
      series: [
        ...tickers.map((ticker, i) => ({
          name: ticker,
          type: "line",
          smooth: true,
          data: points.map((d) => d.stock_values[ticker] ?? 0),
          lineStyle: { color: colorOf(i), width: 1.5 },
          itemStyle: { color: colorOf(i) },
        })),
        {
          name: "Total",
          type: "line",
          smooth: true,
          data: points.map((d) => d.total_investment_value),
          lineStyle: { color: chartColors.ink, width: 2.5 },
          itemStyle: { color: chartColors.ink },
        },
      ],
    },
    dividends: {
      ...base,
      tooltip: { trigger: "axis", formatter: tooltip(currency, true, currencyOf) },
      legend: { data: tickers, bottom: 0, type: "scroll" },
      grid: { ...base.grid, bottom: 36 },
      series: tickers.map((ticker, i) => ({
        name: ticker,
        type: "line",
        smooth: true,
        stack: "dividends",
        data: points.map((d) => d.stock_dividends[ticker] ?? 0),
        lineStyle: { color: colorOf(i), width: 1.25 },
        itemStyle: { color: colorOf(i) },
        areaStyle: { color: colorOf(i), opacity: 0.18 },
      })),
    },
  };

  const descriptions: Record<View, React.ReactNode> = {
    benchmark: converted ? (
      <>
        What you hold plus the dividends it paid, against the same money put into the {data.benchmark_name} at the start of
        the year of your first purchase, with its dividends. Both lines are in{" "}
        <span className="font-mono">{currencyLabel(currency)}</span> at each date&apos;s exchange rate. Invested:{" "}
        <span className="num text-ink-2">{formatMoney(data.total_initial_investment, currency)}</span>.
      </>
    ) : (
      <>
        What you hold plus the dividends it paid, against the same total put into the {data.benchmark_name} at the start
        of the year of your first purchase, with its dividends. Invested:{" "}
        <span className="num text-ink-2">{formatMoney(data.total_initial_investment, currency)}</span>.
      </>
    ),
    value: converted
      ? `What each holding was worth over time, at the price on each dividend date, in ${currencyLabel(currency)}.`
      : "What each holding was worth over time, at the price on each dividend date.",
    dividends: converted
      ? "Dividends received since you bought, stacked by stock, each at the exchange rate on the day it was paid. The top edge is the running total."
      : "Dividends received since you bought, stacked by stock. The top edge is the running total.",
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle>Performance</CardTitle>
          <CardDescription className="max-w-xl leading-relaxed">{descriptions[view]}</CardDescription>
        </div>
        <Segmented
          aria-label="Chart"
          value={view}
          onChange={setView}
          options={[
            { value: "benchmark", label: `Vs ${data.benchmark_name}` },
            { value: "value", label: "Value" },
            { value: "dividends", label: "Dividends" },
          ]}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {currencies.length > 1 && (
          <p className="flex items-start gap-2 rounded-lg border border-watch/25 bg-watch/10 px-3 py-2 text-[12.5px] text-watch">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Totals add up amounts in different currencies (<span className="num">{currencies.join(", ")}</span>) without
              converting them. Each stock&apos;s own line is in its own currency.
            </span>
          </p>
        )}
        {unconverted.length > 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-watch/25 bg-watch/10 px-3 py-2 text-[12.5px] text-watch">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              No exchange rate for <span className="num">{unconverted.join(", ")}</span>, so those amounts are added in their
              own currency.
            </span>
          </p>
        )}
        <EChart option={options[view]} style={{ height: 340 }} />
      </CardContent>
    </Card>
  );
}
