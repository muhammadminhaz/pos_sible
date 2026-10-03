"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PickField } from "@/features/catalog/formParts";
import { usePurchaseMutations } from "@/lib/data/hooks/operations";
import type { PurchaseStatus } from "@/lib/data/services/purchases";
import { opsErrorMessage } from "./opsError";

function Body({ id, current, onClose }: { id: string; current: PurchaseStatus; onClose: () => void }) {
  const t = useTranslations();
  const { setStatus } = usePurchaseMutations();
  const [status, setS] = useState<PurchaseStatus>(current);
  const run = async () => {
    try {
      await setStatus.mutateAsync({ id, status });
      toast.success(t("ops.statusUpdated"));
      onClose();
    } catch (e) {
      toast.error(opsErrorMessage(e, t));
    }
  };
  return (
    <div className="grid gap-4">
      <DialogHeader><DialogTitle>{t("ops.updateStatus")}</DialogTitle></DialogHeader>
      <PickField label={t("ops.purchaseStatus")} nullable={false} value={status} onChange={(x) => setS((x ?? current) as PurchaseStatus)}
        options={(["received", "pending", "ordered"] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))} />
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button disabled={setStatus.isPending || status === current} onClick={run}>{t("common.update")}</Button>
      </DialogFooter>
    </div>
  );
}

export function PurchaseStatusDialog({ target, onClose }: { target: { id: string; status: PurchaseStatus } | null; onClose: () => void }) {
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">{target && <Body key={target.id} id={target.id} current={target.status} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}
