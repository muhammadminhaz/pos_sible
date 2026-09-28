"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRightIcon, MonitorSmartphoneIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { findNavTrail, NAV, type NavGroup } from "@/lib/nav";
import { LocationSwitcher } from "./LocationSwitcher";
import { LogoMark } from "./LogoMark";

/** NAV filtered by permission; groups with no visible items disappear. */
export function useVisibleNav(): NavGroup[] {
  const can = useCan();
  return NAV.flatMap((g) => {
    if (!can(g.permission)) return [];
    if (!g.items) return [g];
    const items = g.items.filter((i) => can(i.permission));
    return items.length ? [{ ...g, items }] : [];
  });
}

function useActive() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return findNavTrail(pathname, search ? `?${search}` : "");
}

const itemBase =
  "relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";
const itemActive =
  "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary before:absolute before:-left-3 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-primary";

function ExpandedNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const active = useActive();
  const openGroups = useUI((s) => s.openGroups);
  const toggleGroup = useUI((s) => s.toggleGroup);

  return (
    <nav className="flex flex-col gap-0.5 px-3 py-2">
      {groups.map((g) => {
        const Icon = g.icon;
        if (!g.items) {
          const isActive = active.group?.key === g.key;
          return (
            <Link key={g.key} href={g.href!} onClick={onNavigate} className={cn(itemBase, isActive && itemActive)}>
              <Icon className="size-4 shrink-0" />
              {t(g.key)}
            </Link>
          );
        }
        const containsActive = active.group?.key === g.key;
        const open = openGroups.includes(g.key) !== containsActive; // the active group is open unless toggled shut
        return (
          <Collapsible key={g.key} open={open} onOpenChange={() => toggleGroup(g.key)}>
            <CollapsibleTrigger className={cn(itemBase, "w-full", containsActive && "text-foreground")}>
              <Icon className={cn("size-4 shrink-0", containsActive && "text-primary")} />
              <span className="flex-1 text-left">{t(g.key)}</span>
              <ChevronRightIcon className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
              <div className="my-0.5 ml-[18px] flex flex-col gap-0.5 border-l pl-3">
                {g.items.map((i) => (
                  <Link
                    key={i.key}
                    href={i.href}
                    onClick={onNavigate}
                    className={cn(itemBase, "h-7 font-normal", active.item?.key === i.key && itemActive)}
                  >
                    {t(i.key)}
                  </Link>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </nav>
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
  return (
    <Link href="/home" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
      <LogoMark />
      {!collapsed && <span className="text-[15px] font-semibold tracking-tight">pos_sible</span>}
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
      <div className={cn("flex h-14 shrink-0 items-center border-b", collapsed ? "justify-center" : "px-4")}>
        <Brand collapsed={collapsed} />
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
        {!onNavigate && (
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className={cn("text-muted-foreground", !collapsed && "justify-start")}
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? t("expand") : t("collapse")}
          >
            {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
            {!collapsed && t("collapse")}
          </Button>
        )}
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
