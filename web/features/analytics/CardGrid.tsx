"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ReactGridLayout, { useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { GripVerticalIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { CARD } from "@/components/shared/card-surface";
import { useLayouts, type Place } from "./layoutStore";

export const COLS = 12;
const ROW = 24;
const GAP = 16;
const NARROW = 768;
const HANDLE = ".analytics-drag";

export type CardDef = { id: string; w: number; h: number; minW?: number; minH?: number; maxW?: number; maxH?: number; node: ReactNode };

/** The first-visit arrangement: cards flow left to right in the order given and wrap at the 12th column. */
export function defaultLayout(items: CardDef[]): Place[] {
  let x = 0, y = 0, rowH = 0;
  return items.map((c) => {
    if (x + c.w > COLS) { x = 0; y += rowH; rowH = 0; }
    const p = { i: c.id, x, y, w: c.w, h: c.h };
    x += c.w;
    rowH = Math.max(rowH, c.h);
    return p;
  });
}

const same = (a: Place[], b: Place[]) => a.length === b.length && a.every((p) => { const q = b.find((z) => z.i === p.i); return q && q.x === p.x && q.y === p.y && q.w === p.w && q.h === p.h; });

const HeightContext = createContext<number | null>(null);
/** Height the enclosing card gives its chart; `fallback` outside a card. */
export const useChartHeight = (fallback: number) => useContext(HeightContext) ?? fallback;

/** A dashboard card on the grid: the title bar is the handle to drag it, the corner resizes it. `scroll` lets tables scroll inside. */
export function GridCard({ title, subtitle, scroll, children }: { title: string; subtitle?: string; scroll?: boolean; children: ReactNode }) {
  const t = useTranslations("analytics");
  const body = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    if (!body.current) return;
    const ro = new ResizeObserver(([e]) => setH(Math.max(120, Math.floor(e.contentRect.height))));
    ro.observe(body.current);
    return () => ro.disconnect();
  }, []);
  return (
    <section className={cn(CARD, "flex h-full flex-col")}>
      <header className="analytics-drag mb-3 flex cursor-grab items-start gap-2 active:cursor-grabbing" title={t("dragHint")}>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <GripVerticalIcon data-print-hide className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" aria-hidden />
      </header>
      <HeightContext.Provider value={h}>
        <div ref={body} className={cn("min-h-0 flex-1", scroll ? "overflow-auto" : "overflow-hidden")}>{children}</div>
      </HeightContext.Provider>
    </section>
  );
}

/** A headline figure on the grid; the whole tile drags. */
export function TileCard({ children }: { children: ReactNode }) {
  return <section className={cn(CARD, "analytics-drag h-full cursor-grab overflow-hidden active:cursor-grabbing")}>{children}</section>;
}

/**
 * Cards on a 12-column grid. Drag a title bar to move a card, drag its bottom-right corner to resize it; the other cards
 * make room. The arrangement is saved per `section` and restored next visit. On narrow screens everything stacks and the
 * layout is fixed.
 */
export function CardGrid({ section, items }: { section: string; items: CardDef[] }) {
  const { width, containerRef, mounted } = useContainerWidth();
  const saved = useLayouts((s) => s.layouts[section]);
  const save = useLayouts((s) => s.save);
  const reset = useLayouts((s) => s.reset);
  const narrow = mounted && width < NARROW;
  // Items are rebuilt on every render; only their ids and default sizes decide the layout.
  const sig = items.map((c) => `${c.id}:${c.w}x${c.h}:${c.minW ?? ""}x${c.minH ?? ""}:${c.maxW ?? ""}x${c.maxH ?? ""}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const base = useMemo(() => defaultLayout(items), [sig]);

  // Saved places win; a card added since (or missing) falls back to its default place.
  const merged = useMemo(() => base.map((d) => {
    const p = saved?.find((z) => z.i === d.i);
    const c = items.find((z) => z.id === d.i);
    if (!p || !c) return d;
    const w = Math.min(c.maxW ?? COLS, Math.max(c.minW ?? 2, p.w)), h = Math.min(c.maxH ?? 24, Math.max(c.minH ?? 3, p.h));
    return { ...p, w, h, x: Math.min(p.x, COLS - w) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [base, saved]);
  const layout = useMemo(() => {
    const spec = new Map(items.map((c) => [c.id, c]));
    const stamp = (p: Place) => ({ ...p, minW: spec.get(p.i)?.minW ?? 2, minH: spec.get(p.i)?.minH ?? 3, maxW: spec.get(p.i)?.maxW ?? COLS, maxH: spec.get(p.i)?.maxH ?? 24 });
    if (!narrow) return merged.map(stamp);
    let y = 0;
    return [...merged].sort((a, b) => a.y - b.y || a.x - b.x).map((p) => { const out = { ...p, x: 0, y, w: 1, minW: 1 }; y += p.h; return out; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merged, sig, narrow]);

  return (
    <div ref={containerRef} data-analytics-grid={section}>
      {mounted && (
        <ReactGridLayout
          width={width}
          layout={layout}
          gridConfig={{ cols: narrow ? 1 : COLS, rowHeight: ROW, margin: [GAP, GAP], containerPadding: [0, 0], maxRows: Infinity }}
          dragConfig={{ enabled: !narrow, handle: HANDLE, cancel: "a,button,input,[role=button]" }}
          resizeConfig={{ enabled: !narrow, handles: ["se"] }}
          onLayoutChange={(next) => {
            if (narrow) return;
            const places = next.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
            if (same(places, base)) { if (saved) reset(section); } else if (!saved || !same(places, saved)) save(section, places);
          }}
        >
          {items.map((c) => <div key={c.id}>{c.node}</div>)}
        </ReactGridLayout>
      )}
    </div>
  );
}
