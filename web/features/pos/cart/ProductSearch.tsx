"use client";

import { useDeferredValue, useState, type KeyboardEvent } from "react";
import { PlusIcon, ScanBarcodeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCan } from "@/lib/auth/useCan";
import { usePosLookup, usePosSearch } from "@/lib/data/hooks/pos";
import { useSettings } from "@/lib/data/hooks/settings";
import type { PosSearchHit } from "@/lib/data/services/pos";
import { useFormat } from "@/lib/i18n/format";
import { parseScaleBarcode } from "@/lib/pos/scale";
import { useCart } from "@/lib/pos/store";
import { SEARCH_ID } from "../focus";
import { useAddToCart } from "../usePos";

export function ProductSearch({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const { cart } = useCart(locationId);
  const { data: settings } = useSettings();
  const add = useAddToCart(locationId);
  const lookup = usePosLookup();
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(0);
  const deferred = useDeferredValue(term);
  const hideSuggestions = settings?.pos.hideProductSuggestion;
  const { data: hits = [] } = usePosSearch({ locationId, contactId: cart.contactId, term: hideSuggestions ? "" : deferred });
  const open = term.trim().length > 0 && hits.length > 0 && deferred === term;

  const choose = (hit: PosSearchHit, qty = 1) => {
    if (add(hit.product, hit.variation, qty)) {
      setTerm("");
      setActive(0);
    }
  };

  /** Enter: a highlighted suggestion wins; otherwise treat the text as a scan (scale label, then SKU). */
  const submit = async () => {
    const raw = term.trim();
    if (!raw) return;
    if (open && hits[active]) return choose(hits[active]);
    const scale = settings?.pos.enableWeighingScale ? parseScaleBarcode(raw, settings.pos.weighingScale) : null;
    const res = await lookup({ locationId, contactId: cart.contactId, term: scale?.sku ?? raw });
    const hit = res.find((h) => h.exact) ?? (res.length === 1 ? res[0] : undefined);
    if (hit) return choose(hit, scale?.qty ?? 1);
    toast.error(t("pos.search.noMatch", { term: raw }));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    } else if (e.key === "Escape" && term) {
      e.preventDefault();
      setTerm("");
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative flex-1">
        <ScanBarcodeIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={SEARCH_ID}
          autoFocus
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="pos-search-list"
          aria-activedescendant={open ? `pos-hit-${active}` : undefined}
          placeholder={t("pos.search.placeholder")}
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-11 pl-10 text-base"
        />
        {open && (
          <ul id="pos-search-list" role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
            {hits.map((h, i) => (
              <li
                key={h.variation.id}
                id={`pos-hit-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(h)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm", i === active && "bg-accent")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {h.product.name}
                    {h.product.type === "variable" && <span className="text-muted-foreground"> · {h.variation.name}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{h.variation.sku}</span>
                </span>
                {settings?.pos.showPricingOnSuggestion !== false && (
                  <span className="tabular-nums">{f.money(h.variation.priceInc)}</span>
                )}
                {h.product.manageStock && (
                  <span className={cn("w-20 text-right text-xs tabular-nums", h.variation.stock <= 0 ? "text-danger" : "text-muted-foreground")}>
                    {t("pos.search.inStock", { qty: f.qty(h.variation.stock) })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {can("product.create") && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-lg" aria-label={t("pos.search.addProduct")} onClick={() => window.open("/products/new", "_blank")}>
              <PlusIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("pos.search.addProduct")}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
