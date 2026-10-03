"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftIcon, HomeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

/** The shop's mark, a sales line that stops short, and a question mark where the line should have gone. */
function LostLine({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 120" fill="none" aria-hidden className={cn("w-full", className)}>
      <defs>
        <linearGradient id="nf-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <path d="M6 96 C 40 96, 52 60, 84 62 S 130 98, 160 70 S 206 30, 232 44" stroke="url(#nf-line)" strokeWidth="5" strokeLinecap="round" className="draw-line" style={{ ["--len" as string]: 420 }} />
      <path d="M244 50 C 262 58, 270 74, 300 66" stroke="currentColor" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 10" />
      <circle cx="232" cy="44" r="7" fill="#10b981" className="pop" />
      <text x="300" y="62" textAnchor="middle" fontSize="30" fontWeight="700" fill="currentColor" fillOpacity="0.55" className="float-slow">?</text>
    </svg>
  );
}

/**
 * The 404 screen. `page` is the full-page version (any unknown address); the compact one sits inside the app shell
 * when a record is missing. Uses a static icon and no data hooks, so it also works for signed-out visitors.
 */
export function NotFoundView({ page = false }: { page?: boolean }) {
  const t = useTranslations("errors");
  const nav = useTranslations("nav");
  const common = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const links = [
    { href: "/pos", label: nav("openPos") },
    { href: "/products", label: t("linkProducts") },
    { href: "/reports/profit-loss", label: t("linkReports") },
  ];

  const Root = page ? "main" : "div"; // the app shell already provides <main> for the in-app version
  return (
    <Root className={cn("relative isolate flex flex-col items-center overflow-hidden text-center", page ? "min-h-dvh justify-center bg-background px-6 py-16" : "rounded-xl border bg-card px-6 py-14")}>
      {/* Soft colour wash and a faint grid, behind everything. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 size-96 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute -right-24 bottom-10 size-80 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      </div>

      <p className="page-in rounded-full border bg-card/70 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground backdrop-blur">{t("notFoundCode")}</p>

      <div className="page-in my-4 flex items-center justify-center gap-1 sm:gap-3" aria-hidden>
        <span className="bg-linear-to-b from-indigo-500 to-indigo-700 bg-clip-text text-8xl leading-none font-black tracking-tighter text-transparent sm:text-[9rem] dark:from-indigo-300 dark:to-indigo-500">4</span>
        <span className="float-slow block size-20 overflow-hidden rounded-[22%] shadow-xl shadow-indigo-500/30 ring-1 ring-black/5 sm:size-32">
          {/* eslint-disable-next-line @next/next/no-img-element -- the app icon, static */}
          <img src="/icon.svg" alt="" className="size-full" />
        </span>
        <span className="bg-linear-to-b from-indigo-500 to-indigo-700 bg-clip-text text-8xl leading-none font-black tracking-tighter text-transparent sm:text-[9rem] dark:from-indigo-300 dark:to-indigo-500">4</span>
      </div>

      <h1 className="page-in text-2xl font-semibold tracking-tight sm:text-3xl">{t("notFound")}</h1>
      <p className="page-in mt-2 max-w-md text-muted-foreground">{t("notFoundBody")}</p>
      {pathname && (
        <p className="page-in mt-3 max-w-full text-sm text-muted-foreground">
          {t("notFoundPath")}{" "}
          <code className="inline-block max-w-[80vw] truncate rounded-md bg-muted px-1.5 py-0.5 align-bottom font-mono text-xs text-foreground sm:max-w-md">{pathname}</code>
        </p>
      )}

      <LostLine className="my-6 max-w-sm text-foreground" />

      <div className="page-in flex flex-wrap items-center justify-center gap-2">
        <Button asChild size="lg">
          <Link href="/home"><HomeIcon />{common("goHome")}</Link>
        </Button>
        <Button size="lg" variant="outline" onClick={() => (window.history.length > 1 ? router.back() : router.push("/home"))}>
          <ArrowLeftIcon className="rtl:rotate-180" />{t("goBack")}
        </Button>
      </div>

      <div className="page-in mt-8 flex flex-col items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("notFoundTry")}</span>
        <div className="flex flex-wrap justify-center gap-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full border bg-card/70 px-3 py-1 text-sm backdrop-blur transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </Root>
  );
}
