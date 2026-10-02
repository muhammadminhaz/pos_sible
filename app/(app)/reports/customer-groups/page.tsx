import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { CustomerGroupsReport } from "@/features/reports/ContactReports";

export default function Page() {
  return (
    <RequirePermission permission="report.view">
      <Suspense><CustomerGroupsReport /></Suspense>
    </RequirePermission>
  );
}
