import { create } from "zustand";
import type { Role, User } from "@/lib/data/schemas";

/** A user as the browser sees it: never the password. */
type PublicUser = Omit<User, "password">;

/** Who the server says is signed in (API mode only; the local demo derives this from its own database). */
type AuthState = {
  status: "loading" | "in" | "out";
  user: PublicUser | null;
  role: Role | null;
  businessName: string;
  /** Modules the business subscribes to; null until the server says (and in the local demo): everything is on. */
  modules: string[] | null;
  set: (p: { user: PublicUser; role: Role; businessName: string; modules?: string[] }) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  status: "loading", user: null, role: null, businessName: "", modules: null,
  set: ({ user, role, businessName, modules }) => set({ status: "in", user, role, businessName, modules: modules ?? null }),
  clear: () => set({ status: "out", user: null, role: null, businessName: "", modules: null }),
}));

/** Asks the server who we are. Resolves true when signed in. */
export async function refreshAuth(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (!res.ok) {
      useAuth.getState().clear();
      return false;
    }
    const body = await res.json();
    useAuth.getState().set({ user: body.user, role: body.role, businessName: body.businessName, modules: body.modules });
    return true;
  } catch {
    return useAuth.getState().status === "in";
  }
}

export async function signOutOnServer(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
  useAuth.getState().clear();
}
