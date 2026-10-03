"use client";

import { useTranslations } from "next-intl";
import { ImportWizard } from "@/features/catalog/ImportWizard";
import { CONTACT_IMPORT_COLUMNS, contactImportService } from "@/lib/data/services/contactImport";
import { useFormat } from "@/lib/i18n/format";

export function ImportContacts() {
  const t = useTranslations();
  const f = useFormat();
  return (
    <ImportWizard
      title={t("nav.importContacts")} description={t("ops.importContactsDescription")} hint={t("ops.importContactsHint")}
      columns={CONTACT_IMPORT_COLUMNS} templateName="contacts-import-template" historyKind="contacts"
      parse={contactImportService.parse} commit={contactImportService.commit}
      preview={{
        headers: [t("ops.contactType"), t("catalog.name"), t("ops.mobile"), t("ops.openingBalance")],
        cells: ({ data: d }) => [t(`ops.type.${d.type}`), d.name, d.mobile, f.money(d.openingBalance)],
      }}
    />
  );
}
