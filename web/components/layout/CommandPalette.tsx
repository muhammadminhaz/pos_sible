"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  CornerDownLeftIcon,
  MonitorSmartphoneIcon,
  PackageIcon,
  PackagePlusIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  UserIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useCan } from "@/lib/auth/useCan";
import { contactsService } from "@/lib/data/services/contacts";
import { productsService } from "@/lib/data/services/products";
import { useFormat } from "@/lib/i18n/format";
import { useCommandPalette } from "./commandStore";
import { useAuth } from "@/lib/auth/authStore";
import { isPathLicensed } from "@/lib/modules";
import { useVisibleNav } from "./Sidebar";

type Action = { key: string; label: string; href: string; icon: LucideIcon; permission: string };

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function CommandPalette() {
  const t = useTranslations();
  const router = useRouter();
  const can = useCan();
  const f = useFormat();
  const groups = useVisibleNav();
  const licensed = useAuth((s) => s.modules);
  const open = useCommandPalette((s) => s.open);
  const setOpen = useCommandPalette((s) => s.setOpen);
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim(), 200);
  const live = open && term.length >= 2;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!useCommandPalette.getState().open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const products = useQuery({
    queryKey: ["products", "palette", term],
    queryFn: () => productsService.list({ search: term, pageSize: 5 }),
    enabled: live && can("product.view"),
  });
  const contacts = useQuery({
    queryKey: ["contacts", "palette", term],
    queryFn: () => contactsService.list({ search: term, pageSize: 5 }),
    enabled: live && (can("contacts.customer") || can("contacts.supplier")),
  });

  const actions: Action[] = [
    { key: "newSale", label: t("header.newSale"), href: "/pos", icon: MonitorSmartphoneIcon, permission: "pos.access" },
    { key: "addProduct", label: t("nav.addProduct"), href: "/products/new", icon: PackagePlusIcon, permission: "product.create" },
    { key: "addPurchase", label: t("nav.addPurchase"), href: "/purchases/new", icon: ShoppingBagIcon, permission: "purchase.create" },
    { key: "addExpense", label: t("nav.addExpense"), href: "/expenses/new", icon: ReceiptIcon, permission: "expense.create" },
    { key: "addContact", label: t("header.addContact"), href: "/contacts/customers?new=1", icon: UserPlusIcon, permission: "contacts.customer" },
  ].filter((a) => can(a.permission) && isPathLicensed(licensed, a.href));

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={t("header.searchTrigger")} description={t("header.typeToSearch")}>
      <Command loop>
        <CommandInput value={query} onValueChange={setQuery} placeholder={t("header.typeToSearch")} />
        <CommandList className="max-h-[min(60vh,420px)]">
          <CommandEmpty>{t("common.noResults")}</CommandEmpty>

          {actions.length > 0 && (
            <CommandGroup heading={t("header.quickActions")}>
              {actions.map((a) => (
                <CommandItem key={a.key} value={`action ${a.label}`} onSelect={() => go(a.href)}>
                  <a.icon />
                  {a.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!!products.data?.rows.length && (
            <CommandGroup heading={t("nav.products")}>
              {products.data.rows.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`product ${p.id} ${p.name}`}
                  keywords={[p.sku, term]}
                  onSelect={() => go(`/products/${p.id}`)}
                >
                  <PackageIcon />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground tabular">{p.sku}</span>
                  <CommandShortcut className="tracking-normal">{f.money(p.sellPrice)}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!!contacts.data?.rows.length && (
            <CommandGroup heading={t("nav.contacts")}>
              {contacts.data.rows.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`contact ${c.id} ${c.name}`}
                  keywords={[c.businessName, c.mobile, c.code, term]}
                  onSelect={() => go(`/contacts/${c.type === "supplier" ? "suppliers" : "customers"}?id=${c.id}`)}
                >
                  <UserIcon />
                  <span className="min-w-0 flex-1 truncate">
                    {c.name}
                    {c.businessName && <span className="text-muted-foreground"> · {c.businessName}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground tabular">{c.mobile}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />
          <CommandGroup heading={t("header.pages")}>
            {groups.flatMap((g) =>
              (g.items ?? [{ key: g.key, href: g.href!, keywords: [] as string[] }]).map((i) => {
                const label = t(`nav.${i.key}`);
                const groupLabel = g.items ? t(`nav.${g.key}`) : "";
                return (
                  <CommandItem
                    key={`${g.key}-${i.key}`}
                    value={`page ${groupLabel} ${label}`}
                    keywords={i.keywords}
                    onSelect={() => go(i.href)}
                  >
                    <g.icon />
                    {groupLabel && <span className="text-muted-foreground">{groupLabel} ›</span>}
                    {label}
                    <CornerDownLeftIcon className="ml-auto opacity-0 group-data-selected/command-item:opacity-60" />
                  </CommandItem>
                );
              }),
            )}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
