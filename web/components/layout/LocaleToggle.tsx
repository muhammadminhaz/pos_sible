"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "cn";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { setLocale } from "@/lib/i18n/locale";
import type { Locale } from "@/i18n/request";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "bn", label: "বাং" },
];

export function LocaleToggle({ className }: { className?: string }) {
  const t = useTranslations("header");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [shown, setShown] = useOptimistic(locale);

  const change = (next: Locale) => {
    if (next === locale) return;
    start(async () => {
      setShown(next);
      await setLocale(next);
      router.refresh();
    });
  };

  return (
    // ponytail: wrapper carries layout classes, the control's own CSS module would override Tailwind's `hidden`.
    <div className={cn(pending && "pointer-events-none opacity-60", className)}>
    <SegmentedControl
      label={t("language")}
      options={OPTIONS}
      value={shown}
      onValueChange={(v) => change(v as Locale)}
    />
    </div>
  );
}
