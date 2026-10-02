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
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { catalogErrorMessage } from "@/features/catalog/catalogError";
import { useCan } from "@/lib/auth/useCan";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useCrud } from "@/lib/data/hooks/catalog";
import type { Role } from "@/lib/data/schemas";

/** Permissions grouped by what's before the dot ("sell.view" → "sell"). */
export const PERMISSION_GROUPS: Record<string, string[]> = PERMISSIONS.reduce<Record<string, string[]>>((acc, p) => {
  const g = p.includes(".") ? p.split(".")[0] : "general";
  (acc[g] ??= []).push(p);
  return acc;
}, {});

const humanize = (p: string) => p.replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase());

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
      const data = { name: name.trim(), permissions: perms, isServiceStaff: row?.isServiceStaff ?? false, locationIds: row?.locationIds ?? [] };
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
        <div className="grid max-h-[50vh] gap-3 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
          {Object.entries(PERMISSION_GROUPS).map(([g, list]) => {
            const every = list.every((p) => perms.includes(p));
            return (
              <fieldset key={g} className="grid content-start gap-1.5">
                <legend className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <Checkbox
                    aria-label={`${humanize(g)} — ${t("common.all")}`} checked={every}
                    onCheckedChange={(c) => setPerms(c ? [...new Set([...perms, ...list])] : perms.filter((p) => !list.includes(p)))}
                  />
                  {humanize(g)}
                </legend>
                {list.map((p) => (
                  <Label key={p} className="gap-2 ps-6 text-sm font-normal">
                    <Checkbox checked={perms.includes(p)} onCheckedChange={(c) => toggle(p, !!c)} />
                    {humanize(p.includes(".") ? p.split(".").slice(1).join(".") : p)}
                  </Label>
                ))}
              </fieldset>
            );
          })}
        </div>
      )}
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
  const [edit, setEdit] = useState<(Role & { id: string }) | "new" | null>(null);
  const [del, setDel] = useState<(Role & { id: string }) | null>(null);
  const write = can("role.create");
  const rows = (list.data?.rows ?? []) as (Role & { id: string })[];
  return (
    <>
      <PageHeader title={t("nav.roles")} description={t("settings.rolesDescription")} actions={write && <Button onClick={() => setEdit("new")}><PlusIcon />{t("settings.addRole")}</Button>} />
      {rows.length === 0 ? (
        <EmptyState icon={ShieldIcon} title={t("settings.noRoles")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{r.name}</h2>
                <Badge variant="secondary">{r.permissions.includes("*") ? t("settings.fullAccess") : t("settings.permissionCount", { count: r.permissions.length })}</Badge>
              </div>
              {write && (
                <div className="mt-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEdit(r)}><PencilIcon />{t("common.edit")}</Button>
                  <Button size="sm" variant="outline" onClick={() => setDel(r)}><Trash2Icon />{t("common.delete")}</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
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
