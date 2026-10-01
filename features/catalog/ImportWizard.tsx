"use client";

import { useState, type ReactNode } from "react";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCSV } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCatalogImports } from "@/lib/data/hooks/products";
import { useFormat } from "@/lib/i18n/format";
import { catalogErrorMessage } from "./catalogError";

type Parse<R> = { rows: R[]; errors: { row: number; message: string }[] };

export type ImportWizardProps<R> = {
  title: string;
  description: string;
  hint: string;
  /** Header row of the downloadable template. */
  columns: readonly string[];
  templateName: string;
  historyKind: "products" | "opening_stock" | "prices";
  parse: (csv: string) => Promise<Parse<R>>;
  commit: (rows: R[], fileName: string) => Promise<unknown>;
  /** Columns of the "ready to import" preview. */
  preview: { headers: string[]; cells: (r: R) => ReactNode[] };
  /** Extra header actions, e.g. exporting the current data. */
  actions?: ReactNode;
};

/** Upload → review (row-level errors, nothing imported while any remain) → import. Reused by every CSV import in the catalog. */
export function ImportWizard<R>(p: ImportWizardProps<R>) {
  const t = useTranslations();
  const f = useFormat();
  const qc = useQueryClient();
  const { data: history = [] } = useCatalogImports(p.historyKind);
  const [file, setFile] = useState("");
  const [result, setResult] = useState<Parse<R> | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files?.[0];
    if (!fl) return;
    setFile(fl.name);
    try {
      setResult(await p.parse(await fl.text()));
    } catch (err) {
      setResult(null);
      toast.error(catalogErrorMessage(err, t));
    }
  };

  const run = async () => {
    if (!result) return;
    setBusy(true);
    try {
      await p.commit(result.rows, file);
      toast.success(t("catalog.imported", { count: result.rows.length }));
      setResult(null);
      setFile("");
      await Promise.all(["products", "stockLots", "importBatches", "lookups"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
    } catch (err) {
      toast.error(catalogErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };
  const errText = (m: string) => (t.has(`catalog.importErrors.${m}`) ? t(`catalog.importErrors.${m}`) : m);

  return (
    <div className="grid gap-4">
      <PageHeader title={p.title} description={p.description} actions={p.actions} />
      <div className="grid gap-3 rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">{p.hint}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Input aria-label={t("catalog.chooseFile")} type="file" accept=".csv,text/csv" key={file} onChange={onFile} className="max-w-sm" />
          <Button variant="outline" onClick={() => downloadCSV(p.templateName, `${p.columns.join(",")}\n`)}><DownloadIcon />{t("catalog.downloadTemplate")}</Button>
        </div>
      </div>

      {result && (
        <div className="grid gap-3 rounded-xl border bg-card p-4">
          <h3 className="font-semibold">{t("catalog.review")}</h3>
          <p className="text-sm">
            {t("catalog.rowsReady", { count: result.rows.length })}
            {result.errors.length > 0 && <span className="text-danger"> · {t("catalog.rowsWithErrors", { count: result.errors.length })}</span>}
          </p>
          {result.errors.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead className="w-24">{t("catalog.row")}</TableHead><TableHead>{t("common.details")}</TableHead></TableRow></TableHeader>
              <TableBody>{result.errors.map((e) => <TableRow key={`${e.row}-${e.message}`}><TableCell className="tabular">{f.number(e.row)}</TableCell><TableCell>{errText(e.message)}</TableCell></TableRow>)}</TableBody>
            </Table>
          ) : (
            result.rows.length > 0 && (
              <div className="max-h-80 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow>{p.preview.headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>
                    {result.rows.slice(0, 50).map((r, i) => <TableRow key={i}>{p.preview.cells(r).map((c, j) => <TableCell key={j} className="tabular">{c}</TableCell>)}</TableRow>)}
                  </TableBody>
                </Table>
              </div>
            )
          )}
          <div><Button disabled={result.errors.length > 0 || result.rows.length === 0 || busy} onClick={run}><UploadIcon />{t("catalog.importNow")}</Button></div>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <h3 className="p-4 pb-2 font-semibold">{t("catalog.history")}</h3>
        {history.length === 0 ? (
          <p className="p-4 pt-0 text-sm text-muted-foreground">{t("catalog.noHistoryImports")}</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>{t("catalog.importedAt")}</TableHead><TableHead>{t("catalog.fileName")}</TableHead><TableHead className="text-right">{t("catalog.rowsCount")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {history.map((b) => (
                <TableRow key={b.id}><TableCell className="tabular">{f.dateTime(b.createdAt)}</TableCell><TableCell>{b.fileName}</TableCell><TableCell className="text-right tabular">{f.number(b.rows)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
