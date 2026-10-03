import { ForbiddenError } from "@/lib/data/errors";
import { hasPermission } from "./permissions";
import { currentUser } from "./session";

/** Service-side permission check. Skipped when nobody is signed in (tests, seed scripts). */
export function assertCan(permission: string) {
  const cu = currentUser();
  if (cu && !hasPermission(cu.role, permission)) throw new ForbiddenError(permission);
}

/** Like `assertCan` but answers yes/no; true when nobody is signed in, so tests and seed scripts see everything. */
export function canDo(permission: string): boolean {
  const cu = currentUser();
  return !cu || hasPermission(cu.role, permission);
}
