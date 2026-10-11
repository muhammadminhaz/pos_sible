"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { SunMoonIcon } from "@/components/arc/icon-morph/icon-morph";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Until the theme is known both icons render and the `dark` class picks one, so server and client markup match.
const staticIcons = (
  <>
    <SunIcon className="dark:hidden" />
    <MoonIcon className="hidden dark:block" />
  </>
);

export function ThemeToggle() {
  const t = useTranslations("header");
  const { resolvedTheme, setTheme } = useTheme();
  // Once the theme is known the icon morphs between sun and moon; it starts at the right state, so nothing animates on load.
  const icons = resolvedTheme ? <SunMoonIcon state={resolvedTheme === "dark"} size={16} strokeWidth={2} /> : staticIcons;

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
