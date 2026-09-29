"use client";

import { EChart } from "@/components/charts/EChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DividendRecord } from "@/lib/types";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", CAD: "C$", GBP: "£", EUR: "€",
  AUD: "A$", INR: "₹", JPY: "¥", HKD: "HK$",
};

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
        <CardHeader><CardTitle>Dividend Amount &amp; Price</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  const sym = CURRENCY_SYMBOLS[currency] ?? currency + " ";

  const data = records
    .filter((r) => r.dividend_per_share != null && r.dividend_per_share > 0)
    .map((r) => ({
      date: new Date(r.dividend_date).toLocaleDateString("en-US", { year: "numeric", month: "short" }),
      dividend: parseFloat(Number(r.dividend_per_share).toFixed(4)),
      price: r.share_price_on_dividend_date
        ? parseFloat(Number(r.share_price_on_dividend_date).toFixed(2))
        : null,
    }));

  const option = {
    backgroundColor: "transparent",
    grid: { top: 24, right: 60, bottom: 40, left: 60, containLabel: false },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross", crossStyle: { color: "rgba(255,255,255,0.2)" } },
      backgroundColor: "#1c1c25",
      borderColor: "#282834",
      textStyle: { color: "#ececf3", fontSize: 12 },
      formatter: (params: { seriesName: string; value: number | null; color: string; dataIndex: number }[]) => {
        if (!params?.length) return "";
        const date = data[params[0]?.dataIndex ?? 0]?.date ?? "";
        let html = `<div style="font-weight:500;margin-bottom:4px">${date}</div>`;
        for (const p of params) {
          if (p.value == null) continue;
          const decimals = p.seriesName === "Stock Price" ? 2 : 4;
          html += `<div style="color:${p.color}">${p.seriesName}: ${sym}${Number(p.value).toFixed(decimals)}</div>`;
        }
        return html;
      },
    },
    legend: {
      data: ["Dividend/Share", "Stock Price"],
      textStyle: { color: "#80809a", fontSize: 12 },
      bottom: 0,
    },
    xAxis: {
      type: "category",
      data: data.map((d) => d.date),
      axisLabel: { fontSize: 11, color: "#80809a", interval: "auto" },
      axisLine: { lineStyle: { color: "#282834" } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: "value",
        name: `Div (${sym})`,
        nameTextStyle: { color: "#80809a", fontSize: 10 },
        axisLabel: { formatter: `${sym}{value}`, fontSize: 11, color: "#80809a" },
        splitLine: { lineStyle: { color: "#22222c", type: "dashed" } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      {
        type: "value",
        name: `Price (${sym})`,
        nameTextStyle: { color: "#80809a", fontSize: 10 },
        position: "right",
        axisLabel: { formatter: `${sym}{value}`, fontSize: 11, color: "#80809a" },
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
      },
    ],
    series: [
      {
        name: "Dividend/Share",
        type: "bar",
        yAxisIndex: 0,
        data: data.map((d) => d.dividend),
        itemStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(122,191,80,0.9)" },
              { offset: 1, color: "rgba(122,191,80,0.4)" },
            ],
          },
          borderRadius: [3, 3, 0, 0],
        },
        barMaxWidth: 16,
      },
      {
        name: "Stock Price",
        type: "line",
        yAxisIndex: 1,
        data: data.map((d) => d.price),
        smooth: true,
        symbol: "none",
        lineStyle: { color: "#b3b3e6", width: 2 },
        itemStyle: { color: "#b3b3e6" },
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
          <span>Dividend Amount &amp; Stock Price</span>
          <span className="text-sm font-normal text-muted-foreground">
            {CURRENCY_SYMBOLS[currency] ?? currency}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            No dividend amount data for {ticker}
          </div>
        ) : (
          <EChart option={option} style={{ height: 280 }} />
        )}
      </CardContent>
    </Card>
  );
}
