import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { Analytics } from "@/features/analytics/Analytics";

export default function Page() {
  return (
    <RequirePermission permission="report.view">
      <Suspense><Analytics segment="overview" /></Suspense>
    </RequirePermission>
  );
}
