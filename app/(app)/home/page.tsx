"use client";

import {
  BanknoteIcon,
  CircleDollarSignIcon,
  FileClockIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
  Undo2Icon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import type { Tone } from "@/components/shared/tones";
import { useRangeContext } from "@/components/shared/DateRangePicker";
import { useCurrentUser } from "@/lib/auth/useCan";
import type { Kpis } from "@/lib/data/services/dashboard";
import { useDashboardKpis } from "@/lib/data/hooks/dashboard";
import { useUI } from "@/lib/data/store/ui";
import { presetRange } from "@/lib/domain/dateRanges";
import { useFormat } from "@/lib/i18n/format";

const CARDS: { key: keyof Kpis; label: string; icon: LucideIcon; tone: Exclude<Tone, "primary"> }[] = [
  { key: "totalSales", label: "totalSales", icon: CircleDollarSignIcon, tone: "default" },
  { key: "net", label: "net", icon: TrendingUpIcon, tone: "success" },
  { key: "invoiceDue", label: "invoiceDue", icon: FileClockIcon, tone: "warning" },
  { key: "sellReturn", label: "totalSellReturn", icon: Undo2Icon, tone: "danger" },
  { key: "totalPurchase", label: "totalPurchase", icon: ShoppingBagIcon, tone: "info" },
  { key: "purchaseDue", label: "purchaseDue", icon: WalletIcon, tone: "warning" },
  { key: "purchaseReturn", label: "totalPurchaseReturn", icon: BanknoteIcon, tone: "danger" },
  { key: "expense", label: "expense", icon: ReceiptIcon, tone: "default" },
];

export default function HomePage() {
  const t = useTranslations("dashboard");
  const f = useFormat();
  const name = useCurrentUser()?.user.firstName ?? "";
  const locationId = useUI((s) => s.locationId);
  const { today, fyStartMonth } = useRangeContext();
  const kpis = useDashboardKpis({ locationId, ...presetRange("thisMonth", today, fyStartMonth) });

  return (
    <>
      <PageHeader title={t("title", { name })} description={t("description")} />
      <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("thisMonth")}</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => (
          <StatCard
            key={c.key}
            label={t(c.label)}
            icon={c.icon}
            tone={c.tone}
            loading={kpis.isPending}
            value={kpis.data ? f.money(kpis.data[c.key]) : null}
          />
        ))}
      </div>
    </>
  );
}
