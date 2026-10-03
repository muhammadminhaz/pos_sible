import { RequirePermission } from "@/components/shared/Can";
import { Opportunities } from "@/features/possible/Opportunities";

export default function Page() {
  return (
    <RequirePermission permission="report.view">
      <Opportunities />
    </RequirePermission>
  );
}
