"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { CheckIcon, PhoneIcon, XIcon } from "lucide-react";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCan } from "@/lib/auth/useCan";
import { todayISO } from "@/lib/dates";
import { useProducts } from "@/lib/data/hooks/products";
import { useDiscountMutations } from "@/lib/data/hooks/sales";
import { useSettings } from "@/lib/data/hooks/settings";
import type { ContactRow } from "@/lib/data/services/contacts";
import { discountsService } from "@/lib/data/services/discounts";
import { useFormat } from "@/lib/i18n/format";
import { telHref, waHref } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { saleErrorMessage } from "@/features/sales/saleError";

type Offer = { percent: number; until: string; items: string };

/**
 * Everything about winning back lapsed regulars in one place: who they are and why they are listed, an optional
 * customer-only offer (everything or chosen products), then a ready-written WhatsApp message per customer.
 */
export function WinBackOfferDialog({ open, customers, onClose }: { open: boolean; customers: ContactRow[]; onClose: () => void }) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const { data: settings } = useSettings();
  const { save } = useDiscountMutations();
  const { data: products } = useProducts({ pageSize: -1 });
  const [percent, setPercent] = useState(10);
  const [days, setDays] = useState(14);
  const [scope, setScope] = useState<"all" | "products">("all");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [term, setTerm] = useState("");
  // null: still choosing; { offer: null }: sending a plain message; { offer }: offer created, now sending it.
  const [sending, setSending] = useState<{ offer: Offer | null } | null>(null);
  const [opened, setOpened] = useState<Set<string>>(new Set());

  const canOffer = can("discount.create");
  const names = new Map((products?.rows ?? []).map((p) => [p.id, p.name]));
  const found = (products?.rows ?? []).filter((p) => term && !productIds.includes(p.id) && p.name.toLowerCase().includes(term.toLowerCase())).slice(0, 6);
  const valid = percent >= 1 && percent <= 100 && days >= 1 && (scope === "all" || productIds.length > 0);
  const shop = settings?.business.name ?? "";
  const reachable = customers.filter((c) => waHref(c.mobile, "")).length;

  const close = () => {
    setSending(null); setOpened(new Set()); setScope("all"); setProductIds([]); setTerm("");
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || !settings || !customers.length) return;
    try {
      const start = todayISO(settings.business.timeZone);
      const end = format(addDays(parseISO(start), days - 1), "yyyy-MM-dd");
      const ids = scope === "products" ? productIds : [];
      // Only the highest-priority rule applies, so the offer goes above every other one to keep the promise in the message.
      const top = Math.max(0, ...(await discountsService.list({ pageSize: -1 })).rows.map((r) => r.priority));
      await save.mutateAsync({
        name: t("ops.winBackOfferName", { date: f.date(start) }), locationId: null, productIds: ids, brandId: null, categoryId: null,
        priority: top + 1, type: "percentage", amount: percent, startsAt: start, endsAt: end,
        priceGroupIds: [], applyInCustomerGroups: false, contactIds: customers.map((c) => c.id), active: true,
      });
      toast.success(t("ops.winBackOfferSaved", { count: customers.length }));
      const items = scope === "all"
        ? t("ops.offerOnEverything")
        : ids.length <= 2 ? ids.map((id) => names.get(id)).join(", ") : t("ops.offerOnSome", { first: names.get(ids[0]) ?? "", count: ids.length - 1 });
      setSending({ offer: { percent, until: f.date(end), items } });
    } catch (err) {
      toast.error(saleErrorMessage(err, t));
    }
  };

  const message = (c: ContactRow) => {
    const name = c.name.split(" ")[0];
    const o = sending?.offer;
    return o ? t("ops.winBackOfferMessage", { name, shop, percent: o.percent, items: o.items, until: o.until }) : t("ops.winBackMessage", { name, shop });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        {sending ? (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{sending.offer ? t("ops.sendOfferTitle") : t("ops.sendMessageTitle")}</DialogTitle>
              <DialogDescription>
                {sending.offer ? t("ops.sendOfferHint", { percent: sending.offer.percent, items: sending.offer.items, until: sending.offer.until }) : t("ops.sendMessageHint")}
              </DialogDescription>
            </DialogHeader>
            <ul className="-mx-1 grid max-h-80 gap-1 overflow-y-auto px-1">
              {customers.map((c) => {
                const wa = waHref(c.mobile, message(c));
                const tel = telHref(c.mobile);
                const done = opened.has(c.id);
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground tabular">{c.mobile || t("ops.noMobile")}</div>
                    </div>
                    {wa && tel ? (
                      <>
                        <Button asChild size="icon" variant="ghost"><a href={tel} aria-label={t("ops.call")} title={t("ops.call")}><PhoneIcon /></a></Button>
                        <Button asChild size="sm" variant={done ? "outline" : "default"}>
                          <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(new Set(opened).add(c.id))}>
                            {done ? <CheckIcon /> : <WhatsAppIcon />}{done ? t("ops.offerSent") : t("ops.sendOnWhatsApp")}
                          </a>
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("ops.noMobile")}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">{t(sending.offer ? "ops.sentProgress" : "ops.sentProgressPlain", { done: opened.size, total: reachable })}</p>
            <DialogFooter>
              {sending.offer && <Button asChild variant="outline"><Link href="/sales/discounts" onClick={close}>{t("ops.viewDiscount")}</Link></Button>}
              <Button type="button" onClick={close}>{t("common.close")}</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{t("ops.winBackTitle", { count: customers.length })}</DialogTitle>
              <DialogDescription>{t("ops.winBackWhy")}</DialogDescription>
            </DialogHeader>
            <ul className="-mx-1 grid max-h-44 gap-1 overflow-y-auto px-1" aria-label={t("ops.lapsedRegulars")}>
              {customers.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-sm odd:bg-muted/40">
                  <span className="min-w-0 truncate font-medium">{c.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular">
                    {t("ops.lapsedFacts", { last: c.lastVisit ? f.date(c.lastVisit) : "", visits: c.visits ?? 0, basket: f.money(c.basket ?? 0) })}
                  </span>
                </li>
              ))}
            </ul>

            {canOffer && (
              <fieldset className="grid gap-3 rounded-lg border p-3">
                <legend className="px-1 text-sm font-medium">{t("ops.addOffer")}</legend>
                <div role="radiogroup" aria-label={t("ops.offerOn")} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                  {(["all", "products"] as const).map((s) => (
                    <button
                      key={s} type="button" role="radio" aria-checked={scope === s} onClick={() => setScope(s)}
                      className={cn("rounded-md px-3 py-1.5 text-sm transition-colors", scope === s ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      {t(s === "all" ? "ops.offerScopeAll" : "ops.offerScopeProducts")}
                    </button>
                  ))}
                </div>
                {scope === "products" && (
                  <div className="grid gap-2">
                    <Input id="wb-prod" aria-label={t("sales.products")} placeholder={t("sales.searchProductsShort")} value={term} onChange={(e) => setTerm(e.target.value)} />
                    {found.map((p) => (
                      <button key={p.id} type="button" className="rounded-md px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => { setProductIds([...productIds, p.id]); setTerm(""); }}>{p.name}</button>
                    ))}
                    {productIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {productIds.map((id) => (
                          <Badge key={id} variant="secondary" className="gap-1">{names.get(id) ?? id}<button type="button" aria-label={t("common.remove")} onClick={() => setProductIds(productIds.filter((x) => x !== id))}><XIcon className="size-3" /></button></Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t("ops.pickProducts")}</p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="wb-pct">{t("ops.offerPercent")}</Label>
                    <Input id="wb-pct" type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className="tabular-nums" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="wb-days">{t("ops.offerDays")}</Label>
                    <Input id="wb-days" type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} className="tabular-nums" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("ops.offerOnlyThem")}</p>
              </fieldset>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSending({ offer: null })}>{t("ops.messageWithoutOffer")}</Button>
              {canOffer && <Button type="submit" disabled={!valid || save.isPending}>{t("ops.createOffer")}</Button>}
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
