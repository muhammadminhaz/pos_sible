import { RequirePermission } from "@/components/shared/Can";
import { ContactDetail } from "@/features/operations/ContactDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission>
      <ContactDetail id={id} />
    </RequirePermission>
  );
}
