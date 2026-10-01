"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileTextIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, useTableQuery, type TableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { decodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/lib/auth/useCan";
import { useContacts } from "@/lib/data/hooks/contacts";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useSaleMutations, useSalesList } from "@/lib/data/hooks/sales";
import { SHIPPING_STATUSES, PAYMENT_STATUSES } from "@/lib/data/schemas";
import { salesService, type SaleFilters, type SaleListRow } from "@/lib/data/services/sales";
import { useUI } from "@/lib/data/store/ui";
import { useFormat } from "@/lib/i18n/format";
import { usePosDialogs } from "@/features/pos/dialogStore";
import { ReceiptModal } from "@/features/pos/receipt/ReceiptModal";
import { saleColumns, SALE_DEFAULT_HIDDEN, type SaleKind } from "./columns";
import { PaymentsDialog } from "./PaymentsDialog";
import { saleErrorMessage } from "./saleError";
import { ShippingDialog } from "./ShippingDialog";

type UrlFilters = {
  location?: string; customer?: string; payment?: string; range?: string; user?: string; agent?: string;
  shipping?: string; subscription?: "1"; channel?: "pos" | "web";
};
const FILTER_KEYS = ["location", "customer", "payment", "range", "user", "agent", "shipping", "subscription", "channel"] as const;

const TITLE: Record<SaleKind, string> = { all: "nav.allSales", drafts: "nav.drafts", quotations: "nav.quotations" };
const DESCRIPTION: Record<SaleKind, string> = { all: "sales.listDescription", drafts: "sales.draftsDescription", quotations: "sales.quotationsDescription" };
const ADD_HREF: Record<SaleKind, string> = { all: "/sales/new", drafts: "/sales/new?status=draft", quotations: "/sales/new?status=quotation" };

function toFilters(u: UrlFilters, kind: SaleKind, globalLocation: string, q: TableQuery): SaleFilters {
  const range = decodeRange(u.range);
  return {
    kind, search: q.search || undefined, page: q.page, pageSize: q.pageSize, sort: q.sort ?? { id: "date", desc: true },
    locationId: u.location ?? (globalLocation === "all" ? undefined : globalLocation), contactId: u.customer,
    paymentStatus: u.payment as SaleFilters["paymentStatus"], from: range?.from, to: range?.to, createdBy: u.user, agentId: u.agent,
    shippingStatus: u.shipping as SaleFilters["shippingStatus"], subscription: u.subscription ? true : undefined, channel: u.channel,
  };
}

