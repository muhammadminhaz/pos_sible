import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Presentational stand-ins for our own screens. Every root is aria-hidden; the section text says what it shows. */
const taka = (n: number) => `৳${n.toLocaleString("en-IN")}`;

const tile = "rounded-xl border bg-card p-3 shadow-[0_1px_2px_rgb(0_0_0/.04)]";

function Chip({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "ok" | "info" | "warn" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    ok: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
    info: "bg-primary/15 text-indigo-800 dark:text-indigo-200",
    warn: "bg-amber-500/15 text-amber-900 dark:text-amber-300",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", tones[tone])}>{children}</span>;
}

function Bars({ values, highlight, className }: { values: number[]; highlight?: number; className?: string }) {
  const max = Math.max(...values);
  return (
    <div className={cn("flex h-24 items-end gap-2", className)}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{ height: `${(v / max) * 100}%`, animationDelay: `${i * 60}ms` }}
          className={cn("grow-bar w-full rounded-md", i === highlight ? "bg-primary" : "bg-primary/25")}
        />
      ))}
    </div>
  );
}

export function DashboardMock() {
  const days = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <div aria-hidden className="select-none rounded-[20px] border bg-background p-4 text-foreground sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="size-6 rounded-lg bg-primary" />
          <span className="font-display text-sm font-semibold">POS-sible</span>
        </div>
        <div className="hidden gap-1 rounded-full border bg-card p-1 text-[11px] font-medium sm:flex">
          {["Home", "Sales", "Products", "Stock", "Reports"].map((l, i) => (
            <span key={l} className={cn("rounded-full px-3 py-1", i === 0 ? "bg-foreground text-background" : "text-muted-foreground")}>
              {l}
            </span>
          ))}
        </div>
        <span className="size-7 rounded-full bg-muted" />
      </div>
      <div className="mt-6 sm:mt-8">
        <p className="font-display text-xl font-semibold tracking-tight sm:text-3xl">Good morning, Rahim</p>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Here is how the shop is doing today</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Sales", taka(124580), "+12%"],
          ["Purchases", taka(48200), "+3%"],
          ["Expenses", taka(9650), "-4%"],
          ["Due from customers", taka(21300), "9 invoices"],
        ].map(([l, v, d]) => (
          <div key={l} className={tile}>
            <p className="text-[10px] text-muted-foreground sm:text-xs">{l}</p>
            <p className="font-display mt-1 text-base font-semibold tabular-nums sm:text-xl">{v}</p>
            <p className="mt-1 text-[10px] text-primary">{d}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className={tile}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Sales this week</p>
            <Chip>Last 7 days</Chip>
          </div>
          <Bars className="mt-4 h-28" values={[42, 58, 36, 64, 52, 71, 96]} highlight={6} />
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            {days.map((d) => (
              <span key={d} className="w-full text-center">
                {d}
              </span>
            ))}
          </div>
        </div>
        <div className={tile}>
          <p className="text-xs font-medium">Top products</p>
          <ul className="mt-3 space-y-2.5 text-xs">
            {[
              ["Miniket rice 5 kg", 214],
              ["Mustard oil 1 L", 168],
              ["Masoor dal 1 kg", 131],
              ["Sugar 1 kg", 97],
            ].map(([n, q]) => (
              <li key={n} className="flex items-center justify-between gap-2">
                <span className="truncate">{n}</span>
                <span className="tabular-nums text-muted-foreground">{q} sold</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function CartMock() {
  const lines = [
    ["Miniket rice 5 kg", 2, 1020],
    ["Mustard oil 1 L", 1, 235],
    ["Masoor dal 1 kg", 3, 540],
  ] as const;
  return (
    <div aria-hidden className={cn(tile, "select-none space-y-3 p-4")}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Current sale</p>
        <Chip tone="info">Barcode scanned</Chip>
      </div>
      <ul className="space-y-2 text-xs">
        {lines.map(([n, q, p]) => (
          <li key={n} className="flex items-center justify-between gap-2">
            <span className="truncate">{n}</span>
            <span className="tabular-nums text-muted-foreground">
              {q} x {taka(p / q)}
            </span>
            <span className="font-medium tabular-nums">{taka(p)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
        <span>Total</span>
        <span className="font-display tabular-nums">{taka(1795)}</span>
      </div>
      <div className="flex gap-2">
        <Chip tone="ok">Cash {taka(1000)}</Chip>
        <Chip>bKash {taka(795)}</Chip>
      </div>
    </div>
  );
}

export function StockMock() {
  const rows: [string, number, "ok" | "warn"][] = [
    ["Gulshan", 428, "ok"],
    ["Mirpur", 36, "warn"],
    ["Uttara", 212, "ok"],
  ];
  return (
    <div aria-hidden className={cn(tile, "select-none space-y-3 p-4")}>
      <p className="text-xs font-medium">Mustard oil 1 L</p>
      <ul className="space-y-2.5 text-xs">
        {rows.map(([n, q, t]) => (
          <li key={n} className="flex items-center justify-between">
            <span>{n}</span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums">{q} units</span>
              <Chip tone={t}>{t === "warn" ? "Low" : "OK"}</Chip>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SalesLineMock() {
  return (
    <div aria-hidden className={cn(tile, "select-none p-4")}>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Today</p>
          <p className="font-display text-2xl font-semibold tabular-nums">{taka(124580)}</p>
        </div>
        <Chip tone="ok">+12% vs yesterday</Chip>
      </div>
      <svg viewBox="0 0 240 80" className="mt-3 h-20 w-full" fill="none">
        <path d="M0 62 C30 58 40 30 70 36 S110 62 140 44 S190 14 240 10 V80 H0Z" className="fill-primary/10" />
        <path d="M0 62 C30 58 40 30 70 36 S110 62 140 44 S190 14 240 10" className="draw-line stroke-primary" strokeWidth="2.5" strokeLinecap="round" style={{ ["--len" as string]: 400 }} />
      </svg>
    </div>
  );
}

export function ReceiptMock() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[260px] select-none rounded-xl border bg-card p-5 font-mono text-[11px] shadow-[0_12px_32px_-16px_rgb(11_12_43/.3)]">
      <p className="text-center text-xs font-semibold">POS-sible Mart, Gulshan</p>
      <p className="text-center text-muted-foreground">Invoice INV-0412</p>
      <div className="my-3 border-t border-dashed" />
      {[
        ["Rice 5 kg x2", 1020],
        ["Mustard oil", 235],
        ["Masoor dal x3", 540],
      ].map(([n, p]) => (
        <p key={n} className="flex justify-between py-0.5">
          <span>{n}</span>
          <span className="tabular-nums">{taka(p as number)}</span>
        </p>
      ))}
      <div className="my-3 border-t border-dashed" />
      <p className="flex justify-between font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{taka(1795)}</span>
      </p>
      <p className="mt-0.5 flex justify-between text-muted-foreground">
        <span>Paid by bKash</span>
        <span className="tabular-nums">{taka(1795)}</span>
      </p>
      <div className="mt-4 h-8 rounded bg-[repeating-linear-gradient(90deg,var(--foreground)_0_2px,transparent_2px_5px)] opacity-70" />
    </div>
  );
}

const SLICES = [
  { label: "Cash", pct: 46, cls: "stroke-primary" },
  { label: "bKash", pct: 31, cls: "stroke-bkash" },
  { label: "Nagad", pct: 14, cls: "stroke-nagad" },
  { label: "Card", pct: 9, cls: "stroke-sky-500" },
];

export function DonutMock() {
  const starts = SLICES.map((_, i) => SLICES.slice(0, i).reduce((a, s) => a + s.pct, 0));
  return (
    <div aria-hidden className="select-none">
      <div className="relative mx-auto size-40">
        <svg viewBox="0 0 36 36" className="size-full -rotate-90" fill="none" strokeWidth="4">
          {SLICES.map((s, i) => (
            <circle key={s.label} cx="18" cy="18" r="14" pathLength={100} strokeDasharray={`${s.pct - 1} ${101 - s.pct}`} strokeDashoffset={-starts[i]} className={s.cls} />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-2xl font-semibold">46%</p>
            <p className="text-[10px] text-muted-foreground">paid in cash</p>
          </div>
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {SLICES.map((s) => (
          <li key={s.label} className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", s.cls.replace("stroke-", "bg-"))} />
              {s.label}
            </span>
            <span className="tabular-nums text-muted-foreground">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const POS_ITEMS: [string, number][] = [
  ["Rice 5 kg", 510], ["Mustard oil 1 L", 235], ["Masoor dal 1 kg", 180], ["Sugar 1 kg", 130], ["Salt 1 kg", 45], ["Tea 400 g", 220],
];

export function PosMock() {
  return (
    <div aria-hidden className="grid select-none gap-3 sm:grid-cols-[1.3fr_1fr]">
      <div className="grid grid-cols-3 gap-2">
        {POS_ITEMS.map(([n, p], i) => (
          <div key={n} className={cn(tile, "flex flex-col justify-end gap-1 p-3 pt-10", i < 3 && "border-primary/40")}>
            <p className="text-[11px] font-medium">{n}</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">{taka(p)}</p>
          </div>
        ))}
      </div>
      <CartMock />
    </div>
  );
}

export function TransfersMock() {
  const rows: [string, string, string, "ok" | "info" | "warn"][] = [
    ["TR-0087", "Gulshan to Mirpur", "Completed", "ok"],
    ["TR-0088", "Gulshan to Uttara", "In transit", "info"],
    ["TR-0089", "Uttara to Mirpur", "Pending", "warn"],
  ];
  return (
    <div aria-hidden className={cn(tile, "select-none divide-y p-0")}>
      {rows.map(([id, route, st, tone]) => (
        <div key={id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
          <div>
            <p className="font-medium">{route}</p>
            <p className="text-muted-foreground">{id}</p>
          </div>
          <Chip tone={tone}>{st}</Chip>
        </div>
      ))}
    </div>
  );
}

export function PnlMock() {
  return (
    <div aria-hidden className="grid select-none gap-3 sm:grid-cols-2">
      <div className={cn(tile, "space-y-2.5 p-4 text-xs")}>
        <p className="font-medium">Profit and loss, this month</p>
        {([
          ["Sales", 842300],
          ["Cost of goods", -561200],
          ["Expenses", -118400],
        ] as [string, number][]).map(([l, v]) => (
          <p key={l} className="flex justify-between">
            <span className="text-muted-foreground">{l}</span>
            <span className="tabular-nums">{v < 0 ? `-${taka(-v)}` : taka(v)}</span>
          </p>
        ))}
        <p className="flex justify-between border-t pt-2.5 font-semibold">
          <span>Net profit</span>
          <span className="tabular-nums text-primary">{taka(162700)}</span>
        </p>
      </div>
      <div className={cn(tile, "p-4")}>
        <p className="text-xs font-medium">Profit by week</p>
        <Bars className="mt-3" values={[28, 41, 35, 58]} highlight={3} />
      </div>
    </div>
  );
}

export function ImportMock() {
  return (
    <div aria-hidden className={cn(tile, "select-none space-y-2.5 p-4 text-xs")}>
      {[
        ["products.csv", "Done", "ok"],
        ["Opening stock", "Mapping", "info"],
        ["Suppliers", "Waiting", "muted"],
      ].map(([n, s, t]) => (
        <div key={n} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
          <span>{n}</span>
          <Chip tone={t as "ok" | "info" | "muted"}>{s}</Chip>
        </div>
      ))}
    </div>
  );
}

export function ForecastMock() {
  return (
    <div aria-hidden className={cn(tile, "relative select-none p-4")}>
      <p className="text-xs font-medium">Forecast</p>
      <svg viewBox="0 0 240 90" className="mt-2 h-24 w-full" fill="none">
        <path d="M0 74 C40 70 60 50 100 48 S160 40 240 12" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M0 80 C50 78 80 66 120 62 S190 54 240 40" className="stroke-muted-foreground/40" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
        <circle cx="168" cy="36" r="4" className="fill-primary" />
      </svg>
      <span className="absolute right-6 top-8 rounded-lg bg-foreground px-2 py-1 text-[10px] font-medium text-background tabular-nums">{taka(658200)}</span>
    </div>
  );
}

export function TourTile({ kind }: { kind: 0 | 1 | 2 }) {
  return (
    <div aria-hidden className="h-full select-none rounded-xl bg-muted/60 p-4">
      {kind === 0 && (
        <div className="space-y-2">
          {["Restock mustard oil", "Win back 14 regulars", "Collect 6 old dues"].map((t) => (
            <p key={t} className="rounded-lg bg-card px-3 py-2 text-xs font-medium">
              {t}
            </p>
          ))}
        </div>
      )}
      {kind === 1 && (
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 28 }, (_, i) => (
            <span key={i} className="aspect-square rounded-md bg-primary" style={{ opacity: 0.12 + ((i * 37) % 10) / 12 }} />
          ))}
        </div>
      )}
      {kind === 2 && (
        <div className="space-y-2">
          {[
            ["Owner", "Full access"],
            ["Manager", "No deletes"],
            ["Cashier", "POS only"],
          ].map(([r, a]) => (
            <p key={r} className="flex items-center justify-between rounded-lg bg-card px-3 py-2 text-xs">
              <span className="font-medium">{r}</span>
              <Chip>{a}</Chip>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
