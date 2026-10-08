"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Both icons are always rendered and switched by the `dark` class, so server and client markup match before the theme is known.
const icons = (
  <>
    <SunIcon className="dark:hidden" />
    <MoonIcon className="hidden dark:block" />
  </>
);

export function ThemeToggle() {
  const t = useTranslations("header");
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Tooltip>
      {/* The span takes the tooltip's ref; the toggler keeps its own ref to measure where the circle starts. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <AnimatedThemeToggler
            variant="circle"
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            onThemeChange={setTheme}
            sunIcon={icons}
            moonIcon={icons}
            aria-label={t("theme")}
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{t("theme")}</TooltipContent>
    </Tooltip>
  );
}
