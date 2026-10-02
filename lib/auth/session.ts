import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getDB } from "@/lib/data/store/db";
import { chooseSessionStore, sessionStorageChoice } from "@/lib/data/store/storage";
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
    { name: "posible:v1:session", storage: sessionStorageChoice(), partialize: (s) => ({ userId: s.userId }) },
  ),
);

export function currentUser(): { user: User; role: Role } | null {
  const id = useSession.getState().userId;
  if (!id) return null;
  const db = getDB();
  const user = db.users.find((u) => u.id === id);
  const role = user && db.roles.find((r) => r.id === user.roleId);
  return user && role ? { user, role } : null;
}
