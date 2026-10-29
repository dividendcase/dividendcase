"use client";

import { useMemo } from "react";
import { EChart } from "@/components/charts/EChart";
import { chartColors } from "@/lib/chartTheme";
import { formatMoney } from "@/lib/format";
import {
  bollinger, drawdown, ema, macd, rsi, sma, trailingYield, yieldBands, mean,
  type Dividend, type Interval, type Series,
} from "@/lib/indicators";
import { barTooltip, compactNumber, dateLabel, priceSeries, volumeSeries, DOWN, UP, type ChartType } from "@/lib/priceChart";
import type { PriceBar } from "@/lib/types";

export type OverlayKey = "sma20" | "sma50" | "sma200" | "ema21" | "bollinger" | "bands" | "dividends";
export type PaneKey = "volume" | "rsi" | "macd" | "drawdown" | "yield";

export const OVERLAYS: readonly { key: OverlayKey; label: string; color: string; title: string }[] = [
  { key: "sma20", label: "SMA 20", color: "#e0e0f5", title: "Simple average of the last 20 closes" },
  { key: "sma50", label: "SMA 50", color: chartColors.s3, title: "Simple average of the last 50 closes" },
  { key: "sma200", label: "SMA 200", color: chartColors.s4, title: "Simple average of the last 200 closes: the long-term trend" },
  { key: "ema21", label: "EMA 21", color: "#c5e8a8", title: "Exponential average of 21 closes: recent closes count more" },
  { key: "bollinger", label: "Bollinger 20, 2", color: chartColors.ink3, title: "Two standard deviations either side of the 20-bar average" },
  { key: "bands", label: "Yield bands", color: chartColors.sprout, title: "The price at which the trailing dividend would give this stock's average yield, and one standard deviation either side" },
  { key: "dividends", label: "Ex-dividend dates", color: chartColors.sproutHi, title: "Days the stock started trading without its next dividend" },
];

export const PANES: readonly { key: PaneKey; label: string; title: string }[] = [
  { key: "volume", label: "Volume", title: "Shares traded, with its 20-bar average" },
  { key: "yield", label: "Trailing yield", title: "Dividends of the last 12 months over the price, with the average for the whole history" },
  { key: "rsi", label: "RSI 14", title: "Relative strength: above 70 the recent rise is stretched, below 30 the fall is" },
  { key: "macd", label: "MACD 12, 26, 9", title: "The gap between the 12- and 26-bar averages, its 9-bar signal line, and the difference as bars" },
  { key: "drawdown", label: "Drawdown", title: "How far the price is below its highest close so far" },
];

interface Props {
  /** Every bar, at the chosen interval: averages need the history before the range */
  bars: PriceBar[];
  /** The first bar of the chosen range */
  start: number;
  interval: Interval;
  dividends: Dividend[];
  currency: string;
  type: ChartType;
  log: boolean;
  overlays: ReadonlySet<OverlayKey>;
  panes: readonly PaneKey[];
}

const PRICE_HEIGHT = 340;
const PANE_HEIGHT = 92;
const PANE_GAP = 30;
const TOP = 14;
const BOTTOM = 64;

export function advancedChartHeight(paneCount: number) {
  return TOP + PRICE_HEIGHT + paneCount * (PANE_GAP + PANE_HEIGHT) + BOTTOM;
}

