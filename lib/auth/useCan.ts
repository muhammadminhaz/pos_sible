"use client";

import { useCallback, useMemo } from "react";
import { useDB } from "@/lib/data/store/db";
import type { Role, User } from "@/lib/data/schemas";
import { API_MODE } from "@/lib/data/api/mode";
import { useAuth } from "./authStore";
import { hasPermission } from "./permissions";
import { useSession } from "./session";

function useCurrentUserApi(): { user: User; role: Role } | null {
  const user = useAuth((s) => s.user);
  const role = useAuth((s) => s.role);
  return useMemo(() => (user && role ? { user: { ...user, password: "" }, role } : null), [user, role]);
}

function useCurrentUserLocal(): { user: User; role: Role } | null {
  const userId = useSession((s) => s.userId);
  const users = useDB((s) => s.db?.users);
  const roles = useDB((s) => s.db?.roles);
  return useMemo(() => {
    const user = userId ? users?.find((u) => u.id === userId) : undefined;
    const role = user && roles?.find((r) => r.id === user.roleId);
    return user && role ? { user, role } : null;
  }, [userId, users, roles]);
}

/** The signed-in user: from the server in API mode, from the local demo database otherwise. */
export const useCurrentUser = API_MODE ? useCurrentUserApi : useCurrentUserLocal;

export function useCan(): (p?: string) => boolean {
  const role = useCurrentUser()?.role;
  return useCallback((p?: string) => hasPermission(role, p), [role]);
}
