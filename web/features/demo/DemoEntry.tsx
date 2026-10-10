"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEMO } from "@/lib/data/api/mode";
import { getDB, hydrateDB, useDB } from "@/lib/data/store/db";
import { useSession } from "@/lib/auth/session";
import { enterDemo } from "@/lib/demo";

/**
 * /demo: switches this tab to a demo shop seeded around today's date, signs in as its owner and opens the dashboard.
 * Everything stays in this browser tab; signing out or closing the tab throws it away.
 */
export function DemoEntry() {
  const router = useRouter();
  const hydrated = useDB((s) => s.hydrated);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const owner = DEMO && hydrated ? getDB().users.find((u) => u.username === "admin") : undefined;
  const blocked = storageBlocked || (DEMO && hydrated && !owner);

  useEffect(() => {
    if (!DEMO) {
      void enterDemo().then((ok) => !ok && setStorageBlocked(true));
      return;
    }
    if (!hydrated) return void hydrateDB();
    if (!owner) return;
    useSession.setState({ userId: owner.id });
    router.replace("/home");
  }, [hydrated, owner, router]);

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-background px-4 text-center">
      {blocked ? (
        <div role="alert" className="max-w-sm">
          <h1 className="text-lg font-semibold">The demo couldn&apos;t start</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your browser is blocking site storage, which the demo needs to keep its sample shop. Allow storage for this site, or leave private browsing, and try again.
          </p>
          <Link href="/welcome" className="mt-5 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">Back to the home page</Link>
        </div>
      ) : (
        <div role="status" className="flex flex-col items-center gap-3">
          <span aria-hidden className="size-9 animate-pulse rounded-xl bg-primary" />
          <h1 className="text-base font-semibold">Setting up your demo shop</h1>
          <p className="text-sm text-muted-foreground">Six months of sample sales, stock and customers, dated up to today.</p>
        </div>
      )}
    </main>
  );
}
