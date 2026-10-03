"use client";

import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useCart } from "@/lib/pos/store";
import { useCartFlag, usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";

export function CancelDialog({ locationId }: { locationId: string }) {
  const t = useTranslations("pos");
  const open = usePosDialogs((s) => s.open === "cancel");
  const hide = usePosDialogs((s) => s.hide);
  const { reset } = useCart(locationId);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => !o && hide()}
      title={t("cancelConfirm.title")}
      description={t("cancelConfirm.body")}
      confirmLabel={t("cancelConfirm.confirm")}
      cancelLabel={t("cancelConfirm.keep")}
      destructive
      onConfirm={() => {
        reset();
        useCartFlag.getState().flag(null);
        toast(t("done.cancelled"));
        hide();
        focusSearch();
      }}
    />
  );
}
