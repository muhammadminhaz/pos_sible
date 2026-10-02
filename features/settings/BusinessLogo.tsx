"use client";

import { useRef } from "react";
import { ImageUpIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LogoMark } from "@/components/layout/LogoMark";
import { Button } from "@/components/ui/button";
import { useSettings, useUpdateSettings } from "@/lib/data/hooks/settings";

const MAX_FILE = 2 * 1024 * 1024;
const MAX_SVG = 100 * 1024;
/** Longest edge of a stored raster logo; plenty for the sidebar, receipts and A4 invoices. */
const MAX_EDGE = 384;

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

/** Downscales a raster image so the logo kept in local storage stays small. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/png");
}

/** Upload, replace or remove the business logo. Saves straight away, separate from the settings form. */
export function BusinessLogo() {
  const t = useTranslations("settings.logo");
  const { data } = useSettings();
  const update = useUpdateSettings("business");
  const input = useRef<HTMLInputElement>(null);
  const logo = data?.business.logo ?? null;

  const save = (value: string | null, message: string) =>
    update.mutate({ logo: value }, { onSuccess: () => toast.success(message) });

  const onPick = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) return void toast.error(t("invalidType"));
    if (file.size > MAX_FILE) return void toast.error(t("tooLarge"));
    try {
      if (file.type === "image/svg+xml") {
        if (file.size > MAX_SVG) return void toast.error(t("svgTooLarge"));
        return save(await readAsDataUrl(file), t("saved"));
      }
      save(await shrink(file), t("saved"));
    } catch {
      toast.error(t("unreadable"));
    }
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border p-4">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40">
        <LogoMark className="size-14 rounded-md" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        <p className="mt-0.5 text-muted-foreground">{logo ? t("helpSet") : t("helpEmpty")}</p>
      </div>
      <div className="flex gap-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          tabIndex={-1}
          aria-label={t("upload")}
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" disabled={update.isPending} onClick={() => input.current?.click()}>
          <ImageUpIcon />
          {logo ? t("replace") : t("upload")}
        </Button>
        {logo && (
          <Button type="button" variant="ghost" disabled={update.isPending} onClick={() => save(null, t("removed"))}>
            <Trash2Icon />
            {t("remove")}
          </Button>
        )}
      </div>
    </div>
  );
}
