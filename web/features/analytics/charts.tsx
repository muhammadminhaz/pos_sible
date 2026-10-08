"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/format";
import { useChartHeight } from "./CardGrid";

/**
 * Interactive charts for the Analytics tab, drawn with Highcharts but dressed in the app's own tokens (card colours,
 * radius, accent). Click a legend entry to hide or show that series; hover for exact values. Each chart keeps the
 * screen-reader table the report charts have.
 */

type Row = Record<string, string | number>;
type Series = { key: string; label: string };
type Common = { data: Row[]; xKey: string; label: string; height?: number; format?: (n: number) => string };

// ── Theme: resolve the CSS tokens to real colours, and follow light/dark and accent changes ──

let probe: HTMLCanvasElement | undefined;
function resolve(token: string): { r: number; g: number; b: number } {
  const el = document.createElement("span");
  el.style.color = `var(${token})`;
  document.body.appendChild(el);
  const css = getComputedStyle(el).color;
  el.remove();
  probe ??= document.createElement("canvas");
  probe.width = probe.height = 1;
  const ctx = probe.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return { r, g, b };
}
export const rgba = (c: { r: number; g: number; b: number }, a = 1) => `rgba(${c.r},${c.g},${c.b},${a})`;

export type Theme = ReturnType<typeof readTheme>;
function readTheme() {
  const c = [1, 2, 3, 4, 5].map((n) => resolve(`--chart-${n}`));
  return {
    series: c, fg: resolve("--foreground"), muted: resolve("--muted-foreground"), border: resolve("--border"),
    popover: resolve("--popover"), popoverFg: resolve("--popover-foreground"),
  };
}

function useTheme(): Theme | null {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    const read = () => setTheme(readTheme());
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

export function baseOptions(th: Theme, reduced: boolean): Highcharts.Options {
  const label = { style: { color: rgba(th.muted), fontSize: "12px", textOutline: "none" } };
  return {
    chart: { backgroundColor: "transparent", spacing: [8, 4, 4, 0], style: { fontFamily: "inherit" }, animation: !reduced },
    title: { text: undefined }, credits: { enabled: false }, accessibility: { enabled: false },
    legend: {
      itemStyle: { color: rgba(th.muted), fontWeight: "normal", fontSize: "12px" },
      itemHoverStyle: { color: rgba(th.fg) }, itemHiddenStyle: { color: rgba(th.muted, 0.7), textDecoration: "line-through" }, symbolRadius: 6,
    },
    tooltip: {
      shared: true, backgroundColor: rgba(th.popover), borderColor: rgba(th.border), borderRadius: 8, shadow: false,
      style: { color: rgba(th.popoverFg), fontSize: "12px" },
    },
    xAxis: { lineWidth: 0, tickWidth: 0, labels: label, gridLineWidth: 0 },
    yAxis: { title: { text: undefined }, labels: label, gridLineColor: rgba(th.border), lineWidth: 0 },
    plotOptions: { series: { animation: reduced ? false : { duration: 500 }, states: { inactive: { opacity: 0.35 } } } },
  };
}

export function Chart({ options, label, rows, xKey, series, format, height }: { options: (th: Theme, h: number, reduced: boolean) => Highcharts.Options; label: string; rows: Row[]; xKey: string; series: Series[]; format: (n: number) => string; height: number }) {
  const t = useTranslations("reports");
  const th = useTheme();
  const h = useChartHeight(height);
  const wrap = useRef<HTMLDivElement>(null);
  const chart = useRef<Highcharts.Chart | null>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // The chart takes its height from its container (see below), so dragging a card never rebuilds the options.
  const opts = useMemo(() => (th ? options(th, 0, reduced) : null), [th, reduced, options]);

  // The chart follows its card when the card gets wider or narrower, not just when the window resizes.
  useEffect(() => {
    if (!wrap.current) return;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const c = chart.current;
        // A chart that was just destroyed (its card re-mounted) has no container left to measure.
        if (!c?.container?.isConnected) return;
        try { c.reflow(); } catch { /* destroyed mid-frame */ }
      });
    });
    ro.observe(wrap.current);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); chart.current = null; };
  }, []);

  return (
    <figure role="img" aria-label={label} className="m-0">
      <div ref={wrap} aria-hidden style={{ height: h }}>
        {opts && <HighchartsReact highcharts={Highcharts} options={opts} callback={(c: Highcharts.Chart) => { chart.current = c; }} containerProps={{ style: { height: "100%" } }} />}
      </div>
      <div className="sr-only"><table>
        <caption>{label}</caption>
        <thead><tr><th>{t("chartCategory")}</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}><td>{String(r[xKey])}</td>{series.map((s) => <td key={s.key}>{format(Number(r[s.key]))}</td>)}</tr>)}</tbody>
      </table></div>
    </figure>
  );
}

