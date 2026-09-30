"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
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
        toast(t("done.cancelled"));
        hide();
        focusSearch();
      }}
    />
  );
}
