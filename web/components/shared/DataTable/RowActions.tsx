"use client";

import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RowAction = {
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  hidden?: boolean;
  /** Items sharing a group are listed together under that heading, after the ungrouped ones. */
  group?: string;
};

/** The per-row "⋯" menu. Labelled groups follow the plain items; destructive items sit at the bottom behind a separator. */
export function RowActions({ items }: { items: RowAction[] }) {
  const t = useTranslations("common");
  const visible = items.filter((i) => !i.hidden);
  const normal = visible.filter((i) => !i.destructive && !i.group);
  const groups = [...new Set(visible.filter((i) => !i.destructive && i.group).map((i) => i.group!))];
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
        {groups.map((g, n) => (
          <DropdownMenuGroup key={g}>
            {(normal.length > 0 || n > 0) && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{g}</DropdownMenuLabel>
            {visible.filter((i) => !i.destructive && i.group === g).map(render)}
          </DropdownMenuGroup>
        ))}
        {(normal.length > 0 || groups.length > 0) && danger.length > 0 && <DropdownMenuSeparator />}
        {danger.map(render)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
