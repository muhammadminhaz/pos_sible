"use client";

import { useRef, useState } from "react";
import { DatabaseBackupIcon, DownloadIcon, PlusIcon, RotateCcwIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      {!data?.length ? (
        <EmptyState icon={DatabaseBackupIcon} title={t("settings.noBackups")} description={t("settings.noBackupsBody")} />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("settings.f.name")}</TableHead>
                <TableHead>{t("settings.created")}</TableHead>
                <TableHead className="text-end">{t("settings.size")}</TableHead>
                <TableHead className="w-0"><span className="sr-only">{t("common.actions")}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{f.dateTime(b.createdAt)}</TableCell>
                  <TableCell className="text-end tabular-nums">{kb(b.size)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label={t("common.download")} onClick={() => save(b.name, b.payload)}><DownloadIcon /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={t("settings.restore")} onClick={() => setRestore({ kind: "saved", id: b.id })}><RotateCcwIcon /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={t("common.delete")} onClick={() => setDel(b)}><Trash2Icon /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
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
