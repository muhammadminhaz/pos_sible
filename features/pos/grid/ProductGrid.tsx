"use client";

import { useEffect, useRef, useState } from "react";
import { PackageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useLookups } from "@/lib/data/hooks/lookups";
import { usePosProducts } from "@/lib/data/hooks/pos";
import { useSettings } from "@/lib/data/hooks/settings";
import type { PosProduct } from "@/lib/data/services/pos";
import { useFormat } from "@/lib/i18n/format";
import { useCart } from "@/lib/pos/store";
import { focusSearch } from "../focus";
import { useAddToCart } from "../usePos";

const PAGE = 40;

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function ProductCard({ p, locationId }: { p: PosProduct; locationId: string }) {
  const t = useTranslations("pos.grid");
  const f = useFormat();
  const { data: settings } = useSettings();
  const add = useAddToCart(locationId);
  const [open, setOpen] = useState(false);
  const out = p.manageStock && p.stock <= 0 && !settings?.sale.allowOverselling;
  const low = p.manageStock && p.stock > 0 && p.alertQty !== null && p.stock <= p.alertQty;
  const variable = p.type === "variable" && p.variations.length > 1;

  const pick = (vi: number) => {
    if (add(p, p.variations[vi])) {
      setOpen(false);
      focusSearch();
    }
  };

  const card = (
    <button
      type="button"
      disabled={out}
      onClick={variable ? undefined : () => pick(0)}
      className="group flex min-h-44 flex-col overflow-hidden rounded-xl border bg-card text-left shadow-xs transition duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md active:translate-y-0 active:scale-[0.97] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="relative grid aspect-[4/3] place-items-center bg-muted text-lg font-semibold text-muted-foreground">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" className="size-full object-cover" />
        ) : (
          initials(p.name)
        )}
        {out && <Badge variant="destructive" className="absolute top-1.5 right-1.5">{t("outOfStock")}</Badge>}
        {low && <Badge className="absolute top-1.5 right-1.5 border-warning/40 bg-warning-soft text-warning-foreground">{t("lowStock")}</Badge>}
      </span>
      <span className="flex flex-1 flex-col gap-1 p-2">
        <span className="line-clamp-2 text-sm leading-snug font-medium">{p.name}</span>
        <span className="mt-auto flex items-center justify-between text-xs">
          <span className="font-semibold tabular-nums">{f.money(p.priceInc)}</span>
          {p.manageStock && <span className="text-muted-foreground tabular-nums">{f.qty(p.stock)}</span>}
        </span>
      </span>
    </button>
  );

  if (!variable) return card;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{card}</PopoverTrigger>
      <PopoverContent className="w-64 p-1">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{t("chooseVariation")}</p>
        {p.variations.map((v, i) => {
          const vOut = p.manageStock && v.stock <= 0 && !settings?.sale.allowOverselling;
          return (
            <Button key={v.id} variant="ghost" className="w-full justify-between" disabled={vOut} onClick={() => pick(i)}>
              <span className="truncate">{v.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {f.money(v.priceInc)}
                {p.manageStock && ` · ${f.qty(v.stock)}`}
              </span>
            </Button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

export function ProductGrid({ locationId }: { locationId: string }) {
  const t = useTranslations("pos.grid");
  const { data: lookups } = useLookups();
  const { cart } = useCart(locationId);
  const [featured, setFeatured] = useState(false);
  const [categoryId, setCategoryId] = useState<string>();
  const [brandId, setBrandId] = useState<string>();
  const [size, setSize] = useState(PAGE);
  const { data, isPending } = usePosProducts({
    locationId, contactId: cart.contactId, featured, categoryId, brandId, page: 0, pageSize: size,
  });
  const sentinel = useRef<HTMLDivElement>(null);
  const hasMore = !!data && data.rows.length < data.total;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSize((s) => s + PAGE), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore]);

  const filter = (fn: () => void) => () => {
    fn();
    setSize(PAGE);
  };
  const categories = (lookups?.categories ?? []).filter((c) => !c.parentId);
  const brands = lookups?.brands ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid gap-2 border-b bg-card/60 p-3">
        <div className="flex gap-2">
          <Chip active={!featured} onClick={filter(() => setFeatured(false))}>{t("all")}</Chip>
          <Chip active={featured} onClick={filter(() => setFeatured(true))}>{t("featured")}</Chip>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t("allCategories")}>
          <Chip active={!categoryId} onClick={filter(() => setCategoryId(undefined))}>{t("allCategories")}</Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={categoryId === c.id} onClick={filter(() => setCategoryId(c.id))}>{c.name}</Chip>
          ))}
        </div>
        {brands.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t("allBrands")}>
            <Chip active={!brandId} onClick={filter(() => setBrandId(undefined))}>{t("allBrands")}</Chip>
            {brands.map((b) => (
              <Chip key={b.id} active={brandId === b.id} onClick={filter(() => setBrandId(b.id))}>{b.name}</Chip>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {isPending ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : !data?.rows.length ? (
          <EmptyState icon={PackageIcon} title={t("empty")} />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {data.rows.map((p) => <ProductCard key={p.id} p={p} locationId={locationId} />)}
          </div>
        )}
        <div ref={sentinel} className="h-px" />
      </div>
    </div>
  );
}
