import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { ContactsList } from "@/features/operations/ContactsList";

export default function Page() {
  return (
    <RequirePermission permission="contacts.supplier">
      <Suspense><ContactsList kind="supplier" /></Suspense>
    </RequirePermission>
  );
}
