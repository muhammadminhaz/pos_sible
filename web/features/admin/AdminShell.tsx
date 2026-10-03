"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { BanknoteIcon, Building2Icon, CreditCardIcon, LayoutDashboardIcon, Loader2Icon, LogOutIcon, MenuIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import { cn } from "cn";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { call, type Business, type Me, type ModuleDef, type Plan } from "./api";

type AdminState = { me: Me; plans: Plan[]; modules: ModuleDef[]; businesses: Business[] | null; reload: () => Promise<void>; signOut: () => Promise<void> };
const Ctx = createContext<AdminState | null>(null);

export function useAdmin(): AdminState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdmin outside the admin shell");
  return v;
}

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/admin/businesses", label: "Businesses", icon: Building2Icon },
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCardIcon },
  { href: "/admin/revenue", label: "Revenue", icon: BanknoteIcon },
] as const;

const itemBase = "relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring [&>svg]:transition-transform hover:[&>svg]:scale-110";

function SidebarBody({ me, onNavigate, onSignOut }: { me: Me; onNavigate?: () => void; onSignOut: () => void }) {
  const path = usePathname();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
        <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><ShieldCheckIcon className="size-4" /></span>
        <span className="text-[15px] font-semibold tracking-tight">Platform admin</span>
      </div>
      <nav aria-label="Admin" className="flex flex-1 flex-col gap-0.5 px-3 py-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
          return (
            <Link key={href} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn(itemBase, active && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary before:absolute before:top-1.5 before:bottom-1.5 before:-left-3 before:w-0.5 before:animate-[grow-y_0.25s_ease-out] before:rounded-full before:bg-primary")}>
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 border-t p-3">
        <div className="mb-2 truncate px-1 text-xs text-muted-foreground">Signed in as {me.username}</div>
        <Button variant="outline" className="w-full justify-start" onClick={onSignOut}><LogOutIcon />Sign out</Button>
      </div>
    </div>
  );
}

/** Sign-in, then the console frame (sidebar + page). Businesses are loaded once here and shared with every page. */
export function AdminShell({ children }: { children: ReactNode }) {
  // undefined: asking · null: signed out · "offline": the backend didn't answer like the API (not configured or down)
  const [me, setMe] = useState<Me | null | undefined | "offline">(undefined);
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [menu, setMenu] = useState(false);

  const refreshMe = useCallback(async () => {
    const res = await call("me").catch(() => null);
    if (res?.ok) return setMe(await res.json());
    setMe(res?.status === 401 ? null : "offline");
  }, []);
  const reload = useCallback(async () => {
    const res = await call("businesses").catch(() => null);
    if (res?.status === 401) return setMe(null);
    if (res?.ok) setBusinesses((await res.json()).businesses);
  }, []);
  const refreshAll = useCallback(async () => {
    await Promise.all([refreshMe(), reload()]);
  }, [refreshMe, reload]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- asks the server who is signed in, then stores the answer
    void refreshAll();
  }, [refreshAll]);

  const signOut = useCallback(async () => {
    await call("logout", { method: "POST" }).catch(() => {});
    setBusinesses(null);
    setMe(null);
  }, []);

  const value = useMemo(() => (me && me !== "offline" ? { me, plans: me.plans, modules: me.modules, businesses, reload: async () => { await Promise.all([refreshMe(), reload()]); }, signOut } : null), [me, businesses, reload, refreshMe, signOut]);

  if (me === "offline") {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 text-center">
        <div className="grid gap-2">
          <h1 className="text-lg font-semibold">Can&apos;t reach the server</h1>
          <p className="text-muted-foreground">The admin console talks to the API. On Vercel, set BACKEND_URL to the API&apos;s address and redeploy, and make sure the API is running.</p>
          <Button variant="outline" className="mx-auto mt-2" onClick={() => { setMe(undefined); void refreshAll(); }}>Try again</Button>
        </div>
      </main>
    );
  }
  if (me === undefined) return <main className="grid min-h-dvh place-items-center"><Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-label="Loading" /></main>;
  if (me === null || !value) return <SignIn onDone={refreshAll} />;

  return (
    <Ctx.Provider value={value}>
      <div className="flex min-h-dvh bg-muted/30">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r lg:block">
          <SidebarBody me={me} onSignOut={signOut} />
        </aside>
        <Sheet open={menu} onOpenChange={setMenu}>
          <SheetContent side="left" className="w-60 p-0">
            <SheetTitle className="sr-only">Admin menu</SheetTitle>
            <SheetDescription className="sr-only">Pages of the platform admin console</SheetDescription>
            <SidebarBody me={me} onNavigate={() => setMenu(false)} onSignOut={signOut} />
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b bg-background/90 px-4 backdrop-blur lg:justify-end">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setMenu(true)}><MenuIcon /></Button>
            <ThemeToggle />
          </header>
          <main className="mx-auto grid w-full max-w-6xl content-start gap-6 px-4 py-6">{children}</main>
        </div>
      </div>
    </Ctx.Provider>
  );
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = await call("login", { method: "POST", body: JSON.stringify({ username: f.get("username"), password: f.get("password") }) }).catch(() => null);
    setBusy(false);
    if (res?.ok) return onDone();
    setError(res?.status === 429 ? "Too many attempts. Try again in a few minutes." : "That username or password isn't right.");
  };

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-sm content-center gap-6 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheckIcon className="size-6" /></span>
        <h1 className="text-2xl font-semibold tracking-tight">Platform admin</h1>
        <p className="text-sm text-muted-foreground">Sign in to manage business accounts and subscriptions.</p>
      </div>
      <Card>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            {error && <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-foreground">{error}</div>}
            <div className="grid gap-1.5">
              <Label htmlFor="admin-username">Username</Label>
              <Input id="admin-username" name="username" autoComplete="username" autoFocus required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="admin-password">Password</Label>
              <Input id="admin-password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <Button type="submit" disabled={busy}>{busy && <Loader2Icon className="animate-spin" />}Sign in</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

/** Page title block used by every admin page. */
export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
