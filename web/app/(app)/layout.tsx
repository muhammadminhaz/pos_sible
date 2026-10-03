import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/lib/auth/AuthGuard";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
