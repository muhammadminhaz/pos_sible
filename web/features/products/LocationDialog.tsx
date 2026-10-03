"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Location } from "@/lib/data/schemas";

/** Pick locations to add selected products to, or remove them from. */
export function LocationDialog({
  mode,
  count,
  locations,
  onOpenChange,
  onSubmit,
}: {
  mode: "add" | "remove" | null;
  count: number;
  locations: Location[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (locationIds: string[]) => Promise<void>;
}) {
  const t = useTranslations();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const close = (open: boolean) => {
    if (!open) setPicked([]);
    onOpenChange(open);
  };

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit(picked);
      close(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={mode !== null} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "remove" ? t("products.removeFromLocation") : t("products.addToLocation")}</DialogTitle>
          <DialogDescription>{t("products.chooseLocationsHint", { count })}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1">
          {locations.map((l) => (
            <Label key={l.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 font-normal hover:bg-muted/40">
              <Checkbox
                checked={picked.includes(l.id)}
                onCheckedChange={(v) => setPicked((p) => (v ? [...p, l.id] : p.filter((x) => x !== l.id)))}
              />
              <span className="flex-1">{l.name}</span>
              <span className="text-xs text-muted-foreground tabular">{l.code}</span>
            </Label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={!picked.length || busy} variant={mode === "remove" ? "destructive" : "default"}>
            {busy && <Loader2Icon className="animate-spin" />}
            {t("common.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
