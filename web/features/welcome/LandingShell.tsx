import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import content from "@/features/landing/content.json";
import { WelcomeNav } from "./WelcomeNav";
import { landingFonts } from "./fonts";

/**
 * The frame every public page shares: a dark bezel around a rounded card that scrolls inside itself, under a notch nav hanging from its top edge.
 * `backdrop` paints the card behind the content. Off the landing page (`home={false}`) the nav's section links point back to /.
 * Mark the page's opening block with `data-hero`: the nav slides away once it has scrolled out of view.
 */
export function LandingShell({ backdrop, home = false, children }: { backdrop: ReactNode; home?: boolean; children: ReactNode }) {
  const links = home ? content.nav : content.nav.map((n) => ({ ...n, href: `/${n.href}` }));
  return (
    <div lang="en" className={cn(landingFonts, "wl-root h-dvh bg-[#05050a] p-2 sm:p-4")}>
      <div className="relative isolate h-full overflow-hidden rounded-[28px] text-white">
        {backdrop}
        {/* overflow-y alone would let it scroll sideways too. */}
        <div data-scroller className="flex h-full flex-col overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:none]">
          {/* Fixed height: the nav floats in it, so the phone menu unfolds over the page instead of pushing it down. */}
          <header className="pointer-events-none sticky top-0 z-20 h-16 sm:h-[68px]">
            <WelcomeNav links={links} />
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
