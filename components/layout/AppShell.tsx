import type { ReactNode } from "react";
import { ModuleGate } from "@/components/shared/ModuleGate";
import { CommandPalette } from "./CommandPalette";
import { NotificationSync } from "./NotificationSync";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 lg:px-6"><ModuleGate>{children}</ModuleGate></main>
      </div>
      <CommandPalette />
      <NotificationSync />
    </div>
  );
}
