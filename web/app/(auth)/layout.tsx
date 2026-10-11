import Image from "next/image";
import Link from "next/link";
import { BarChart3Icon, PackageCheckIcon, ReceiptTextIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";
import { LocaleToggle } from "@/components/layout/LocaleToggle";
import { landingFonts } from "@/features/welcome/fonts";
import { Threads } from "@/features/welcome/TiltBackground";

/**
 * Sign in, sign up and the locked page, in the landing page's frame: a dark bezel around one rounded card.
 * Always dark (the `dark` class scopes the app's dark tokens to these pages only, leaving the visitor's app theme alone). Fills the viewport and never scrolls.
 * From 1024px the right half is flat brand blue with the landing threads: what the account is for, and the wordmark.
 */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("auth");
  const points = [
    { icon: ReceiptTextIcon, text: t("heroPoint1") },
    { icon: PackageCheckIcon, text: t("heroPoint2") },
    { icon: BarChart3Icon, text: t("heroPoint3") },
  ];
  return (
    <div className={cn(landingFonts, "dark wl-root h-dvh text-foreground [color-scheme:dark] overflow-hidden bg-[#05050a] p-2 font-display sm:p-4")}>
      <div className="grid h-full overflow-hidden rounded-[28px] bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Only this column may scroll, and only on screens too short to hold the form. */}
        <div className="flex min-h-0 flex-col overflow-y-auto px-5 py-5 [scrollbar-width:none] sm:px-10 sm:py-6">
          <div className="flex items-center justify-between">
            <Link href="/welcome" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
              <Image src="/logo-192.png" alt="" width={32} height={32} />
              {SITE.name}
            </Link>
            <LocaleToggle />
          </div>
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">{children}</div>
          <p className="text-center text-xs text-muted-foreground">{t("footer")}</p>
        </div>

        <aside aria-hidden className="relative isolate m-2 hidden min-h-0 flex-col overflow-hidden rounded-[22px] bg-[#0a3cff] px-12 pt-12 text-white lg:flex xl:px-16 xl:pt-14">
          <div className="absolute inset-0 -z-10 opacity-70">
            <Threads />
          </div>
          <p className="font-mono text-[13px] tracking-wide text-white/80 uppercase">{t("heroEyebrow")}</p>
          <div className="my-auto py-8">
            <h2 className="max-w-lg text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.04em] text-balance xl:text-5xl">{t("heroTitle")}</h2>
            <p className="mt-4 max-w-md text-pretty text-white/85">{t("heroBody")}</p>
            <ul className="mt-8 grid max-w-md gap-2.5">
              {points.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 rounded-2xl bg-white/10 p-2 pr-4 text-sm ring-1 ring-white/20">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-[#0a3cff]"><Icon className="size-4" /></span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="-mx-12 -mb-[0.2em] text-center text-[9.5vw] leading-none font-semibold tracking-[-0.07em] whitespace-nowrap text-white/15 select-none xl:-mx-16">{SITE.name}</p>
        </aside>
      </div>
    </div>
  );
}
