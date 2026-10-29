"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { EChart } from "@/components/charts/EChart";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { usePriceHistory } from "@/lib/hooks/usePriceHistory";
import { aggregate, autoInterval, lastMonths, type Dividend } from "@/lib/indicators";
import {
  CHART_TYPES, DOWN, RANGES, UP, apiErrorDetail, barTooltip, dateLabel, priceSeries, rangeLabel, volumeSeries,
  type ChartType,
} from "@/lib/priceChart";
import { chartColors } from "@/lib/chartTheme";
import { formatMoney, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  ticker: string;
  /** Ex-dividend dates to mark under the price */
  dividends?: Dividend[];
  height?: number;
  /** Shown on the right of the summary line, such as links to the stock's other pages */
  actions?: React.ReactNode;
  className?: string;
}

/** A stock's price as a line, area, candles or OHLC bars, with its volume, over a chosen range. */
export function PriceChart({ ticker, dividends, height = 300, actions, className }: Props) {
  const { data, error, isLoading } = usePriceHistory(ticker);
  const [type, setType] = useState<ChartType>("line");
  const [months, setMonths] = useState(12);

  const view = useMemo(() => {
    if (!data?.bars.length) return null;
    const interval = autoInterval(months);
    const bars = aggregate(lastMonths(data.bars, months), interval);
    const first = bars[0];
    const last = bars[bars.length - 1];
    const change = (last.close / first.close - 1) * 100;
    return { interval, bars, last, change };
  }, [data, months]);

  const option = useMemo(() => {
    if (!view || !data) return null;
    const { bars, interval, change } = view;
    const color = change >= 0 ? UP : DOWN;
    const dates = bars.map((b) => b.date);
    // Dividends whose ex-date falls inside the range, placed on the bar that opened ex-dividend
    const marks = (dividends ?? [])
      .map((d) => ({ d, i: bars.findIndex((b) => b.date >= d.date) }))
      .filter(({ d, i }) => i >= 0 && d.date >= bars[0].date)
      .map(({ d, i }) => ({ value: [i, 0], amount: d.amount, date: d.date }));
    return {
      animation: false,
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      grid: [
        { left: 8, right: 56, top: 12, height: "66%" },
        { left: 8, right: 56, top: "78%", bottom: 22 },
      ],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: (params: { dataIndex: number; seriesName: string }[]) => {
          // The dividend marks are numbered by mark, not by bar: read the bar from the other series
          const p = params.find((x) => x.seriesName !== "Dividend");
          if (!p) return "";
          const mark = params.find((x) => x.seriesName === "Dividend");
          const div = mark ? marks.find((m) => m.value[0] === p.dataIndex) : undefined;
          return (
            barTooltip(bars[p.dataIndex], data.currency, interval) +
            (div ? `<div style="margin-top:4px;color:${chartColors.sproutHi}">Went ex-dividend ${formatMoney(div.amount, data.currency, { decimals: 4 })}</div>` : "")
          );
        },
      },
      xAxis: [
        // Both axes leave half a bar at the ends, so the price lines up with the volume bars under it
        { type: "category", data: dates, boundaryGap: true, axisLabel: { show: false }, axisLine: { show: false } },
        {
          type: "category",
          gridIndex: 1,
          data: dates,
          boundaryGap: true,
          axisLabel: { formatter: (v: string) => dateLabel(v, interval, months > 12) },
          axisLine: { lineStyle: { color: chartColors.line } },
        },
      ],
      yAxis: [
        {
          type: "value",
          scale: true,
          position: "right",
          axisLabel: { formatter: (v: number) => formatMoney(v, data.currency, { decimals: v >= 1000 ? 0 : 2 }) },
        },
        { type: "value", gridIndex: 1, position: "right", axisLabel: { show: false }, splitLine: { show: false } },
        { type: "value", gridIndex: 1, show: false, min: 0, max: 1 },
      ],
      series: [
        priceSeries(type, bars, { color }),
        volumeSeries(bars, { xAxisIndex: 1, yAxisIndex: 1 }),
        ...(marks.length
          ? [{
              name: "Dividend",
              type: "scatter",
              xAxisIndex: 1,
              yAxisIndex: 2,
              data: marks.map((m) => [m.value[0], 0.92]),
              symbol: "circle",
              symbolSize: 6,
              itemStyle: { color: chartColors.sproutHi, borderColor: chartColors.ground, borderWidth: 1 },
              z: 5,
            }]
          : []),
      ],
    };
  }, [view, data, type, dividends, months]);

  const detail = apiErrorDetail(error);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {view && data ? (
            <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="num text-[22px] font-medium tracking-[-0.03em] text-ink">
                {formatMoney(view.last.close, data.currency, { decimals: 2 })}
              </span>
              <span className={cn("num text-[13px]", view.change >= 0 ? "text-money" : "text-cut")}>
                <span aria-hidden="true">{view.change >= 0 ? "▲" : "▼"}</span> {view.change >= 0 ? "+" : "−"}
                {Math.abs(view.change).toFixed(2)}%
              </span>
              <span className="text-[12.5px] text-ink-3">over {rangeLabel(months)}</span>
            </p>
          ) : isLoading ? (
            <Skeleton className="h-7 w-48" />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={type} onChange={setType} options={CHART_TYPES} aria-label="Chart type" />
          <Segmented value={months} onChange={setMonths} options={RANGES} aria-label="Range" />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="w-full rounded-xl" style={{ height }} />
      ) : detail ? (
        <div className="flex items-center justify-center gap-2 rounded-xl text-center text-[13px] text-ink-3" style={{ height }}>
          <AlertTriangle className="size-4 shrink-0 text-watch" aria-hidden="true" />
          {detail}
        </div>
      ) : option ? (
        <EChart option={option} opts={{ renderer: "canvas" }} style={{ height }} />
      ) : (
        <div className="flex items-center justify-center text-[13px] text-ink-3" style={{ height }}>
          No prices stored for {ticker}.
        </div>
      )}

      {(data?.stale || actions || (dividends?.length ?? 0) > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[12px] text-ink-3">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {(dividends?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-sprout-hi" aria-hidden="true" />
                Ex-dividend dates
              </span>
            )}
            {data?.stale && (
              <span className="text-watch">
                ▲ Yahoo Finance didn&apos;t answer, so these prices are from {timeAgo(data.fetched_at)}.
              </span>
            )}
          </span>
          {actions && <span className="flex flex-wrap items-center gap-2">{actions}</span>}
        </div>
      )}
    </div>
  );
}
