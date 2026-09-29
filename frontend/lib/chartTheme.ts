/**
 * Chart colours and the ECharts theme, taken from the brand tokens
 * (packages/brand/tokens.css). ECharts draws SVG, so it needs literal values.
 */

export const chartColors = {
  ground: "#0e0e13",
  surface: "#15151c",
  raised: "#1c1c25",
  grid: "#22222c",
  line: "#282834",
  lineStrong: "#363645",
  ink: "#ececf3",
  ink2: "#a9a9bd",
  ink3: "#80809a",
  sprout: "#7abf50",
  sproutHi: "#9bd96b",
  leaf: "#4a8c1a",
  stem: "#2d6010",
  dial: "#8f8fc2",
  dialHi: "#b3b3e6",
  watch: "#e3a33b",
  cut: "#e5604f",
  s1: "#8ccf5c",
  s2: "#4a8c1a",
  s3: "#b3b3e6",
  s4: "#6d6db0",
} as const;

/** Lines that must stay apart (compare up to four stocks) */
export const lineSeries = [chartColors.s1, chartColors.s3, "#d0d0e0", chartColors.s4] as const;

/** Categories (sectors, countries, tickers): greens, lavenders and steel, alternating */
export const categorical = [
  "#8ccf5c", "#b3b3e6", "#4a8c1a", "#6d6db0",
  "#d0d0e0", "#c5e8a8", "#8f8fc2", "#2d6010",
  "#80809a", "#639922", "#4b4b80", "#e0e0f5",
] as const;

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

let cachedTheme: Record<string, unknown> | null = null;

/** The "dividendcase" ECharts theme. Fonts come from next/font, whose family names are hashed. */
export function getChartTheme(): Record<string, unknown> {
  if (cachedTheme) return cachedTheme;
  const sans = `${cssVar("--font-geist", "Geist")}, ui-sans-serif, system-ui, sans-serif`;
  const mono = `${cssVar("--font-geist-mono", "Geist Mono")}, ui-monospace, monospace`;
  const c = chartColors;
  // Charts draw in place, without growing bars or lines, for people who ask for less motion
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const axisCommon = {
    axisLine: { show: true, lineStyle: { color: c.line } },
    axisTick: { show: false },
    axisLabel: { color: c.ink3, fontFamily: mono, fontSize: 11 },
    splitLine: { show: false, lineStyle: { color: c.grid } },
    nameTextStyle: { color: c.ink3, fontFamily: sans, fontSize: 11 },
  };

  const theme = {
    color: [...categorical],
    backgroundColor: "transparent",
    animation: !reduceMotion,
    textStyle: { fontFamily: sans, color: c.ink2 },
    title: { textStyle: { color: c.ink, fontFamily: sans }, subtextStyle: { color: c.ink3 } },
    legend: {
      textStyle: { color: c.ink2, fontFamily: sans, fontSize: 12 },
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 16,
      inactiveColor: c.lineStrong,
    },
    tooltip: {
      backgroundColor: c.raised,
      borderColor: c.lineStrong,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: c.ink, fontFamily: sans, fontSize: 12 },
      extraCssText: "border-radius:10px;box-shadow:0 12px 32px -8px rgba(0,0,0,.6);",
      axisPointer: {
        lineStyle: { color: c.lineStrong },
        crossStyle: { color: c.lineStrong },
        shadowStyle: { color: "rgba(255,255,255,0.03)" },
        label: { backgroundColor: c.lineStrong, color: c.ink, fontFamily: mono },
      },
    },
    categoryAxis: axisCommon,
    timeAxis: axisCommon,
    logAxis: { ...axisCommon, axisLine: { show: false }, splitLine: { show: true, lineStyle: { color: c.grid } } },
    valueAxis: {
      ...axisCommon,
      axisLine: { show: false },
      splitLine: { show: true, lineStyle: { color: c.grid } },
    },
    line: { symbol: "none", lineStyle: { width: 2 }, emphasis: { lineStyle: { width: 2 } } },
    bar: { itemStyle: { borderRadius: [3, 3, 0, 0] } },
    pie: { itemStyle: { borderColor: c.surface, borderWidth: 2 } },
    radar: {
      axisName: { color: c.ink2, fontFamily: sans },
      splitLine: { lineStyle: { color: c.line } },
      splitArea: { areaStyle: { color: ["transparent"] } },
      axisLine: { lineStyle: { color: c.line } },
    },
    dataZoom: { textStyle: { color: c.ink3 }, borderColor: c.line, fillerColor: "rgba(122,191,80,0.12)" },
  };
  cachedTheme = theme;
  return theme;
}
