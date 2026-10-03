"use client";

import { useState } from "react";
import { DownloadIcon, UploadIcon, Undo2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCSV } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { useImportHistory, useImportMutations } from "@/lib/data/hooks/sales";
import { SALES_IMPORT_COLUMNS, type ImportParse } from "@/lib/data/services/salesImport";
import { useFormat } from "@/lib/i18n/format";
import { saleErrorMessage } from "./saleError";

export function ImportSales() {
  const t = useTranslations();
  const f = useFormat();
  const { parse, commit, revert } = useImportMutations();
  const { data: history = [] } = useImportHistory();
  const [file, setFile] = useState<string>("");
  const [result, setResult] = useState<ImportParse | null>(null);
  const [toRevert, setToRevert] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files?.[0];
    if (!fl) return;
    setFile(fl.name);
    setResult(await parse.mutateAsync(await fl.text()));
  };
  const run = async () => {
    if (!result) return;
    try {
      const r = await commit.mutateAsync({ rows: result.rows, fileName: file });
      toast.success(t("sales.imported", { count: r.created }));
      setResult(null);
      setFile("");
    } catch (e) {
      toast.error(saleErrorMessage(e, t));
    }
  };
  const errText = (m: string) => (t.has(`sales.importErrors.${m}`) ? t(`sales.importErrors.${m}`) : m);

  return (
    <div className="grid gap-4">
      <PageHeader title={t("sales.importTitle")} description={t("sales.importDescription")} />
      <div className="grid gap-3 rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">{t("sales.importHint")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Input aria-label={t("sales.chooseFile")} type="file" accept=".csv,text/csv" onChange={onFile} className="max-w-sm" />
          <Button variant="outline" onClick={() => downloadCSV("sales-import-template", `${SALES_IMPORT_COLUMNS.join(",")}\n`)}><DownloadIcon />{t("sales.downloadTemplate")}</Button>
        </div>
      </div>

      {result && (
        <div className="grid gap-3 rounded-xl border bg-card p-4">
          <h3 className="font-semibold">{t("sales.review")}</h3>
          <p className="text-sm">{t("sales.rowsReady", { count: result.rows.length })}{result.errors.length > 0 && <span className="text-danger"> · {t("sales.rowsWithErrors", { count: result.errors.length })}</span>}</p>
          {result.errors.length > 0 && (
            <Table>
              <TableHeader><TableRow><TableHead className="w-24">{t("sales.row")}</TableHead><TableHead>{t("common.details")}</TableHead></TableRow></TableHeader>
              <TableBody>{result.errors.map((e) => <TableRow key={`${e.row}-${e.message}`}><TableCell className="tabular">{f.number(e.row)}</TableCell><TableCell>{errText(e.message)}</TableCell></TableRow>)}</TableBody>
            </Table>
          )}
          <div><Button disabled={result.errors.length > 0 || result.rows.length === 0 || commit.isPending} onClick={run}><UploadIcon />{t("sales.importNow")}</Button></div>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <h3 className="p-4 pb-2 font-semibold">{t("sales.history")}</h3>
        {history.length === 0 ? <p className="p-4 pt-0 text-sm text-muted-foreground">{t("sales.noHistory")}</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>{t("sales.importedAt")}</TableHead><TableHead>{t("sales.fileName")}</TableHead><TableHead className="text-right">{t("sales.rowsCount")}</TableHead><TableHead className="text-right">{t("sales.invoiceNo")}</TableHead><TableHead className="w-28" /></TableRow></TableHeader>
            <TableBody>
              {history.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="tabular">{f.dateTime(b.createdAt)}</TableCell><TableCell>{b.fileName}</TableCell>
                  <TableCell className="text-right tabular">{f.number(b.rows)}</TableCell><TableCell className="text-right tabular">{f.number(b.recordIds.length)}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => setToRevert(b.id)}><Undo2Icon />{t("sales.revert")}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <ConfirmDialog open={toRevert !== null} onOpenChange={(o) => !o && setToRevert(null)} destructive title={t("sales.revert")} description={t("sales.revertBody")} confirmLabel={t("sales.revert")}
        onConfirm={async () => { if (!toRevert) return; await revert.mutateAsync(toRevert); toast.success(t("sales.reverted")); }} />
    </div>
  );
}
