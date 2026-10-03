"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, RowActions, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { crudPerm, permissionFor, type WritePermission } from "@/lib/auth/permissions";
import { useCan } from "@/lib/auth/useCan";
import { useCrud } from "@/lib/data/hooks/catalog";
import type { Row, TableName } from "@/lib/data/schemas";
import { catalogErrorMessage } from "./catalogError";

export type Values = Record<string, unknown>;
export type Option = { value: string; label: string };

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "switch" | "list" | "multi" | "password";
  required?: boolean;
  /** Select/number: an empty choice saves `null`. */
  nullable?: boolean;
  min?: number;
  /** Starting value for a new row. */
  initial?: unknown;
  options?: (ctx: { id?: string; values: Values }) => Option[];
  show?: (values: Values) => boolean;
  /** Narrow fields share a row in the dialog. */
  half?: boolean;
  /** Multi: message key shown while nothing is ticked ("common.all" when empty means everything). Defaults to "common.none". */
  emptyLabel?: string;
};

export type ColumnDescriptor<R> = {
  key: string;
  label: string;
  render?: (row: R) => ReactNode;
  align?: "right";
  csv?: (row: R) => unknown;
};

export type CrudConfig<N extends TableName> = {
  table: N;
  title: string;
  description: string;
  icon: LucideIcon;
  addLabel: string;
  editLabel: string;
  emptyTitle: string;
  columns: ColumnDescriptor<Row<N> & { id: string }>[];
  fields: FieldDef[];
  /** Permission for the add / edit / delete controls. */
  permission?: WritePermission;
  /** Merged under the form values when creating (fields the form doesn't show). */
  defaults?: Values;
  /** Rows the user may not delete (e.g. the default scheme). */
  canDelete?: (row: Row<N> & { id: string }) => boolean;
  /** Extra panel beside the form fields (live preview). */
  preview?: (values: Values) => ReactNode;
  /** Inside another page (e.g. a tab): no page header, just the add button above the table. */
  embedded?: boolean;
};

const NONE = "__none__";

function startValues(fields: FieldDef[], row: Values | null): Values {
  return Object.fromEntries(
    fields.map((f) => [f.key, f.type === "password" ? "" : row ? row[f.key] : (f.initial ?? (f.type === "switch" ? false : f.type === "list" ? [] : f.type === "text" || f.type === "textarea" ? "" : null))]),
  );
}

