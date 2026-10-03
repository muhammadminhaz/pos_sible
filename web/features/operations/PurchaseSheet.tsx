"use client";

import { useTranslations } from "next-intl";
import { useSettings } from "@/lib/data/hooks/settings";
import type { PurchaseDetail } from "@/lib/data/services/purchases";
import { useFormat } from "@/lib/i18n/format";

/** Plain black-on-white A4 page for a purchase; rendered into the print portal. */
export function PurchaseSheet({ p }: { p: PurchaseDetail }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: settings } = useSettings();
  const tt = p.totals;
  const row = (label: string, value: string, bold = false) => (
    <tr className={bold ? "text-base font-semibold" : ""}><td className="py-1 pr-6 text-right text-neutral-600">{label}</td><td className="py-1 text-right tabular-nums">{value}</td></tr>
  );
  return (
    <article className="mx-auto w-[186mm] bg-white p-8 text-[12px] text-neutral-900">
      <header className="flex items-start justify-between border-b pb-4">
        <div><h1 className="text-xl font-bold">{settings?.business.name}</h1><p>{p.locationName}</p></div>
        <div className="text-right">
          <p className="text-2xl font-light tracking-wide uppercase">{t("nav.purchases")}</p>
          <p className="mt-2">{`${t("ops.refNo")}: ${p.refNo}`}</p>
          <p>{`${t("common.date")}: ${f.dateTime(p.date)}`}</p>
          <p>{`${t("ops.purchaseStatus")}: ${t(`status.${p.status}`)}`}</p>
        </div>
      </header>
      <p className="mt-4 font-medium">{`${t("ops.supplier")}: ${p.supplierName}`}</p>
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-b text-left text-neutral-600">
            <th className="py-1">#</th><th>{t("products.product")}</th><th className="text-right">{t("catalog.qty")}</th><th className="text-right">{t("ops.unitCostExc")}</th><th className="text-right">{t("common.subtotal")}</th>
          </tr>
        </thead>
        <tbody>
          {p.lines.map((l, i) => (
            <tr key={l.id} className="border-b align-top">
              <td className="py-1">{f.number(i + 1)}</td>
              <td>{p.lineNames[l.id]?.name}<div className="text-neutral-500">{p.lineNames[l.id]?.sku}</div></td>
              <td className="text-right tabular-nums">{`${f.qty(l.qty)} ${p.lineNames[l.id]?.unitName ?? ""}`}</td>
              <td className="text-right tabular-nums">{f.amount(l.unitPrice)}</td>
              <td className="text-right tabular-nums">{f.amount(l.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="mt-4 ml-auto">
        <tbody>
          {row(t("common.subtotal"), f.amount(tt.linesTotal))}
          {tt.discount > 0 && row(t("ops.discountLine"), f.amount(-tt.discount))}
          {tt.orderTax > 0 && row(t("ops.orderTax"), f.amount(tt.orderTax))}
          {tt.shipping > 0 && row(t("ops.shippingCharges"), f.amount(tt.shipping))}
          {tt.additional > 0 && row(t("ops.additionalExpenses"), f.amount(tt.additional))}
          {row(t("common.total"), f.money(tt.total), true)}
          {row(t("ops.paid"), f.amount(p.paid))}
          {p.due > 0 && row(t("status.due"), f.amount(p.due), true)}
        </tbody>
      </table>
      {p.notes && <p className="mt-4 text-neutral-600">{p.notes}</p>}
    </article>
  );
}
