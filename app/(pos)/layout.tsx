import { AuthGuard } from "@/lib/auth/AuthGuard";

/** Full-screen register: no sidebar or app header. */
export default function PosLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGuard>
      <div className="flex min-h-dvh flex-col bg-background">{children}</div>
    </AuthGuard>
  );
}
