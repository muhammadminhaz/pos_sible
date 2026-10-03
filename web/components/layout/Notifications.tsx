"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { BellIcon, CheckCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { bn as bnLocale } from "date-fns/locale";
import { useLocale } from "next-intl";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Notification } from "@/lib/data/schemas";
import { useNotificationMutations, useNotifications } from "@/lib/data/hooks/notifications";
import { useFormat } from "@/lib/i18n/format";

const DOT: Record<Notification["kind"], string> = {
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/** Generated alerts are worded here, in the viewer's language, from the type and numbers stored with them. */
function useAlertText() {
  const t = useTranslations("alerts");
  const f = useFormat();
  return (n: Notification): { title: string; body: string } => {
    if (!n.type || !t.has(`${n.type}.title`)) return { title: n.title, body: n.body };
    const p = n.params ?? {};
    const values: Record<string, string | number> = { ...p, countText: f.number(Number(p.count ?? 0)), daysText: f.number(Number(p.days ?? 0)) };
    for (const k of ["amount", "limit"]) if (k in p) values[k] = f.money(Number(p[k]));
    if ("since" in p) values.since = f.date(String(p.since));
    return { title: t(`${n.type}.title`, values), body: t(`${n.type}.body`, values) };
  };
}

/** Marks an unread row as read once most of it has been on screen for a moment, so the count falls as you read down the list. */
function SeenWhenVisible({ id, unread, root, onSeen, children }: { id: string; unread: boolean; root: HTMLElement | null; onSeen: (id: string) => void; children: ReactNode }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!unread || !root || !ref.current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        clearTimeout(timer);
        if (e.isIntersecting) timer = setTimeout(() => onSeen(id), 700);
      },
      { root, threshold: 0.75 },
    );
    io.observe(ref.current);
    return () => { clearTimeout(timer); io.disconnect(); };
  }, [id, unread, root, onSeen]);
  return <li ref={ref}>{children}</li>;
}

export function Notifications() {
  const t = useTranslations("header");
  const text = useAlertText();
  const locale = useLocale();
  const { data } = useNotifications();
  const { markAllRead, markRead } = useNotificationMutations();
  const unread = data?.unread ?? 0;
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const seen = (id: string) => markRead.mutate(id);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`${t("notifications")} (${unread})`}>
          <BellIcon />
          {unread > 0 && (
            <span className="absolute -top-[3px] -right-[3px] pointer-coarse:top-[3px] pointer-coarse:right-[3px] grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-xs leading-none font-semibold text-white ring-2 ring-background tabular">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex max-h-[min(34rem,calc(100dvh-5rem))] w-[22rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden bg-popover p-0">
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">{t("notifications")}</h3>
          {unread > 0 && (
            <Button variant="ghost" size="xs" onClick={() => markAllRead.mutate()}>
              <CheckCheckIcon />
              {t("markAllRead")}
            </Button>
          )}
        </div>
        {data?.items.length ? (
          <div ref={setList} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <ul className="divide-y">
              {data.items.map((n) => {
                const { title, body: detail } = text(n);
                const body = (
                  <div className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : DOT[n.kind])} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm", !n.readAt && "font-medium")}>{title}</p>
                      {detail && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{detail}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(n.createdAt), {
                          addSuffix: true,
                          locale: locale === "bn" ? bnLocale : undefined,
                        })}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <SeenWhenVisible key={n.id} id={n.id} unread={open && !n.readAt} root={list} onSeen={seen}>
                    {n.href ? (
                      <Link href={n.href} onClick={() => markRead.mutate(n.id)}>
                        {body}
                      </Link>
                    ) : (
                      <button type="button" className="w-full text-left" onClick={() => markRead.mutate(n.id)}>
                        {body}
                      </button>
                    )}
                  </SeenWhenVisible>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-sm text-muted-foreground">
            <BellIcon className="size-5" />
            {t("noNotifications")}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
