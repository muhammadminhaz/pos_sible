"use client";

import "./types";
import { useMemo, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type Updater,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { cn } from "cn";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/lib/data/hooks/settings";
import { useUI } from "@/lib/data/store/ui";
import { EmptyState } from "../EmptyState";
import { BulkBar } from "./BulkBar";
import { AUDIT_COLUMN_IDS, useAuditColumns } from "./auditColumns";
import { columnLabel } from "./ColumnMenu";
import { downloadCSV, exportFileName, toCSV } from "./export";
import { Pagination } from "./Pagination";
import { Toolbar } from "./Toolbar";
import type { TableQuery } from "./types";

export type { TableQuery } from "./types";

export type DataTableProps<T> = {
  /** Key for persisted column visibility and page size. */
  tableId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  data: T[];
  total: number;
  loading?: boolean;
  query: TableQuery;
  onQueryChange: (q: Partial<TableQuery>) => void;
  selectable?: boolean;
  bulkActions?: (rows: T[], clear: () => void) => ReactNode;
  /** Rendered as a `<tfoot>` row per column: return a node per column id. */
  footer?: (rows: T[]) => Partial<Record<string, ReactNode>>;
  toolbar?: ReactNode;
  exportName?: string;
  /** Rows for CSV export — typically every row matching the current filters, not just this page. */
  exportRows?: () => Promise<T[]>;
  getRowId?: (r: T) => string;
  onRowClick?: (r: T) => void;
  empty?: ReactNode;
  /** Columns hidden until the user shows them (only used before a preference is saved). */
  defaultHidden?: string[];
};

const ROW_H = { comfortable: "h-10", compact: "h-8" };

export function DataTable<T>({
  tableId,
  columns,
  data,
  total,
  loading,
  query,
  onQueryChange,
  selectable,
  bulkActions,
  footer,
  toolbar,
  exportName,
  exportRows,
  getRowId,
  onRowClick,
  empty,
  defaultHidden = [],
}: DataTableProps<T>) {
  const t = useTranslations();
  const density = useUI((s) => s.density);
  const { data: appSettings } = useSettings();
  const pref = useUI((s) => s.tablePrefs[tableId]);
  const setTablePref = useUI((s) => s.setTablePref);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [selectedRows, setSelectedRows] = useState<Record<string, T>>({});

  const auditColumns = useAuditColumns(data);
  const hidden = pref?.hidden ?? (auditColumns.length ? [...defaultHidden, ...AUDIT_COLUMN_IDS] : defaultHidden);
  const columnVisibility = useMemo<VisibilityState>(() => Object.fromEntries(hidden.map((id) => [id, false])), [hidden]);
  const sorting: SortingState = query.sort ? [query.sort] : [];

  const allColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    // The audit columns sit before the row-actions column, which stays last.
    const at = columns.findIndex((c) => c.id === "actions");
    const withAudit = auditColumns.length ? (at < 0 ? [...columns, ...auditColumns] : [...columns.slice(0, at), ...auditColumns, ...columns.slice(at)]) : columns;
    if (!selectable) return withAudit;
    const select: ColumnDef<T, unknown> = {
      id: "__select",
      enableSorting: false,
      enableHiding: false,
      meta: { className: "w-10 pr-0" },
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label={t("table.selectAll")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          onClick={(e) => e.stopPropagation()}
          aria-label={t("table.selectRow")}
        />
      ),
    };
    return [select, ...withAudit];
  }, [columns, auditColumns, selectable, t]);

  const rowId = (r: T, i: number) => (getRowId ? getRowId(r) : ((r as { id?: string }).id ?? String(i)));

  // TanStack Table is not React Compiler-safe; this component simply isn't auto-memoized.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId: rowId,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableSortingRemoval: true,
    rowCount: total,
    state: { sorting, columnVisibility, rowSelection: selection },
    onSortingChange: (u: Updater<SortingState>) => {
      const next = typeof u === "function" ? u(sorting) : u;
      onQueryChange({ sort: next[0], page: 0 });
    },
    onColumnVisibilityChange: (u: Updater<VisibilityState>) => {
      const next = typeof u === "function" ? u(columnVisibility) : u;
      setTablePref(tableId, { hidden: Object.keys(next).filter((k) => next[k] === false) });
    },
    onRowSelectionChange: (u: Updater<RowSelectionState>) => {
      const next = typeof u === "function" ? u(selection) : u;
      // Remember row objects so selection survives paging.
      const byId = Object.fromEntries(data.map((r, i) => [rowId(r, i), r]));
      setSelectedRows((prev) => {
        const out: Record<string, T> = {};
        for (const id of Object.keys(next)) if (next[id]) out[id] = byId[id] ?? prev[id];
        return out;
      });
      setSelection(next);
    },
  });

  const clearSelection = () => {
    setSelection({});
    setSelectedRows({});
  };

  const exportCsv = async () => {
    const rows = exportRows ? await exportRows() : data;
    const cols = table.getVisibleLeafColumns().filter((c) => c.id !== "__select" && c.id !== "actions");
    const records = rows.map((r) =>
      Object.fromEntries(
        cols.flatMap((c) => {
          const def = c.columnDef as { accessorKey?: string; accessorFn?: (r: T, i: number) => unknown };
          const v = c.columnDef.meta?.csv
            ? c.columnDef.meta.csv(r)
            : def.accessorFn
              ? def.accessorFn(r, 0)
              : def.accessorKey
                ? (r as Record<string, unknown>)[def.accessorKey]
                : undefined;
          return v === undefined ? [] : [[columnLabel(c), v]];
        }),
      ),
    );
    const file = `${exportFileName(exportName ?? tableId, appSettings?.business.name)}.csv`;
    downloadCSV(file, toCSV(records));
    toast.success(t("common.exportDone"), { description: t("common.exportDoneBody", { count: rows.length, file }) });
  };

  const selected = Object.values(selectedRows);
  const footerCells = footer?.(data);
  const visibleCols = table.getVisibleLeafColumns();
  const rowH = ROW_H[density];
  const skeletonRows = Math.min(query.pageSize === -1 ? 10 : query.pageSize, 10);

  return (
    <div className="overflow-hidden rounded-xl border bg-card text-card-foreground">
      <Toolbar
        table={table}
        search={query.search}
        onSearch={(search) => onQueryChange({ search, page: 0 })}
        onExport={appSettings?.business.enableExport === false ? undefined : exportCsv}
      >
        {toolbar}
      </Toolbar>

      <ScrollFade tabIndex={0} className="relative hidden max-h-[calc(100dvh-16rem)] overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:block print:max-h-none">
        <table className="w-full caption-bottom text-[13px]">
          <thead className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b">
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta;
                  const sort = h.column.getIsSorted();
                  const canSort = h.column.getCanSort();
                  const content = h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext());
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined}
                      className={cn(
                        "h-9 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground",
                        meta?.align === "right" && "text-right",
                        meta?.align === "center" && "text-center",
                        meta?.className,
                      )}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn(
                            "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 pointer-coarse:min-h-11 hover:text-foreground",
                            meta?.align === "right" && "flex-row-reverse",
                            sort && "text-foreground",
                          )}
                        >
                          {content}
                          {sort === "asc" ? (
                            <ArrowUpIcon className="size-3.5" />
                          ) : sort === "desc" ? (
                            <ArrowDownIcon className="size-3.5" />
                          ) : (
                            <ArrowUpDownIcon className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        content
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading && !data.length ? (
              Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={i} className={cn("border-b last:border-0", rowH)}>
                  {visibleCols.map((c) => (
                    <td key={c.id} className="px-3">
                      <Skeleton className="h-4 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length}>{empty ?? <EmptyState title={t("common.noResults")} />}</td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    "border-b transition-colors last:border-0 hover:bg-muted/40 data-[state=selected]:bg-primary/5",
                    rowH,
                    onRowClick && "cursor-pointer",
                    loading && "opacity-60",
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-3 align-middle",
                          meta?.align === "right" && "text-right",
                          meta?.align === "center" && "text-center",
                          meta?.className,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          {footerCells && data.length > 0 && (
            <tfoot className="sticky bottom-0 border-t bg-muted font-medium">
              <tr className="h-10">
                {visibleCols.map((c) => (
                  <td
                    key={c.id}
                    className={cn(
                      "px-3 whitespace-nowrap",
                      c.columnDef.meta?.align === "right" && "text-right",
                      c.columnDef.meta?.className,
                    )}
                  >
                    {footerCells[c.id]}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </ScrollFade>

      {/* Below md rows become stacked cards; the full table needs more width than a phone has. */}
      <ul className="divide-y md:hidden print:hidden">
        {loading && !data.length ? (
          Array.from({ length: Math.min(skeletonRows, 5) }, (_, i) => (
            <li key={i} className="space-y-2 p-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
            </li>
          ))
        ) : data.length === 0 ? (
          <li>{empty ?? <EmptyState title={t("common.noResults")} />}</li>
        ) : (
          table.getRowModel().rows.map((row) => {
            const cells = row.getVisibleCells();
            const lead = cells.find((c) => c.column.id !== "__select" && c.column.id !== "actions");
            const select = cells.find((c) => c.column.id === "__select");
            const actions = cells.find((c) => c.column.id === "actions");
            const rest = cells.filter(
              (c) => c !== lead && c !== select && c !== actions && !c.column.columnDef.meta?.mobileHidden,
            );
            return (
              <li
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn("p-4 data-[state=selected]:bg-primary/5", onRowClick && "cursor-pointer", loading && "opacity-60")}
              >
                <div className="flex items-center gap-3">
                  {select && flexRender(select.column.columnDef.cell, select.getContext())}
                  <div className="min-w-0 flex-1 font-medium">{lead && flexRender(lead.column.columnDef.cell, lead.getContext())}</div>
                  {actions && flexRender(actions.column.columnDef.cell, actions.getContext())}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
                  {rest.map((c) => (
                    <div key={c.id} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{columnLabel(c.column)}</dt>
                      <dd className="mt-0.5">{flexRender(c.column.columnDef.cell, c.getContext())}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            );
          })
        )}
        {footerCells && data.length > 0 && (
          <li className="grid grid-cols-2 gap-x-4 gap-y-1 bg-muted/60 p-4 text-[13px] font-medium">
            {visibleCols
              .filter((c) => footerCells[c.id])
              .map((c) => (
                <div key={c.id} className={cn("min-w-0", c.columnDef.meta?.align === "right" && "text-right")}>
                  <div className="text-xs font-normal text-muted-foreground">{columnLabel(c)}</div>
                  {footerCells[c.id]}
                </div>
              ))}
          </li>
        )}
      </ul>

      <Pagination
        page={query.page}
        pageSize={query.pageSize}
        total={total}
        onChange={(q) => {
          if (q.pageSize !== undefined) setTablePref(tableId, { pageSize: q.pageSize });
          onQueryChange(q);
        }}
      />

      {selectable && bulkActions && (
        <BulkBar count={selected.length} onClear={clearSelection}>
          {bulkActions(selected, clearSelection)}
        </BulkBar>
      )}
    </div>
  );
}

/** Initial query for a table, honouring the persisted page size. */
export function useTableQuery(tableId: string, init: Partial<TableQuery> = {}) {
  const { data: appSettings } = useSettings();
  const defaultSize = appSettings?.system.defaultPageSize ?? 25;
  const savedSize = useUI((s) => s.tablePrefs[tableId]?.pageSize);
  const [query, setQuery] = useState<Omit<TableQuery, "pageSize"> & { pageSize?: number }>({ page: 0, search: "", ...init });
  // The size is resolved on every render so the business default applies as soon as settings have loaded.
  const resolved: TableQuery = { ...query, pageSize: query.pageSize ?? savedSize ?? defaultSize };
  const update = (q: Partial<TableQuery>) => setQuery((prev) => ({ ...prev, ...q }));
  return [resolved, update] as const;
}
