"use client";

import { useMemo } from "react";
import { EChart } from "@/components/charts/EChart";
import { chartColors } from "@/lib/chartTheme";
import { formatMoney } from "@/lib/format";
import { monthLabel, type CurrencyIncome } from "@/lib/income";

// Biggest payers first: the brand's chart series (greens, then lavenders), then steel
const PAYER_COLORS = ["#8ccf5c", "#4a8c1a", "#b3b3e6", "#6d6db0", "#d0d0e0"];
const OTHER_COLOR = "#45455a";
const TOP = 5;

/** Next twelve months of income, stacked by the biggest payers. */
export function MonthlyIncomeChart({ income, height = 260 }: { income: CurrencyIncome; height?: number }) {
  const option = useMemo(() => {
    const top = income.payers.slice(0, TOP).map((p) => p.ticker);
    const hasOther = income.payers.length > TOP;
    const labels = income.months.map((m, i) =>
      i === 0 || m.key.endsWith("-01") ? monthLabel(m.key, { withYear: true }).replace(" ", "\n") : monthLabel(m.key)
    );
    const bar = (name: string, color: string, data: number[]) => ({
      name,
      type: "bar",
      stack: "income",
      barMaxWidth: 34,
      itemStyle: { color, borderRadius: [0, 0, 0, 0] as number[] },
      emphasis: { focus: "series" },
      data,
    });
    const series = top.map((ticker, i) =>
      bar(ticker, PAYER_COLORS[i % PAYER_COLORS.length], income.months.map((m) => +(m.byTicker[ticker] ?? 0).toFixed(2)))
    );
    if (hasOther) {
      series.push(
        bar(
          "Others",
          OTHER_COLOR,
          income.months.map((m) =>
            +Object.entries(m.byTicker)
              .filter(([t]) => !top.includes(t))
              .reduce((sum, [, v]) => sum + v, 0)
              .toFixed(2)
          )
        )
      );
    }
    // Round the top of each stack only
    const last = series.length - 1;
    if (last >= 0) series[last].itemStyle.borderRadius = [4, 4, 0, 0];

    return {
      grid: { top: 16, right: 8, bottom: 8, left: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: { seriesName: string; value: number; color: string; dataIndex: number }[]) => {
          const idx = params[0]?.dataIndex ?? 0;
          const month = income.months[idx];
          const rows = params
            .filter((p) => p.value > 0)
            .sort((a, b) => b.value - a.value)
            .map(
              (p) =>
                `<div style="display:flex;gap:14px;justify-content:space-between"><span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin-right:6px"></span>${p.seriesName}</span><span style="font-family:var(--font-geist-mono)">${formatMoney(p.value, income.currency)}</span></div>`
            )
            .join("");
          return `<div style="min-width:170px"><div style="display:flex;justify-content:space-between;margin-bottom:6px;color:${chartColors.ink}"><b style="font-weight:600">${monthLabel(month.key, { withYear: true })}</b><span style="font-family:var(--font-geist-mono)">${formatMoney(month.total, income.currency)}</span></div>${rows || `<div style="color:${chartColors.ink3}">No payments expected</div>`}</div>`;
        },
      },
      legend: { show: false },
      xAxis: {
        type: "category",
        data: labels,
        axisLine: { show: false },
        axisLabel: { lineHeight: 14, interval: 0, hideOverlap: true },
      },
      yAxis: {
        type: "value",
        splitNumber: 3,
        axisLabel: { formatter: (v: number) => formatMoney(v, income.currency, { decimals: 0 }) },
      },
      series,
    };
  }, [income]);

  const top = income.payers.slice(0, TOP);
  return (
    <div>
      <EChart option={option} style={{ height }} />
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-ink-2">
        {top.map((p, i) => (
          <span key={p.ticker} className="inline-flex items-center gap-1.5">
            <i className="size-2 rounded-[2px]" style={{ background: PAYER_COLORS[i % PAYER_COLORS.length] }} />
            <span className="num">{p.ticker}</span>
          </span>
        ))}
        {income.payers.length > TOP && (
          <span className="inline-flex items-center gap-1.5">
            <i className="size-2 rounded-[2px]" style={{ background: OTHER_COLOR }} />
            {income.payers.length - TOP} others
          </span>
        )}
      </div>
    </div>
  );
}
