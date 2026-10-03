"use client";

import { useTranslations } from "next-intl";
import { useContactGroupsLookup } from "./lookups";
import { useReport } from "@/lib/data/hooks/reports";
import { contactReports, type ContactReportRow, type GroupReportRow } from "@/lib/data/services/reports/contacts";
import { ReportShell, useReportFilters } from "./ReportShell";
import { ReportTable, type Col } from "./ReportTable";

export function ContactsReport() {
  const t = useTranslations("reports");
  const rf = useReportFilters(["type", "group"] as const);
  const groups = useContactGroupsLookup();
  const type = rf.url.type as "customer" | "supplier" | undefined;
  const filter = { ...rf.filter, type, customerGroupId: rf.url.group };
  const { data, isFetching } = useReport("contacts", filter, () => contactReports.contacts(filter));
  const cols: Col<ContactReportRow>[] = [
    { key: "name", label: t("contact") }, { key: "mobile", label: t("mobile") },
    { key: "totalSale", label: t("totalSale"), kind: "money", total: true }, { key: "sellReturn", label: t("sellReturn"), kind: "money", total: true }, { key: "saleDue", label: t("saleDue"), kind: "money", total: true },
    { key: "totalPurchase", label: t("totalPurchase"), kind: "money", total: true }, { key: "purchaseReturn", label: t("purchaseReturn"), kind: "money", total: true }, { key: "purchaseDue", label: t("purchaseDue"), kind: "money", total: true },
    { key: "openingBalance", label: t("openingBalance"), kind: "money", total: true },
  ];
  return (
    <ReportShell
      title={t("contactsTitle")} description={t("contactsDescription")} rf={rf}
      extraDefs={[
        { key: "type", label: t("contactType"), type: "select", options: [{ value: "customer", label: t("customers") }, { value: "supplier", label: t("suppliers") }] },
        { key: "group", label: t("customerGroup"), type: "select", options: groups },
      ]}
    >
      <ReportTable id="contacts" columns={cols} rows={data?.rows ?? []} totals={data?.totals} loading={isFetching} />
    </ReportShell>
  );
}

export function CustomerGroupsReport() {
  const t = useTranslations("reports");
  const rf = useReportFilters();
  const { data, isFetching } = useReport("customer-groups", rf.filter, () => contactReports.customerGroups(rf.filter));
  const cols: Col<GroupReportRow>[] = [
    { key: "name", label: t("customerGroup"), render: (r) => r.name || t("noGroup"), csv: (r) => r.name || t("noGroup") },
    { key: "customers", label: t("customers"), kind: "number", total: true },
    { key: "sales", label: t("sales"), kind: "money", total: true }, { key: "sellReturn", label: t("sellReturn"), kind: "money", total: true }, { key: "net", label: t("net"), kind: "money", total: true },
  ];
  return (
    <ReportShell title={t("customerGroupsTitle")} description={t("customerGroupsDescription")} rf={rf}>
      <ReportTable id="customer-groups" columns={cols} rows={data?.rows ?? []} totals={data?.totals} loading={isFetching} />
    </ReportShell>
  );
}
