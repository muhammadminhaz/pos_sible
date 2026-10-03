"use client";

import { useDeferredValue, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, UserIcon, UserPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const list = usePosCustomers(useDeferredValue(term));
  const { data: current } = useContact(cart.contactId);

  const pick = (id: string) => {
    update((c) => setContact(c, id));
    setOpen(false);
    setTerm("");
    focusSearch();
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} aria-label={t("pos.customer.label")} className="h-10 flex-1 justify-between">
            <span className="flex min-w-0 items-center gap-2">
              <UserIcon className="text-muted-foreground" />
              <span className="truncate">{current?.name ?? "…"}</span>
              {current && !current.isDefault && (
                <span className="truncate text-xs text-muted-foreground">{current.mobile}</span>
              )}
            </span>
            <ChevronsUpDownIcon className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={t("pos.customer.search")} value={term} onValueChange={setTerm} />
            <CommandList>
              <CommandEmpty>{t("common.noResults")}</CommandEmpty>
              <CommandGroup>
                {(list.data?.rows ?? []).map((c) => (
                  <CommandItem key={c.id} value={c.id} onSelect={() => pick(c.id)}>
                    <CheckIcon className={cn(c.id === cart.contactId ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1 truncate">
                      {c.name} <span className="text-muted-foreground">· {c.mobile} · {c.code}</span>
                    </span>
                    {c.due > 0 && <span className="text-xs text-danger tabular-nums">{f.money(c.due)}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
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
