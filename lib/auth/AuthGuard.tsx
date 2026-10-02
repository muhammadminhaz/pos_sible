"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { API_MODE } from "@/lib/data/api/mode";
import { setUnauthorizedHandler } from "@/lib/data/api/client";
import { refreshAuth, useAuth } from "./authStore";
import { useSession } from "./session";
import { useCurrentUser } from "./useCan";

function useSessionHydrated() {
  return useSyncExternalStore(
    (onChange) => useSession.persist.onFinishHydration(onChange),
    () => useSession.persist.hasHydrated(),
    () => false,
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-60 shrink-0 border-r bg-sidebar p-4 lg:block">
        <Skeleton className="mb-6 h-8 w-32" />
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="mb-3 h-6 w-full" />
        ))}
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Client-side guard: renders children only for a signed-in user, else redirects to /login. */
export function AuthGuard({ children }: { children: ReactNode }) {
  return API_MODE ? <ServerGuard>{children}</ServerGuard> : <LocalGuard>{children}</LocalGuard>;
}

/** API mode: the server's cookie session decides. A 401 from any call sends the user back to sign in. */
function ServerGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const status = useAuth((s) => s.status);
  useEffect(() => {
    setUnauthorizedHandler(() => useAuth.getState().clear());
    if (useAuth.getState().status === "loading") void refreshAuth();
    // Role changes and deactivations made elsewhere take effect within a minute, or as soon as the tab is focused.
    const again = () => useAuth.getState().status === "in" && void refreshAuth();
    const timer = setInterval(again, 60_000);
    window.addEventListener("focus", again);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", again);
    };
  }, []);
  useEffect(() => {
    if (status === "out") router.replace("/login");
  }, [status, router]);
  return status === "in" ? children : <ShellSkeleton />;
}

function LocalGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hydrated = useSessionHydrated();
  const current = useCurrentUser();

  useEffect(() => {
    if (hydrated && !current) router.replace("/login");
  }, [hydrated, current, router]);

  return hydrated && current ? children : <ShellSkeleton />;
}
