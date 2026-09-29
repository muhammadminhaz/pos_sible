"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { useFormat } from "@/lib/i18n/format";
import { roundMoney } from "@/lib/domain/money";

export const denominationTotal = (counts: Record<string, number>) =>
  roundMoney(Object.entries(counts).reduce((s, [note, n]) => s + Number(note) * (n || 0), 0));

/** Note × count grid; `counts` is keyed by the note value as a string. */
export function Denominations({ notes, counts, onChange }: {
  notes: number[]; counts: Record<string, number>; onChange: (c: Record<string, number>) => void;
}) {
  const t = useTranslations("pos.pay");
  const f = useFormat();
  return (
    <fieldset className="grid gap-2 rounded-lg border p-3">
      <legend className="px-1 text-xs text-muted-foreground">{t("denominations")}</legend>
      <div className="grid grid-cols-2 gap-2">
        {notes.map((n) => (
          <label key={n} className="flex items-center gap-2 text-sm">
            <span className="w-20 shrink-0 whitespace-nowrap text-right tabular-nums">{f.amount(n)} ×</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={counts[n] || ""}
              onChange={(e) => onChange({ ...counts, [n]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              className="h-8 w-16 tabular-nums"
            />
          </label>
        ))}
      </div>
      <p className="text-right text-sm font-medium tabular-nums">{f.money(denominationTotal(counts))}</p>
    </fieldset>
  );
}
