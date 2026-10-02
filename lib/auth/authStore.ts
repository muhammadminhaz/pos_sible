import { create } from "zustand";
import type { Role } from "@/lib/data/schemas";
import type { PublicUser } from "@/lib/server/types";

/** Who the server says is signed in (API mode only; the local demo derives this from its own database). */
type AuthState = {
  status: "loading" | "in" | "out";
  user: PublicUser | null;
  role: Role | null;
  businessName: string;
  set: (p: { user: PublicUser; role: Role; businessName: string }) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  status: "loading", user: null, role: null, businessName: "",
  set: ({ user, role, businessName }) => set({ status: "in", user, role, businessName }),
  clear: () => set({ status: "out", user: null, role: null, businessName: "" }),
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
    useAuth.getState().set({ user: body.user, role: body.role, businessName: body.businessName });
    return true;
  } catch {
    return useAuth.getState().status === "in";
  }
}

export async function signOutOnServer(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
  useAuth.getState().clear();
}
