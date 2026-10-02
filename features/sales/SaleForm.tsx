"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { useContacts } from "@/lib/data/hooks/contacts";
import { useLookups } from "@/lib/data/hooks/lookups";
import { usePosSearch } from "@/lib/data/hooks/pos";
import { useOpenOrders, useSaleMutations } from "@/lib/data/hooks/sales";
import { useSettings } from "@/lib/data/hooks/settings";
import { SHIPPING_STATUSES, type PaymentMethod, type ShippingStatus, type Transaction } from "@/lib/data/schemas";
import { toCartItem } from "@/lib/data/services/pos";
import type { SaleInput } from "@/lib/data/services/sales";
import { useUI } from "@/lib/data/store/ui";
import { addItem, patchCart, removeLine, setContact, setLineDiscount, setPrice, setQty, WALK_IN_ID, type Cart } from "@/lib/pos/cart";
import { methodLabel, tillMethods } from "@/lib/pos/methods";
import { cartTotals } from "@/lib/pos/selectors";
import { usePosDialogs } from "@/features/pos/dialogStore";
import { saleErrorMessage } from "./saleError";

type Status = "final" | "draft" | "quotation" | "proforma";
export type SaleFormInit = { id?: string; cart: Cart; sale?: Transaction; status: Status; locationId?: string; orderIds?: string[] };

const selectOf = (opts: { value: string; label: string }[], value: string, onChange: (v: string) => void, id?: string, label?: string) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger id={id} aria-label={label} className="w-full"><SelectValue /></SelectTrigger>
    <SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
  </Select>
);

