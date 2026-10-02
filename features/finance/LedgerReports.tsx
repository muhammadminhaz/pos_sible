"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { useBalanceSheet, useTrialBalance } from "@/lib/data/hooks/finance";
import { useLookups } from "@/lib/data/hooks/lookups";
import type { LedgerAccount, SheetRow } from "@/lib/domain/ledger";
import { useFormat } from "@/lib/i18n/format";
import { PrintPortal, useReportPrint } from "@/features/reports/print";
import { DateField, ReportControls, useReportScope } from "./ReportControls";

function useScope() {
  const { today, defaultLocation } = useReportScope();
  const [location, setLocation] = useState<string | null | undefined>(undefined);
  const [date, setDate] = useState<string | undefined>(undefined);
  return { locationId: location === undefined ? defaultLocation : location, setLocation, date: date ?? today, setDate };
}

function useAccountLabel() {
  const t = useTranslations();
  return (account: LedgerAccount | "retained", accountName: string) => {
    const base = t(`finance.ledger.${account}`);
    return account === "cash" ? `${base} — ${accountName || t("finance.unlinked")}` : base;
  };
}

function ScopeLine({ locationId, date }: { locationId: string | null; date: string }) {
  const t = useTranslations();
  const f = useFormat();
  const { data: lookups } = useLookups();
  const loc = lookups?.locations.find((l) => l.id === locationId)?.name ?? t("common.allLocations");
  return <p className="mb-4 hidden text-sm text-muted-foreground print:block">{`${loc} · ${t("finance.asOf", { date: f.date(date) })}`}</p>;
}

export function TrialBalance() {
  const t = useTranslations();
  const label = useAccountLabel();
  const s = useScope();
  const { data } = useTrialBalance({ date: s.date, locationId: s.locationId });
  const { printing, print } = useReportPrint();
  const body = (
    <>
      <ScopeLine locationId={s.locationId} date={s.date} />
      {!data ? <Skeleton className="h-64" /> : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>{t("finance.ledgerAccount")}</TableHead><TableHead className="text-right">{t("finance.debit")}</TableHead><TableHead className="text-right">{t("finance.credit")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={`${r.account}|${r.accountId ?? ""}`}>
                  <TableCell>{label(r.account, r.accountName)}</TableCell>
                  <TableCell className="text-right">{r.debit ? <Money value={r.debit} /> : "—"}</TableCell>
                  <TableCell className="text-right">{r.credit ? <Money value={r.credit} /> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="font-semibold"><TableCell>{t("common.total")}</TableCell><TableCell className="text-right"><Money value={data.debit} /></TableCell><TableCell className="text-right"><Money value={data.credit} /></TableCell></TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </>
  );
  return (
    <>
      <PageHeader title={t("nav.trialBalance")} description={t("finance.trialDescription")} />
      <ReportControls locationId={s.locationId} onLocation={s.setLocation} onPrint={print}>
        <DateField id="tb-date" label={t("finance.asOfDate")} value={s.date} onChange={s.setDate} />
      </ReportControls>
      {body}
      <PrintPortal printing={printing}><h1 className="mb-2 text-lg font-semibold">{t("nav.trialBalance")}</h1>{body}</PrintPortal>
    </>
  );
}

function Group({ title, rows, total, names }: { title: string; rows: SheetRow[]; total: number; names: Record<string, string> }) {
  const t = useTranslations();
  const label = useAccountLabel();
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <dl className="grid gap-2 text-sm">
        {rows.length === 0 && <p className="text-muted-foreground">{t("common.noData")}</p>}
        {rows.map((r) => (
          <div key={`${r.account}|${r.accountId ?? ""}`} className="flex justify-between gap-4"><dt>{label(r.account, names[r.accountId ?? ""] ?? "")}</dt><dd><Money value={r.amount} /></dd></div>
        ))}
        <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>{t("common.total")}</dt><dd><Money value={total} /></dd></div>
      </dl>
    </section>
  );
}

export function BalanceSheet() {
  const t = useTranslations();
  const s = useScope();
  const { data } = useBalanceSheet({ date: s.date, locationId: s.locationId });
  const { printing, print } = useReportPrint();
  const body = (
    <>
      <ScopeLine locationId={s.locationId} date={s.date} />
      {!data ? <Skeleton className="h-64" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Group title={t("finance.assets")} rows={data.assets} total={data.totalAssets} names={data.accountNames} />
          <div className="grid content-start gap-4">
            <Group title={t("finance.liabilities")} rows={data.liabilities} total={data.totalLiabilities} names={data.accountNames} />
            <Group title={t("finance.equity")} rows={data.equity} total={data.totalEquity} names={data.accountNames} />
          </div>
        </div>
      )}
    </>
  );
  return (
    <>
      <PageHeader title={t("nav.balanceSheet")} description={t("finance.sheetDescription")} />
      <ReportControls locationId={s.locationId} onLocation={s.setLocation} onPrint={print}>
        <DateField id="bs-date" label={t("finance.asOfDate")} value={s.date} onChange={s.setDate} />
      </ReportControls>
      {body}
      <PrintPortal printing={printing}><h1 className="mb-2 text-lg font-semibold">{t("nav.balanceSheet")}</h1>{body}</PrintPortal>
    </>
  );
}
