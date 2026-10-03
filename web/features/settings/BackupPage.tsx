"use client";

import { useRef, useState } from "react";
import { DatabaseBackupIcon, DownloadIcon, PlusIcon, RotateCcwIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, RowActions, useTableQuery } from "@/components/shared/DataTable";
import { clientPage } from "./clientTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { catalogErrorMessage } from "@/features/catalog/catalogError";
import { useBackupActions, useBackups } from "@/lib/data/hooks/settings";
import type { Backup } from "@/lib/data/schemas";
import { useFormat } from "@/lib/i18n/format";

function save(name: string, json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${name}.json` });
  a.click();
  URL.revokeObjectURL(url);
}

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function BackupPage() {
  const t = useTranslations();
  const f = useFormat();
  const { data } = useBackups();
  const act = useBackupActions();
  const file = useRef<HTMLInputElement>(null);
  const [del, setDel] = useState<Backup | null>(null);
  const [restore, setRestore] = useState<{ kind: "saved"; id: string } | { kind: "file"; json: string } | null>(null);
  const run = async (p: Promise<unknown>, ok: string) => {
    try {
      await p;
      toast.success(ok);
    } catch (e) {
      toast.error(catalogErrorMessage(e, t));
    }
  };

  const [query, setQuery] = useTableQuery("settings-backups");
  const page = clientPage(data ?? [], query, (b) => [b.name]);
  const columns: ColumnDef<Backup>[] = [
    { id: "name", accessorKey: "name", header: t("settings.f.name"), meta: { label: t("settings.f.name") }, cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { id: "createdAt", accessorKey: "createdAt", header: t("settings.created"), meta: { label: t("settings.created"), csv: (b) => b.createdAt }, cell: ({ row }) => f.dateTime(row.original.createdAt) },
    { id: "size", accessorKey: "size", header: t("settings.size"), meta: { label: t("settings.size"), align: "right", csv: (b) => b.size }, cell: ({ row }) => <span className="tabular-nums">{kb(row.original.size)}</span> },
    {
      id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined },
      cell: ({ row }) => (
        <RowActions items={[
          { label: t("common.download"), icon: DownloadIcon, onClick: () => save(row.original.name, row.original.payload) },
          { label: t("settings.restore"), icon: RotateCcwIcon, onClick: () => setRestore({ kind: "saved", id: row.original.id }) },
          { label: t("common.delete"), icon: Trash2Icon, destructive: true, onClick: () => setDel(row.original) },
        ]} />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("nav.backup")} description={t("settings.backupDescription")}
        actions={
          <>
            <Button variant="outline" onClick={() => file.current?.click()}><UploadIcon />{t("settings.restoreFromFile")}</Button>
            <Button
              onClick={() => run(act.create.mutateAsync(undefined).then((b) => save(b.name, b.payload)), t("settings.backupCreated"))}
              disabled={act.create.isPending}
            >
              <PlusIcon />{t("settings.createBackup")}
            </Button>
          </>
        }
      />
      <input
        ref={file} type="file" accept="application/json,.json" hidden aria-label={t("settings.restoreFromFile")}
        onChange={async (e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (picked) setRestore({ kind: "file", json: await picked.text() });
        }}
      />
      <DataTable
        tableId="settings-backups" columns={columns} data={page.rows} total={page.total} query={query} onQueryChange={setQuery} exportName="backups"
        empty={<EmptyState icon={DatabaseBackupIcon} title={t("settings.noBackups")} description={t("settings.noBackupsBody")} />}
      />
      <ConfirmDialog
        open={restore !== null} onOpenChange={(o) => !o && setRestore(null)} destructive title={t("settings.restoreTitle")} description={t("settings.restoreBody")} confirmLabel={t("settings.restore")}
        onConfirm={() => restore && run(restore.kind === "saved" ? act.restoreSaved.mutateAsync(restore.id) : act.restoreFile.mutateAsync(restore.json), t("settings.restored"))}
      />
      <ConfirmDialog
        open={del !== null} onOpenChange={(o) => !o && setDel(null)} destructive title={t("common.areYouSure")} confirmLabel={t("common.delete")}
        onConfirm={() => del && run(act.remove.mutateAsync(del.id), t("common.deleted"))}
      />
    </>
  );
}
