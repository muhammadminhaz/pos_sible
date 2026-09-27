"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "cn";
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

  const change = (next: Locale) => {
    if (next === locale) return;
    start(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  return (
    <div
      role="radiogroup"
      aria-label={t("language")}
      className={cn("inline-flex h-8 items-center rounded-lg border bg-muted/50 p-0.5", pending && "opacity-60", className)}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={locale === o.value}
          disabled={pending}
          onClick={() => change(o.value)}
          className={cn(
            "h-full min-w-9 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
            locale === o.value && "bg-background text-foreground shadow-xs",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
