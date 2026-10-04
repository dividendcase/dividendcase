"use client";

import { EChart } from "@/components/charts/EChart";
import { categorical, chartColors } from "@/lib/chartTheme";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { currencyLabel, frequencyLabel } from "@/lib/format";
import type { PortfolioAnalysisResponse, PortfolioDataPoint } from "@/lib/types";

interface Props {
  data: PortfolioAnalysisResponse;
  /** Only count holdings on this exchange */
  exchangeFilter?: string | null;
}

/** Build {label: value} weights from a ticker→category map, weighted by latest stock value. */
function buildWeights(
  categoryMap: Record<string, string>,
  latestValues: Record<string, number>,
  fallbackLabel: string = "Unknown",
): { name: string; value: number }[] {
  const weights: Record<string, number> = {};
  for (const [ticker, value] of Object.entries(latestValues)) {
    const category = categoryMap[ticker] || fallbackLabel;
    weights[category] = (weights[category] || 0) + value;
  }
  return Object.entries(weights)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);
}

/** Build sunburst data: sector as inner ring, industry as outer ring. */
function buildSunburstData(
  sectorMap: Record<string, string>,
  industryMap: Record<string, string>,
  latestValues: Record<string, number>,
): { name: string; value?: number; children?: { name: string; value: number }[] }[] {
  // sector → industry → total value
  const tree: Record<string, Record<string, number>> = {};
  for (const [ticker, value] of Object.entries(latestValues)) {
    const sector = sectorMap[ticker] || "Other";
    const industry = industryMap[ticker] || "Other";
    if (!tree[sector]) tree[sector] = {};
    tree[sector][industry] = (tree[sector][industry] || 0) + value;
  }
  return Object.entries(tree)
    .map(([sector, industries]) => ({
      name: sector,
      children: Object.entries(industries)
        .map(([ind, val]) => ({ name: ind, value: Math.round(val * 100) / 100 }))
        .sort((a, b) => b.value - a.value),
    }))
    .sort((a, b) => {
      const aTotal = a.children!.reduce((s, c) => s + c.value, 0);
      const bTotal = b.children!.reduce((s, c) => s + c.value, 0);
      return bTotal - aTotal;
    });
}

const DONUT_COLORS = [...categorical];

const pctTooltip = {
  trigger: "item",
  formatter: (p: { name: string; percent: number; marker: string }) =>
    `${p.marker}${p.name}<span style="float:right;margin-left:16px;font-variant-numeric:tabular-nums">${p.percent.toFixed(1)}%</span>`,
};

const outsideLabel = {
  show: true,
  position: "outside",
  formatter: "{b}\n{d}%",
  fontSize: 10.5,
  lineHeight: 14,
  color: chartColors.ink2,
};

function ChartPanel({ title, note, warning, children }: {
  title: string;
  note?: string;
  warning?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="eyebrow">{title}</p>
      {note && <p className="text-[12px] text-ink-3">{note}</p>}
      {warning}
      {children}
    </div>
  );
}

// Slices that aren't a category to be concentrated in: a missing profile (funds rarely have
// one), or holdings that pay no dividends
const NOT_A_CATEGORY = new Set(["Unknown", "Other", frequencyLabel("none")]);

/** A warning when the biggest slice is over 30%, unless that slice isn't a real category. */
function concentration(name: string | undefined, share: number) {
  return name && share > 0.3 && !NOT_A_CATEGORY.has(name) ? <ConcentrationWarning name={name} share={share} /> : undefined;
}

function ConcentrationWarning({ name, share }: { name: string; share: number }) {
  return (
    <p className="flex items-center gap-1.5 text-[12px] text-watch">
      <AlertTriangle className="size-3.5 shrink-0" />
      <span>
        Concentrated: {name} is <span className="num">{(share * 100).toFixed(0)}%</span>
      </span>
    </p>
  );
}

