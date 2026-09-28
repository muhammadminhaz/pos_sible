"use client";

import { useState, type ReactNode } from "react";
import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  destructive?: boolean;
  /** May be async; the dialog stays open with a spinner until it settles, and closes only on success. */
  onConfirm: () => unknown;
}) {
  const t = useTranslations("common");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t("areYouSure")}</AlertDialogTitle>
          <AlertDialogDescription>{description ?? t("cannotUndo")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            className={destructive ? "bg-danger text-white hover:bg-danger/90 dark:bg-danger dark:hover:bg-danger/90" : undefined}
            disabled={busy}
            onClick={confirm}
          >
            {busy && <Loader2Icon className="animate-spin" />}
            {confirmLabel ?? t("confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
