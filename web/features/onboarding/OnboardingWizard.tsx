"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, DatabaseZapIcon, SparklesIcon, StoreIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GlideSelect from "@/components/ui/glide-select";
import { LocaleToggle } from "@/components/layout/LocaleToggle";
import { LogoMark } from "@/components/layout/LogoMark";
import { useCan } from "@/lib/auth/useCan";
import { API_MODE } from "@/lib/data/api/mode";
import { useOnboardingActions, useOnboardingState } from "@/lib/data/hooks/onboarding";
import type { Settings } from "@/lib/data/schemas";
import { currencyOptions, currencySymbol } from "@/lib/i18n/currencies";

const COLORS: { id: Settings["system"]["themeColor"]; swatch: string }[] = [
  { id: "indigo", swatch: "#4f46e5" }, { id: "blue", swatch: "#2563eb" }, { id: "sky", swatch: "#0284c7" }, { id: "green", swatch: "#059669" },
  { id: "amber", swatch: "#d97706" }, { id: "red", swatch: "#dc2626" }, { id: "purple", swatch: "#9333ea" }, { id: "black", swatch: "#27272a" },
];
/**
 * First-run setup for whoever can change business settings: pick demo or empty shop, describe the business, choose a look.
 * Only for a real business account (API mode). The browser-only demo, and showcase accounts the platform owner creates
 * with sample data, go straight into the app.
 */
export function OnboardingGate() {
  const { loaded, onboarding } = useOnboardingState();
  const can = useCan();
  if (!API_MODE || !loaded || !can("settings.business") || onboarding?.done) return null;
  return <Wizard />;
}

function Wizard() {
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { complete, skip } = useOnboardingActions();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"demo" | "fresh">("demo");
  const [f, setF] = useState({ businessName: "", locationName: "", phone: "", city: "", currency: "BDT", themeColor: "indigo" as Settings["system"]["themeColor"] });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const steps = 3;
  const busy = complete.isPending || skip.isPending;

  // The Next and Finish buttons carry distinct keys: if React reused one element as the submit button, the click
  // that opens the last step would also submit the form.
  const finish = async (e?: FormEvent) => {
    e?.preventDefault();
    try {
      await complete.mutateAsync({
        mode, businessName: f.businessName, locationName: f.locationName || f.businessName, phone: f.phone, city: f.city,
        currencyCode: f.currency, currencySymbol: currencySymbol(f.currency, locale), themeColor: f.themeColor,
      });
      toast.success(t("ready"));
    } catch {
      toast.error(t("failed"));
    }
  };

  const choice = (id: "demo" | "fresh", Icon: typeof StoreIcon, title: string, body: string) => (
    <button
      type="button" onClick={() => setMode(id)} aria-pressed={mode === id}
      className={cn("flex flex-1 flex-col gap-2 rounded-xl border p-4 text-left transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md", mode === id ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "bg-card")}
    >
      <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span>
      <span className="font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{body}</span>
    </button>
  );

  return (
    <Dialog open>
      <DialogContent showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} className="gap-5 sm:max-w-xl">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold"><LogoMark className="size-7" />POS-sible</span>
          <LocaleToggle />
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: steps }, (_, i) => <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-primary" : "bg-muted")} />)}
        </div>

        <form onSubmit={finish} className="grid gap-5">
          <div key={step} className="grid animate-in gap-4 fade-in slide-in-from-right-2 duration-300">
            {step === 0 && (
              <>
                <div>
                  <DialogTitle className="text-xl">{t("welcomeTitle")}</DialogTitle>
                  <DialogDescription>{t("welcomeBody")}</DialogDescription>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  {choice("demo", SparklesIcon, t("demoTitle"), t("demoBody"))}
                  {choice("fresh", StoreIcon, t("freshTitle"), t("freshBody"))}
                </div>
                {mode === "fresh" && <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-foreground"><DatabaseZapIcon className="mt-0.5 size-4 shrink-0" />{t("freshWarning")}</p>}
              </>
            )}
            {step === 1 && (
              <>
                <div>
                  <DialogTitle className="text-xl">{t("businessTitle")}</DialogTitle>
                  <DialogDescription>{t("businessBody")}</DialogDescription>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="ob-name">{t("businessName")}</Label>
                    <Input id="ob-name" autoFocus required value={f.businessName} onChange={(e) => set("businessName", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ob-loc">{t("shopName")}</Label>
                    <Input id="ob-loc" placeholder={f.businessName} value={f.locationName} onChange={(e) => set("locationName", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ob-phone">{t("phone")}</Label>
                    <Input id="ob-phone" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ob-city">{t("city")}</Label>
                    <Input id="ob-city" value={f.city} onChange={(e) => set("city", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ob-cur">{t("currency")}</Label>
                    <GlideSelect field searchable id="ob-cur" ariaLabel={t("currency")} searchPlaceholder={t("currency")} emptyText={tc("noResults")} options={currencyOptions(locale)} value={f.currency} onChange={(c) => set("currency", c)} />
                  </div>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div>
                  <DialogTitle className="text-xl">{t("lookTitle")}</DialogTitle>
                  <DialogDescription>{t("lookBody")}</DialogDescription>
                </div>
                <div role="radiogroup" aria-label={t("accent")} className="flex flex-wrap gap-3">
                  {COLORS.map((c) => (
                    <button
                      key={c.id} type="button" role="radio" aria-checked={f.themeColor === c.id} aria-label={c.id}
                      onClick={() => { set("themeColor", c.id); document.documentElement.setAttribute("data-accent", c.id === "indigo" ? "" : c.id); }}
                      className={cn("grid size-10 place-items-center rounded-full text-white shadow-sm transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", f.themeColor === c.id && "scale-110 ring-2 ring-offset-2 ring-offset-background")}
                      style={{ backgroundColor: c.swatch }}
                    >
                      {f.themeColor === c.id && <CheckIcon className="size-5" />}
                    </button>
                  ))}
                </div>
                <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">{t("lookHint")}</p>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => (step === 0 ? skip.mutate() : setStep(step - 1))}>
              {step === 0 ? t("skip") : <><ArrowLeftIcon />{t("back")}</>}
            </Button>
            {step < steps - 1 ? (
              <Button key="next" type="button" disabled={step === 1 && !f.businessName.trim()} onClick={() => setStep(step + 1)}>{t("next")}<ArrowRightIcon /></Button>
            ) : (
              <Button key="finish" type="submit" disabled={busy || !f.businessName.trim()}>{busy ? t("settingUp") : t("finish")}</Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