export function SalesList({ kind = "all" }: { kind?: SaleKind }) {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const can = useCan();
  const { data: lookups } = useLookups();
  const { data: customers } = useContacts({ type: "customer", pageSize: -1 });
  const globalLocation = useUI((s) => s.locationId);
  const showReceipt = usePosDialogs((s) => s.showReceipt);
  const [url, setUrl, resetUrl] = useUrlFilters<UrlFilters>([...FILTER_KEYS]);
  const [query, setQuery] = useTableQuery(`sales-${kind}`);
  const filters = toFilters(url, kind, globalLocation, query);
  const list = useSalesList(filters);
  const m = useSaleMutations();

  const [toDelete, setToDelete] = useState<SaleListRow | null>(null);
  const [toConvert, setToConvert] = useState<SaleListRow | null>(null);
  const [payments, setPayments] = useState<{ id: string; mode: "add" | "view" } | null>(null);
  const [shippingId, setShippingId] = useState<string | null>(null);

  const columns = useMemo(
    () =>
      saleColumns(t, f, kind, {
        can,
        onPrint: (s) => showReceipt(s.id),
        onPayments: (s, mode) => setPayments({ id: s.id, mode }),
        onShipping: (s) => setShippingId(s.id),
        onConvert: setToConvert,
        onDelete: setToDelete,
        onGenerate: async (s) => {
          try {
            const r = await m.generateNext.mutateAsync(s.id);
            toast.success(t("sales.generated", { refNo: r.refNo }));
          } catch (e) {
            toast.error(saleErrorMessage(e, t));
          }
        },
      }),
    // `m.generateNext` is a stable mutation handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, f, kind, can, showReceipt],
  );

  const named = (xs: { id: string; name: string }[]) => xs.map((x) => ({ value: x.id, label: x.name }));
  const people = (lookups?.users ?? []).map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() }));
  const defs: FilterDef[] = [
    { key: "location", label: t("common.location"), type: "select", options: named(lookups?.locations ?? []) },
    { key: "customer", label: t("sales.customer"), type: "select", options: named(customers?.rows ?? []) },
    ...(kind === "all"
      ? ([
          { key: "payment", label: t("sales.paymentStatus"), type: "select", options: PAYMENT_STATUSES.map((v) => ({ value: v, label: t(`status.${v}`) })) },
        ] as FilterDef[])
      : []),
    { key: "range", label: t("sales.dateRange"), type: "daterange" },
    { key: "user", label: t("sales.user"), type: "select", options: named(people) },
    ...(kind === "all"
      ? ([
          { key: "agent", label: t("sales.commissionAgent"), type: "select", options: named(people.filter((p) => lookups?.users.find((u) => u.id === p.id)?.isSalesAgent)) },
          { key: "shipping", label: t("sales.shippingStatus"), type: "select", options: SHIPPING_STATUSES.map((v) => ({ value: v, label: t(`status.${v === "ordered" ? "ordered_shipping" : v}`) })) },
          { key: "channel", label: t("sales.channel"), type: "select", options: (["pos", "web"] as const).map((v) => ({ value: v, label: t(`sales.${v}`) })) },
          { key: "subscription", label: t("sales.subscriptionsOnly"), type: "toggle" },
        ] as FilterDef[])
      : []),
  ];

  const allRows = () => salesService.listAll({ ...filters, page: 0, pageSize: -1 }).then((r) => r.rows);
  const totals = list.data?.totals;

  return (
    <>
      <PageHeader
        title={t(TITLE[kind])}
        description={t(DESCRIPTION[kind])}
        actions={
          can("sell.create") && (
            <Button asChild>
              <Link href={ADD_HREF[kind]}>
                <PlusIcon />
                {kind === "all" ? t("nav.addSale") : kind === "drafts" ? t("nav.addDraft") : t("nav.addQuotation")}
              </Link>
            </Button>
          )
        }
      />
      <div className="mb-4">
        <FilterBar
          defs={defs}
          value={url}
          onChange={(patch) => {
            setUrl(patch);
            setQuery({ page: 0 });
          }}
          onReset={() => {
            resetUrl();
            setQuery({ page: 0 });
          }}
        />
      </div>
      <DataTable
        tableId={`sales-${kind}`}
        columns={columns}
        data={list.data?.rows ?? []}
        total={list.data?.total ?? 0}
        loading={list.isFetching}
        query={query}
        onQueryChange={setQuery}
        exportName={`sales-${kind}`}
        exportRows={allRows}
        defaultHidden={kind === "all" ? SALE_DEFAULT_HIDDEN : []}
        onRowClick={(s) => router.push(`/sales/${s.id}`)}
        empty={<EmptyState icon={FileTextIcon} title={t("sales.noSales")} />}
        footer={
          kind === "all" && totals
            ? () => ({
                refNo: t("sales.footerTotals"),
                total: <Money value={totals.total} />,
                paid: <Money value={totals.paid} />,
                due: <Money value={totals.due} />,
              })
            : undefined
        }
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title={t("sales.deleteTitle")}
        description={t("sales.deleteBody")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await m.remove.mutateAsync(toDelete.id);
            toast.success(t("sales.deleted"));
          } catch (e) {
            toast.error(saleErrorMessage(e, t));
          }
        }}
      />
      <ConfirmDialog
        open={toConvert !== null}
        onOpenChange={(o) => !o && setToConvert(null)}
        title={t("sales.convertTitle")}
        confirmLabel={t("sales.convert")}
        onConfirm={async () => {
          if (!toConvert) return;
          try {
            const r = await m.convert.mutateAsync({ id: toConvert.id });
            toast.success(t("sales.converted", { refNo: r.refNo }));
          } catch (e) {
            toast.error(saleErrorMessage(e, t));
          }
        }}
      />
      <PaymentsDialog saleId={payments?.id ?? null} mode={payments?.mode ?? "view"} onClose={() => setPayments(null)} />
      <ShippingDialog saleId={shippingId} onClose={() => setShippingId(null)} />
      <ReceiptModal />
    </>
  );
}
