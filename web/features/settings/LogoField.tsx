"use client";

import { ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_BYTES = 400 * 1024;

/** Business logo shown on receipts and invoices. Stored as a small data URL. */
export function LogoField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const t = useTranslations("settings");
  return (
    <div className="col-span-full flex items-center gap-4">
      <span className="grid size-16 place-items-center overflow-hidden rounded-lg border bg-muted text-muted-foreground">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={t("logoPreview")} className="size-full object-contain" />
        ) : (
          <ImageIcon className="size-6" />
        )}
      </span>
      <div className="grid gap-2">
        <Label htmlFor="biz-logo">{t("logo")}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="biz-logo" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="max-w-xs"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > MAX_BYTES) return void toast.error(t("logoTooBig"));
              const r = new FileReader();
              r.onload = () => onChange(String(r.result));
              r.readAsDataURL(file);
            }}
          />
          {value && <Button type="button" variant="outline" onClick={() => onChange(null)}>{t("removeLogo")}</Button>}
        </div>
        <p className="text-xs text-muted-foreground">{t("logoHint")}</p>
      </div>
    </div>
  );
}
