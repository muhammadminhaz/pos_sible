import { Barcode } from "@/features/pos/receipt/Barcode";
import type { LabelSheet as Sheet } from "@/lib/domain/labels";

export type LabelItem = { business: string; name: string; variation: string; price: string; sku: string; packing: string; expiry: string };
export type LabelField = { on: boolean; size: number };
export type LabelFields = { business: LabelField; name: LabelField; variation: LabelField; price: LabelField; packing: LabelField; expiry: LabelField };

const inch = (n: number) => `${n}in`;

/** Plain black-on-white pages, sized in inches, so the preview and the print are the same markup. */
export function LabelPages({ pages, sheet, fields, labels }: { pages: LabelItem[][]; sheet: Sheet; fields: LabelFields; labels: { packing: string; expiry: string } }) {
  const line = (f: LabelField, text: string, bold = false) =>
    f.on && text ? <div style={{ fontSize: f.size }} className={`w-full truncate leading-tight ${bold ? "font-bold" : ""}`}>{text}</div> : null;
  return (
    <>
      {pages.map((page, p) => (
        <div
          key={p} className="overflow-hidden bg-white text-black"
          style={{
            width: inch(sheet.paperWidth), height: sheet.isContinuous || sheet.paperHeight == null ? undefined : inch(sheet.paperHeight),
            paddingTop: inch(sheet.topMargin), paddingLeft: inch(sheet.leftMargin), breakAfter: p === pages.length - 1 ? undefined : "page",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${sheet.perRow}, ${inch(sheet.labelWidth)})`, columnGap: inch(sheet.colDistance), rowGap: inch(sheet.rowDistance) }}>
            {page.map((l, i) => (
              <div key={i} className="flex flex-col items-center justify-center overflow-hidden text-center" style={{ width: inch(sheet.labelWidth), height: inch(sheet.labelHeight), padding: "0.04in" }}>
                {line(fields.business, l.business, true)}
                {line(fields.name, l.name, true)}
                {line(fields.variation, l.variation)}
                {line(fields.price, l.price, true)}
                {line(fields.packing, l.packing && `${labels.packing}: ${l.packing}`)}
                {line(fields.expiry, l.expiry && `${labels.expiry}: ${l.expiry}`)}
                <Barcode value={l.sku} height={30} className="mt-0.5 min-h-0 w-[90%] flex-1" />
                <div className="text-[8px] leading-none tracking-widest">{l.sku}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
