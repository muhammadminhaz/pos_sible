import type { Metadata } from "next";
import { PageTitle } from "@/components/layout/PageTitle";
import { ModuleGate } from "@/components/shared/ModuleGate";
import { NotificationSync } from "@/components/layout/NotificationSync";
import { AuthGuard } from "@/lib/auth/AuthGuard";

export const metadata: Metadata = { title: "Point of sale", robots: { index: false, follow: false } };

/** Full-screen register: no sidebar or app header. */
export default function PosLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGuard>
      <PageTitle />
      <div className="flex min-h-dvh flex-col bg-background"><ModuleGate>{children}</ModuleGate></div>
      <NotificationSync />
    </AuthGuard>
  );
}
