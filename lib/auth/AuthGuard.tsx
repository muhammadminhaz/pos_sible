"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
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
  const router = useRouter();
  const hydrated = useSessionHydrated();
  const current = useCurrentUser();

  useEffect(() => {
    if (hydrated && !current) router.replace("/login");
  }, [hydrated, current, router]);

  return hydrated && current ? children : <ShellSkeleton />;
}
