"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangleIcon, Loader2Icon, LogOutIcon, PlusIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { API_MODE } from "@/lib/data/api/mode";

type PlanId = string;
type Plans = Record<PlanId, { label: string; maxUsers: number | null }>;
type Business = {
  id: string; name: string; createdAt: string; plan: PlanId; status: "active" | "suspended"; expiresAt: string | null;
  state: "active" | "suspended" | "expired"; users: number; maxUsers: number | null; storageBytes: number; lastActiveAt: string | null;
};
type Me = { username: string; defaultPassword: boolean; plans: Plans };

const call = (path: string, init?: RequestInit) => fetch(`/api/admin/${path}`, { credentials: "same-origin", ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");
const toInputDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA") : "");
const endOfDay = (date: string) => new Date(`${date}T23:59:59`).toISOString();

const STATE_STYLE = {
  active: "bg-success-soft text-success-foreground",
  suspended: "bg-danger-soft text-danger-foreground",
  expired: "bg-warning-soft text-warning-foreground",
} as const;

const selectClass = "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AdminConsole() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  const refreshMe = useCallback(async () => {
    const res = await call("me").catch(() => null);
    setMe(res?.ok ? { ...(await res.json()) } : null);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- asks the server who is signed in, then stores the answer
    if (API_MODE) void refreshMe();
  }, [refreshMe]);

  if (!API_MODE) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 text-center">
        <p className="text-muted-foreground">The platform admin console needs the Postgres-backed server. Build the web app with NEXT_PUBLIC_DATA_MODE=api.</p>
      </main>
    );
  }
  if (me === undefined) return <main className="grid min-h-dvh place-items-center"><Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-label="Loading" /></main>;
  if (me === null) return <SignIn onDone={refreshMe} />;
  return <Dashboard me={me} onSignedOut={() => setMe(null)} />;
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

function Dashboard({ me, onSignedOut }: { me: Me; onSignedOut: () => void }) {
  const [rows, setRows] = useState<Business[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState<Business | null>(null);

  const load = useCallback(async () => {
    const res = await call("businesses").catch(() => null);
    if (res?.status === 401) return onSignedOut();
    if (res?.ok) setRows((await res.json()).businesses);
  }, [onSignedOut]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server, then stores the result
    void load();
  }, [load]);

  const signOut = async () => {
    await call("logout", { method: "POST" }).catch(() => {});
    onSignedOut();
  };

  const totals = rows && {
    count: rows.length,
    active: rows.filter((r) => r.state === "active").length,
    users: rows.reduce((s, r) => s + r.users, 0),
    bytes: rows.reduce((s, r) => s + r.storageBytes, 0),
  };

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheckIcon className="size-5" /></span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Platform admin</h1>
            <p className="text-sm text-muted-foreground">Signed in as {me.username}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setAdding(true)}><PlusIcon />Add business</Button>
          <Button variant="outline" onClick={signOut}><LogOutIcon />Sign out</Button>
        </div>
      </header>

      {me.defaultPassword && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <span>This console is using the default password. Set ADMIN_USERNAME and ADMIN_PASSWORD on the API server before you go live.</span>
        </div>
      )}

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Businesses", totals ? String(totals.count) : "…"],
          ["Active subscriptions", totals ? String(totals.active) : "…"],
          ["User accounts", totals ? String(totals.users) : "…"],
          ["Storage used", totals ? formatBytes(totals.bytes) : "…"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </section>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Ends</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead className="text-right">Storage</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead>Created</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {rows?.length === 0 && <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No business accounts yet. Add the first one.</TableCell></TableRow>}
            {rows?.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>{me.plans[b.plan]?.label ?? b.plan}</TableCell>
                <TableCell><Badge variant="outline" className={STATE_STYLE[b.state]}>{b.state[0].toUpperCase() + b.state.slice(1)}</Badge></TableCell>
                <TableCell className="whitespace-nowrap">{day(b.expiresAt)}</TableCell>
                <TableCell className="text-right tabular-nums">{b.users}{b.maxUsers !== null ? ` / ${b.maxUsers}` : ""}</TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">{formatBytes(b.storageBytes)}</TableCell>
                <TableCell className="whitespace-nowrap">{day(b.lastActiveAt)}</TableCell>
                <TableCell className="whitespace-nowrap">{day(b.createdAt)}</TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={() => setManaging(b)}>Manage</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">You see each business&apos;s package, user count and storage only. Their products, customers, sales and staff stay private to them.</p>

      <AddBusiness open={adding} plans={me.plans} onClose={() => setAdding(false)} onDone={() => { setAdding(false); void load(); }} />
      <Manage business={managing} plans={me.plans} onClose={() => setManaging(null)} onDone={() => { setManaging(null); void load(); }} />
    </main>
  );
}

