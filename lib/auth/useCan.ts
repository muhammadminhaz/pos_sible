"use client";

import { useCallback, useMemo } from "react";
import { useDB } from "@/lib/data/store/db";
import type { Role, User } from "@/lib/data/schemas";
import { hasPermission } from "./permissions";
import { useSession } from "./session";

export function useCurrentUser(): { user: User; role: Role } | null {
  const userId = useSession((s) => s.userId);
  const users = useDB((s) => s.db?.users);
  const roles = useDB((s) => s.db?.roles);
  return useMemo(() => {
    const user = userId ? users?.find((u) => u.id === userId) : undefined;
    const role = user && roles?.find((r) => r.id === user.roleId);
    return user && role ? { user, role } : null;
  }, [userId, users, roles]);
}

export function useCan(): (p?: string) => boolean {
  const role = useCurrentUser()?.role;
  return useCallback((p?: string) => hasPermission(role, p), [role]);
}
