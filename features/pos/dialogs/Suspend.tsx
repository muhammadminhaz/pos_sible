"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";
import { useCheckout } from "../usePosAction";

function SuspendForm({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const hide = usePosDialogs((s) => s.hide);
  const { run, pending } = useCheckout(locationId);
  const [note, setNote] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run("suspended", [], note.trim() || undefined);
  };
  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t("pos.suspend.title")}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="suspend-note">{t("pos.suspend.note")}</Label>
        <Textarea id="suspend-note" rows={3} autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={hide}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={pending}>{t("pos.suspend.confirm")}</Button>
      </DialogFooter>
    </form>
  );
}

export function SuspendDialog({ locationId }: { locationId: string }) {
  const open = usePosDialogs((s) => s.open === "suspend");
  const hide = usePosDialogs((s) => s.hide);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent onCloseAutoFocus={(e) => { e.preventDefault(); focusSearch(); }} className="sm:max-w-md">{open && <SuspendForm locationId={locationId} />}</DialogContent>
    </Dialog>
  );
}
