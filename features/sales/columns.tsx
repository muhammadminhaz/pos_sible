"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { BanknoteIcon, EyeIcon, FileCheckIcon, PencilIcon, PrinterIcon, ReceiptIcon, RepeatIcon, TruckIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import type { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { RowActions } from "@/components/shared/DataTable";
import { Money } from "@/components/shared/Money";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { SaleListRow } from "@/lib/data/services/sales";
import type { Formatter } from "@/lib/i18n/format";

type T = ReturnType<typeof useTranslations>;
export type SaleKind = "all" | "drafts" | "quotations";

export type SaleActions = {
  can: (p?: string) => boolean;
  onPrint: (s: SaleListRow) => void;
  onPayments: (s: SaleListRow, mode: "add" | "view") => void;
  onShipping: (s: SaleListRow) => void;
  onConvert: (s: SaleListRow) => void;
  onDelete: (s: SaleListRow) => void;
  onGenerate: (s: SaleListRow) => void;
};

const dash = <span className="text-muted-foreground">—</span>;
const text = (id: keyof SaleListRow, label: string, className?: string): ColumnDef<SaleListRow> => ({
  id, accessorKey: id, header: label, meta: { label, className },
  cell: ({ getValue }) => getValue<string>() || dash,
});
const money = (id: keyof SaleListRow, label: string): ColumnDef<SaleListRow> => ({
  id, accessorKey: id, header: label, meta: { label, align: "right" }, cell: ({ row }) => <Money value={row.original[id] as number} muted />,
});

export function saleColumns(t: T, f: Formatter, kind: SaleKind, a: SaleActions): ColumnDef<SaleListRow>[] {
  const final = kind === "all";
  const actions: ColumnDef<SaleListRow> = {
    id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined },
    cell: ({ row }) => {
      const s = row.original;
      const isFinal = s.status === "final";
      return (
        <RowActions
          items={[
            { label: t("sales.viewSale"), icon: EyeIcon, href: `/sales/${s.id}` },
            { label: t("sales.editSale"), icon: PencilIcon, href: `/sales/${s.id}/edit`, hidden: !a.can("sell.update") },
            { label: t("sales.printInvoice"), icon: PrinterIcon, onClick: () => a.onPrint(s) },
            { label: t("sales.convert"), icon: FileCheckIcon, onClick: () => a.onConvert(s), hidden: isFinal || !a.can("sell.update") },
            { label: t("sales.addPayment"), icon: BanknoteIcon, onClick: () => a.onPayments(s, "add"), hidden: !isFinal || s.due <= 0 || !a.can("sell.payments") },
            { label: t("sales.viewPayments"), icon: ReceiptIcon, onClick: () => a.onPayments(s, "view"), hidden: !isFinal },
            { label: t("sales.sellReturn"), icon: Undo2Icon, href: `/sales/returns/new?sale=${s.id}`, hidden: !isFinal || !a.can("sell.create") },
            { label: t("sales.editShipping"), icon: TruckIcon, onClick: () => a.onShipping(s), hidden: !isFinal || !a.can("sell.update") },
            { label: t("sales.generateNext"), icon: RepeatIcon, onClick: () => a.onGenerate(s), hidden: !s.recurring || !a.can("sell.create") },
            { label: t("common.delete"), icon: Trash2Icon, onClick: () => a.onDelete(s), destructive: true, hidden: !a.can("sell.delete") },
          ]}
        />
      );
    },
  };

  const date: ColumnDef<SaleListRow> = {
    id: "date", accessorKey: "date", header: t("common.date"), meta: { label: t("common.date"), className: "whitespace-nowrap", csv: (s) => s.date },
    cell: ({ row }) => <span className="tabular">{f.dateTime(row.original.date)}</span>,
  };
  const refNo: ColumnDef<SaleListRow> = {
    id: "refNo", accessorKey: "refNo", header: final ? t("sales.invoiceNo") : t("sales.refNo"), meta: { label: final ? t("sales.invoiceNo") : t("sales.refNo") },
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5">
        <Link href={`/sales/${row.original.id}`} onClick={(e) => e.stopPropagation()} className="font-medium tabular hover:underline">
          {row.original.refNo}
        </Link>
        {row.original.recurring && <RepeatIcon className="size-3.5 text-muted-foreground" aria-label={t("sales.subscription")} />}
      </span>
    ),
  };
  const customer = text("contactName", t("sales.customer"), "min-w-32");
  const mobile = text("mobile", t("sales.mobile"));
  const location = text("locationName", t("common.location"));
  const items: ColumnDef<SaleListRow> = {
    id: "itemsCount", accessorKey: "itemsCount", header: t("sales.totalItems"), meta: { label: t("sales.totalItems"), align: "right" },
    cell: ({ row }) => <span className="tabular">{f.number(row.original.itemsCount)}</span>,
  };
  const addedBy = text("addedBy", t("sales.addedBy"));

  if (!final) return [date, refNo, customer, mobile, location, items, addedBy, text("note", t("sales.sellNote")), actions];

  return [
    date,
    refNo,
    customer,
    mobile,
    location,
    {
      id: "paymentStatus", accessorKey: "paymentStatus", header: t("sales.paymentStatus"), meta: { label: t("sales.paymentStatus"), csv: (s) => t(`status.${s.paymentStatus}`) },
      cell: ({ row }) => (row.original.status === "final" ? <StatusBadge status={row.original.paymentStatus} /> : <StatusBadge status={row.original.status} />),
    },
    {
      id: "methods", header: t("sales.paymentMethod"), enableSorting: false,
      meta: { label: t("sales.paymentMethod"), csv: (s) => s.methods.map((m) => (t.has(`payMethods.${m}`) ? t(`payMethods.${m}`) : m)).join(", ") },
      cell: ({ row }) =>
        row.original.methods.length ? (
          <span className="flex flex-wrap gap-1">
            {row.original.methods.map((m) => (
              <Badge key={m} variant="outline" className="font-normal">{t.has(`payMethods.${m}`) ? t(`payMethods.${m}`) : m}</Badge>
            ))}
          </span>
        ) : dash,
    },
    money("total", t("sales.totalAmount")),
    money("paid", t("sales.totalPaid")),
    money("due", t("sales.sellDue")),
    money("returnDue", t("sales.sellReturnDue")),
    {
      id: "shippingStatus", accessorKey: "shippingStatus", header: t("sales.shippingStatus"),
      meta: { label: t("sales.shippingStatus"), csv: (s) => (s.shippingStatus ? t(`status.${s.shippingStatus === "ordered" ? "ordered_shipping" : s.shippingStatus}`) : "") },
      cell: ({ row }) => (row.original.shippingStatus ? <StatusBadge status={row.original.shippingStatus === "ordered" ? "ordered_shipping" : row.original.shippingStatus} /> : dash),
    },
    items,
    addedBy,
    {
      id: "channel", accessorKey: "channel", header: t("sales.channel"), meta: { label: t("sales.channel"), csv: (s) => t(`sales.${s.channel}`) },
      cell: ({ row }) => <Badge variant="outline" className="font-normal">{t(`sales.${row.original.channel}`)}</Badge>,
    },
    text("note", t("sales.sellNote"), "max-w-48 truncate"),
    text("staffNote", t("sales.staffNote"), "max-w-48 truncate"),
    actions,
  ];
}

export const SALE_DEFAULT_HIDDEN = ["channel", "staffNote", "note", "returnDue", "mobile"];
