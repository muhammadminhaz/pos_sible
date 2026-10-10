import { create } from "zustand";
import { persist } from "zustand/middleware";
import { actor, dataContext, getDB } from "@/lib/data/store/db";
import { createJSONStorage } from "zustand/middleware";
import { chooseSessionStore, sessionStorageChoice } from "@/lib/data/store/storage";
import { DEMO } from "@/lib/data/api/mode";
import type { Role, User } from "@/lib/data/schemas";

type SessionState = {
  userId: string | null;
  login: (username: string, password: string, remember?: boolean) => boolean;
  logout: () => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      userId: null,
      login: (username, password, remember = true) => {
        const u = getDB().users.find(
          (x) => x.username.toLowerCase() === username.trim().toLowerCase() && x.password === password && x.isActive && x.allowLogin,
        );
        if (!u) return false;
        chooseSessionStore(remember);
        set({ userId: u.id });
        return true;
      },
      logout: () => set({ userId: null }),
    }),
    // The demo sign-in lives only in this tab and under its own key.
    DEMO
      ? { name: "posible:demo:session", storage: createJSONStorage(() => sessionStorage), partialize: (s) => ({ userId: s.userId }) }
      : { name: "posible:v1:session", storage: sessionStorageChoice(), partialize: (s) => ({ userId: s.userId }) },
  ),
);

/** Who is acting: the request's user on the server, the signed-in user in the browser. */
export function activeUserId(): string | null {
  const ctx = dataContext.current();
  return ctx ? ctx.userId : useSession.getState().userId;
}

actor.userId = activeUserId;

export function currentUser(): { user: User; role: Role } | null {
  const id = activeUserId();
  if (!id) return null;
  const db = getDB();
  const user = db.users.find((u) => u.id === id);
  const role = user && db.roles.find((r) => r.id === user.roleId);
  return user && role ? { user, role } : null;
}
