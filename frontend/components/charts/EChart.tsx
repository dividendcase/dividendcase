"use client";

import ReactECharts, { type EChartsReactProps } from "echarts-for-react";
import { getChartTheme } from "@/lib/chartTheme";

/** ECharts with the DividendCase theme, drawn as SVG so text stays crisp. */
export function EChart({ opts, ...props }: EChartsReactProps) {
  return <ReactECharts theme={getChartTheme()} notMerge opts={{ renderer: "svg", ...opts }} {...props} />;
}
