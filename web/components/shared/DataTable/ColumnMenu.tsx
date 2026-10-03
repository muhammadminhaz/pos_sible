"use client";

import type { Table } from "@tanstack/react-table";
import { Columns3Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function columnLabel<T>(col: ReturnType<Table<T>["getAllLeafColumns"]>[number]): string {
  const h = col.columnDef.header;
  return col.columnDef.meta?.label ?? (typeof h === "string" ? h : col.id);
}

export function ColumnMenu<T>({ table }: { table: Table<T> }) {
  const t = useTranslations("table");
  const cols = table.getAllLeafColumns().filter((c) => c.getCanHide());
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3Icon />
          <span className="hidden sm:inline">{t("columns")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-52">
        <DropdownMenuLabel>{t("columns")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {cols.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.id}
            checked={c.getIsVisible()}
            onCheckedChange={(v) => c.toggleVisibility(!!v)}
            onSelect={(e) => e.preventDefault()}
          >
            {columnLabel(c)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
