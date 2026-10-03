import { ModuleGate } from "@/components/shared/ModuleGate";
import { NotificationSync } from "@/components/layout/NotificationSync";
import { AuthGuard } from "@/lib/auth/AuthGuard";

/** Full-screen register: no sidebar or app header. */
export default function PosLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGuard>
      <div className="flex min-h-dvh flex-col bg-background"><ModuleGate>{children}</ModuleGate></div>
      <NotificationSync />
    </AuthGuard>
  );
}
