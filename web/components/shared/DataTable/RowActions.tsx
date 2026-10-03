"use client";

import Link from "next/link";
import { MoreHorizontalIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RowAction = {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  hidden?: boolean;
};

/** The per-row "⋯" menu. Destructive items are grouped at the bottom behind a separator. */
export function RowActions({ items }: { items: RowAction[] }) {
  const t = useTranslations("common");
  const visible = items.filter((i) => !i.hidden);
  const normal = visible.filter((i) => !i.destructive);
  const danger = visible.filter((i) => i.destructive);
  if (!visible.length) return null;

  const render = (i: RowAction) => (
    <DropdownMenuItem
      key={i.label}
      variant={i.destructive ? "destructive" : "default"}
      asChild={!!i.href}
      onSelect={i.onClick}
    >
      {i.href ? (
        <Link href={i.href}>
          {i.icon && <i.icon />}
          {i.label}
        </Link>
      ) : (
        <>
          {i.icon && <i.icon />}
          {i.label}
        </>
      )}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("actions")} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
        {normal.map(render)}
        {normal.length > 0 && danger.length > 0 && <DropdownMenuSeparator />}
        {danger.map(render)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
