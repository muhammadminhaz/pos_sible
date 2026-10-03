"use client";

import { RequirePermission } from "@/components/shared/Can";
import { PosScreen } from "@/features/pos/PosScreen";

export default function PosPage() {
  return (
    <RequirePermission permission="pos.access">
      <PosScreen />
    </RequirePermission>
  );
}
