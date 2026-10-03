"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { AccentSync } from "@/components/layout/AccentSync";
import { MicroInteractions } from "@/components/layout/MicroInteractions";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/lib/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataGate } from "@/lib/data/store/DataGate";

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="size-7 animate-pulse rounded-lg bg-primary" />
        <span className="text-sm font-medium">Pos-sible</span>
      </div>
    </div>
  );
}

export function Providers({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: AbstractIntlMessages;
  children: ReactNode;
}) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Dhaka">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={300}>
            <DataGate fallback={<Splash />}>
              <AccentSync />
              <MicroInteractions />
              {children}
            </DataGate>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}
