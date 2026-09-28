"use client";

import { MapPinIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentUser } from "@/lib/auth/useCan";
import { useLookups } from "@/lib/data/hooks/lookups";
import { useUI } from "@/lib/data/store/ui";

/** Global location filter (`ui.locationId`). Users limited to some locations only see those. */
export function LocationSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common");
  const { data } = useLookups();
  const user = useCurrentUser()?.user;
  const locationId = useUI((s) => s.locationId);
  const setLocationId = useUI((s) => s.setLocationId);

  const allowed = (data?.locations ?? []).filter(
    (l) => l.active && (!user?.locationIds.length || user.locationIds.includes(l.id)),
  );

  return (
    <Select value={locationId} onValueChange={setLocationId}>
      <SelectTrigger className={cn("w-full bg-background", className)} aria-label={t("location")}>
        <MapPinIcon className="text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" className="w-(--radix-select-trigger-width)">
        <SelectItem value="all">{t("allLocations")}</SelectItem>
        {allowed.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            {l.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