const dayLabel = (f: ReturnType<typeof useFormat>) => (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) ? f.date(v).slice(0, 5) : /^\d{4}-\d{2}$/.test(v) ? f.date(`${v}-01`).slice(3) : v;

/** Bars for one measure and a line for another (sales vs profit). */
export function ComboChart({ data, xKey, bar, line, label, height = 280, format }: Common & { bar: Series; line: Series }) {
  const f = useFormat();
  const fmt = format ?? f.money;
  const options = useMemo(() => (th: Theme, h: number, reduced: boolean): Highcharts.Options => {
    const base = baseOptions(th, reduced);
    return {
      ...base,
      xAxis: { ...base.xAxis, categories: data.map((r) => dayLabel(f)(String(r[xKey]))), tickInterval: Math.ceil(data.length / 12) },
      yAxis: { ...base.yAxis, labels: { ...(base.yAxis as Highcharts.YAxisOptions).labels, formatter() { return f.number(Number(this.value)); } } },
      tooltip: { ...base.tooltip, pointFormatter() { return `<span style="color:${this.color}">●</span> ${this.series.name}: <b>${fmt(Number(this.y))}</b><br/>`; } },
      series: [
        { type: "column", name: bar.label, data: data.map((r) => Number(r[bar.key])), color: rgba(th.series[0], 0.55), borderRadius: 4, borderWidth: 0 },
        { type: "spline", name: line.label, data: data.map((r) => Number(r[line.key])), color: rgba(th.series[1]), lineWidth: 2.5, marker: { enabled: false } },
      ],
    };
  }, [data, xKey, bar, line, f, fmt]);
  return <Chart options={options} label={label} rows={data} xKey={xKey} series={[bar, line]} format={fmt} height={height} />;
}

/** Running total so far as a filled area, carried on to the period end as a dashed forecast line. */
export function ForecastChart({ data, xKey, actual, projected, label, height = 240, format }: Omit<Common, "data"> & { data: Record<string, string | number | null>[]; actual: Series; projected: Series }) {
  const f = useFormat();
  const fmt = format ?? f.money;
  const options = useMemo(() => (th: Theme, _h: number, reduced: boolean): Highcharts.Options => {
    const base = baseOptions(th, reduced);
    const pick = (k: string) => data.map((r) => (r[k] === null || r[k] === undefined ? null : Number(r[k])));
    return {
      ...base,
      legend: { ...base.legend, enabled: false },
      xAxis: { ...base.xAxis, categories: data.map((r) => dayLabel(f)(String(r[xKey]))), tickInterval: Math.ceil(data.length / 8) },
      yAxis: { ...base.yAxis, labels: { ...(base.yAxis as Highcharts.YAxisOptions).labels, formatter() { return f.compact(Number(this.value)); } } },
      tooltip: { ...base.tooltip, pointFormatter() { return `<span style="color:${this.color}">●</span> ${this.series.name}: <b>${fmt(Number(this.y))}</b><br/>`; } },
      series: [
        { type: "areaspline", name: actual.label, data: pick(actual.key), color: rgba(th.series[0]), lineWidth: 2.5, marker: { enabled: false },
          fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, rgba(th.series[0], 0.28)], [1, rgba(th.series[0], 0)]] } },
        { type: "spline", name: projected.label, data: pick(projected.key), color: rgba(th.series[0], 0.75), dashStyle: "Dash", lineWidth: 2, marker: { enabled: false } },
      ],
    };
  }, [data, xKey, actual, projected, f, fmt]);
  return <Chart options={options} label={label} rows={data as Row[]} xKey={xKey} series={[actual, projected]} format={fmt} height={height} />;
}

