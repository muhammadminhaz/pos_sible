import type { Metadata } from "next";
import { AdminShell } from "@/features/admin/AdminShell";

export const metadata: Metadata = { title: "Platform admin", robots: { index: false, follow: false } };

/** The platform owner's console: outside the business app, so no business sign-in, menu or data is loaded here. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
