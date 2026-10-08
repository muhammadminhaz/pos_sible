"use client";

import { Area, AreaChart as RAreaChart, Bar, BarChart as RBarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/format";

type Point = Record<string, string | number>;
type ChartProps = {
  data: Point[];
  xKey: string;
  yKey: string;
  /** What the chart shows; becomes its accessible name and the table's caption. */
  label: string;
  height?: number;
  /** Format a y value for the tooltip and the text alternative; defaults to money. */
  format?: (n: number) => string;
  layout?: "vertical" | "horizontal";
  /** Unit or measure shown beside the value axis, so numbers are never unlabeled. */
  axisTitle?: string;
};

/** A visually hidden table so screen readers get the numbers the picture shows. */
function TextAlternative({ data, xKey, yKey, label, format }: Required<Pick<ChartProps, "data" | "xKey" | "yKey" | "label" | "format">>) {
  const t = useTranslations("reports");
  return (
    <div className="sr-only"><table>
      <caption>{label}</caption>
      <thead><tr><th>{t("chartCategory")}</th><th>{t("chartValue")}</th></tr></thead>
      <tbody>{data.map((p, i) => <tr key={i}><td>{String(p[xKey])}</td><td>{format(Number(p[yKey]))}</td></tr>)}</tbody>
    </table></div>
  );
}

const tick = { fill: "var(--muted-foreground)", fontSize: 12 };
const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 };

function useChartFormat(format?: (n: number) => string) {
  const f = useFormat();
  return format ?? f.money;
}

export function AreaChart({ data, xKey, yKey, label, height = 240, format }: ChartProps) {
  const fmt = useChartFormat(format);
  const f = useFormat();
  return (
    <figure role="img" aria-label={label} className="m-0">
      <div aria-hidden style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RAreaChart accessibilityLayer={false} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`fill-${yKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey={xKey} tick={tick} tickLine={false} axisLine={false} minTickGap={24} tickFormatter={(v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? f.date(v).slice(0, 5) : v)} />
            <YAxis tick={tick} tickLine={false} axisLine={false} width={72} tickFormatter={(n: number) => f.number(n)} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v))} labelFormatter={(v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? f.date(String(v)) : String(v))} />
            <Area type="linear" dataKey={yKey} stroke="var(--chart-1)" strokeWidth={2} fill={`url(#fill-${yKey})`} />
          </RAreaChart>
        </ResponsiveContainer>
      </div>
      <TextAlternative data={data} xKey={xKey} yKey={yKey} label={label} format={fmt} />
    </figure>
  );
}

export function BarChart({ data, xKey, yKey, label, height = 280, format, layout = "horizontal", axisTitle }: ChartProps) {
  const fmt = useChartFormat(format);
  const f = useFormat();
  const vertical = layout === "vertical";
  return (
    <figure role="img" aria-label={label} className="m-0">
      <div aria-hidden style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RBarChart accessibilityLayer={false} data={data} layout={vertical ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, bottom: 0, left: vertical ? 8 : 0 }}>
            <defs>
              {/* Subtle gradient along the bar: a lighter start deepening to the full colour at the tip. */}
              <linearGradient id={`bar-${yKey}`} x1={vertical ? "0" : "0"} y1={vertical ? "0" : "1"} x2={vertical ? "1" : "0"} y2={vertical ? "0" : "0"}>
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid horizontal={!vertical} vertical={vertical} stroke="var(--border)" />
            {vertical ? (
              <>
                <XAxis type="number" tick={tick} tickLine={false} axisLine={false} tickFormatter={(n: number) => f.number(n)} label={axisTitle ? { value: axisTitle, position: "insideBottomRight", offset: 0, fill: "var(--muted-foreground)", fontSize: 11 } : undefined} height={axisTitle ? 44 : undefined} />
                <YAxis type="category" dataKey={xKey} tick={tick} tickLine={false} axisLine={false} width={140} />
              </>
            ) : (
              <>
                <XAxis dataKey={xKey} tick={tick} tickLine={false} axisLine={false} />
                <YAxis tick={tick} tickLine={false} axisLine={false} width={72} tickFormatter={(n: number) => f.number(n)} />
              </>
            )}
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.5 }} formatter={(v) => fmt(Number(v))} />
            <Bar dataKey={yKey} fill={`url(#bar-${yKey})`} minPointSize={3} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
          </RBarChart>
        </ResponsiveContainer>
      </div>
      <TextAlternative data={data} xKey={xKey} yKey={yKey} label={label} format={fmt} />
    </figure>
  );
}
