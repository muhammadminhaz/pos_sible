"use client";

import { useMemo } from "react";
import type Highcharts from "highcharts";
import { baseOptions, Chart, rgba, type Theme } from "@/features/analytics/charts";
import { formatMoney, shortMonth, type RevenueReport } from "./api";

/**
 * Charts for the platform console. They share the business app's chart theme (colours, tooltip, legend) but format
 * with the console's own money and month helpers, because there is no business here to take settings from.
 */

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const tipRow = (name: string, color: unknown, text: string) => `<span style="color:${color}">●</span> ${name}: <b>${text}</b><br/>`;

/** Money received each month as columns, with the running total as a line on its own axis. */
export function RevenueChart({ report, height = 300 }: { report: RevenueReport; height?: number }) {
  const rows = useMemo(() => {
    // The line starts from what was earned before this 12-month window, so it ends on the true total.
    const before = report.total - report.months.reduce((s, m) => s + m.amount, 0);
    return report.months.reduce<{ label: string; amount: number; total: number }[]>((acc, m) => {
      acc.push({ label: shortMonth(m.month), amount: m.amount, total: (acc.at(-1)?.total ?? before) + m.amount });
      return acc;
    }, []);
  }, [report]);
  const options = useMemo(() => (th: Theme, _h: number, reduced: boolean): Highcharts.Options => {
    const base = baseOptions(th, reduced);
    const left = base.yAxis as Highcharts.YAxisOptions;
    return {
      ...base,
      xAxis: { ...base.xAxis, categories: rows.map((r) => r.label) },
      yAxis: [
        { ...left, min: 0, labels: { ...left.labels, formatter() { return compact.format(Number(this.value)); } } },
        { title: { text: undefined }, labels: { enabled: false }, gridLineWidth: 0, opposite: true, min: 0 },
      ],
      tooltip: { ...base.tooltip, pointFormatter() { return tipRow(this.series.name, this.color, formatMoney(Number(this.y))); } },
      series: [
        { type: "column", name: "Received", data: rows.map((r) => r.amount), color: rgba(th.series[0], 0.6), borderRadius: 5, borderWidth: 0, yAxis: 0 },
        { type: "spline", name: "Total earned", data: rows.map((r) => r.total), color: rgba(th.series[1]), lineWidth: 2.5, marker: { enabled: false }, yAxis: 1 },
      ],
    };
  }, [rows]);
  return <Chart options={options} label="Revenue received each month and the running total" rows={rows} xKey="label" series={[{ key: "amount", label: "Received" }, { key: "total", label: "Total earned" }]} format={formatMoney} height={height} />;
}

/** One column per label: a count or an amount over time. */
export function ColumnsChart({ data, name, format = (n) => String(Math.round(n)), height = 240 }: { data: { label: string; value: number }[]; name: string; format?: (n: number) => string; height?: number }) {
  const options = useMemo(() => (th: Theme, _h: number, reduced: boolean): Highcharts.Options => {
    const base = baseOptions(th, reduced);
    const y = base.yAxis as Highcharts.YAxisOptions;
    return {
      ...base,
      legend: { ...base.legend, enabled: false },
      xAxis: { ...base.xAxis, categories: data.map((d) => d.label), labels: { ...(base.xAxis as Highcharts.XAxisOptions).labels, rotation: 0, step: 2 } },
      yAxis: { ...y, min: 0, allowDecimals: false, labels: { ...y.labels, formatter() { return compact.format(Number(this.value)); } } },
      tooltip: { ...base.tooltip, pointFormatter() { return tipRow(this.series.name, this.color, format(Number(this.y))); } },
      series: [{ type: "column", name, data: data.map((d) => d.value), color: rgba(th.series[0], 0.6), borderRadius: 5, borderWidth: 0 }],
    };
  }, [data, name, format]);
  return <Chart options={options} label={name} rows={data} xKey="label" series={[{ key: "value", label: name }]} format={format} height={height} />;
}
