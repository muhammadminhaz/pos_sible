"use client";

import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { SaleList } from "./SaleList";

export function SuspendedSheet({ locationId }: { locationId: string }) {
  const t = useTranslations("pos.suspended");
  const open = usePosDialogs((s) => s.open === "suspended");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && hide()}>
      <SheetContent side="right" onCloseAutoFocus={(e) => { e.preventDefault(); focusSearch(); }} className="w-[420px] gap-0 p-0 sm:max-w-[420px]">
        <SheetHeader className="border-b">
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-auto">{open && <SaleList locationId={locationId} status="suspended" />}</div>
      </SheetContent>
    </Sheet>
  );
}
