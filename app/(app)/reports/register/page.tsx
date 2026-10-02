import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { RegisterReport } from "@/features/reports/ActivityReports";

export default function Page() {
  return (
    <RequirePermission permission="report.view">
      <Suspense><RegisterReport /></Suspense>
    </RequirePermission>
  );
}