function PlanSelect({ plans, value, onChange, id }: { plans: Plans; value: string; onChange: (v: string) => void; id: string }) {
  return (
    <select id={id} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(plans).map(([k, p]) => <option key={k} value={k}>{p.label} — {p.maxUsers === null ? "unlimited users" : `up to ${p.maxUsers} users`}</option>)}
    </select>
  );
}

function AddBusiness({ open, plans, onClose, onDone }: { open: boolean; plans: Plans; onClose: () => void; onDone: () => void }) {
  const [plan, setPlan] = useState("standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ends = String(f.get("ends") ?? "");
    setBusy(true);
    setError(null);
    const res = await call("businesses", {
      method: "POST",
      body: JSON.stringify({ businessName: f.get("businessName"), ownerName: f.get("ownerName"), username: f.get("username"), password: f.get("password"), plan, expiresAt: ends ? endOfDay(ends) : null }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      toast.success("Business account created");
      return onDone();
    }
    const body = await res?.json().catch(() => null);
    setError(body?.reason === "username_taken" ? "That username is already used by another business." : "Check the details: the password needs at least 8 characters and the username 3+ letters or digits.");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add business</DialogTitle>
            <DialogDescription>Creates the account and its owner sign-in. Share the username and password with the owner; they can change it after signing in.</DialogDescription>
          </DialogHeader>
          {error && <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-foreground">{error}</div>}
          <div className="grid gap-1.5"><Label htmlFor="b-name">Business name</Label><Input id="b-name" name="businessName" required minLength={2} maxLength={80} /></div>
          <div className="grid gap-1.5"><Label htmlFor="b-owner">Owner name</Label><Input id="b-owner" name="ownerName" required maxLength={60} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label htmlFor="b-user">Owner username</Label><Input id="b-user" name="username" required minLength={3} maxLength={40} pattern="[a-zA-Z0-9._-]+" autoComplete="off" /></div>
            <div className="grid gap-1.5"><Label htmlFor="b-pass">Owner password</Label><Input id="b-pass" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="b-plan">Package</Label><PlanSelect id="b-plan" plans={plans} value={plan} onChange={setPlan} /></div>
          <div className="grid gap-1.5"><Label htmlFor="b-ends">Subscription ends (optional)</Label><Input id="b-ends" name="ends" type="date" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2Icon className="animate-spin" />}Create business</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Manage({ business, plans, onClose, onDone }: { business: Business | null; plans: Plans; onClose: () => void; onDone: () => void }) {
  return (
    <Dialog open={business !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">{business && <ManageForm key={business.id} business={business} plans={plans} onClose={onClose} onDone={onDone} />}</DialogContent>
    </Dialog>
  );
}

function ManageForm({ business, plans, onClose, onDone }: { business: Business; plans: Plans; onClose: () => void; onDone: () => void }) {
  const [plan, setPlan] = useState(business.plan);
  const [enabled, setEnabled] = useState(business.status === "active");
  const [ends, setEnds] = useState(toInputDate(business.expiresAt));
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await call(`businesses/${business.id}`, { method: "PATCH", body: JSON.stringify({ plan, status: enabled ? "active" : "suspended", expiresAt: ends ? endOfDay(ends) : null }) }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      toast.success("Subscription updated");
      return onDone();
    }
    toast.error("Couldn't save the change.");
  };

  return (
    <form onSubmit={save} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{business.name}</DialogTitle>
        <DialogDescription>{business.users} user{business.users === 1 ? "" : "s"} · {formatBytes(business.storageBytes)} stored</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5"><Label htmlFor="m-plan">Package</Label><PlanSelect id="m-plan" plans={plans} value={plan} onChange={setPlan} /></div>
      <div className="grid gap-1.5"><Label htmlFor="m-ends">Subscription ends</Label><Input id="m-ends" type="date" value={ends} onChange={(e) => setEnds(e.target.value)} /><p className="text-xs text-muted-foreground">Leave empty for no end date.</p></div>
      <Label className="gap-2 font-normal">
        <input type="checkbox" className="size-4 accent-primary" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Subscription is on. Switching it off signs everyone in this business out and blocks sign-in.
      </Label>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy && <Loader2Icon className="animate-spin" />}Save</Button>
      </DialogFooter>
    </form>
  );
}
