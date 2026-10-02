"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Fades each screen in as you navigate. Keyed on the path so every route change replays it. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div key={pathname} className="page-in">{children}</div>;
}