/** Price with overlays, and a stack of indicator panes under it sharing one time axis. */
export function AdvancedChart({ bars, start, interval, dividends, currency, type, log, overlays, panes }: Props) {
  const option = useMemo(() => {
    const closes = bars.map((b) => b.close);
    const cut = <T,>(s: T[]) => s.slice(start);
    const shown = cut(bars);
    if (shown.length < 2) return null;
    const dates = shown.map((b) => b.date);
    const change = shown[shown.length - 1].close / shown[0].close - 1;

    // Overlays and panes, computed on the whole history and then cut to the range
    const lines: { name: string; color: string; data: Series; dashed?: boolean }[] = [];
    const on = (k: OverlayKey) => overlays.has(k);
    if (on("sma20")) lines.push({ name: "SMA 20", color: OVERLAYS[0].color, data: cut(sma(closes, 20)) });
    if (on("sma50")) lines.push({ name: "SMA 50", color: OVERLAYS[1].color, data: cut(sma(closes, 50)) });
    if (on("sma200")) lines.push({ name: "SMA 200", color: OVERLAYS[2].color, data: cut(sma(closes, 200)) });
    if (on("ema21")) lines.push({ name: "EMA 21", color: OVERLAYS[3].color, data: cut(ema(closes, 21)) });
    if (on("bollinger")) {
      const bb = bollinger(closes, 20, 2);
      lines.push({ name: "Upper band", color: chartColors.ink3, data: cut(bb.upper), dashed: true });
      lines.push({ name: "Lower band", color: chartColors.ink3, data: cut(bb.lower), dashed: true });
    }
    const bands = on("bands") ? yieldBands(bars, dividends) : null;
    if (bands) {
      lines.push({ name: `Yield ${(bands.average + bands.spread).toFixed(1)}%`, color: chartColors.sprout, data: cut(bands.cheap), dashed: true });
      lines.push({ name: `Yield ${bands.average.toFixed(1)}%`, color: chartColors.ink2, data: cut(bands.fair), dashed: true });
      lines.push({ name: `Yield ${(bands.average - bands.spread).toFixed(1)}%`, color: chartColors.watch, data: cut(bands.dear), dashed: true });
    }
    const marks = on("dividends")
      ? dividends
          .map((d) => ({ d, i: shown.findIndex((b) => b.date >= d.date) }))
          .filter(({ d, i }) => i >= 0 && d.date >= shown[0].date)
      : [];

    type Pane = { key: PaneKey; label: string; series: Record<string, unknown>[]; yAxis: Record<string, unknown>; values: { name: string; data: Series; format: (v: number) => string }[] };
    const paneDefs: Pane[] = [];
    for (const key of panes) {
      const label = PANES.find((p) => p.key === key)!.label;
      if (key === "volume") {
        const avg = cut(sma(bars.map((b) => b.volume ?? 0), 20));
        paneDefs.push({
          key, label,
          series: [
            volumeSeries(shown, { xAxisIndex: 0, yAxisIndex: 0 }),
            { name: "Volume average", type: "line", data: avg, symbol: "none", lineStyle: { color: chartColors.ink2, width: 1 } },
          ],
          yAxis: { axisLabel: { formatter: (v: number) => compactNumber(v) } },
          values: [{ name: "Volume", data: shown.map((b) => b.volume), format: compactNumber }],
        });
      } else if (key === "rsi") {
        const r = cut(rsi(closes, 14));
        paneDefs.push({
          key, label,
          series: [{
            name: "RSI", type: "line", data: r, symbol: "none", lineStyle: { color: chartColors.ink, width: 1.25 },
            markLine: {
              silent: true, symbol: "none", label: { show: false },
              lineStyle: { color: chartColors.lineStrong, type: "dashed" },
              data: [{ yAxis: 30 }, { yAxis: 70 }],
            },
          }],
          yAxis: { min: 0, max: 100, interval: 50 },
          values: [{ name: "RSI", data: r, format: (v) => v.toFixed(1) }],
        });
      } else if (key === "macd") {
        const m = macd(closes);
        const line = cut(m.macd), signal = cut(m.signal), hist = cut(m.hist);
        paneDefs.push({
          key, label,
          series: [
            { name: "MACD histogram", type: "bar", data: hist.map((v) => ({ value: v, itemStyle: { color: (v ?? 0) >= 0 ? "rgba(122,191,80,0.5)" : "rgba(229,96,79,0.5)" } })), barMaxWidth: 6 },
            { name: "MACD", type: "line", data: line, symbol: "none", lineStyle: { color: chartColors.ink, width: 1.25 } },
            { name: "Signal", type: "line", data: signal, symbol: "none", lineStyle: { color: chartColors.s3, width: 1.25 } },
          ],
          yAxis: { axisLabel: { formatter: (v: number) => v.toFixed(Math.abs(v) < 1 ? 2 : 1) } },
          values: [
            { name: "MACD", data: line, format: (v) => v.toFixed(3) },
            { name: "Signal", data: signal, format: (v) => v.toFixed(3) },
          ],
        });
      } else if (key === "drawdown") {
        const dd = cut(drawdown(closes));
        paneDefs.push({
          key, label,
          series: [{ name: "Drawdown", type: "line", data: dd, symbol: "none", lineStyle: { color: DOWN, width: 1 }, areaStyle: { color: DOWN, opacity: 0.12 } }],
          yAxis: { max: 0, axisLabel: { formatter: (v: number) => `${v.toFixed(0)}%` } },
          values: [{ name: "Below the high", data: dd, format: (v) => `${v.toFixed(1)}%` }],
        });
      } else if (key === "yield") {
        const y = trailingYield(bars, dividends);
        const avg = mean(y.filter((v): v is number => v != null));
        const shownY = cut(y);
        paneDefs.push({
          key, label,
          series: [{
            name: "Trailing yield", type: "line", data: shownY, symbol: "none", lineStyle: { color: chartColors.sprout, width: 1.25 },
            ...(Number.isFinite(avg)
              ? { markLine: { silent: true, symbol: "none", lineStyle: { color: chartColors.ink3, type: "dashed" }, label: { formatter: `Average ${avg.toFixed(2)}%`, color: chartColors.ink3, fontSize: 10, position: "insideStartTop" }, data: [{ yAxis: avg }] } }
              : {}),
          }],
          yAxis: { scale: true, axisLabel: { formatter: (v: number) => `${v.toFixed(1)}%` } },
          values: [{ name: "Trailing yield", data: shownY, format: (v) => `${v.toFixed(2)}%` }],
        });
      }
    }

    // One grid for the price, one per pane, all on the same dates
    const grids: Record<string, unknown>[] = [{ left: 12, right: 64, top: TOP, height: PRICE_HEIGHT }];
    paneDefs.forEach((_, i) => grids.push({ left: 12, right: 64, top: TOP + PRICE_HEIGHT + PANE_GAP + i * (PANE_GAP + PANE_HEIGHT), height: PANE_HEIGHT }));
    const last = grids.length - 1;
    const xAxes = grids.map((_, i) => ({
      type: "category",
      gridIndex: i,
      data: dates,
      boundaryGap: true,
      axisLabel: i === last ? { formatter: (v: string) => dateLabel(v, interval, interval !== "day" || dates.length > 260) } : { show: false },
      axisLine: { lineStyle: { color: chartColors.line } },
      axisPointer: { label: { show: i === last, formatter: (p: { value: string }) => dateLabel(p.value, "day") } },
    }));
    const money = (v: number) => formatMoney(v, currency, { decimals: v >= 1000 ? 0 : 2 });
    const yAxes: Record<string, unknown>[] = [
      { type: log ? "log" : "value", gridIndex: 0, scale: true, position: "right", axisLabel: { formatter: money } },
      // For the ex-dividend marks along the bottom of the price grid
      { type: "value", gridIndex: 0, min: 0, max: 1, show: false },
      ...paneDefs.map((p, i) => ({ type: "value", gridIndex: i + 1, position: "right", splitNumber: 2, ...p.yAxis })),
    ];

    const series: Record<string, unknown>[] = [
      priceSeries(type, shown, { color: change >= 0 ? UP : DOWN }),
      ...lines.map((l) => ({
        name: l.name, type: "line", data: l.data, symbol: "none", z: 3,
        lineStyle: { color: l.color, width: 1.25, ...(l.dashed ? { type: "dashed" } : {}) },
        itemStyle: { color: l.color },
      })),
      ...(marks.length
        ? [{
            name: "Ex-dividend", type: "scatter", yAxisIndex: 1, z: 4,
            data: marks.map(({ i }) => [i, 0.035]),
            symbol: "circle", symbolSize: 6,
            itemStyle: { color: chartColors.sproutHi, borderColor: chartColors.ground, borderWidth: 1 },
          }]
        : []),
      ...paneDefs.flatMap((p, i) => p.series.map((s) => ({ ...s, xAxisIndex: i + 1, yAxisIndex: i + 2 }))),
    ];

    const allX = grids.map((_, i) => i);
    return {
      animation: false,
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      title: paneDefs.map((p, i) => ({
        text: p.label,
        left: 14,
        top: TOP + PRICE_HEIGHT + PANE_GAP + i * (PANE_GAP + PANE_HEIGHT) - 20,
        textStyle: { color: chartColors.ink3, fontSize: 11.5, fontWeight: 500 },
      })),
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      series,
      dataZoom: [
        { type: "inside", xAxisIndex: allX, start: 0, end: 100, minValueSpan: 10 },
        { type: "slider", xAxisIndex: allX, bottom: 10, height: 18, left: 12, right: 64, showDetail: false, brushSelect: false,
          borderColor: chartColors.line, backgroundColor: "rgba(255,255,255,0.02)",
          dataBackground: { lineStyle: { color: chartColors.lineStrong }, areaStyle: { color: "rgba(255,255,255,0.03)" } },
          selectedDataBackground: { lineStyle: { color: chartColors.ink3 }, areaStyle: { color: "rgba(122,191,80,0.08)" } },
          handleStyle: { color: chartColors.raised, borderColor: chartColors.ink3 }, moveHandleStyle: { color: chartColors.lineStrong } },
      ],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: (params: { dataIndex: number; seriesName: string }[]) => {
          const p = params.find((x) => x.seriesName !== "Ex-dividend");
          if (!p) return "";
          const i = p.dataIndex;
          const row = (label: string, value: string, color: string = chartColors.ink3) =>
            `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${color}">${label}</span><span style="font-variant-numeric:tabular-nums">${value}</span></div>`;
          let html = barTooltip(shown[i], currency, interval);
          for (const l of lines) if (l.data[i] != null) html += row(l.name, money(l.data[i]!), l.color);
          const div = marks.find((m) => m.i === i);
          if (div) html += `<div style="margin-top:4px;color:${chartColors.sproutHi}">Went ex-dividend ${formatMoney(div.d.amount, currency, { decimals: 4 })}</div>`;
          for (const pane of paneDefs)
            for (const v of pane.values) if (v.data[i] != null && pane.key !== "volume") html += row(v.name, v.format(v.data[i]!));
          return html;
        },
      },
    };
  }, [bars, start, interval, dividends, currency, type, log, overlays, panes]);

  if (!option) return <div className="flex h-64 items-center justify-center text-[13px] text-ink-3">Not enough prices in this range to draw.</div>;
  return <EChart option={option} opts={{ renderer: "canvas" }} style={{ height: advancedChartHeight(panes.length) }} />;
}
