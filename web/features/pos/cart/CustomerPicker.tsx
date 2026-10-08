"use client";

import { useDeferredValue, useState } from "react";
import { UserPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import GlideSelect from "@/components/ui/glide-select";
import { useCan } from "@/lib/auth/useCan";
import { useContact } from "@/lib/data/hooks/contacts";
import { usePosCustomers } from "@/lib/data/hooks/pos";
import { useFormat } from "@/lib/i18n/format";
import { setContact } from "@/lib/pos/cart";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "../dialogStore";
import { focusSearch } from "../focus";

export function CustomerPicker({ locationId }: { locationId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const can = useCan();
  const { cart, update } = useCart(locationId);
  const show = usePosDialogs((s) => s.show);
  const [term, setTerm] = useState("");
  const list = usePosCustomers(useDeferredValue(term));
  const { data: current } = useContact(cart.contactId);

  const rows = list.data?.rows ?? [];
  const options = rows.map((c) => ({ value: c.id, label: `${c.name} · ${c.mobile}`, tag: c.due > 0 ? f.money(c.due) : undefined }));
  if (current && !rows.some((c) => c.id === current.id)) options.unshift({ value: current.id, label: current.isDefault ? current.name : `${current.name} · ${current.mobile}`, tag: undefined });

  const pick = (id: string) => {
    update((c) => setContact(c, id));
    focusSearch();
  };

  return (
    <div className="flex items-center gap-2">
      <GlideSelect
        field
        size="lg"
        searchable
        onSearch={setTerm}
        searchPlaceholder={t("pos.customer.search")}
        emptyText={t("common.noResults")}
        ariaLabel={t("pos.customer.label")}
        value={cart.contactId}
        onChange={pick}
        options={options}
        className="min-w-0 flex-1"
      />
      {current && !current.isDefault && (
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
          {current.due > 0 && <Badge variant="destructive">{t("pos.customer.due", { amount: f.money(current.due) })}</Badge>}
          {current.points > 0 && <Badge variant="secondary">{t("pos.customer.points", { points: f.number(current.points) })}</Badge>}
        </div>
      )}
      {can("customer.create") && (
        <Button variant="outline" size="icon-lg" aria-label={t("pos.customer.add")} onClick={() => show("addCustomer")}>
          <UserPlusIcon />
        </Button>
      )}
    </div>
  );
}