/** Revenue bars with a cumulative-share line: how few products carry most of the sales. */
export function ParetoChart({ data, xKey, bar, line, label, height = 300 }: Common & { bar: Series; line: Series }) {
  const f = useFormat();
  const options = useMemo(() => (th: Theme, h: number, reduced: boolean): Highcharts.Options => {
    const base = baseOptions(th, reduced);
    const yLabels = (base.yAxis as Highcharts.YAxisOptions).labels;
    return {
      ...base,
      xAxis: { ...base.xAxis, categories: data.map((r) => String(r[xKey])), labels: { enabled: false } },
      yAxis: [
        { ...base.yAxis, labels: { ...yLabels, formatter() { return f.number(Number(this.value)); } } },
        { title: { text: undefined }, opposite: true, min: 0, max: 100, gridLineWidth: 0, labels: { ...yLabels, formatter() { return `${this.value}%`; } } },
      ],
      tooltip: { ...base.tooltip, formatter() {
        const pts = this.points ?? [];
        return `<b>${this.x}</b><br/>` + pts.map((p) => `<span style="color:${p.color}">●</span> ${p.series.name}: <b>${p.series.userOptions.yAxis === 1 ? `${f.number(Number(p.y))}%` : f.money(Number(p.y))}</b>`).join("<br/>");
      } },
      series: [
        { type: "column", name: bar.label, data: data.map((r) => Number(r[bar.key])), color: rgba(th.series[0]), borderRadius: 4, borderWidth: 0, yAxis: 0 },
        { type: "spline", name: line.label, data: data.map((r) => Number(r[line.key])), color: rgba(th.series[2]), lineWidth: 2.5, marker: { enabled: false }, yAxis: 1 },
      ],
    };
  }, [data, xKey, bar, line, f]);
  return <Chart options={options} label={label} rows={data} xKey={xKey} series={[bar, line]} format={(n) => f.number(n)} height={height} />;
}

/** Stacked columns: one coloured segment per series. Click the legend to leave a segment out. */
export function StackedBars({ data, xKey, series, label, height = 260, format }: Common & { series: Series[] }) {
  const f = useFormat();
  const fmt = format ?? f.number;
  const options = useMemo(() => (th: Theme, h: number, reduced: boolean): Highcharts.Options => {
    const base = baseOptions(th, reduced);
    return {
      ...base,
      xAxis: { ...base.xAxis, categories: data.map((r) => dayLabel(f)(String(r[xKey]))) },
      plotOptions: { ...base.plotOptions, column: { stacking: "normal", borderRadius: 4, borderWidth: 0 } },
      tooltip: { ...base.tooltip, pointFormatter() { return `<span style="color:${this.color}">●</span> ${this.series.name}: <b>${fmt(Number(this.y))}</b><br/>`; } },
      series: series.map((s, i) => ({ type: "column" as const, name: s.label, data: data.map((r) => Number(r[s.key])), color: rgba(th.series[i % th.series.length]) })),
    };
  }, [data, xKey, series, fmt, f]);
  return <Chart options={options} label={label} rows={data} xKey={xKey} series={series} format={fmt} height={height} />;
}

