"use client";

import type { ReactNode } from "react";
import { CircleCheckIcon, InfoIcon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { create } from "zustand";
import SwipeToast from "@/components/ui/swipe-toast";

type Kind = "success" | "error" | "warning" | "info" | "default";
type Options = { description?: ReactNode; duration?: number; action?: { label: ReactNode; onClick: () => void } };
type Item = Options & { id: number; kind: Kind; title: ReactNode };

/** The underline (fuse) and icon take the status colour from the theme tokens, so they follow light and dark. */
const LOOK: Record<Kind, { token: string; Icon: typeof InfoIcon | null }> = {
  success: { token: "var(--success)", Icon: CircleCheckIcon },
  error: { token: "var(--danger)", Icon: OctagonXIcon },
  warning: { token: "var(--warning)", Icon: TriangleAlertIcon },
  info: { token: "var(--info)", Icon: InfoIcon },
  default: { token: "var(--muted-foreground)", Icon: null },
};

/** Problems and toasts with a button stay a little longer. */
const durationFor = (kind: Kind, o?: Options) => o?.duration ?? (o?.action || kind === "error" || kind === "warning" ? 6000 : 4000);

const MAX_VISIBLE = 4;
let nextId = 0;
const useToasts = create<{ items: Item[] }>(() => ({ items: [] }));
const remove = (id: number) => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) }));

function push(kind: Kind, title: ReactNode, o?: Options): number {
  const id = ++nextId;
  useToasts.setState((s) => ({ items: [...s.items, { ...o, id, kind, title }].slice(-MAX_VISIBLE) }));
  return id;
}

/** Same calls as before (`toast.success("Saved")`, `toast.error(msg, { description, action })`), rendered by SwipeToast. */
export const toast = Object.assign((title: ReactNode, o?: Options) => push("default", title, o), {
  success: (title: ReactNode, o?: Options) => push("success", title, o),
  error: (title: ReactNode, o?: Options) => push("error", title, o),
  warning: (title: ReactNode, o?: Options) => push("warning", title, o),
  info: (title: ReactNode, o?: Options) => push("info", title, o),
  dismiss: (id?: number) => (id === undefined ? useToasts.setState({ items: [] }) : remove(id)),
});

/** Stack in the bottom-right corner; mount once, near the root. */
export function Toaster() {
  const t = useTranslations("common");
  const items = useToasts((s) => s.items);
  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed right-4 bottom-4 z-[100000] flex w-[min(356px,calc(100vw-2rem))] flex-col items-end pb-[env(safe-area-inset-bottom)] sm:right-8 sm:bottom-8"
      style={{ pointerEvents: "none" }}
    >
      {items.map((n) => {
        const { token, Icon } = LOOK[n.kind];
        return (
          <div key={n.id} className="w-full" style={{ pointerEvents: "auto" }}>
            <SwipeToast
              inline
              title={n.title}
              description={n.description}
              icon={Icon ? <Icon style={{ color: token }} /> : undefined}
              actionLabel={n.action?.label}
              onAction={n.action?.onClick}
              duration={durationFor(n.kind, n)}
              fuseColor={token}
              background="var(--popover)"
              color="var(--popover-foreground)"
              closeButton
              closeLabel={t("close")}
              onClose={() => remove(n.id)}
            />
          </div>
        );
      })}
    </div>
  );
}