export function SaleForm({ init }: { init: SaleFormInit }) {
  const t = useTranslations();
  const router = useRouter();
  const { data: lookups } = useLookups();
  const { data: settings } = useSettings();
  const { data: customers } = useContacts({ type: "customer", active: "active", pageSize: -1 });
  const globalLocation = useUI((s) => s.locationId);
  const showReceipt = usePosDialogs((s) => s.showReceipt);
  const { save } = useSaleMutations();
  const s0 = init.sale;

  const [locationId, setLocationId] = useState(s0?.locationId ?? init.locationId ?? (globalLocation !== "all" ? globalLocation : "") ?? "");
  const [cart, setCart] = useState<Cart>(init.cart);
  const [status, setStatus] = useState<Status>(init.status);
  const [refNo, setRefNo] = useState("");
  const [term, setTerm] = useState("");
  const [payTerm, setPayTerm] = useState({ number: String(s0?.payTerm?.number ?? ""), type: s0?.payTerm?.type ?? "days" });
  const [doc, setDoc] = useState(s0?.documents[0] ?? "");
  const [orderIds, setOrderIds] = useState<string[]>(s0?.salesOrderIds ?? init.orderIds ?? []);
  const [ship, setShip] = useState({ status: (s0?.shipping.status ?? "") as ShippingStatus | "", deliveredTo: s0?.shipping.deliveredTo ?? "", person: s0?.shipping.deliveryPersonId ?? "", docs: s0?.shipping.documents.join(", ") ?? "" });
  const [extras, setExtras] = useState<{ name: string; amount: string }[]>((s0?.additionalExpenses ?? []).map((e) => ({ name: e.name, amount: String(e.amount) })));
  const [pays, setPays] = useState<{ method: PaymentMethod; amount: string }[]>([]);
  const [rec, setRec] = useState(s0?.recurring ? { on: true, interval: String(s0.recurring.interval), type: s0.recurring.intervalType, reps: String(s0.recurring.repetitions ?? ""), day: String(s0.recurring.repeatOn ?? "") } : { on: false, interval: "1", type: "months" as const, reps: "", day: "" });
  const [agent, setAgent] = useState(s0?.commissionAgentId ?? "");

  const { data: hits = [] } = usePosSearch({ locationId, contactId: cart.contactId, term: locationId ? term : "" });
  const { data: openOrders = [] } = useOpenOrders(cart.contactId === WALK_IN_ID ? undefined : cart.contactId);

  const extraAmounts = extras.map((e) => Number(e.amount) || 0);
  const totals = cartTotals(cart, { rounding: settings?.sale.roundingMethod ?? "none", rewards: settings!.rewards, additional: extraAmounts });
  const paidNow = pays.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const location = lookups?.locations.find((l) => l.id === locationId);
  const labels = settings?.customLabels.payments ?? [];
  const methods = tillMethods(location?.paymentMethods ?? ["cash"], labels);
  const statusLabel = (v: string) => t(`status.${v}`);
  const customer = (customers?.rows ?? []).find((c) => c.id === cart.contactId);

  const submit = async (e: FormEvent, print = false) => {
    e.preventDefault();
    if (!locationId) return toast.error(t("sales.chooseLocation"));
    if (settings?.sale.payTermRequired && !Number(payTerm.number) && status !== "quotation") return toast.error(t("sales.payTermRequired"));
    if (settings?.sale.commissionAgentRequired && settings.sale.commissionAgent !== "disabled" && !agent) return toast.error(t("sales.agentRequired"));
    const input: SaleInput = {
      id: init.id, cart: { ...cart, date: cart.date }, locationId, status, refNo: refNo || undefined,
      payments: init.id ? undefined : pays.filter((p) => Number(p.amount) > 0).map((p) => ({ method: p.method, amount: Number(p.amount) })),
      payTerm: payTerm.number ? { number: Number(payTerm.number), type: payTerm.type as "days" | "months" } : null,
      documents: doc ? [doc] : [], salesOrderIds: orderIds, commissionAgentId: agent || null,
      additionalExpenses: extras.filter((x) => x.name || Number(x.amount)).map((x) => ({ name: x.name, amount: Number(x.amount) || 0 })),
      shipping: { ...(ship.status ? { status: ship.status } : {}), deliveredTo: ship.deliveredTo, deliveryPersonId: ship.person || null, documents: ship.docs ? ship.docs.split(",").map((d) => d.trim()).filter(Boolean) : [] },
      recurring: rec.on ? { interval: Number(rec.interval) || 1, intervalType: rec.type, repetitions: rec.reps ? Number(rec.reps) : null, repeatOn: rec.day ? Number(rec.day) : null, parentId: null } : null,
    };
    try {
      const r = await save.mutateAsync(input);
      toast.success(t("sales.saved", { refNo: r.refNo }));
      if (print) showReceipt(r.id);
      router.push(`/sales/${r.id}`);
    } catch (err) {
      toast.error(saleErrorMessage(err, t));
    }
  };

  const title = init.id ? t("nav.editSale") : status === "draft" ? t("nav.addDraft") : status === "quotation" ? t("nav.addQuotation") : t("nav.addSale");
  const box = "grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3";
  const field = (label: string, id: string, node: React.ReactNode) => (
    <div className="grid content-start gap-2"><Label htmlFor={id}>{label}</Label>{node}</div>
  );
  const named = (xs: { id: string; name: string }[]) => xs.map((x) => ({ value: x.id, label: x.name }));
  const people = (lookups?.users ?? []).map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() }));

  return (
    <form onSubmit={submit} className="grid gap-4 pb-24">
      <PageHeader title={title} />
      <div className={box}>
        {field(t("common.location"), "sf-loc", selectOf(named(lookups?.locations ?? []), locationId, (v) => { setLocationId(v); setCart({ ...cart, lines: [] }); }, "sf-loc"))}
        {field(t("sales.customer"), "sf-cust", selectOf([{ value: WALK_IN_ID, label: t("sales.walkIn") }, ...named((customers?.rows ?? []).filter((c) => !c.isDefault))], cart.contactId, (v) => setCart(setContact(cart, v)), "sf-cust"))}
        {field(t("sales.saleDate"), "sf-date", <Input id="sf-date" type="datetime-local" value={(cart.date ?? "").slice(0, 16)} onChange={(e) => setCart(patchCart(cart, { date: e.target.value ? `${e.target.value}:00` : null }))} />)}
        {field(t("sales.saleStatus"), "sf-status", selectOf((["final", "draft", "quotation", "proforma"] as const).map((v) => ({ value: v, label: statusLabel(v) })), status, (v) => setStatus(v as Status), "sf-status"))}
        {field(t("sales.invoiceNoManual"), "sf-ref", <Input id="sf-ref" value={refNo} onChange={(e) => setRefNo(e.target.value)} disabled={!!init.id || status !== "final"} />)}
        {field(t("sales.payTerm"), "sf-term", (
          <div className="flex gap-2">
            <Input id="sf-term" type="number" min={0} value={payTerm.number} onChange={(e) => setPayTerm({ ...payTerm, number: e.target.value })} className="w-24" />
            {selectOf([{ value: "days", label: t("sales.days") }, { value: "months", label: t("sales.months") }], payTerm.type, (v) => setPayTerm({ ...payTerm, type: v as "days" | "months" }), undefined, t("sales.payTermType"))}
          </div>))}
        {field(t("sales.commissionAgent"), "sf-agent", selectOf([{ value: "", label: "—" }, ...named(people.filter((p) => lookups?.users.find((u) => u.id === p.id)?.isSalesAgent))].map((o) => ({ ...o, value: o.value || "none" })), agent || "none", (v) => setAgent(v === "none" ? "" : v), "sf-agent"))}
        {field(t("sales.attachDocument"), "sf-doc", <Input id="sf-doc" type="file" onChange={(e) => setDoc(e.target.files?.[0]?.name ?? "")} />)}
        {customer && cart.contactId !== WALK_IN_ID && <p className="self-end text-sm text-muted-foreground">{t("sales.customerPoints", { points: customer.points })}</p>}
        {openOrders.length > 0 && (
          <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
            <Label>{t("sales.linkOrders")}</Label>
            <div className="flex flex-wrap gap-2">
              {openOrders.map((o) => (
                <Button key={o.id} type="button" size="sm" variant={orderIds.includes(o.id) ? "default" : "outline"} onClick={() => setOrderIds(orderIds.includes(o.id) ? orderIds.filter((x) => x !== o.id) : [...orderIds, o.id])}>
                  {o.refNo} · {t("sales.qtyRemaining")} {o.remainingQty}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4">
        <div className="relative">
          <Input aria-label={t("sales.searchProducts")} placeholder={t("sales.searchProducts")} value={term} onChange={(e) => setTerm(e.target.value)} disabled={!locationId} />
          {term && hits.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
              {hits.map((h) => (
                <li key={h.variation.id}>
                  <button type="button" className="flex w-full justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => { setCart(addItem(cart, toCartItem(h.product, h.variation, 1))); setTerm(""); }}>
                    <span>{h.product.name}{h.product.type === "variable" ? ` · ${h.variation.name}` : ""} <span className="text-muted-foreground">{h.variation.sku}</span></span>
                    <Money value={h.variation.priceInc} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {cart.lines.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t("sales.noLines")}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2">{t("sales.product")}</th><th className="w-24 px-1">{t("sales.qty")}</th><th className="w-28 px-1">{t("sales.unitPrice")}</th><th className="w-36 px-1">{t("sales.discount")}</th><th className="w-20 px-1">{t("sales.tax")}</th><th className="px-1 text-right">{t("sales.lineSubtotal")}</th><th className="w-8" />
              </tr></thead>
              <tbody>
                {cart.lines.map((l, i) => (
                  <tr key={l.key} className="border-t align-middle">
                    <td className="py-1.5 pr-2">{l.name}<div className="text-xs text-muted-foreground">{l.sku}</div></td>
                    <td className="px-1"><Input aria-label={t("sales.qty")} type="number" min={0} step="any" value={l.qty} onChange={(e) => setCart(setQty(cart, l.key, Number(e.target.value)))} className="tabular-nums" /></td>
                    <td className="px-1"><Input aria-label={t("sales.unitPrice")} type="number" min={0} step="any" value={l.unitPrice} onChange={(e) => setCart(setPrice(cart, l.key, Number(e.target.value)))} className="tabular-nums" /></td>
                    <td className="px-1">
                      <div className="flex gap-1">
                        <Input aria-label={t("sales.discount")} type="number" min={0} step="any" value={l.discount?.amount ?? ""} onChange={(e) => setCart(setLineDiscount(cart, l.key, e.target.value ? { type: l.discount?.type ?? "fixed", amount: Number(e.target.value) } : null))} className="tabular-nums" />
                        <Button type="button" variant="outline" size="sm" disabled={!l.discount} onClick={() => setCart(setLineDiscount(cart, l.key, l.discount && { ...l.discount, type: l.discount.type === "fixed" ? "percentage" : "fixed" }))}>{l.discount?.type === "percentage" ? "%" : "৳"}</Button>
                      </div>
                    </td>
                    <td className="px-1 tabular-nums">{l.taxRate}%</td>
                    <td className="px-1 text-right"><Money value={totals.lines[i].subtotal} /></td>
                    <td><Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => setCart(removeLine(cart, l.key))}><Trash2Icon /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={box}>
        {field(t("sales.orderDiscount"), "sf-disc", (
          <div className="flex gap-2">
            <Input id="sf-disc" type="number" min={0} step="any" value={cart.discount?.amount ?? ""} onChange={(e) => setCart(patchCart(cart, { discount: e.target.value ? { type: cart.discount?.type ?? "fixed", amount: Number(e.target.value) } : null }))} />
            {selectOf([{ value: "fixed", label: t("sales.fixed") }, { value: "percentage", label: t("sales.percentage") }], cart.discount?.type ?? "fixed", (v) => cart.discount && setCart(patchCart(cart, { discount: { ...cart.discount, type: v as "fixed" | "percentage" } })), undefined, t("sales.discountType"))}
          </div>))}
        {field(t("sales.orderTax"), "sf-tax", selectOf([{ value: "none", label: "—" }, ...(lookups?.taxRates ?? []).map((x) => ({ value: x.id, label: `${x.name} (${x.rate}%)` }))], cart.orderTaxId ?? "none", (v) => { const r = lookups?.taxRates.find((x) => x.id === v); setCart(patchCart(cart, { orderTaxId: r?.id ?? null, orderTaxRate: r?.rate ?? 0 })); }, "sf-tax"))}
        {customer && customer.points > 0 && settings?.rewards.enabled && field(t("sales.redeemPoints"), "sf-pts", <Input id="sf-pts" type="number" min={0} max={customer.points} value={cart.pointsRedeemed || ""} onChange={(e) => setCart(patchCart(cart, { pointsRedeemed: Number(e.target.value) || 0 }))} />)}
        <div className="grid content-start gap-2 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="sf-note">{t("sales.sellNote")}</Label>
          <Textarea id="sf-note" rows={2} value={cart.note} onChange={(e) => setCart(patchCart(cart, { note: e.target.value }))} />
        </div>
      </div>

      <div className={box}>
        <h3 className="font-semibold sm:col-span-2 lg:col-span-3">{t("sales.shipping")}</h3>
        {field(t("sales.shippingDetails"), "sh-d", <Textarea id="sh-d" rows={2} value={cart.shipping.details} onChange={(e) => setCart(patchCart(cart, { shipping: { ...cart.shipping, details: e.target.value } }))} />)}
        {field(t("sales.shippingAddress"), "sh-a", <Textarea id="sh-a" rows={2} value={cart.shipping.address} onChange={(e) => setCart(patchCart(cart, { shipping: { ...cart.shipping, address: e.target.value } }))} />)}
        {field(t("sales.shippingCharges"), "sh-c", <Input id="sh-c" type="number" min={0} step="any" value={cart.shipping.charges || ""} onChange={(e) => setCart(patchCart(cart, { shipping: { ...cart.shipping, charges: Number(e.target.value) || 0 } }))} />)}
        {field(t("sales.shippingStatus"), "sh-s", selectOf([{ value: "none", label: "—" }, ...SHIPPING_STATUSES.map((v) => ({ value: v, label: t(`status.${v === "ordered" ? "ordered_shipping" : v}`) }))], ship.status || "none", (v) => setShip({ ...ship, status: v === "none" ? "" : (v as ShippingStatus) }), "sh-s"))}
        {field(t("sales.deliveredTo"), "sh-t", <Input id="sh-t" value={ship.deliveredTo} onChange={(e) => setShip({ ...ship, deliveredTo: e.target.value })} />)}
        {field(t("sales.deliveryPerson"), "sh-p", selectOf([{ value: "none", label: "—" }, ...named(people)], ship.person || "none", (v) => setShip({ ...ship, person: v === "none" ? "" : v }), "sh-p"))}
        {field(t("sales.shippingDocuments"), "sh-x", <Input id="sh-x" value={ship.docs} onChange={(e) => setShip({ ...ship, docs: e.target.value })} />)}
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{t("sales.additionalExpenses")} <span className="text-xs font-normal text-muted-foreground">{t("sales.maxFour")}</span></h3>
          <Button type="button" size="sm" variant="outline" disabled={extras.length >= 4} onClick={() => setExtras([...extras, { name: "", amount: "" }])}><PlusIcon />{t("sales.addExpenseRow")}</Button>
        </div>
        {extras.map((x, i) => (
          <div key={i} className="flex gap-2">
            <Input aria-label={t("sales.expenseName")} placeholder={t("sales.expenseName")} value={x.name} onChange={(e) => setExtras(extras.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
            <Input aria-label={t("sales.expenseAmount")} type="number" min={0} step="any" className="w-36 tabular-nums" value={x.amount} onChange={(e) => setExtras(extras.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} />
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => setExtras(extras.filter((_, j) => j !== i))}><Trash2Icon /></Button>
          </div>
        ))}
      </div>

      {!init.id && status === "final" && (
        <div className="grid gap-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t("sales.payments")}</h3>
            <Button type="button" size="sm" variant="outline" onClick={() => setPays([...pays, { method: methods[0] ?? "cash", amount: String(Math.max(0, totals.total - paidNow) || "") }])}><PlusIcon />{t("sales.addPaymentRow")}</Button>
          </div>
          {pays.map((p, i) => (
            <div key={i} className="flex gap-2">
              {selectOf(methods.map((m) => ({ value: m, label: methodLabel(m, t, labels) })), p.method, (v) => setPays(pays.map((y, j) => (j === i ? { ...y, method: v as PaymentMethod } : y))), undefined, t("sales.paymentMethod"))}
              <Input aria-label={t("sales.expenseAmount")} type="number" min={0} step="any" className="w-40 tabular-nums" value={p.amount} onChange={(e) => setPays(pays.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} />
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => setPays(pays.filter((_, j) => j !== i))}><Trash2Icon /></Button>
            </div>
          ))}
          <p className="text-sm text-muted-foreground">{t("sales.balance")}: <Money value={totals.total - paidNow} className="font-medium text-foreground" /></p>
        </div>
      )}

      {settings?.modules.subscription && (
        <div className="grid gap-3 rounded-xl border bg-card p-4">
          <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={rec.on} onCheckedChange={(on) => setRec({ ...rec, on })} />{t("sales.subscribe")}</label>
          {rec.on && (
            <div className="grid gap-3 sm:grid-cols-4">
              {field(t("sales.interval"), "rc-i", <Input id="rc-i" type="number" min={1} value={rec.interval} onChange={(e) => setRec({ ...rec, interval: e.target.value })} />)}
              {field(t("sales.days"), "rc-t", selectOf([{ value: "days", label: t("sales.days") }, { value: "months", label: t("sales.months") }, { value: "years", label: t("sales.years") }], rec.type, (v) => setRec({ ...rec, type: v as "days" | "months" | "years" }), "rc-t"))}
              {field(t("sales.repetitions"), "rc-r", <Input id="rc-r" type="number" min={1} value={rec.reps} onChange={(e) => setRec({ ...rec, reps: e.target.value })} />)}
              {field(t("sales.repeatOn"), "rc-d", <Input id="rc-d" type="number" min={1} max={31} value={rec.day} onChange={(e) => setRec({ ...rec, day: e.target.value })} />)}
            </div>
          )}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/95 px-6 py-3 backdrop-blur md:left-16">
        <span className="mr-auto text-sm text-muted-foreground">{t("common.total")}: <Money value={totals.total} className="text-lg font-semibold text-foreground" /></span>
        <Button type="button" variant="outline" onClick={() => router.back()}>{t("common.cancel")}</Button>
        <Button type="button" variant="outline" disabled={save.isPending} onClick={(e) => submit(e as unknown as FormEvent, true)}>{t("sales.saveAndPrint")}</Button>
        <Button type="submit" disabled={save.isPending}>{t("common.save")}</Button>
      </div>
    </form>
  );
}
