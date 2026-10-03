"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Table } from "@tanstack/react-table";
import { DownloadIcon, PrinterIcon, Rows3Icon, Rows4Icon, SearchIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUI } from "@/lib/data/store/ui";
import { ColumnMenu } from "./ColumnMenu";

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("common");
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  if (value !== lastValue) {
    // external reset (e.g. filters cleared) wins over the local draft
    setLastValue(value);
    setDraft(value);
  }
  useEffect(() => {
    if (draft === lastValue) return;
    const id = setTimeout(() => onChangeRef.current(draft), 250);
    return () => clearTimeout(id);
  }, [draft, lastValue]);

  return (
    <div className="relative w-full sm:w-64">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="h-8 pr-8 pl-8 pointer-coarse:h-11 pointer-coarse:pr-11 [&::-webkit-search-cancel-button]:hidden"
        aria-label={t("search")}
      />
      {draft && (
        <button
          type="button"
          onClick={() => setDraft("")}
          className="absolute top-1/2 right-2 grid -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground pointer-coarse:size-11 pointer-coarse:right-0"
          aria-label={t("clear")}
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function Toolbar<T>({
  table,
  search,
  onSearch,
  children,
  onExport,
}: {
  table: Table<T>;
  search: string;
  onSearch: (v: string) => void;
  children?: ReactNode;
  onExport?: () => void;
}) {
  const t = useTranslations();
  const density = useUI((s) => s.density);
  const setDensity = useUI((s) => s.setDensity);
  const compact = density === "compact";

  return (
    <div data-print-hide className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
      <SearchInput value={search} onChange={onSearch} />
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              className="size-8"
              onClick={() => setDensity(compact ? "comfortable" : "compact")}
              aria-label={t("table.density")}
            >
              {compact ? <Rows4Icon /> : <Rows3Icon />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{compact ? t("table.comfortable") : t("table.compact")}</TooltipContent>
        </Tooltip>
        <ColumnMenu table={table} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <DownloadIcon />
              <span className="hidden sm:inline">{t("common.export")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {onExport && (
              <DropdownMenuItem onSelect={onExport}>
                <DownloadIcon />
                {t("common.exportCsv")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setTimeout(() => window.print(), 50)}>
              <PrinterIcon />
              {t("common.print")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
