import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { ContactsReport } from "@/features/reports/ContactReports";

export default function Page() {
  return (
    <RequirePermission permission="report.view">
      <Suspense><ContactsReport /></Suspense>
    </RequirePermission>
  );
}
