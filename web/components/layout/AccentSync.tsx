"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/data/hooks/settings";

/** Applies Settings → System → Theme colour to the whole app, live. Brand blue is the stylesheet default. */
export function AccentSync() {
  const color = useSettings().data?.system.themeColor;
  useEffect(() => {
    const el = document.documentElement;
    if (!color || color === "blue") el.removeAttribute("data-accent");
    else el.setAttribute("data-accent", color);
  }, [color]);
  return null;
}
