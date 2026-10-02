"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDownIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCan } from "@/lib/auth/useCan";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useSettings } from "@/lib/data/hooks/settings";
import type { LineTotals } from "@/lib/domain/totals";
import { useFormat } from "@/lib/i18n/format";
import {
  exceedsStock, removeLine, setLineDiscount, setLineNote, setPrice, setQty, setSerials, setServiceStaff, type CartLine,
} from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { useCartFlag } from "../dialogStore";
import { focusSearch } from "../focus";
import { useFlash } from "../usePos";

type Props = { locationId: string; line: CartLine; index: number; totals: LineTotals; expanded: boolean; onToggle: () => void };

export function CartRow({ locationId, line, index, totals, expanded, onToggle }: Props) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const { data: settings } = useSettings();
  const { data: lookups } = useLookups();
  const { update } = useCart(locationId);
  const flashKey = useFlash((s) => s.key);
  const flashToken = useFlash((s) => s.n);
  const ref = useRef<HTMLTableRowElement>(null);
  const [serial, setSerial] = useState("");
  const flagged = useCartFlag((s) => s.name === line.name);
  const flashing = flashKey === line.key;
  const over = exceedsStock(line) || flagged;
  const needsSerials = line.enableSerial && line.serials.length !== line.qty;
  const open = expanded || needsSerials || flagged;
  const step = line.allowDecimal ? 0.1 : 1;
  const oversell = !!settings?.sale.allowOverselling;
  const serviceStaff = settings?.modules.serviceStaff && settings.pos.inlineServiceStaff
    ? (lookups?.users ?? []).filter((u) => lookups?.roles.find((r) => r.id === u.roleId)?.isServiceStaff)
    : [];

  useEffect(() => {
    if (flashing) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [flashing]);

  const changeQty = (q: number) => {
    if (!oversell && exceedsStock(line, q)) {
      toast.error(t("errors.insufficientStock", { available: f.qty(line.maxQty ?? 0), product: line.name }));
      return;
    }
    update((c) => setQty(c, line.key, q));
  };

  const addSerial = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const v = serial.trim();
    if (v && !line.serials.includes(v)) update((c) => setSerials(c, line.key, [...line.serials, v]));
    setSerial("");
  };

  return (
    <>
      <tr
        ref={ref}
        className={cn("relative border-b align-middle transition-colors", over && "bg-danger/5 ring-1 ring-danger ring-inset")}
      >
        <td className="w-8 py-2 pl-3 text-xs text-muted-foreground tabular-nums">
          {/* Keyed on the flash token so re-flashing the same line remounts this overlay and replays
              the CSS animation, without remounting the row (the qty input keeps focus). */}
          {flashing && <span key={flashToken} aria-hidden className="pointer-events-none absolute inset-0 animate-[pos-flash_1s_ease-out]" />}
          {f.number(index + 1)}
        </td>
        <td className="py-2 pr-2">
          <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-1 text-left">
            <ChevronDownIcon className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
            <span className="min-w-0">
              <span className="line-clamp-2 text-sm font-medium">{line.name}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {line.sku}
                {line.maxQty !== null && (
                  <span className={cn(over && "font-medium text-danger")}>· {t("pos.cart.stockLeft", { qty: f.qty(line.maxQty) })}</span>
                )}
                {needsSerials && <Badge variant="outline" className="h-4 px-1 text-[10px]">{t("pos.cart.serials")}</Badge>}
                {line.discount && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{t("pos.cart.discount")}</Badge>}
              </span>
            </span>
          </button>
        </td>
        <td className="py-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" aria-label={t("pos.cart.decrease")} onClick={() => changeQty(line.qty - step)} disabled={line.qty <= step}>
              <MinusIcon />
            </Button>
            <Input
              id={`pos-qty-${line.key}`}
              type="number"
              inputMode="decimal"
              min={step}
              step={line.allowDecimal ? "any" : 1}
              aria-label={`${t("pos.cart.qty")} ${line.name}`}
              value={line.qty}
              onChange={(e) => changeQty(Number(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && focusSearch()}
              className="h-8 w-16 px-1 text-center tabular-nums"
            />
            <Button variant="outline" size="icon-sm" aria-label={t("pos.cart.increase")} onClick={() => changeQty(line.qty + step)}>
              <PlusIcon />
            </Button>
          </div>
          <span className="mt-0.5 block text-center text-[10px] text-muted-foreground">{f.unit(line.unitName)}</span>
        </td>
        <td className="py-2 pl-3 text-right tabular-nums">
          {settings?.pos.subtotalEditable && can("pos.edit_price") ? (
            <Input
              type="number"
              min={0}
              step="any"
              aria-label={`${t("pos.cart.price")} ${line.name}`}
              value={line.unitPrice}
              onChange={(e) => update((c) => setPrice(c, line.key, Number(e.target.value)))}
              className="ml-auto h-8 w-24 text-right tabular-nums"
            />
          ) : (
            <span className="text-sm">{f.amount(totals.netUnitInc)}</span>
          )}
        </td>
        <td className="py-2 pl-3 pr-2 text-right text-sm font-medium tabular-nums">{f.amount(totals.subtotal)}</td>
        <td className="w-10 py-2 pr-2">
          <Button variant="ghost" size="icon-sm" aria-label={t("pos.cart.remove", { name: line.name })} onClick={() => update((c) => removeLine(c, line.key))}>
            <XIcon />
          </Button>
        </td>
      </tr>
      {open && (
        <tr className="border-b bg-muted/40">
          <td />
          <td colSpan={5} className="py-3 pr-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="grid gap-1">
                <Label className="text-xs">{t("pos.cart.unitPrice")}</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  disabled={!can("pos.edit_price")}
                  value={line.unitPrice}
                  onChange={(e) => update((c) => setPrice(c, line.key, Number(e.target.value)))}
                  className="h-8 tabular-nums"
                />
                {line.taxRate > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {`${f.percent(line.taxRate)} · ${line.taxType === "inclusive" ? t("pos.cart.taxInc") : t("pos.cart.taxExc")} · ${f.amount(totals.unitTax)}`}
                  </span>
                )}
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">{t("pos.cart.discount")}</Label>
                <div className="flex gap-1">
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    disabled={!can("pos.edit_discount")}
                    value={line.discount?.type ?? "fixed"}
                    onValueChange={(v) => v && update((c) => setLineDiscount(c, line.key, { type: v as "fixed" | "percentage", amount: line.discount?.amount ?? 0 }))}
                  >
                    <ToggleGroupItem value="fixed" aria-label={t("pos.discount.fixed")}>{settings?.business.currencySymbol || "৳"}</ToggleGroupItem>
                    <ToggleGroupItem value="percentage" aria-label={t("pos.discount.percentage")}>%</ToggleGroupItem>
                  </ToggleGroup>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    disabled={!can("pos.edit_discount")}
                    value={line.discount?.amount ?? ""}
                    onChange={(e) => {
                      const amount = Number(e.target.value);
                      update((c) => setLineDiscount(c, line.key, amount > 0 ? { type: line.discount?.type ?? "fixed", amount } : null));
                    }}
                    className="h-8 tabular-nums"
                  />
                </div>
              </div>
              <div className="col-span-2 grid gap-1">
                <Label className="text-xs">{t("pos.cart.note")}</Label>
                <Input value={line.note} onChange={(e) => update((c) => setLineNote(c, line.key, e.target.value))} className="h-8" />
              </div>
              {line.enableSerial && (
                <div className="col-span-2 grid gap-1">
                  <Label className="text-xs" htmlFor={`serial-${line.key}`}>
                    {`${t("pos.cart.serials")} (${f.number(line.serials.length)}/${f.qty(line.qty)})`}
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {line.serials.map((s) => (
                      <Badge key={s} variant="secondary" className="gap-1">
                        {s}
                        <button type="button" aria-label={t("common.remove")} onClick={() => update((c) => setSerials(c, line.key, line.serials.filter((x) => x !== s)))}>
                          <XIcon className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Input
                    id={`serial-${line.key}`}
                    autoFocus={needsSerials}
                    placeholder={t("pos.cart.serialsHint")}
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    onKeyDown={addSerial}
                    className="h-8"
                  />
                </div>
              )}
              {serviceStaff.length > 0 && (
                <div className="col-span-2 grid gap-1">
                  <Label htmlFor={`staff-${line.key}`} className="text-xs">{t("pos.cart.serviceStaff")}</Label>
                  <Select value={line.serviceStaffId ?? "none"} onValueChange={(v) => update((c) => setServiceStaff(c, line.key, v === "none" ? null : v))}>
                    <SelectTrigger id={`staff-${line.key}`} size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("common.none")}</SelectItem>
                      {serviceStaff.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {`${u.firstName} ${u.lastName}`.trim()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
