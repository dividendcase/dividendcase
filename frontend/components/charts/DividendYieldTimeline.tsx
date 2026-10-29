"use client";

import { EChart } from "@/components/charts/EChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { chartColors } from "@/lib/chartTheme";
import type { DividendRecord } from "@/lib/types";

interface Props {
  records: DividendRecord[];
  ticker: string;
  years: number;
  /** Each payment's yield is scaled to a year, so the line is comparable with the TTM yield */
  paymentsPerYear: number;
  isLoading: boolean;
}

export function DividendYieldTimeline({ records, ticker, years, paymentsPerYear, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Yield over time</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  const data = records
    .filter((r) => r.dividend_yield_pct != null)
    .map((r) => ({
      date: new Date(`${r.dividend_date}T00:00:00`).toLocaleDateString("en-GB", { year: "numeric", month: "short" }),
      yield: Number(((r.dividend_yield_pct ?? 0) * paymentsPerYear).toFixed(2)),
    }));

  const avgYield = data.length ? Number((data.reduce((s, d) => s + d.yield, 0) / data.length).toFixed(2)) : 0;

  const option = {
    grid: { top: 24, right: 16, bottom: 8, left: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      formatter: (params: { name: string; value: number }[]) => {
        if (!params?.length) return "";
        const p = params[0];
        return `<div style="margin-bottom:4px">${p.name}</div><span style="color:${chartColors.sproutHi}">${p.value?.toFixed(2)}% a year</span>`;
      },
    },
    xAxis: { type: "category", data: data.map((d) => d.date), axisLabel: { interval: "auto" } },
    yAxis: { type: "value", scale: true, axisLabel: { formatter: "{value}%" } },
    series: [
      {
        name: "Yield",
        type: "line",
        data: data.map((d) => d.yield),
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { color: chartColors.sprout, width: 2 },
        itemStyle: { color: chartColors.sprout },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: chartColors.ink3, type: "dashed", width: 1 },
          label: { formatter: `Average ${avgYield}%`, color: chartColors.ink2, fontSize: 11, position: "insideEndTop" },
          data: [{ yAxis: avgYield }],
        },
      },
    ],
    dataZoom: [{ type: "inside", start: 0, end: 100 }],
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle>Yield over time</CardTitle>
          <span className="text-[12.5px] text-ink-3">
            <span className="num">{data.length}</span> payments in {years} years
          </span>
        </div>
        <p className="text-[12.5px] text-ink-3">
          Each payment times {paymentsPerYear} a year, over the price that day. Above the average line, the stock was cheaper
          for its dividend than usual.
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-[13px] text-ink-3">No yields on record for {ticker}.</div>
        ) : (
          <EChart option={option} style={{ height: 260 }} />
        )}
      </CardContent>
    </Card>
  );
}
