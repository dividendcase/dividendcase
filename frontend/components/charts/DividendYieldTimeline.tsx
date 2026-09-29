"use client";

import { EChart } from "@/components/charts/EChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DividendRecord } from "@/lib/types";

interface Props {
  records: DividendRecord[];
  ticker: string;
  years: number;
  isLoading: boolean;
}

export function DividendYieldTimeline({ records, ticker, years, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Dividend Yield Timeline</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  const data = records
    .filter((r) => r.dividend_yield_pct != null)
    .map((r) => ({
      date: new Date(r.dividend_date).toLocaleDateString("en-US", { year: "numeric", month: "short" }),
      yield: parseFloat((r.dividend_yield_pct ?? 0).toFixed(2)),
    }));

  const avgYield = data.length
    ? parseFloat((data.reduce((s, d) => s + d.yield, 0) / data.length).toFixed(2))
    : 0;

  const option = {
    backgroundColor: "transparent",
    grid: { top: 24, right: 16, bottom: 40, left: 48, containLabel: false },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross", crossStyle: { color: "rgba(255,255,255,0.2)" } },
      backgroundColor: "#1c1c25",
      borderColor: "#282834",
      textStyle: { color: "#ececf3", fontSize: 12 },
      formatter: (params: { name: string; value: number }[]) => {
        if (!params?.length) return "";
        const p = params[0];
        return `<div style="font-weight:500;margin-bottom:4px">${p.name}</div>
                <span style="color:#7abf50">Yield: ${p.value?.toFixed(2)}%</span>`;
      },
    },
    xAxis: {
      type: "category",
      data: data.map((d) => d.date),
      axisLabel: { fontSize: 11, color: "#80809a", interval: "auto" },
      axisLine: { lineStyle: { color: "#282834" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { formatter: "{value}%", fontSize: 11, color: "#80809a" },
      splitLine: { lineStyle: { color: "#22222c", type: "dashed" } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: "Dividend Yield %",
        type: "line",
        smooth: true,
        data: data.map((d) => d.yield),
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: "#7abf50", width: 2.5 },
        itemStyle: { color: "#7abf50" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(122,191,80,0.25)" },
              { offset: 1, color: "rgba(122,191,80,0.02)" },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: "#a9a9bd", type: "dashed", width: 1.5 },
          label: {
            formatter: `Avg ${avgYield}%`,
            color: "#a9a9bd",
            fontSize: 11,
            position: "insideEndTop",
          },
          data: [{ yAxis: avgYield }],
        },
      },
    ],
    dataZoom: [
      { type: "inside", start: 0, end: 100 },
    ],
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Dividend Yield Timeline</span>
          <span className="text-sm font-normal text-muted-foreground">
            Last {years} years · {data.length} payments
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            No yield data available for {ticker}
          </div>
        ) : (
          <EChart option={option} style={{ height: 280 }} />
        )}
      </CardContent>
    </Card>
  );
}