/** One measure per category as horizontal (default) or vertical bars; the colour deepens along the bar. */
export function Bars({ data, xKey, yKey, label, height = 280, format, layout = "horizontal" }: Common & { yKey: string; layout?: "horizontal" | "vertical" }) {
  const f = useFormat();
  const fmt = format ?? f.money;
  const horizontal = layout === "horizontal";
  const options = useMemo(() => (th: Theme, h: number, reduced: boolean): Highcharts.Options => {
    const base = baseOptions(th, reduced);
    const c = th.series[0];
    return {
      ...base,
      chart: { ...base.chart, type: horizontal ? "bar" : "column" },
      legend: { enabled: false },
      xAxis: { ...base.xAxis, categories: data.map((r) => String(r[xKey])), reversed: horizontal ? true : false },
      yAxis: { ...base.yAxis, tickAmount: 5, labels: { ...(base.yAxis as Highcharts.YAxisOptions).labels, autoRotation: [0], formatter() { return f.number(Number(this.value)); } } },
      tooltip: { ...base.tooltip, shared: false, pointFormatter() { return `<b>${fmt(Number(this.y))}</b>`; } },
      plotOptions: { ...base.plotOptions, bar: { borderRadius: 4, borderWidth: 0, pointPadding: 0.08, groupPadding: 0.05 }, column: { borderRadius: 4, borderWidth: 0 } },
      series: [{
        type: horizontal ? "bar" : "column", name: label, data: data.map((r) => Number(r[yKey])),
        color: { linearGradient: horizontal ? { x1: 0, y1: 0, x2: 1, y2: 0 } : { x1: 0, y1: 1, x2: 0, y2: 0 }, stops: [[0, rgba(c, 0.55)], [1, rgba(c)]] },
      }],
    };
  }, [data, xKey, yKey, label, fmt, f, horizontal]);
  return <Chart options={options} label={label} rows={data} xKey={xKey} series={[{ key: yKey, label }]} format={fmt} height={height} />;
}

/** Share of a total; the long tail is grouped as "Other". Click a legend entry to drop a slice and the rest re-scale. */
export function Donut({ data, label, other, height = 240, format }: { data: { name: string; value: number }[]; label: string; other: string; height?: number; format?: (n: number) => string }) {
  const f = useFormat();
  const fmt = format ?? f.money;
  const slices = useMemo(() => {
    const head = data.slice(0, 5);
    const rest = data.slice(5).reduce((s, x) => s + x.value, 0);
    return rest > 0 ? [...head, { name: other, value: rest }] : head;
  }, [data, other]);
  const options = useMemo(() => (th: Theme, h: number, reduced: boolean): Highcharts.Options => {
    const base = baseOptions(th, reduced);
    return {
      ...base,
      tooltip: { ...base.tooltip, shared: false, pointFormatter() { return `<b>${fmt(Number(this.y))}</b> (${f.number(Math.round((this.percentage ?? 0) * 10) / 10)}%)`; } },
      plotOptions: { ...base.plotOptions, pie: { innerSize: "58%", borderWidth: 0, showInLegend: true, dataLabels: { enabled: false }, size: "92%" } },
      series: [{ type: "pie", name: label, data: slices.map((x, i) => ({ name: x.name, y: x.value, color: x.name === other ? rgba(th.muted, 0.5) : rgba(th.series[i % th.series.length]) })) }],
    };
  }, [slices, label, other, fmt, f]);
  return <Chart options={options} label={label} rows={slices} xKey="name" series={[{ key: "value", label }]} format={fmt} height={height} />;
}

/** Weekday × hour grid shaded by value, so the busiest times stand out at a glance. */
export function Heatmap({ grid, rowLabels, label, format }: { grid: number[][]; rowLabels: string[]; label: string; format: (n: number) => string }) {
  const max = Math.max(1, ...grid.flat());
  const hours = Array.from({ length: 24 }, (_, h) => h);
  return (
    <figure role="img" aria-label={label} className="m-0 overflow-x-auto">
      <div className="grid min-w-[560px] gap-1" style={{ gridTemplateColumns: "3rem repeat(24, minmax(0, 1fr))" }} aria-hidden>
        <span />
        {hours.map((h) => <span key={h} className="text-center text-[10px] text-muted-foreground tabular">{h % 3 === 0 ? h : ""}</span>)}
        {grid.map((row, d) => (
          <div key={d} className="contents">
            <span className="self-center text-xs text-muted-foreground">{rowLabels[d]}</span>
            {row.map((v, h) => (
              <span
                key={h}
                title={`${rowLabels[d]} ${h}:00 · ${format(v)}`}
                className="aspect-square rounded-[4px] bg-muted"
                style={v > 0 ? { background: `color-mix(in oklab, var(--chart-1) ${Math.round(12 + (v / max) * 88)}%, var(--muted))` } : undefined}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="sr-only"><table>
        <caption>{label}</caption>
        <tbody>{grid.map((row, d) => <tr key={d}><th>{rowLabels[d]}</th>{row.map((v, h) => <td key={h}>{`${h}:00 ${format(v)}`}</td>)}</tr>)}</tbody>
      </table></div>
    </figure>
  );
}
