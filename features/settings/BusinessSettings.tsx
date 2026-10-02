"use client";

import { useState } from "react";
import { MailIcon, MessageSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { useLookups } from "@/lib/data/hooks/lookups";
import type { Settings } from "@/lib/data/schemas";
import { BusinessLogo } from "./BusinessLogo";
import { SectionForm } from "./SectionForm";

const TABS = [
  "business", "tax", "product", "contact", "sale", "pos", "purchase", "payment", "dashboard", "system", "prefixes", "rewards", "modules", "customLabels", "email", "sms",
] as const satisfies readonly (keyof Settings)[];

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
      <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof TABS)[number])} orientation="vertical" className="gap-6 lg:flex-row">
        <TabsList aria-label={t("sections")} className="h-fit w-full shrink-0 flex-row flex-wrap justify-start lg:w-52 lg:flex-col">
          {TABS.map((k) => <TabsTrigger key={k} value={k}>{t(`tabs.${k}`)}</TabsTrigger>)}
        </TabsList>
        <section className="min-w-0 flex-1 rounded-xl border bg-card p-5" aria-label={t(`tabs.${tab}`)}>
          <h2 className="mb-4 text-lg font-semibold">{t(`tabs.${tab}`)}</h2>
          {tab === "business" && <BusinessLogo />}
          <SectionForm
            key={tab}
            section={tab}
            hidden={tab === "business" ? ["logo"] : []}
            options={{
              defaultTaxId: taxOptions, defaultUnitId: unitOptions,
              themeColor: ["indigo", "blue", "black", "purple", "green", "red", "amber", "sky"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
            }}
            extra={(d) =>
              tab === "email" ? <TestSend kind="email" ready={!!(d as Settings["email"]).host && !!(d as Settings["email"]).fromAddress} />
              : tab === "sms" ? <TestSend kind="sms" ready={(d as Settings["sms"]).service === "twilio" ? !!(d as Settings["sms"]).twilioSid : (d as Settings["sms"]).service === "nexmo" ? !!(d as Settings["sms"]).nexmoKey : !!(d as Settings["sms"]).url} />
              : null
            }
          />
        </section>
      </Tabs>
    </>
  );
}
