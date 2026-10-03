"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { useReturnMutations, useReturnableLines, useSalesList } from "@/lib/data/hooks/sales";
import { useFormat } from "@/lib/i18n/format";
import { saleErrorMessage } from "./saleError";

export function ReturnForm() {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const [saleId, setSaleId] = useState(useSearchParams().get("sale") ?? "");
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const { data: sales } = useSalesList({ search: search || undefined, pageSize: 20, paymentStatus: undefined });
  const { data: lines } = useReturnableLines(saleId || undefined);
  const { create } = useReturnMutations();
  const options = (sales?.rows ?? []).filter((s) => s.status === "final");
  const picked = (lines ?? []).map((l) => ({ ...l, ret: Number(qty[l.lineId]) || 0 })).filter((l) => l.ret > 0);
  const total = picked.reduce((s, l) => s + l.ret * l.unitPrice, 0);

  const submit = async () => {
    try {
      const r = await create.mutateAsync({ parentId: saleId, lines: picked.map((l) => ({ lineId: l.lineId, qty: l.ret })), note });
      toast.success(t("sales.returnSaved", { refNo: r.refNo }));
      router.push("/sales/returns");
    } catch (e) {
      toast.error(saleErrorMessage(e, t));
    }
  };

  return (
    <div className="grid gap-4">
      <PageHeader title={t("sales.newReturn")} />
      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="rf-search">{t("sales.invoiceSearch")}</Label>
          <Input id="rf-search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rf-sale">{t("sales.chooseInvoice")}</Label>
          <Select value={saleId} onValueChange={(v) => { setSaleId(v); setQty({}); }}>
            <SelectTrigger id="rf-sale" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{options.map((s) => <SelectItem key={s.id} value={s.id}>{s.refNo} · {s.contactName} · {f.money(s.total)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {lines && (
        <div className="grid gap-3 rounded-xl border bg-card p-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1">{t("sales.product")}</th><th className="px-2 text-right">{t("sales.soldQty")}</th><th className="px-2 text-right">{t("sales.returnedQty")}</th><th className="w-32 px-2">{t("sales.returnQty")}</th><th className="text-right">{t("sales.lineSubtotal")}</th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.lineId} className="border-t">
                  <td className="py-1.5">{l.name}</td>
                  <td className="px-2 text-right tabular">{f.qty(l.soldQty)}</td>
                  <td className="px-2 text-right tabular">{f.qty(l.returnedQty)}</td>
                  <td className="px-2"><Input aria-label={t("sales.returnQty")} type="number" min={0} max={l.soldQty - l.returnedQty} step="any" value={qty[l.lineId] ?? ""} onChange={(e) => setQty({ ...qty, [l.lineId]: e.target.value })} className="tabular-nums" /></td>
                  <td className="text-right"><Money value={(Number(qty[l.lineId]) || 0) * l.unitPrice} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Textarea aria-label={t("sales.sellNote")} placeholder={t("sales.sellNote")} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("sales.returnTotal")}: <Money value={total} className="font-semibold text-foreground" /></span>
            <Button disabled={!picked.length || create.isPending} onClick={submit}>{t("sales.createReturn")}</Button>
          </div>
          {!picked.length && <p className="text-sm text-muted-foreground">{t("sales.nothingToReturn")}</p>}
        </div>
      )}
    </div>
  );
}
