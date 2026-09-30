"use client";

import { useTranslations } from "next-intl";
import { Fragment } from "react";
import { useSettings } from "@/lib/data/hooks/settings";
import type { ReceiptData } from "@/lib/data/services/sales";
import { useFormat } from "@/lib/i18n/format";
import { methodLabel } from "@/lib/pos/methods";
import { Barcode } from "./Barcode";

/** 80mm roll: 72mm printable. Plain black-on-white, so it prints the same in dark mode. */
export function ThermalReceipt({ data }: { data: ReceiptData }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: settings } = useSettings();
  const { txn, layout, location } = data;
  const tt = txn.totals;
  const labels = settings?.customLabels.payments ?? [];
  const line = (label: string, value: string, bold = false) => (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );

  return (
    <article className="mx-auto w-[72mm] bg-white p-2 font-mono text-[11px] leading-tight text-black">
      <header className="mb-2 text-center">
        {layout.showLogo && data.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.logo} alt="" className="mx-auto mb-1 h-10 object-contain" />
        )}
        {layout.showBusinessName && <h2 className="text-sm font-bold">{data.businessName}</h2>}
        {layout.showLocationName && <p>{location.name}</p>}
        {layout.showAddress && <p>{[location.address.line1, location.address.city].filter(Boolean).join(", ")}</p>}
        {layout.showMobile && location.mobile && <p>{`${t("pos.receipt.mobile")}: ${location.mobile}`}</p>}
        {layout.headerText && <p className="mt-1 whitespace-pre-line">{layout.headerText}</p>}
      </header>
      <div className="border-y border-dashed border-black py-1">
        {line(t("pos.receipt.invoiceNo"), txn.refNo)}
        {line(t("pos.receipt.date"), f.dateTime(txn.date))}
        {line(t("pos.receipt.cashier"), data.cashier)}
        {layout.showCustomer && !data.customer.isWalkIn && line(t("pos.receipt.customer"), `${data.customer.name} ${data.customer.mobile}`)}
      </div>
      <table className="my-1 w-full">
        <thead>
          <tr className="border-b border-dashed border-black">
            <th className="text-left font-normal">{t("pos.receipt.item")}</th>
            <th className="text-right font-normal">{t("pos.receipt.total")}</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i} className="align-top">
              <td className="py-0.5">
                <div>{l.name}</div>
                {layout.showSku && <div className="text-[10px]">{l.sku}</div>}
                <div>{`${f.qty(l.qty)} ${l.unitName} × ${f.amount(l.unitPrice)}`}</div>
                {l.discount > 0 && <div className="text-[10px]">{`− ${f.amount(l.discount)}`}</div>}
                {l.serials.length > 0 && <div className="text-[10px]">{l.serials.join(", ")}</div>}
              </td>
              <td className="py-0.5 text-right tabular-nums">{f.amount(l.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-dashed border-black pt-1">
        {line(t("pos.totals.subtotal"), f.amount(tt.linesTotal))}
        {tt.discount > 0 && line(`(−) ${t("pos.totals.discount")}`, f.amount(tt.discount))}
        {tt.orderTax > 0 && line(`(+) ${t("pos.totals.orderTax")}`, f.amount(tt.orderTax))}
        {tt.shipping > 0 && line(`(+) ${t("pos.totals.shipping")}`, f.amount(tt.shipping))}
        {tt.redeemed > 0 && line(`(−) ${t("pos.totals.redeemed")}`, f.amount(tt.redeemed))}
        {tt.roundOff !== 0 && line(t("pos.totals.roundOff"), f.amount(tt.roundOff))}
        {line(t("pos.receipt.total"), f.money(tt.total), true)}
      </div>
      {layout.showPaymentInfo && (
        <div className="mt-1 border-t border-dashed border-black pt-1">
          {txn.payments.filter((p) => !p.isReturn).map((p) => <Fragment key={p.id}>{line(methodLabel(p.method, t, labels), f.amount(p.amount))}</Fragment>)}
          {line(t("pos.receipt.paid"), f.amount(data.paid))}
          {data.change > 0 && line(t("pos.receipt.change"), f.amount(data.change))}
          {data.due > 0 && line(t("pos.receipt.due"), f.amount(data.due), true)}
        </div>
      )}
      {txn.pointsEarned > 0 && <p className="mt-1 text-center">{t("pos.receipt.pointsEarned", { points: f.number(txn.pointsEarned) })}</p>}
      {layout.footerText && <p className="mt-2 text-center whitespace-pre-line">{layout.footerText}</p>}
      <Barcode value={txn.refNo} height={36} className="mx-auto mt-2 h-10 w-[60mm]" />
      <p className="text-center text-[10px] tracking-widest">{txn.refNo}</p>
    </article>
  );
}