function DonutChart({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  if (data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.value, 0);
  const topShare = total > 0 ? data[0].value / total : 0;

  const option = {
    tooltip: pctTooltip,
    legend: { type: "scroll", bottom: 0 },
    series: [
      {
        type: "pie",
        radius: ["42%", "64%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        label: outsideLabel,
        labelLine: { lineStyle: { color: chartColors.lineStrong }, length: 8, length2: 8 },
        data: data.map((d, i) => ({ ...d, itemStyle: { color: DONUT_COLORS[i % DONUT_COLORS.length] } })),
      },
    ],
  };

  return (
    <ChartPanel title={title} warning={concentration(data[0].name, topShare)}>
      <EChart option={option} style={{ height: 280 }} />
    </ChartPanel>
  );
}

function SunburstChart({ sectorMap, industryMap, latestValues }: {
  sectorMap: Record<string, string>;
  industryMap: Record<string, string>;
  latestValues: Record<string, number>;
}) {
  const tree = buildSunburstData(sectorMap, industryMap, latestValues);
  if (tree.length === 0) return null;

  // Sector weights (inner ring)
  const sectorData = tree.map((s, i) => ({
    name: s.name,
    value: (s.children || []).reduce((sum, c) => sum + c.value, 0),
    itemStyle: { color: DONUT_COLORS[i % DONUT_COLORS.length] },
  }));
  const total = sectorData.reduce((s, d) => s + d.value, 0);
  const topShare = total > 0 ? sectorData[0].value / total : 0;

  // Industry weights (outer ring), a lighter shade of the sector's colour
  const industryData = tree.flatMap((s, i) =>
    (s.children || []).map((ind) => ({
      name: ind.name,
      value: ind.value,
      sector: s.name,
      itemStyle: { color: DONUT_COLORS[i % DONUT_COLORS.length], opacity: 0.55 },
    }))
  );

  const option = {
    tooltip: {
      trigger: "item",
      formatter: (p: { name: string; percent: number; marker: string; data: { sector?: string } }) => {
        const header = p.data.sector
          ? `<span style="color:${chartColors.ink3}">${p.data.sector} ›</span> ${p.name}`
          : p.name;
        return `${p.marker}${header}<br/><span style="font-variant-numeric:tabular-nums">${p.percent.toFixed(1)}%</span> of holdings`;
      },
    },
    legend: { type: "scroll", bottom: 0, data: sectorData.map((s) => s.name) },
    series: [
      {
        type: "pie",
        radius: ["26%", "46%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        label: outsideLabel,
        labelLine: { lineStyle: { color: chartColors.lineStrong }, length: 22, length2: 8 },
        data: sectorData,
      },
      {
        type: "pie",
        radius: ["48%", "64%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        itemStyle: { borderWidth: 1 },
        label: { show: false },
        emphasis: { itemStyle: { opacity: 1 } },
        data: industryData,
      },
    ],
  };

  return (
    <ChartPanel
      title="Sector and industry"
      note="Inner ring sector, outer ring industry"
      warning={concentration(sectorData[0]?.name, topShare)}
    >
      <EChart option={option} style={{ height: 280 }} />
    </ChartPanel>
  );
}

export function DiversificationCharts({ data, exchangeFilter }: Props) {
  const lastPoint: PortfolioDataPoint | undefined = data.data_points[data.data_points.length - 1];
  const allValues = lastPoint?.stock_values || {};
  const latestValues = exchangeFilter
    ? Object.fromEntries(Object.entries(allValues).filter(([t]) => data.exchange_map[t] === exchangeFilter))
    : allValues;

  if (Object.keys(latestValues).length === 0) return null;

  const countryData = buildWeights(data.country_map, latestValues);
  // "quarterly" → "Quarterly", merging spellings of the same frequency
  const frequencyNames = Object.fromEntries(
    Object.entries(data.frequency_map).map(([t, f]) => [t, f ? frequencyLabel(f) : ""])
  );
  const frequencyData = buildWeights(frequencyNames, latestValues, "Unknown");
  const hasSunburst = Object.keys(data.sector_map).length > 0;
  // Weights are only exact when every value is in one currency
  const mixed = !data.converted && new Set(Object.keys(latestValues).map((t) => data.currency_map[t] ?? data.currency)).size > 1;
  const unconverted = data.converted ? (data.unconverted_currencies ?? []).map(currencyLabel) : [];

  if (countryData.length === 0 && frequencyData.length === 0 && !hasSunburst) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diversification</CardTitle>
        <CardDescription>
          How your holdings split by sector, country and payment frequency, weighted by current value
          {data.converted ? <> in <span className="font-mono">{currencyLabel(data.currency)}</span></> : ""}.
          {mixed && " Amounts in different currencies are added without converting them."}
          {unconverted.length > 0 && (
            <>
              {" "}
              No exchange rate for <span className="font-mono">{unconverted.join(", ")}</span>, so those values are added in
              their own currency.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {hasSunburst && (
            <SunburstChart sectorMap={data.sector_map} industryMap={data.industry_map} latestValues={latestValues} />
          )}
          {countryData.length > 0 && <DonutChart title="Country" data={countryData} />}
          {frequencyData.length > 0 && <DonutChart title="Payment frequency" data={frequencyData} />}
        </div>
      </CardContent>
    </Card>
  );
}
