"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InboxIcon, PencilIcon, PlayIcon, PrinterIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { useCan } from "@/lib/auth/useCan";
import { usePosMutations, usePosSales } from "@/lib/data/hooks/pos";
import type { SaleRow, SaleStatus } from "@/lib/data/services/sales";
import { useFormat } from "@/lib/i18n/format";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { usePosError } from "../usePosAction";

/**
 * Sales of one status at this location. Non-final rows can be loaded into the cart
 * (confirming first when the cart has items) or deleted. Final rows link to the full edit screen.
 */
export function SaleList({ locationId, status }: { locationId: string; status: SaleStatus }) {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const can = useCan();
  const { data, isPending } = usePosSales({ locationId, status, limit: status === "suspended" ? 50 : 10 });
  const { loadCart, remove } = usePosMutations();
  const { cart, replace } = useCart(locationId);
  const { hide, showReceipt } = usePosDialogs();
  const onError = usePosError();
  const [confirm, setConfirm] = useState<{ kind: "load" | "delete"; row: SaleRow } | null>(null);

  const load = async (row: SaleRow) => {
    try {
      replace(await loadCart.mutateAsync(row.id));
      toast.success(t("pos.suspended.resumed", { ref: row.refNo }));
      hide();
      focusSearch();
    } catch (e) {
      onError(e);
    }
  };
  const del = async (row: SaleRow) => {
    try {
      await remove.mutateAsync(row.id);
      toast.success(t("pos.recent.deleted", { ref: row.refNo }));
    } catch (e) {
      onError(e);
    }
  };
  const edit = (row: SaleRow) => {
    if (status === "final") return router.push(`/sales/${row.id}/edit`);
    if (cart.lines.length) setConfirm({ kind: "load", row });
    else void load(row);
  };

  if (isPending) return <div className="grid gap-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>;
  if (!data?.length) return <EmptyState icon={InboxIcon} title={status === "suspended" ? t("pos.suspended.empty") : t("pos.recent.empty")} />;

  return (
    <>
      <ul className="grid gap-2 p-4">
        {data.map((row) => (
          <li key={row.id} className="grid gap-1 rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium tabular-nums">{row.refNo}</span>
              <span className="font-semibold tabular-nums">{f.money(row.total)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">{`${row.contactName} · ${f.qty(row.itemsCount)} ${t("pos.totals.items")}`}</span>
              <span className="tabular-nums">{f.dateTime(row.date)}</span>
            </div>
            {row.note && <p className="text-xs text-muted-foreground italic">{row.note}</p>}
            <div className="mt-1 flex justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => showReceipt(row.id)}>
                <PrinterIcon />
                {t("common.print")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => edit(row)} disabled={loadCart.isPending}>
                {status === "suspended" ? <PlayIcon /> : <PencilIcon />}
                {status === "suspended" ? t("pos.suspended.resume") : t("common.edit")}
              </Button>
              {status !== "final" && (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={row.id === cart.resumedFromId || !can("sell.delete")} onClick={() => setConfirm({ kind: "delete", row })}>
                  <Trash2Icon />
                  {t("common.delete")}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.kind === "delete" ? t("common.areYouSure") : t("pos.suspended.resume")}
        description={confirm?.kind === "delete" ? t("common.cannotUndo") : t("pos.suspended.replaceCart")}
        confirmLabel={confirm?.kind === "delete" ? t("common.delete") : t("common.confirm")}
        destructive={confirm?.kind === "delete"}
        onConfirm={() => {
          if (!confirm) return;
          void (confirm.kind === "delete" ? del(confirm.row) : load(confirm.row));
          setConfirm(null);
        }}
      />
    </>
  );
}