function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const t = useTranslations();
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    onChange([...value, draft.trim()]);
    setDraft("");
  };
  const move = (i: number, by: number) => {
    const next = [...value];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onChange(next);
  };
  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <Input
          aria-label={label}
          placeholder={t("catalog.addValue")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}><PlusIcon />{t("common.add")}</Button>
      </div>
      <ul className="grid gap-1">
        {value.map((v, i) => (
          <li key={`${v}-${i}`} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
            <span className="flex-1">{v}</span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("catalog.moveUp")} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUpIcon /></Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("catalog.moveDown")} disabled={i === value.length - 1} onClick={() => move(i, 1)}><ArrowDownIcon /></Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.remove")} onClick={() => onChange(value.filter((_, j) => j !== i))}><XIcon /></Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FieldInput({ f, values, id, set }: { f: FieldDef; values: Values; id?: string; set: (v: unknown) => void }) {
  const t = useTranslations();
  const dom = `f-${f.key}`;
  const v = values[f.key];
  switch (f.type) {
    case "textarea":
      return <Textarea id={dom} value={(v as string) ?? ""} onChange={(e) => set(e.target.value)} />;
    case "number":
      return (
        <Input
          id={dom} type="number" step="any" min={f.min} required={f.required} className="tabular-nums"
          value={v == null ? "" : String(v)} onChange={(e) => set(e.target.value === "" ? null : Number(e.target.value))}
        />
      );
    case "select": {
      const opts = f.options?.({ id, values }) ?? [];
      return (
        <Select value={(v as string | null) ?? NONE} onValueChange={(x) => set(x === NONE ? null : x)}>
          <SelectTrigger id={dom} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {f.nullable && <SelectItem value={NONE}>—</SelectItem>}
            {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    case "switch":
      return <Switch id={dom} checked={!!v} onCheckedChange={set} />;
    case "multi":
      return (
        <MultiSelect
          id={dom} values={(v as string[]) ?? []} onChange={set} options={f.options?.({ id, values }) ?? []}
          placeholder={t(f.emptyLabel ?? "common.none")} summary={(count) => t("common.selected", { count })} ariaLabel={f.label}
        />
      );
    case "password":
      return <Input id={dom} type="password" autoComplete="new-password" required={f.required} value={(v as string) ?? ""} onChange={(e) => set(e.target.value)} />;
    case "list":
      return <ListField label={f.label} value={(v as string[]) ?? []} onChange={set} />;
    default:
      return <Input id={dom} required={f.required} value={(v as string) ?? ""} onChange={(e) => set(e.target.value)} />;
  }
}

function EditDialog<N extends TableName>({ cfg, row, onClose }: { cfg: CrudConfig<N>; row: (Row<N> & { id: string }) | null; onClose: () => void }) {
  const t = useTranslations();
  const { create, update } = useCrud(cfg.table);
  const [values, setValues] = useState<Values>(() => startValues(cfg.fields, row as Values | null));
  const pending = create.isPending || update.isPending;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const data = Object.fromEntries(
      // Leaving a password blank on edit keeps the current one.
      cfg.fields.filter((f) => (!f.show || f.show(values)) && !(f.type === "password" && row && !values[f.key])).map((f) => [f.key, f.type === "text" ? (values[f.key] as string).trim() : values[f.key]]),
    );
    // A hidden field must not keep a stale value (e.g. a multiplier after the base unit is cleared).
    for (const f of cfg.fields) if (f.show && !f.show(values)) data[f.key] = f.type === "number" || f.type === "select" ? (f.type === "number" ? (f.initial ?? null) : null) : values[f.key];
    try {
      if (row) await update.mutateAsync({ id: row.id, patch: data as never });
      else await create.mutateAsync({ ...cfg.defaults, ...data } as never);
      toast.success(t("common.saved"));
      onClose();
    } catch (err) {
      toast.error(catalogErrorMessage(err, t));
    }
  };

  const visible = cfg.fields.filter((f) => !f.show || f.show(values));
  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader><DialogTitle>{row ? cfg.editLabel : cfg.addLabel}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        {visible.map((f) => (
          <div key={f.key} className={`grid content-start gap-2 ${f.half ? "" : "col-span-2"}`}>
            {f.type === "switch" ? (
              <div className="flex items-center gap-2">
                <FieldInput f={f} values={values} id={row?.id} set={(v) => setValues({ ...values, [f.key]: v })} />
                <Label htmlFor={`f-${f.key}`}>{f.label}</Label>
              </div>
            ) : (
              <>
                <Label htmlFor={`f-${f.key}`}>{f.label}</Label>
                <FieldInput f={f} values={values} id={row?.id} set={(v) => setValues({ ...values, [f.key]: v })} />
              </>
            )}
          </div>
        ))}
      </div>
      {cfg.preview?.(values)}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={pending}>{t("common.save")}</Button>
      </DialogFooter>
    </form>
  );
}

/** A reference list (brands, units, …): searchable table plus an add/edit dialog, driven by a config. */
export function CrudPage<N extends TableName>({ cfg }: { cfg: CrudConfig<N> }) {
  type R = Row<N> & { id: string };
  const t = useTranslations();
  const can = useCan();
  const [query, setQuery] = useTableQuery(`catalog-${cfg.table}`);
  const { list, remove } = useCrud(cfg.table, { search: query.search || undefined, page: query.page, pageSize: query.pageSize, sort: query.sort });
  const [edit, setEdit] = useState<R | "new" | null>(null);
  const [del, setDel] = useState<R | null>(null);
  const perm = cfg.permission ?? crudPerm("catalog");
  const canAdd = can(permissionFor(perm, "create"));
  const canEdit = can(permissionFor(perm, "update"));
  const canRemove = can(permissionFor(perm, "delete"));

  const columns: ColumnDef<R>[] = [
    ...cfg.columns.map((c): ColumnDef<R> => ({
      id: c.key,
      accessorKey: c.key,
      header: c.label,
      meta: { label: c.label, align: c.align, csv: c.csv },
      cell: ({ row }) => c.render?.(row.original) ?? <span className={c.key === "name" ? "font-medium" : ""}>{String((row.original as Values)[c.key] ?? "") || "—"}</span>,
    })),
    {
      id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined },
      cell: ({ row }) => (
        <RowActions items={[
          { label: t("common.edit"), icon: PencilIcon, onClick: () => setEdit(row.original), hidden: !canEdit },
          { label: t("common.delete"), icon: Trash2Icon, destructive: true, onClick: () => setDel(row.original), hidden: !canRemove || cfg.canDelete?.(row.original) === false },
        ]} />
      ),
    },
  ];

  return (
    <>
      {cfg.embedded ? (
        canAdd && <div className="mb-4 flex justify-end"><Button onClick={() => setEdit("new")}><PlusIcon />{cfg.addLabel}</Button></div>
      ) : (
        <PageHeader title={cfg.title} description={cfg.description} actions={canAdd && <Button onClick={() => setEdit("new")}><PlusIcon />{cfg.addLabel}</Button>} />
      )}
      <DataTable
        tableId={`catalog-${cfg.table}`} columns={columns} data={(list.data?.rows ?? []) as R[]} total={list.data?.total ?? 0}
        loading={list.isFetching} query={query} onQueryChange={setQuery} exportName={cfg.table}
        empty={<EmptyState icon={cfg.icon} title={cfg.emptyTitle} />}
      />
      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          {edit !== null && <EditDialog cfg={cfg} row={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={del !== null} onOpenChange={(o) => !o && setDel(null)} destructive title={t("common.areYouSure")} confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (!del) return;
          try {
            await remove.mutateAsync(del.id);
            toast.success(t("common.deleted"));
          } catch (err) {
            toast.error(catalogErrorMessage(err, t));
          }
        }}
      />
    </>
  );
}
