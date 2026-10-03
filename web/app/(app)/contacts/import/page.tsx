import { RequirePermission } from "@/components/shared/Can";
import { ImportContacts } from "@/features/operations/ImportContacts";

export default function Page() {
  return (
    <RequirePermission permission="contacts.import">
      <ImportContacts />
    </RequirePermission>
  );
}
