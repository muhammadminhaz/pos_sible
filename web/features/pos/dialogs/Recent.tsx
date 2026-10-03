"use client";

import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SaleStatus } from "@/lib/data/services/sales";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { SaleList } from "./SaleList";

const TABS: SaleStatus[] = ["final", "quotation", "draft"];

export function RecentSheet({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const open = usePosDialogs((s) => s.open === "recent");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && hide()}>
      <SheetContent side="right" onCloseAutoFocus={(e) => { e.preventDefault(); focusSearch(); }} className="w-[440px] gap-0 p-0 sm:max-w-[440px]">
        <SheetHeader className="border-b">
          <SheetTitle>{t("pos.recent.title")}</SheetTitle>
        </SheetHeader>
        {open && (
          <Tabs defaultValue="final" className="min-h-0 flex-1 gap-0">
            <TabsList className="mx-4 mt-3">
              {TABS.map((s) => (
                <TabsTrigger key={s} value={s}>{t(`status.${s}`)}</TabsTrigger>
              ))}
            </TabsList>
            {TABS.map((s) => (
              <TabsContent key={s} value={s} className="min-h-0 overflow-auto">
                <SaleList locationId={locationId} status={s} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
