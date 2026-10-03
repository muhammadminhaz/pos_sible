"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { BanknoteIcon, PencilIcon, PrinterIcon, TruckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useCan } from "@/lib/auth/useCan";
import { useSale } from "@/lib/data/hooks/sales";
import { paymentSummary } from "@/lib/domain/payments";
import { useFormat } from "@/lib/i18n/format";
import { usePosDialogs } from "@/features/pos/dialogStore";
import { ReceiptModal } from "@/features/pos/receipt/ReceiptModal";
import { PaymentsDialog } from "./PaymentsDialog";
import { ShippingDialog } from "./ShippingDialog";

export function SaleDetail({ id }: { id: string }) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const { data: s, isError } = useSale(id);
  const showReceipt = usePosDialogs((x) => x.showReceipt);
  const [pay, setPay] = useState(false);
  const [ship, setShip] = useState(false);
  if (isError) return <p className="py-10 text-center text-muted-foreground">{t("sales.notFound")}</p>;
  if (!s) return <Skeleton className="h-96" />;
  const final = s.status === "final";
  const sum = paymentSummary(s.totals.total, s.payments);
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right">{value}</span></div>
  );
  const tt = s.totals;

  return (
    <>
      <PageHeader
        title={s.refNo}
        description={`${s.contactName} · ${f.dateTime(s.date)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => showReceipt(s.id)}><PrinterIcon />{t("sales.printSale")}</Button>
            {final && can("sell.payments") && sum.due > 0 && <Button variant="outline" onClick={() => setPay(true)}><BanknoteIcon />{t("sales.addPayment")}</Button>}
            {final && can("sell.update") && <Button variant="outline" onClick={() => setShip(true)}><TruckIcon />{t("sales.editShipping")}</Button>}
            {can("sell.update") && <Button asChild><Link href={`/sales/${s.id}/edit`}><PencilIcon />{t("sales.editSale")}</Link></Button>}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid content-start gap-4 lg:col-span-2">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sales.product")}</TableHead><TableHead className="text-right">{t("sales.qty")}</TableHead>
                  <TableHead className="text-right">{t("sales.unitPrice")}</TableHead><TableHead className="text-right">{t("sales.lineSubtotal")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{s.lineNames[l.id]}</TableCell>
                    <TableCell className="text-right tabular">{f.qty(l.qty)}</TableCell>
                    <TableCell className="text-right"><Money value={l.unitPrice} /></TableCell>
                    <TableCell className="text-right"><Money value={l.subtotal} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 font-semibold">{t("sales.payments")}</h3>
            {s.payments.filter((p) => !p.isReturn).length === 0 ? <p className="text-sm text-muted-foreground">{t("sales.noPayments")}</p> : (
              <div className="grid gap-1.5">
                {s.payments.filter((p) => !p.isReturn).map((p) => <Fragment key={p.id}>{row(`${f.dateTime(p.paidOn)} · ${p.refNo} · ${t(`payMethods.${p.method}`)}`, <Money value={p.amount} />)}</Fragment>)}
              </div>
            )}
          </div>
        </div>
        <div className="grid content-start gap-4">
          <div className="grid gap-1.5 rounded-xl border bg-card p-4">
            {row(t("sales.saleStatus"), <StatusBadge status={s.status} />)}
            {final && row(t("sales.paymentStatus"), <StatusBadge status={s.paymentStatus} />)}
            {row(t("common.location"), s.locationName)}
            {row(t("sales.addedBy"), s.addedBy || "—")}
            <div className="my-2 border-t" />
            {row(t("pos.totals.subtotal"), <Money value={tt.linesTotal} />)}
            {tt.discount > 0 && row(t("sales.discount"), <Money value={-tt.discount} />)}
            {tt.orderTax > 0 && row(t("sales.orderTax"), <Money value={tt.orderTax} />)}
            {tt.shipping > 0 && row(t("sales.shippingCharges"), <Money value={tt.shipping} />)}
            {tt.additional > 0 && row(t("sales.additionalExpenses"), <Money value={tt.additional} />)}
            {tt.redeemed > 0 && row(t("sales.redeemPoints"), <Money value={-tt.redeemed} />)}
            {row(t("sales.total"), <Money value={tt.total} className="font-semibold" />)}
            {final && row(t("sales.totalPaid"), <Money value={sum.paid} />)}
            {final && row(t("sales.sellDue"), <Money value={sum.due} className="font-semibold" />)}
          </div>
          <div className="grid gap-1.5 rounded-xl border bg-card p-4">
            <h3 className="mb-1 font-semibold">{t("sales.shipping")}</h3>
            {row(t("sales.shippingStatus"), s.shipping.status ? <StatusBadge status={s.shipping.status === "ordered" ? "ordered_shipping" : s.shipping.status} /> : "—")}
            {row(t("sales.deliveredTo"), s.shipping.deliveredTo || "—")}
            {row(t("sales.shippingAddress"), s.shipping.address || "—")}
            {row(t("sales.shippingDetails"), s.shipping.details || "—")}
          </div>
          {(s.notes || s.staffNote) && (
            <div className="grid gap-1.5 rounded-xl border bg-card p-4">
              {s.notes && row(t("sales.sellNote"), s.notes)}
              {s.staffNote && row(t("sales.staffNote"), s.staffNote)}
            </div>
          )}
        </div>
      </div>
      <PaymentsDialog saleId={pay ? s.id : null} mode="add" onClose={() => setPay(false)} />
      <ShippingDialog saleId={ship ? s.id : null} onClose={() => setShip(false)} />
      <ReceiptModal />
    </>
  );
}
