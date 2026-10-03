import type { Metadata } from "next";
import { PageTitle } from "@/components/layout/PageTitle";
import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/lib/auth/AuthGuard";

/** Private screens: never listed in search results. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGuard>
      <PageTitle />
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
