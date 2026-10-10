import { BarChart3Icon, PackageCheckIcon, ReceiptTextIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { HeroChart } from "@/components/auth/HeroChart";
import { LocaleToggle } from "@/components/layout/LocaleToggle";
import { LogoMark } from "@/components/layout/LogoMark";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("auth");
  const points = [
    { icon: ReceiptTextIcon, text: t("heroPoint1") },
    { icon: PackageCheckIcon, text: t("heroPoint2") },
    { icon: BarChart3Icon, text: t("heroPoint3") },
  ];
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <LogoMark className="size-7" />
            POS-sible
          </span>
          <div className="flex items-center gap-2">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-center text-xs text-muted-foreground">{t("footer")}</p>
      </div>

      <aside aria-hidden className="relative hidden overflow-hidden bg-linear-to-br from-indigo-600 via-indigo-700 to-indigo-950 text-white lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative max-w-xl">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight xl:text-4xl">{t("heroTitle")}</h2>
          <p className="mt-3 text-indigo-100">{t("heroBody")}</p>
          <HeroChart className="mt-8 w-full max-w-lg drop-shadow-2xl" />
          <ul className="mt-8 grid gap-3">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-indigo-50">
                <span className="grid size-8 place-items-center rounded-lg bg-white/10"><Icon className="size-4" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
