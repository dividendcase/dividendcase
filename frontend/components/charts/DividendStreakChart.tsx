"use client";

import { EChart } from "@/components/charts/EChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import type { DividendMetrics } from "@/lib/types";

interface Props {
  metrics: DividendMetrics;
}

const COLORS = {
  increase: "#7abf50",  // sprout
  flat: "#e3a33b",      // watch
  decrease: "#e5604f",  // cut
  noData: "#363645",    // gray
};

export function DividendStreakChart({ metrics }: Props) {
  const { annual_dividends, consecutive_growth_years } = metrics;
  if (!annual_dividends || Object.keys(annual_dividends).length < 2) return null;

  const years = Object.keys(annual_dividends)
    .map(Number)
    .sort((a, b) => a - b);

  // Build bars with color coding
  const barData = years.map((year, i) => {
    const amount = annual_dividends[String(year)];
    if (i === 0) {
      return { year, amount, color: COLORS.noData, label: "baseline" };
    }
    const prevAmount = annual_dividends[String(years[i - 1])];
    if (!prevAmount || prevAmount === 0) {
      return { year, amount, color: COLORS.noData, label: "no prior data" };
    }
    const change = ((amount - prevAmount) / prevAmount) * 100;
    if (change > 2) {
      return { year, amount, color: COLORS.increase, label: `+${change.toFixed(1)}%` };
    } else if (change < -2) {
      return { year, amount, color: COLORS.decrease, label: `${change.toFixed(1)}%` };
    } else {
      return { year, amount, color: COLORS.flat, label: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%` };
    }
  });

  const sym = metrics.currency
    ? ({ USD: "$", CAD: "C$", GBP: "£", EUR: "€", AUD: "A$", INR: "₹", JPY: "¥", HKD: "HK$" }[metrics.currency] ?? metrics.currency + " ")
    : "$";

  const option = {
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1c1c25",
      borderColor: "#282834",
      textStyle: { color: "#ececf3", fontSize: 12 },
      formatter: (params: { name: string; value: number; dataIndex: number }[]) => {
        const p = params[0];
        const item = barData[p.dataIndex];
        return `<b>${p.name}</b><br/>Dividend/Share: ${sym}${item.amount.toFixed(4)}<br/>YoY: ${item.label}`;
      },
    },
    grid: { top: 16, right: 16, bottom: 32, left: 48, containLabel: true },
    xAxis: {
      type: "category",
      data: barData.map((d) => String(d.year)),
      axisLabel: { fontSize: 10, color: "#80809a", interval: 0, rotate: years.length > 12 ? 45 : 0 },
      axisLine: { lineStyle: { color: "#282834" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        fontSize: 10,
        color: "#80809a",
        formatter: (v: number) => `${sym}${v.toFixed(2)}`,
      },
      splitLine: { lineStyle: { color: "#22222c", type: "dashed" } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: barData.map((d) => ({
          value: d.amount,
          itemStyle: { color: d.color },
        })),
        barMaxWidth: 32,
      },
    ],
  };

  const streakYears = consecutive_growth_years ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">
            Dividend History by Year
            {metrics.ticker_symbol && (
              <span className="ml-2 text-sm font-mono text-muted-foreground">({metrics.ticker_symbol})</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {streakYears > 0 && (
              <div className="flex items-center gap-1.5">
                <Trophy className={`w-4 h-4 ${
                  streakYears >= 25 ? "text-watch" : streakYears >= 10 ? "text-money" : "text-muted-foreground"
                }`} />
                <span className="text-sm font-medium text-foreground">{streakYears}yr streak</span>
              </div>
            )}
            {streakYears >= 50 && <Badge variant="green">Dividend King</Badge>}
            {streakYears >= 25 && streakYears < 50 && <Badge variant="green">Dividend Aristocrat</Badge>}
            {streakYears >= 10 && streakYears < 25 && <Badge variant="outline">Dividend Achiever</Badge>}
          </div>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.increase }} /> Increase</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.flat }} /> Flat (&#177;2%)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.decrease }} /> Decrease</span>
        </div>
      </CardHeader>
      <CardContent>
        <EChart option={option} style={{ height: 220 }} />
      </CardContent>
    </Card>
  );
}
