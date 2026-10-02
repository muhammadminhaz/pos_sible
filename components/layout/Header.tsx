"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MenuIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Breadcrumbs } from "./Breadcrumbs";
import { Calculator } from "./Calculator";
import { useCommandPalette } from "./commandStore";
import { LocaleToggle } from "./LocaleToggle";
import { Notifications } from "./Notifications";
import { ProfitPopover } from "./ProfitPopover";
import { SidebarContent } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

function MobileNav() {
  const t = useTranslations("header");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("menu")}>
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
        <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

function SearchTrigger() {
  const t = useTranslations("header");
  const setOpen = useCommandPalette((s) => s.setOpen);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-8 pointer-coarse:h-11 w-full max-w-sm items-center gap-2 rounded-lg border bg-muted/40 px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted md:flex"
      >
        <SearchIcon className="size-4" />
        <span className="flex-1 text-left">{t("searchTrigger")}</span>
        <kbd className="rounded border bg-background px-1.5 font-mono text-[10px] font-medium">⌘K</kbd>
      </button>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label={t("searchTrigger")}>
        <SearchIcon />
      </Button>
    </>
  );
}

export function Header() {
  return (
    <header
      data-print-hide
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur supports-backdrop-filter:bg-background/70 lg:px-6"
    >
      <MobileNav />
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Breadcrumbs />
      </div>
      <div className="flex flex-1 justify-center">
        <SearchTrigger />
      </div>
      <div className="flex flex-1 items-center justify-end gap-1">
        <div className="hidden items-center gap-1 sm:flex">
          <Calculator />
          <ProfitPopover />
        </div>
        <Notifications />
        <LocaleToggle className="mx-1 hidden sm:inline-flex" />
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1 h-6" />
        <UserMenu />
      </div>
    </header>
  );
}
