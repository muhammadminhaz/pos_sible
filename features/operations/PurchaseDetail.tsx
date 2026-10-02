"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BanknoteIcon, PencilIcon, PrinterIcon, RefreshCwIcon, Undo2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Section } from "@/features/catalog/formParts";
import { usePrint } from "@/features/pos/receipt/print";
import { PaymentsDialog } from "@/features/sales/PaymentsDialog";
import { useCan } from "@/lib/auth/useCan";
import { usePurchase } from "@/lib/data/hooks/operations";
import { useSettings } from "@/lib/data/hooks/settings";
import type { PurchaseStatus } from "@/lib/data/services/purchases";
import { useFormat } from "@/lib/i18n/format";
import { methodLabel } from "@/lib/pos/methods";
import { PurchaseSheet } from "./PurchaseSheet";
import { PurchaseStatusDialog } from "./StatusDialog";
import { ScrollFade } from "@/components/ui/scroll-fade";

export function PurchaseDetail({ id }: { id: string }) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const router = useRouter();
  const { data: settings } = useSettings();
  const { data: p, isError } = usePurchase(id);
  const { printing, print } = usePrint();
  const [payments, setPayments] = useState<"add" | "view" | null>(null);
  const [status, setStatus] = useState(false);
  if (isError) return <EmptyState title={t("errors.notFound")} />;
  if (!p) return <Skeleton className="h-96" />;
  const hasReturns = p.returns.length > 0;
  const labels = settings?.customLabels.payments ?? [];

  return (
    <div className="grid gap-4">
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{p.refNo}<StatusBadge status={p.status} /><StatusBadge status={p.paymentStatus} /></span>}
        description={`${p.supplierName} · ${p.locationName} · ${f.dateTime(p.date)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => print("a4")}><PrinterIcon />{t("common.print")}</Button>
            {can("purchase.update") && !hasReturns && <Button asChild variant="outline"><Link href={`/purchases/${id}/edit`}><PencilIcon />{t("common.edit")}</Link></Button>}
            {can("purchase.update") && !hasReturns && <Button variant="outline" onClick={() => setStatus(true)}><RefreshCwIcon />{t("ops.updateStatus")}</Button>}
            {can("purchase.update") && p.status === "received" && <Button variant="outline" onClick={() => router.push(`/purchases/returns/new?purchase=${id}`)}><Undo2Icon />{t("nav.addPurchaseReturn")}</Button>}
            {can("purchase.payments") && p.due > 0 && <Button onClick={() => setPayments("add")}><BanknoteIcon />{t("ops.addPayment")}</Button>}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("common.total")} value={<Money value={p.totals.total} />} />
        <StatCard label={t("ops.paid")} value={<Money value={p.paid} />} />
        <StatCard label={t("status.due")} value={<Money value={p.due} />} />
        <StatCard label={t("ops.itemsCount")} value={f.qty(p.totals.itemsCount)} />
      </div>

      <Section title={t("ops.items")}>
        <ScrollFade className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("products.product")}</TableHead><TableHead className="text-right">{t("catalog.qty")}</TableHead><TableHead className="text-right">{t("ops.unitCostExc")}</TableHead>
                <TableHead className="text-right">{t("ops.discountPct")}</TableHead><TableHead className="text-right">{t("products.tax")}</TableHead><TableHead>{t("catalog.lotNo")}</TableHead>
                <TableHead>{t("catalog.expDate")}</TableHead><TableHead className="text-right">{t("ops.returned")}</TableHead><TableHead className="text-right">{t("common.subtotal")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell><div className="font-medium">{p.lineNames[l.id]?.name}</div><div className="text-xs text-muted-foreground tabular">{p.lineNames[l.id]?.sku}</div></TableCell>
                  <TableCell className="text-right tabular">{`${f.qty(l.qty)} ${p.lineNames[l.id]?.unitName ?? ""}`}</TableCell>
                  <TableCell className="text-right tabular">{f.amount(l.unitPrice)}</TableCell>
                  <TableCell className="text-right tabular">{l.discount ? (l.discount.type === "percentage" ? `${l.discount.amount}%` : f.amount(l.discount.amount)) : "—"}</TableCell>
                  <TableCell className="text-right tabular">{l.taxRate ? `${l.taxRate}%` : "—"}</TableCell>
                  <TableCell>{l.lotNo || "—"}</TableCell>
                  <TableCell className="tabular">{l.expDate ? f.date(l.expDate) : "—"}</TableCell>
                  <TableCell className="text-right tabular">{l.returnedQty ? f.qty(l.returnedQty) : "—"}</TableCell>
                  <TableCell className="text-right tabular">{f.amount(l.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollFade>
      </Section>

      <Section title={t("ops.payments")}>
        {p.payments.length === 0 ? <p className="text-sm text-muted-foreground">{t("sales.noPayments")}</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>{t("common.date")}</TableHead><TableHead>{t("ops.refNo")}</TableHead><TableHead>{t("sales.paymentMethod")}</TableHead><TableHead className="text-right">{t("sales.expenseAmount")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {p.payments.filter((x) => !x.isReturn).map((x) => (
                <TableRow key={x.id}><TableCell className="tabular">{f.dateTime(x.paidOn)}</TableCell><TableCell className="tabular">{x.refNo}</TableCell><TableCell>{methodLabel(x.method, t, labels)}</TableCell><TableCell className="text-right tabular">{f.amount(x.amount)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {can("purchase.payments") && p.payments.length > 0 && <div><Button variant="outline" size="sm" onClick={() => setPayments("view")}>{t("ops.managePayments")}</Button></div>}
      </Section>

      {(p.notes || p.shipping.details) && (
        <Section title={t("common.note")}>
          {p.shipping.details && <p className="text-sm">{`${t("ops.shippingDetails")}: ${p.shipping.details}`}</p>}
          {p.notes && <p className="text-sm text-muted-foreground">{p.notes}</p>}
        </Section>
      )}
      <PaymentsDialog saleId={payments ? id : null} mode={payments ?? "view"} kind="purchase" onClose={() => setPayments(null)} />
      <PurchaseStatusDialog target={status ? { id, status: p.status as PurchaseStatus } : null} onClose={() => setStatus(false)} />
      {printing === "a4" && createPortal(<div data-print-root="a4"><PurchaseSheet p={p} /></div>, document.body)}
    </div>
  );
}
