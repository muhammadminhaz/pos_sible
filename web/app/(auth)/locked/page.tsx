import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeftIcon, LockKeyholeIcon, ShieldCheckIcon, UserRoundCogIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { withSiteName } from "@/lib/site";

export const metadata: Metadata = { title: withSiteName("Subscription"), robots: { index: false, follow: false } };

const REASONS = ["expired", "cancelled"] as const;

/** Where sign-in lands when the business's paid subscription lapsed or was switched off. Free accounts never get here. */
export default async function LockedPage({ searchParams }: PageProps<"/locked">) {
  const { reason } = await searchParams;
  if (!REASONS.includes(reason as (typeof REASONS)[number])) redirect("/login");
  const t = await getTranslations("auth");
  const rows = [
    { icon: UserRoundCogIcon, title: t("locked.contactTitle"), body: t("locked.contactBody") },
    { icon: ShieldCheckIcon, title: t("locked.safeTitle"), body: t("locked.safeBody") },
  ];

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-warning-soft text-warning-foreground ring-8 ring-warning-soft/40 dark:text-warning">
          <LockKeyholeIcon className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{t(`locked.${reason as (typeof REASONS)[number]}Title`)}</h1>
          <p className="mt-2 text-pretty text-muted-foreground">{t(`locked.${reason as (typeof REASONS)[number]}Body`)}</p>
        </div>
      </div>

      <Card className="w-full shadow-sm">
        <CardContent className="flex flex-col gap-4">
          {rows.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button asChild variant="outline" size="lg" className="w-full">
        <Link href="/login">
          <ArrowLeftIcon />
          {t("locked.back")}
        </Link>
      </Button>
    </div>
  );
}
