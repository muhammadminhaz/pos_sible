"use client";

import { useTranslations } from "next-intl";
import { useSettings } from "@/lib/data/hooks/settings";
import type { ReceiptData } from "@/lib/data/services/sales";
import { useFormat } from "@/lib/i18n/format";
import { methodLabel } from "@/lib/pos/methods";
import { Barcode } from "./Barcode";

export function A4Invoice({ data }: { data: ReceiptData }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: settings } = useSettings();
  const { txn, a4Layout: layout, location } = data;
  const tt = txn.totals;
  const labels = settings?.customLabels.payments ?? [];
  const sumRow = (label: string, value: string, bold = false) => (
    <tr className={bold ? "text-base font-semibold" : ""}>
      <td className="py-1 pr-6 text-right text-neutral-600">{label}</td>
      <td className="py-1 text-right tabular-nums">{value}</td>
    </tr>
  );

  return (
    <article className="mx-auto w-[186mm] bg-white p-8 text-[12px] text-neutral-900">
      <header className="flex items-start justify-between border-b pb-4">
        <div>
          {layout.showLogo && data.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logo} alt="" className="mb-2 h-12 object-contain" />
          )}
          <h1 className="text-xl font-bold">{data.businessName}</h1>
          <p>{location.name}</p>
          {location.mobile && <p>{location.mobile}</p>}
          {layout.headerText && <p className="mt-1 whitespace-pre-line text-neutral-600">{layout.headerText}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-light tracking-wide uppercase">{t(`status.${txn.status}`)}</p>
          <p className="mt-2">{`${t("pos.receipt.invoiceNo")}: ${txn.refNo}`}</p>
          <p>{`${t("pos.receipt.date")}: ${f.dateTime(txn.date)}`}</p>
          <p>{`${t("pos.receipt.cashier")}: ${data.cashier}`}</p>
          <Barcode value={txn.refNo} className="mt-2 ml-auto h-10 w-48" />
        </div>
      </header>
      {layout.showCustomer && (
        <section className="py-4">
          <p className="text-xs text-neutral-500 uppercase">{t("pos.receipt.customer")}</p>
          <p className="font-medium">{data.customer.name}</p>
          {data.customer.mobile && <p>{data.customer.mobile}</p>}
        </section>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y bg-neutral-50 text-left text-xs uppercase">
            <th className="py-2 pl-2">#</th>
            <th className="py-2">{t("pos.receipt.item")}</th>
            {layout.showSku && <th className="py-2">SKU</th>}
            <th className="py-2 text-right">{t("pos.receipt.qty")}</th>
            <th className="py-2 text-right">{t("pos.receipt.unitPrice")}</th>
            <th className="py-2 text-right">{t("pos.totals.discount")}</th>
            <th className="py-2 pr-2 text-right">{t("pos.receipt.total")}</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i} className="border-b align-top">
              <td className="py-2 pl-2">{f.number(i + 1)}</td>
              <td className="py-2">
                {l.name}
                {l.serials.length > 0 && <div className="text-[10px] text-neutral-500">{l.serials.join(", ")}</div>}
              </td>
              {layout.showSku && <td className="py-2">{l.sku}</td>}
              <td className="py-2 text-right tabular-nums">{`${f.qty(l.qty)} ${l.unitName}`}</td>
              <td className="py-2 text-right tabular-nums">{f.amount(l.unitPrice)}</td>
              <td className="py-2 text-right tabular-nums">{f.amount(l.discount)}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{f.amount(l.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-between gap-8">
        {layout.showPaymentInfo ? (
          <table className="self-start text-sm">
            <tbody>
              {txn.payments.filter((p) => !p.isReturn).map((p) => (
                <tr key={p.id}>
                  <td className="py-0.5 pr-4">{methodLabel(p.method, t, labels)}</td>
                  <td className="py-0.5 pr-4 text-neutral-500">{f.date(p.paidOn)}</td>
                  <td className="py-0.5 text-right tabular-nums">{f.amount(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <span />}
        <table className="text-sm">
          <tbody>
            {sumRow(t("pos.totals.subtotal"), f.amount(tt.linesTotal))}
            {tt.discount > 0 && sumRow(`(−) ${t("pos.totals.discount")}`, f.amount(tt.discount))}
            {tt.orderTax > 0 && sumRow(`(+) ${t("pos.totals.orderTax")}`, f.amount(tt.orderTax))}
            {tt.shipping > 0 && sumRow(`(+) ${t("pos.totals.shipping")}`, f.amount(tt.shipping))}
            {tt.redeemed > 0 && sumRow(`(−) ${t("pos.totals.redeemed")}`, f.amount(tt.redeemed))}
            {tt.roundOff !== 0 && sumRow(t("pos.totals.roundOff"), f.amount(tt.roundOff))}
            {sumRow(t("pos.receipt.total"), f.money(tt.total), true)}
            {sumRow(t("pos.receipt.paid"), f.amount(data.paid))}
            {data.change > 0 && sumRow(t("pos.receipt.change"), f.amount(data.change))}
            {data.due > 0 && sumRow(t("pos.receipt.due"), f.money(data.due), true)}
          </tbody>
        </table>
      </div>
      {layout.footerText && <p className="mt-10 border-t pt-4 text-center whitespace-pre-line text-neutral-600">{layout.footerText}</p>}
    </article>
  );
}
