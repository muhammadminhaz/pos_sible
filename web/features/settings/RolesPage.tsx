"use client";

import { useState, type FormEvent } from "react";
import { PencilIcon, PlusIcon, ShieldIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ColumnDef } from "@tanstack/react-table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, RowActions, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { clientPage } from "./clientTable";
import { catalogErrorMessage } from "@/features/catalog/catalogError";
import { useCan } from "@/lib/auth/useCan";
import { modulePermissions, PERM_VERSION, PERMISSION_MODULES } from "@/lib/auth/permissions";
import { useCrud } from "@/lib/data/hooks/catalog";
import type { Role } from "@/lib/data/schemas";

const ACTIONS = ["view", "create", "update", "delete"] as const;
const humanize = (p: string) => p.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function RoleForm({ row, onClose }: { row: (Role & { id: string }) | null; onClose: () => void }) {
  const t = useTranslations();
  const { create, update } = useCrud("roles");
  const [name, setName] = useState(row?.name ?? "");
  const [perms, setPerms] = useState<string[]>(row?.permissions ?? []);
  const all = perms.includes("*");
  const toggle = (p: string, on: boolean) => setPerms(on ? [...perms, p] : perms.filter((x) => x !== p));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const data = { name: name.trim(), permissions: perms, permVersion: PERM_VERSION, isServiceStaff: row?.isServiceStaff ?? false, locationIds: row?.locationIds ?? [] };
      if (row) await update.mutateAsync({ id: row.id, patch: data });
      else await create.mutateAsync(data);
      toast.success(t("common.saved"));
      onClose();
    } catch (err) {
      toast.error(catalogErrorMessage(err, t));
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader><DialogTitle>{row ? t("settings.editRole") : t("settings.addRole")}</DialogTitle></DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="role-name">{t("settings.f.name")}</Label>
        <Input id="role-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Label className="gap-2 font-medium">
        <Checkbox checked={all} onCheckedChange={(c) => setPerms(c ? ["*"] : [])} />
        {t("settings.fullAccess")}
      </Label>
      {!all && (
        <div className="max-h-[52vh] overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("settings.permissions")}</caption>
            <thead className="sticky top-0 bg-muted/80 text-xs backdrop-blur">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-medium">{t("settings.permModule")}</th>
                {ACTIONS.map((a) => <th key={a} scope="col" className="w-16 px-2 py-2 text-center font-medium">{t(`settings.permActions.${a}`)}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MODULES.map((m) => {
                const group = modulePermissions(m);
                const every = group.every((p) => perms.includes(p));
                const name = t(`settings.permModules.${m.id}`);
                return (
                  <tr key={m.id} className="border-t align-top">
                    <th scope="row" className="px-3 py-2 text-start font-medium">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          aria-label={`${name} — ${t("common.all")}`} checked={every}
                          onCheckedChange={(c) => setPerms(c ? [...new Set([...perms, ...group])] : perms.filter((p) => !group.includes(p as never)))}
                        />
                        {name}
                      </div>
                      {m.extras && (
                        <div className="mt-1.5 grid gap-1 ps-6">
                          {m.extras.map((p) => (
                            <Label key={p} className="gap-2 text-xs font-normal text-muted-foreground">
                              <Checkbox checked={perms.includes(p)} onCheckedChange={(c) => toggle(p, !!c)} />
                              {humanize(p)}
                            </Label>
                          ))}
                        </div>
                      )}
                    </th>
                    {ACTIONS.map((a) => {
                      const p = m[a];
                      return (
                        <td key={a} className="px-2 py-2 text-center">
                          {p && <Checkbox aria-label={`${name} — ${t(`settings.permActions.${a}`)}`} checked={perms.includes(p)} onCheckedChange={(c) => toggle(p, !!c)} />}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!all && <p className="text-xs text-muted-foreground">{t("settings.permNote")}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={create.isPending || update.isPending}>{t("common.save")}</Button>
      </DialogFooter>
    </form>
  );
}

export function RolesPage() {
  const t = useTranslations();
  const can = useCan();
  const { list, remove } = useCrud("roles");
  const [query, setQuery] = useTableQuery("settings-roles");
  const [edit, setEdit] = useState<(Role & { id: string }) | "new" | null>(null);
  const [del, setDel] = useState<(Role & { id: string }) | null>(null);
  const canAdd = can("role.create");
  const canEdit = can("role.update");
  const canRemove = can("role.delete");
  const page = clientPage((list.data?.rows ?? []) as (Role & { id: string })[], query, (r) => [r.name]);
  const count = (r: Role) => (r.permissions.includes("*") ? t("settings.fullAccess") : t("settings.permissionCount", { count: r.permissions.length }));

  const columns: ColumnDef<Role & { id: string }>[] = [
    { id: "name", accessorKey: "name", header: t("settings.f.name"), meta: { label: t("settings.f.name") }, cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { id: "permissions", header: t("settings.permissions"), enableSorting: false, meta: { label: t("settings.permissions"), csv: count }, cell: ({ row }) => <Badge variant="secondary">{count(row.original)}</Badge> },
    {
      id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined },
      cell: ({ row }) => (
        <RowActions items={[
          { label: t("common.edit"), icon: PencilIcon, onClick: () => setEdit(row.original), hidden: !canEdit },
          { label: t("common.delete"), icon: Trash2Icon, destructive: true, onClick: () => setDel(row.original), hidden: !canRemove },
        ]} />
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t("nav.roles")} description={t("settings.rolesDescription")} actions={canAdd && <Button onClick={() => setEdit("new")}><PlusIcon />{t("settings.addRole")}</Button>} />
      <DataTable
        tableId="settings-roles" columns={columns} data={page.rows} total={page.total} loading={list.isFetching} query={query} onQueryChange={setQuery} exportName="roles"
        empty={<EmptyState icon={ShieldIcon} title={t("settings.noRoles")} />}
      />
      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          {edit !== null && <RoleForm row={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
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
