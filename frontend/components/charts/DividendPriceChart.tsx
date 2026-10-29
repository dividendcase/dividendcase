"use client";

import { EChart } from "@/components/charts/EChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { chartColors } from "@/lib/chartTheme";
import { currencyLabel, formatMoney } from "@/lib/format";
import type { DividendRecord } from "@/lib/types";

interface Props {
  records: DividendRecord[];
  currency: string;
  ticker: string;
  isLoading: boolean;
}

export function DividendPriceChart({ records, currency, ticker, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Dividend and price</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  const data = records
    .filter((r) => r.dividend_per_share != null && r.dividend_per_share > 0)
    .map((r) => ({
      date: new Date(`${r.dividend_date}T00:00:00`).toLocaleDateString("en-GB", { year: "numeric", month: "short" }),
      dividend: Number(r.dividend_per_share),
      price: r.share_price_on_dividend_date != null ? Number(r.share_price_on_dividend_date) : null,
    }));

  const option = {
    grid: { top: 28, right: 8, bottom: 32, left: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      formatter: (params: { seriesName: string; value: number | null; color: string; dataIndex: number }[]) => {
        if (!params?.length) return "";
        let html = `<div style="margin-bottom:4px">${data[params[0].dataIndex]?.date ?? ""}</div>`;
        for (const p of params) {
          if (p.value == null) continue;
          const decimals = p.seriesName === "Price" ? 2 : 4;
          html += `<div style="color:${p.color}">${p.seriesName}: ${formatMoney(Number(p.value), currency, { decimals })}</div>`;
        }
        return html;
      },
    },
    legend: { data: ["Dividend per share", "Price"], bottom: 0 },
    xAxis: { type: "category", data: data.map((d) => d.date), axisLabel: { interval: "auto" } },
    yAxis: [
      { type: "value", name: "Dividend", axisLabel: { formatter: (v: number) => formatMoney(v, currency, { decimals: 2 }) } },
      {
        type: "value",
        name: "Price",
        scale: true,
        axisLabel: { formatter: (v: number) => formatMoney(v, currency, { decimals: 0 }) },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Dividend per share",
        type: "bar",
        yAxisIndex: 0,
        data: data.map((d) => d.dividend),
        itemStyle: { color: chartColors.leaf, borderRadius: [3, 3, 0, 0] },
        emphasis: { itemStyle: { color: chartColors.sprout } },
        barMaxWidth: 14,
      },
      {
        name: "Price",
        type: "line",
        yAxisIndex: 1,
        data: data.map((d) => d.price),
        symbol: "none",
        lineStyle: { color: chartColors.ink2, width: 1.75 },
        itemStyle: { color: chartColors.ink2 },
      },
    ],
    dataZoom: [{ type: "inside", start: 0, end: 100 }],
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle>Dividend and price</CardTitle>
          <span className="text-[12.5px] text-ink-3">In {currencyLabel(currency)}</span>
        </div>
        <p className="text-[12.5px] text-ink-3">Each payment, with the share price on the day it went ex-dividend.</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-[13px] text-ink-3">No dividend amounts on record for {ticker}.</div>
        ) : (
          <EChart option={option} style={{ height: 260 }} />
        )}
      </CardContent>
    </Card>
  );
}
