"use client";

import { useState } from "react";
import { DownloadIcon, FileSpreadsheetIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCSV } from "@/components/shared/DataTable";
import { PURCHASE_IMPORT_COLUMNS, purchaseImportService, type PurchaseImportParse, type PurchaseImportRow } from "@/lib/data/services/purchaseImport";
import { useFormat } from "@/lib/i18n/format";

/** Bring products into the purchase from a spreadsheet: pick a file, review the rows and errors, then add. */
export function PurchaseImportButton({ onAdd }: { onAdd: (rows: PurchaseImportRow[]) => void }) {
  const t = useTranslations("ops");
  const tc = useTranslations("common");
  const f = useFormat();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<PurchaseImportParse | null>(null);
  const [fileName, setFileName] = useState("");
  const close = () => { setOpen(false); setResult(null); setFileName(""); };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}><FileSpreadsheetIcon />{t("importProducts")}</Button>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{t("importProducts")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("importProductsHint")}</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="pimp-file">{t("importFile")}</Label>
              <Input
                id="pimp-file" type="file" accept=".csv,text/csv" className="max-w-xs"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setFileName(file.name);
                  setResult(await purchaseImportService.parse(await file.text()));
                }}
              />
            </div>
            <Button type="button" variant="ghost" onClick={() => downloadCSV("purchase-import-template", PURCHASE_IMPORT_COLUMNS.join(",") + "\n")}>
              <DownloadIcon />{t("importTemplate")}
            </Button>
          </div>

          {result && (
            <div className="grid gap-3">
              {result.errors.length > 0 && (
                <ul role="alert" className="max-h-32 overflow-auto rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger-foreground">
                  {result.errors.map((e, i) => <li key={i}>{t("importRowError", { row: f.number(e.row), problem: t(`importErrors.${e.message}`) })}</li>)}
                </ul>
              )}
              {result.rows.length > 0 && (
                <div className="max-h-64 overflow-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                      <tr><th className="px-3 py-2">{t("importSku")}</th><th className="px-3 py-2">{t("importProduct")}</th><th className="px-3 py-2 text-right">{t("importQty")}</th><th className="px-3 py-2 text-right">{t("importCost")}</th></tr>
                    </thead>
                    <tbody>
                      {result.rows.map((r) => (
                        <tr key={`${r.variationId}-${r.row}`} className="border-t">
                          <td className="px-3 py-1.5 tabular-nums">{r.sku}</td><td className="px-3 py-1.5">{r.name}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{f.qty(r.qty)}</td><td className="px-3 py-1.5 text-right tabular-nums">{f.amount(r.unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>{tc("cancel")}</Button>
            {/* Good rows can still be added; the bad ones are listed above so they can be fixed and re-uploaded. */}
            <Button type="button" disabled={!result?.rows.length} onClick={() => { onAdd(result!.rows); close(); }}>
              {t("importAdd", { count: result?.rows.length ?? 0 })}
            </Button>
          </DialogFooter>
          <span className="sr-only">{fileName}</span>
        </DialogContent>
      </Dialog>
    </>
  );
}
