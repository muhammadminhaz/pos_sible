import { RequirePermission } from "@/components/shared/Can";
import { CalendarPage } from "@/features/settings/CalendarPage";

export default function Page() {
  return (
    <RequirePermission permission="calendar.view">
      <CalendarPage />
    </RequirePermission>
  );
}
