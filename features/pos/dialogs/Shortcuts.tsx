"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSettings } from "@/lib/data/hooks/settings";
import { formatHotkey } from "@/lib/pos/hotkeys";
import { usePosDialogs } from "../dialogStore";

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</kbd>
);

export function ShortcutsDialog() {
  const t = useTranslations("pos.shortcuts");
  const open = usePosDialogs((s) => s.open === "shortcuts");
  const hide = usePosDialogs((s) => s.hide);
  const { data: settings } = useSettings();
  const map = settings?.pos.shortcuts;
  const rows: [string, string][] = [
    [t("focusSearch"), "F3"],
    [t("help"), "?"],
    ...(map ? (Object.entries(map) as [keyof typeof map, string][]).map(([k, v]): [string, string] => [t(k), v ? formatHotkey(v) : ""]) : []),
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && hide()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([label, keys]) => (
              <tr key={label} className="border-b last:border-0">
                <td className="py-2">{label}</td>
                <td className="py-2 text-right">{keys ? <Kbd>{keys}</Kbd> : <span className="text-muted-foreground">{t("unset")}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}
