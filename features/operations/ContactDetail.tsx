"use client";

import { useState } from "react";
import Link from "next/link";
import { CoinsIcon, PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Section } from "@/features/catalog/formParts";
import { useCan } from "@/lib/auth/useCan";
import { useContact, useContactLedger } from "@/lib/data/hooks/contacts";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useSettings } from "@/lib/data/hooks/settings";
import { useFormat } from "@/lib/i18n/format";
import { methodLabel } from "@/lib/pos/methods";
import { ContactFormDialog } from "./ContactForm";
import { PayDueDialog } from "./PayDueDialog";
import { ScrollFade } from "@/components/ui/scroll-fade";

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

export function ContactDetail({ id }: { id: string }) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const { data: c, isError } = useContact(id);
  const { data: ledger = [] } = useContactLedger(id);
  const { data: lookups } = useLookups();
  const { data: settings } = useSettings();
  const [edit, setEdit] = useState<string | null>(null);
  const [pay, setPay] = useState<string | null>(null);
  if (isError) return <EmptyState title={t("errors.notFound")} />;
  if (!c) return <Skeleton className="h-96" />;
  const write = can(c.type === "supplier" ? "contacts.supplier" : "contacts.customer");
  const labels = settings?.customLabels.payments ?? [];
  const group = lookups?.customerGroups.find((g) => g.id === c.customerGroupId)?.name;
  const users = (lookups?.users ?? []).filter((u) => c.assignedTo.includes(u.id)).map((u) => `${u.firstName} ${u.lastName}`.trim()).join(", ");
  const owes = c.type === "supplier" ? c.purchaseDue : c.sellDue;

  return (
    <div className="grid gap-4">
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{c.name}<StatusBadge status={c.active ? "active" : "inactive"} /></span>}
        description={`${c.code} · ${t(`ops.type.${c.type}`)}${c.businessName ? ` · ${c.businessName}` : ""}`}
        actions={write && !c.isDefault && (
          <>
            <Button variant="outline" onClick={() => setEdit(c.id)}><PencilIcon />{t("common.edit")}</Button>
            {c.due > 0 && <Button onClick={() => setPay(c.id)}><CoinsIcon />{t("ops.payDue")}</Button>}
          </>
        )}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("ops.totalInvoice")} value={<Money value={c.totalInvoice} />} />
        <StatCard label={t("ops.totalPaid")} value={<Money value={c.totalPaid} />} />
        <StatCard label={t(c.type === "supplier" ? "ops.purchaseDue" : "ops.sellDue")} value={<Money value={owes} />} />
        <StatCard label={t("ops.balanceDue")} value={<Money value={c.due} />} />
      </div>

      <Section title={t("catalog.details")}>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Fact label={t("ops.mobile")} value={c.mobile} />
          <Fact label={t("ops.altNumber")} value={c.altNumber} />
          <Fact label={t("ops.email")} value={c.email} />
          <Fact label={t("ops.taxNumber")} value={c.taxNumber} />
          <Fact label={t("ops.customerGroup")} value={group} />
          <Fact label={t("ops.creditLimit")} value={c.creditLimit != null ? f.money(c.creditLimit) : ""} />
          <Fact label={t("ops.openingBalance")} value={f.money(c.openingBalance)} />
          <Fact label={t("ops.advance")} value={f.money(c.advanceBalance)} />
          <Fact label={t("ops.points")} value={f.number(c.points)} />
          <Fact label={t("ops.payTerm")} value={c.payTerm ? `${c.payTerm.number} ${t(`catalog.${c.payTerm.type}`)}` : ""} />
          <Fact label={t("ops.assignedTo")} value={users} />
          <Fact label={t("ops.address")} value={[c.address.line1, c.address.city].filter(Boolean).join(", ")} />
        </dl>
      </Section>

      <Section title={t("ops.ledger")}>
        {ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("ops.noLedger")}</p>
        ) : (
          <ScrollFade className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("catalog.reference")}</TableHead>
                  <TableHead>{t("catalog.movement")}</TableHead>
                  <TableHead className="text-right">{t("ops.debit")}</TableHead>
                  <TableHead className="text-right">{t("ops.credit")}</TableHead>
                  <TableHead className="text-right">{t("ops.balance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((e) => (
                  <TableRow key={e.key}>
                    <TableCell className="whitespace-nowrap tabular">{f.dateTime(e.date)}</TableCell>
                    <TableCell className="tabular">
                      {e.txnId && (e.kind === "invoice" || e.kind === "return") ? <Link className="text-primary hover:underline" href={e.kind === "return" ? `/${c.type === "supplier" ? "purchases" : "sales"}/returns` : `/${c.type === "supplier" ? "purchases" : "sales"}/${e.txnId}`}>{e.refNo}</Link> : e.refNo || "—"}
                    </TableCell>
                    <TableCell>{t(`ops.ledgerKind.${e.kind}`)}{e.method ? ` · ${methodLabel(e.method, t, labels)}` : ""}</TableCell>
                    <TableCell className="text-right tabular">{e.debit ? f.amount(e.debit) : ""}</TableCell>
                    <TableCell className="text-right tabular">{e.credit ? f.amount(e.credit) : ""}</TableCell>
                    <TableCell className="text-right tabular font-medium">{f.amount(e.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollFade>
        )}
      </Section>
      <ContactFormDialog editId={edit} defaultType={c.type} onClose={() => setEdit(null)} />
      <PayDueDialog contactId={pay} onClose={() => setPay(null)} />
    </div>
  );
}
