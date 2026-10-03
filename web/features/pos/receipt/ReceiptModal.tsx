"use client";

import { createPortal } from "react-dom";
import { FileTextIcon, PlusIcon, PrinterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReceipt } from "@/lib/data/hooks/pos";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { A4Invoice } from "./A4Invoice";
import { usePrint } from "./print";
import { ThermalReceipt } from "./ThermalReceipt";

export function ReceiptModal() {
  const t = useTranslations();
  const open = usePosDialogs((s) => s.open === "receipt");
  const receiptId = usePosDialogs((s) => s.receiptId);
  const hide = usePosDialogs((s) => s.hide);
  const { data } = useReceipt(open ? receiptId : null);
  const { printing, print } = usePrint();

  const close = () => {
    hide();
    focusSearch();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("pos.receipt.title")}</DialogTitle>
          </DialogHeader>
          {!data ? (
            <Skeleton className="h-96" />
          ) : (
            <Tabs defaultValue="thermal">
              <TabsList>
                <TabsTrigger value="thermal">{t("pos.receipt.thermal")}</TabsTrigger>
                <TabsTrigger value="a4">{t("pos.receipt.a4")}</TabsTrigger>
              </TabsList>
              <TabsContent value="thermal" className="max-h-[60vh] overflow-auto rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
                <ThermalReceipt data={data} />
              </TabsContent>
              <TabsContent value="a4" className="max-h-[60vh] overflow-auto rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
                <div style={{ zoom: 0.6 }}>
                  <A4Invoice data={data} />
                </div>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => print("a4")} disabled={!data}>
              <FileTextIcon />
              {t("pos.receipt.a4")}
            </Button>
            <Button variant="outline" onClick={() => print("thermal")} disabled={!data}>
              <PrinterIcon />
              {t("common.print")}
            </Button>
            <Button autoFocus onClick={close}>
              <PlusIcon />
              {t("pos.receipt.newSale")}
              <kbd className="ml-1 rounded bg-primary-foreground/20 px-1 text-[10px]">Enter</kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {printing && data &&
        createPortal(
          <div data-print-root={printing}>{printing === "thermal" ? <ThermalReceipt data={data} /> : <A4Invoice data={data} />}</div>,
          document.body,
        )}
    </>
  );
}
