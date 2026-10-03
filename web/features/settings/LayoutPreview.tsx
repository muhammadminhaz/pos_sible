"use client";

import { useTranslations } from "next-intl";
import type { Values } from "@/features/catalog/CrudPage";

/** A small sample receipt that follows the layout's toggles as they're edited. */
export function LayoutPreview({ values }: { values: Values }) {
  const t = useTranslations("settings");
  const on = (k: string) => !!values[k];
  const a4 = values.paper === "a4" || values.paper === "a5";
  return (
    <div aria-label={t("preview")} className="rounded-lg border bg-muted/40 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t("preview")} · {String(values.paper ?? "80mm")}</p>
      <article className={`mx-auto bg-white p-3 font-mono text-[10px] leading-snug text-black shadow-sm ${a4 ? "w-full max-w-sm" : "w-[60mm]"}`}>
        <header className="text-center">
          {on("showLogo") && <div className="mx-auto mb-1 h-6 w-12 rounded bg-black/10" />}
          {on("showBusinessName") && <p className="font-bold">Pos-sible</p>}
          {on("showLocationName") && <p>Rango Electronics</p>}
          {on("showAddress") && <p>Mirpur 10, Dhaka</p>}
          {on("showMobile") && <p>01711223344</p>}
          {on("showEmail") && <p>rango@possible.test</p>}
          {on("showTax1") && <p>VAT: 004512873-0101</p>}
          {!!values.headerText && <p className="mt-1 whitespace-pre-line">{String(values.headerText)}</p>}
        </header>
        <hr className="my-1 border-dashed border-black" />
        {on("showCustomer") && <p>Customer: Walk-In Customer</p>}
        <p>Invoice: INV-0001</p>
        <hr className="my-1 border-dashed border-black" />
        <div className="flex justify-between"><span>{on("showBrand") && "Walton · "}Rice Cooker{on("showSku") && " (SKU 1042)"}</span><span>2 × 3,200</span></div>
        {on("showWarranty") && <p>Warranty: 12 months</p>}
        <hr className="my-1 border-dashed border-black" />
        <div className="flex justify-between font-bold"><span>Total</span><span>6,400</span></div>
        {on("showPaymentInfo") && <div className="flex justify-between"><span>Paid (cash)</span><span>6,400</span></div>}
        {on("showPreviousDue") && <div className="flex justify-between"><span>Previous due</span><span>0</span></div>}
        {(on("showBarcode") || on("showQrCode")) && <div className="mx-auto mt-1 h-6 w-20 bg-[repeating-linear-gradient(90deg,#000_0_1px,#fff_1px_3px)]" />}
        {on("showSignature") && <p className="mt-3 border-t border-black pt-0.5 text-center">Signature</p>}
        {!!values.footerText && <p className="mt-1 whitespace-pre-line text-center">{String(values.footerText)}</p>}
      </article>
    </div>
  );
}
