"use client";

import type { ReactNode } from "react";
import { useCan } from "@/lib/auth/useCan";
import { Forbidden } from "./Forbidden";

/** Route-level gate: renders a 403 state instead of the page when the role lacks `permission`. */
export function RequirePermission({ permission, children }: { permission?: string; children: ReactNode }) {
  const can = useCan();
  return can(permission) ? children : <Forbidden />;
}
