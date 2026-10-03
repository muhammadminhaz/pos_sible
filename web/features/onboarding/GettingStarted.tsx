"use client";

import { CARD } from "@/features/reports/KpiSummary";
import Link from "next/link";
import { CheckCircle2Icon, CircleIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useCan } from "@/lib/auth/useCan";
import { useOnboardingActions, useOnboardingState } from "@/lib/data/hooks/onboarding";
import { CHECKLIST_STEPS, type ChecklistStep } from "@/lib/data/services/onboarding";

const TARGET: Record<ChecklistStep, { href: string; permission: string }> = {
  product: { href: "/products/new", permission: "product.create" },
  customer: { href: "/contacts/customers", permission: "contacts.customer" },
  sale: { href: "/pos", permission: "pos.access" },
  expense: { href: "/expenses/new", permission: "expense.create" },
  reports: { href: "/reports/profit-loss", permission: "report.view" },
};

/** A short, self-ticking list on Home that walks a new owner through the first day. */
export function GettingStarted() {
  const t = useTranslations("onboarding");
  const can = useCan();
  const { onboarding, checklist } = useOnboardingState();
  const { dismissChecklist, visit } = useOnboardingActions();
  if (!onboarding?.done || onboarding.checklistDismissed || !checklist) return null;
  const steps = CHECKLIST_STEPS.filter((s) => can(TARGET[s].permission));
  if (!steps.length) return null;
  const done = steps.filter((s) => checklist[s]).length;
  const all = done === steps.length;

  return (
    <section aria-label={t("checklistTitle")} className={cn(CARD, "mb-6 overflow-hidden p-0 sm:p-0")}>
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div>
          <h2 className="font-semibold">{all ? t("checklistDone") : t("checklistTitle")}</h2>
          <p className="text-sm text-muted-foreground">{all ? t("checklistDoneBody") : t("checklistBody", { done, total: steps.length })}</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label={t("dismiss")} onClick={() => void dismissChecklist()}><XIcon /></Button>
      </div>
      <div className="mx-4 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ul className="grid gap-1 p-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((s) => {
          const ok = checklist[s];
          return (
            <li key={s}>
              <Link
                href={TARGET[s].href} onClick={() => s === "reports" && void visit("reports")}
                className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent", ok && "text-muted-foreground")}
              >
                {ok ? <CheckCircle2Icon className="size-5 shrink-0 animate-in text-success zoom-in-50 duration-300" /> : <CircleIcon className="size-5 shrink-0 text-muted-foreground/60" />}
                <span className={cn("font-medium", ok && "line-through")}>{t(`step.${s}`)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
