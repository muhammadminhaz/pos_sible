import { Suspense } from "react";
import { RequirePermission } from "@/components/shared/Can";
import { AccountBook } from "@/features/finance/AccountBook";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="account.view">
      <Suspense><AccountBook id={id} /></Suspense>
    </RequirePermission>
  );
}
