import type { ReactNode } from "react";
import { OnboardingGate } from "@/features/onboarding/OnboardingWizard";
import { ModuleGate } from "@/components/shared/ModuleGate";
import { CommandPalette } from "./CommandPalette";
import { NavigationProgress } from "./NavigationProgress";
import { NotificationSync } from "./NotificationSync";
import { PageTransition } from "./PageTransition";
import { ScrollbarFade } from "./ScrollbarFade";
import { StorageBanner } from "./StorageBanner";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <StorageBanner />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 lg:px-6"><NavigationProgress /><ModuleGate><PageTransition>{children}</PageTransition></ModuleGate></main>
      </div>
      <CommandPalette />
      <OnboardingGate />
      <NotificationSync />
      <ScrollbarFade />
    </div>
  );
}
