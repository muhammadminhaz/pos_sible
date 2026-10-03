"use client";

import { useState } from "react";
import { MailIcon, MessageSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { useOnboardingActions } from "@/lib/data/hooks/onboarding";
import { useLookups } from "@/lib/data/hooks/lookups";
import type { Settings } from "@/lib/data/schemas";
import { SectionForm } from "./SectionForm";

const TABS = [
  "business", "tax", "product", "contact", "sale", "pos", "purchase", "payment", "dashboard", "system", "prefixes", "rewards", "modules", "customLabels", "email", "sms",
] as const satisfies readonly (keyof Settings)[];

/** Settings that exist in the data model but have no feature behind them yet; hiding them keeps every visible switch honest. */
const HIDDEN: Partial<Record<(typeof TABS)[number], string[]>> = {
  product: ["enablePriceTax"],
  sale: ["enablePaymentLink", "razorpayKeyId", "razorpayKeySecret", "stripePublicKey", "stripeSecretKey"],
  pos: ["showInvoiceScheme"],
  purchase: ["enablePurchaseOrder", "enablePurchaseRequisition"],
  payment: ["denominationOn"],
  system: ["showHelpText"],
  modules: ["kitchen", "modifiers", "typesOfService"],
};

function SetupAgain() {
  const t = useTranslations("onboarding");
  const { restart, showChecklist } = useOnboardingActions();
  return (
    <div className="grid gap-2 rounded-lg border border-dashed p-4">
      <p className="text-sm text-muted-foreground">{t("restartHint")}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void restart()}>{t("restart")}</Button>
        <Button type="button" variant="outline" onClick={() => void showChecklist()}>{t("showChecklist")}</Button>
      </div>
    </div>
  );
}

/** A mocked send: succeeds when the form is filled in, fails otherwise, like a real provider would. */
function TestSend({ kind, ready }: { kind: "email" | "sms"; ready: boolean }) {
  const t = useTranslations("settings");
  const [busy, setBusy] = useState(false);
  const Icon = kind === "email" ? MailIcon : MessageSquareIcon;
  return (
    <div>
      <Button
        type="button" variant="outline" disabled={busy}
        onClick={async () => {
          setBusy(true);
          await new Promise((r) => setTimeout(r, 600));
          setBusy(false);
          if (ready) toast.success(t(kind === "email" ? "testEmailOk" : "testSmsOk"));
          else toast.error(t(kind === "email" ? "testEmailFail" : "testSmsFail"));
        }}
      >
        <Icon />{t(kind === "email" ? "sendTestEmail" : "sendTestSms")}
      </Button>
    </div>
  );
}

export function BusinessSettings() {
  const t = useTranslations("settings");
  const tn = useTranslations("nav");
  const [tab, setTab] = useState<(typeof TABS)[number]>("business");
  const lookups = useLookups();
  const taxOptions = (lookups.data?.taxRates ?? []).map((x) => ({ value: x.id, label: x.name }));
  const unitOptions = (lookups.data?.units ?? []).map((x) => ({ value: x.id, label: x.name }));
  return (
    <>
      <PageHeader title={tn("businessSettings")} description={t("businessSettingsDescription")} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof TABS)[number])} className="gap-4">
        <TabsList aria-label={t("sections")} className="h-auto flex-wrap">
          {TABS.map((k) => <TabsTrigger key={k} value={k}>{t(`tabs.${k}`)}</TabsTrigger>)}
        </TabsList>
        <section className="min-w-0 flex-1 rounded-xl border bg-card p-5" aria-label={t(`tabs.${tab}`)}>
          <h2 className="mb-4 text-lg font-semibold">{t(`tabs.${tab}`)}</h2>
          <SectionForm
            key={tab}
            section={tab}
            hidden={HIDDEN[tab] ?? []}
            options={{
              defaultTaxId: taxOptions, defaultUnitId: unitOptions,
              themeColor: ["indigo", "blue", "black", "purple", "green", "red", "amber", "sky"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
            }}
            extra={(d) =>
              tab === "business" ? <SetupAgain />
              : tab === "email" ? <TestSend kind="email" ready={!!(d as Settings["email"]).host && !!(d as Settings["email"]).fromAddress} />
              : tab === "sms" ? <TestSend kind="sms" ready={(d as Settings["sms"]).service === "twilio" ? !!(d as Settings["sms"]).twilioSid : (d as Settings["sms"]).service === "nexmo" ? !!(d as Settings["sms"]).nexmoKey : !!(d as Settings["sms"]).url} />
              : null
            }
          />
        </section>
      </Tabs>
    </>
  );
}
