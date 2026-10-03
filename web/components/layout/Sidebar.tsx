"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MonitorSmartphoneIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCan } from "@/lib/auth/useCan";
import { useUI } from "@/lib/data/store/ui";
import { useSettings } from "@/lib/data/hooks/settings";
import { isPathEnabled } from "@/lib/modules";
import { findNavTrail, NAV, type NavGroup } from "@/lib/nav";
import { BranchedNav, type BranchedSection } from "./BranchedNav";
import { LocationSwitcher } from "./LocationSwitcher";
import { LogoMark } from "./LogoMark";

/** NAV filtered by permission; groups with no visible items disappear. */
export function useVisibleNav(): NavGroup[] {
  const can = useCan();
  const settings = useSettings().data;
  return NAV.flatMap((g) => {
    if (!can(g.permission)) return [];
    if (!g.items) return [g];
    const items = g.items.filter((i) => can(i.permission) && isPathEnabled(settings, i.href));
    return items.length ? [{ ...g, items }] : [];
  });
}

function useActive() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return findNavTrail(pathname, search ? `?${search}` : "");
}

function ExpandedNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const active = useActive();
  const openGroups = useUI((s) => s.openGroups);
  const setOpenGroups = useUI((s) => s.setOpenGroups);

  // Accordion: opening a group folds the rest. A group counts as open when its stored flag differs from
  // "contains the active page", so to land on the wanted state we store the flag only where they disagree.
  const isOpen = (key: string) => openGroups.includes(key) !== (active.group?.key === key);
  const toggleGroup = (key: string) => {
    const willOpen = !isOpen(key);
    setOpenGroups(
      groups
        .filter((g) => g.items && (g.key === key ? willOpen : false) !== (active.group?.key === g.key))
        .map((g) => g.key),
    );
  };

  const sections: BranchedSection[] = groups.map((g) => ({
    key: g.key, label: t(g.key), icon: g.icon, href: g.href,
    kids: g.items?.map((i) => ({ key: i.key, href: i.href, label: t(i.key) })),
  }));

  return (
    <div className="px-3 py-2">
      <BranchedNav
        sections={sections}
        activeSection={active.group?.key}
        activeKid={active.item?.key}
        isOpen={isOpen}
        onToggle={toggleGroup}
        // The page we land on makes its group "open" by itself; a leftover manual-open flag would flip it shut.
        onNavigate={() => {
          setOpenGroups([]);
          onNavigate?.();
        }}
      />
    </div>
  );
}

function RailNav({ groups }: { groups: NavGroup[] }) {
  const t = useTranslations("nav");
  const active = useActive();
  const railItem = "grid size-10 place-items-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent";

  return (
    <nav className="flex flex-col items-center gap-1 py-2">
      {groups.map((g) => {
        const Icon = g.icon;
        const isActive = active.group?.key === g.key;
        const cls = cn(railItem, isActive && "bg-primary/10 text-primary hover:bg-primary/10");
        if (!g.items) {
          return (
            <Tooltip key={g.key}>
              <TooltipTrigger asChild>
                <Link href={g.href!} className={cls} aria-label={t(g.key)}>
                  <Icon className="size-[18px]" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{t(g.key)}</TooltipContent>
            </Tooltip>
          );
        }
        return (
          <DropdownMenu key={g.key}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger className={cls} aria-label={t(g.key)}>
                  <Icon className="size-[18px]" />
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">{t(g.key)}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right" align="start" className="max-h-[70vh] w-56">
              <DropdownMenuLabel>{t(g.key)}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {g.items.map((i) => (
                <DropdownMenuItem key={i.key} asChild className={cn(active.item?.key === i.key && "text-primary")}>
                  <Link href={i.href}>{t(i.key)}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}

function OpenPosButton({ collapsed }: { collapsed?: boolean }) {
  const t = useTranslations("nav");
  const can = useCan();
  if (!can("pos.access")) return null;
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild size="icon-lg" aria-label={t("openPos")}>
            <Link href="/pos">
              <MonitorSmartphoneIcon />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{t("openPos")}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Button asChild size="lg" className="w-full">
      <Link href="/pos">
        <MonitorSmartphoneIcon />
        {t("openPos")}
      </Link>
    </Button>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  const business = useSettings().data?.business;
  const name = business?.logo && business.name ? business.name : "pos_sible";
  return (
    <Link href="/home" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
      <LogoMark />
      {!collapsed && <span className="truncate text-[15px] font-semibold tracking-tight">{name}</span>}
    </Link>
  );
}

/** The sidebar body — used by the desktop aside and the mobile sheet. */
export function SidebarContent({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const t = useTranslations("header");
  const groups = useVisibleNav();
  const setCollapsed = useUI((s) => s.setSidebarCollapsed);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn("flex h-14 shrink-0 items-center border-b", collapsed ? "justify-center" : "justify-between px-4")}>
        {collapsed ? (
          !onNavigate && (
            <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed(false)} aria-label={t("expand")}>
              <PanelLeftOpenIcon />
            </Button>
          )
        ) : (
          <>
            <Brand collapsed={collapsed} />
            {!onNavigate && (
              <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed(true)} aria-label={t("collapse")}>
                <PanelLeftCloseIcon />
              </Button>
            )}
          </>
        )}
      </div>
      {!collapsed && (
        <div className="px-3 pt-3">
          <LocationSwitcher />
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1">
        {collapsed ? <RailNav groups={groups} /> : <ExpandedNav groups={groups} onNavigate={onNavigate} />}
      </ScrollArea>
      <div className={cn("flex shrink-0 flex-col gap-2 border-t p-3", collapsed && "items-center")}>
        <OpenPosButton collapsed={collapsed} />
      </div>
    </div>
  );
}

export function Sidebar() {
  const collapsed = useUI((s) => s.sidebarCollapsed);
  return (
    <aside
      data-print-hide
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 border-r transition-[width] duration-200 lg:block",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}
