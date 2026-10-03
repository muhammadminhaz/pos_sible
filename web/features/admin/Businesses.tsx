"use client";

import { useState, type FormEvent } from "react";
import { BanIcon, EyeIcon, EyeOffIcon, Loader2Icon, MoreHorizontalIcon, PlusIcon, RefreshCwIcon, SearchIcon, SettingsIcon, Trash2Icon } from "lucide-react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag, isPhoneOk, PhoneInput } from "@/components/shared/PhoneInput";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminHeader, useAdmin } from "./AdminShell";
import { call, day, formatBytes, formatMoney, TERMS, type Business, type Plan } from "./api";
import { StateBadge } from "./parts";

const planText = (p: Plan) => `${p.label} · ${p.maxUsers === null ? "unlimited users" : `up to ${p.maxUsers} users`} · ${formatMoney(p.priceMonthly)}/month`;

function PlanSelect({ id, plans, value, onChange }: { id: string; plans: Plan[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder="Choose a package" /></SelectTrigger>
      <SelectContent>
        {plans.map((p) => <SelectItem key={p.id} value={p.id}>{planText(p)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** Email and phone on two lines, with the phone's country flag. */
function Contact({ email, phone }: { email: string | null; phone: string | null }) {
  const p = phone ? parsePhoneNumberFromString(phone) : undefined;
  if (!email && !phone) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="grid gap-0.5 text-sm">
      {phone && <span className="flex items-center gap-1.5 whitespace-nowrap tabular-nums">{p?.country && <Flag country={p.country} />}{p ? p.formatInternational() : phone}</span>}
      {email && <span className="max-w-48 truncate text-muted-foreground">{email}</span>}
    </div>
  );
}

function TermSelect({ id, value, onChange, withNone }: { id: string; value: string; onChange: (v: string) => void; withNone?: boolean }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        {TERMS.map((t) => <SelectItem key={t.months} value={String(t.months)}>{t.label}</SelectItem>)}
        {withNone && <SelectItem value="none">No end date</SelectItem>}
      </SelectContent>
    </Select>
  );
}

function PasswordField({ id, name, value, onChange, label, autoComplete }: { id: string; name?: string; value: string; onChange: (v: string) => void; label: string; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input id={id} name={name} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} minLength={8} required autoComplete={autoComplete ?? "new-password"} />
        <Button type="button" variant="outline" size="icon" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)}>{show ? <EyeOffIcon /> : <EyeIcon />}</Button>
      </div>
    </div>
  );
}

export function BusinessesPage() {
  const { businesses, plans, reload } = useAdmin();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState<Business | null>(null);
  const [deleting, setDeleting] = useState<Business | null>(null);
  const [renewing, setRenewing] = useState<Business | null>(null);
  const [cancelling, setCancelling] = useState<Business | null>(null);
  const term = q.trim().toLowerCase();
  const rows = (businesses ?? []).filter((b) => !term || b.name.toLowerCase().includes(term) || (b.ownerUsername ?? "").toLowerCase().includes(term));

  return (
    <>
      <AdminHeader
        title="Businesses"
        description="Each business is a separate account. You see its package, users and storage, never its data."
        actions={<Button onClick={() => setAdding(true)}><PlusIcon />Add business</Button>}
      />
      <div className="relative max-w-xs">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Search businesses" placeholder="Search name or username…" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Ends</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead className="text-right">Storage</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!businesses && <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {businesses && rows.length === 0 && <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">{businesses.length ? "No businesses match." : "No business accounts yet. Add the first one."}</TableCell></TableRow>}
            {rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell className="text-muted-foreground">{b.ownerUsername ?? "—"}</TableCell>
                <TableCell><Contact email={b.contactEmail} phone={b.contactPhone} /></TableCell>
                <TableCell>{b.planLabel}</TableCell>
                <TableCell><StateBadge state={b.state} /></TableCell>
                <TableCell className="whitespace-nowrap">{day(b.expiresAt)}</TableCell>
                <TableCell className="text-right tabular-nums">{b.users}{b.maxUsers !== null ? ` / ${b.maxUsers}` : ""}</TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">{formatBytes(b.storageBytes)}</TableCell>
                <TableCell className="whitespace-nowrap">{day(b.lastActiveAt)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`Actions for ${b.name}`}><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setManaging(b)}><SettingsIcon />Manage account</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setRenewing(b)}><RefreshCwIcon />Renew subscription</DropdownMenuItem>
                      {b.state !== "cancelled" && <DropdownMenuItem variant="destructive" onSelect={() => setCancelling(b)}><BanIcon />Cancel subscription</DropdownMenuItem>}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(b)}><Trash2Icon />Delete business</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">{adding && <AddForm plans={plans} onClose={() => setAdding(false)} onDone={async () => { setAdding(false); await reload(); }} />}</DialogContent>
      </Dialog>
      <Dialog open={managing !== null} onOpenChange={(o) => !o && setManaging(null)}>
        <DialogContent className="sm:max-w-md">{managing && <ManageForm key={managing.id} business={managing} plans={plans} onClose={() => setManaging(null)} onDone={async () => { setManaging(null); await reload(); }} onRenew={() => { setRenewing(managing); setManaging(null); }} onCancel={() => { setCancelling(managing); setManaging(null); }} />}</DialogContent>
      </Dialog>
      <Dialog open={renewing !== null} onOpenChange={(o) => !o && setRenewing(null)}>
        <DialogContent className="sm:max-w-sm">{renewing && <RenewForm key={renewing.id} business={renewing} onClose={() => setRenewing(null)} onDone={async () => { setRenewing(null); await reload(); }} />}</DialogContent>
      </Dialog>
      <CancelDialog business={cancelling} onClose={() => setCancelling(null)} onDone={async () => { setCancelling(null); await reload(); }} />
      <DeleteDialog business={deleting} onClose={() => setDeleting(null)} onDone={async () => { setDeleting(null); await reload(); }} />
    </>
  );
}

function AddForm({ plans, onClose, onDone }: { plans: Plan[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState(plans.find((p) => p.id === "standard")?.id ?? plans[0]?.id ?? "");
  const [term, setTerm] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await call("businesses", { method: "POST", body: JSON.stringify({ businessName: name, username, password, email, phone, plan, months: term === "none" ? null : Number(term) }) }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      toast.success("Business account created");
      return onDone();
    }
    const body = await res?.json().catch(() => null);
    setError(body?.reason === "username_taken" ? "That username is already used by another business." : "Check the details: the username needs 3+ letters or digits and the password at least 8 characters.");
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Add business</DialogTitle>
        <DialogDescription>Creates the account and the sign-in its owner will use. Share the username and password with them.</DialogDescription>
      </DialogHeader>
      {error && <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-foreground">{error}</div>}
      <div className="grid gap-1.5"><Label htmlFor="b-name">Business name</Label><Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} autoFocus /></div>
      <div className="grid gap-1.5"><Label htmlFor="b-user">Username</Label><Input id="b-user" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={40} pattern="[a-zA-Z0-9._-]+" autoComplete="off" /><p className="text-xs text-muted-foreground">Letters, digits, dot, dash or underscore. The business signs in with this.</p></div>
      <PasswordField id="b-pass" label="Password" value={password} onChange={setPassword} />
      <div className="grid gap-1.5"><Label htmlFor="b-email">Email (optional)</Label><Input id="b-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="off" /></div>
      <div className="grid gap-1.5"><Label htmlFor="b-phone">Phone (optional)</Label><PhoneInput id="b-phone" value={phone} onChange={setPhone} />{!isPhoneOk(phone) && <p role="alert" className="text-xs text-danger">That phone number doesn&apos;t look right for the chosen country.</p>}</div>
      <div className="grid gap-1.5"><Label htmlFor="b-plan">Package</Label><PlanSelect id="b-plan" plans={plans} value={plan} onChange={setPlan} /></div>
      <div className="grid gap-1.5"><Label htmlFor="b-term">Subscription term</Label><TermSelect id="b-term" value={term} onChange={setTerm} withNone /></div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={busy || !plan || !isPhoneOk(phone)}>{busy && <Loader2Icon className="animate-spin" />}Create business</Button>
      </DialogFooter>
    </form>
  );
}

function ManageForm({ business, plans, onClose, onDone, onRenew, onCancel }: { business: Business; plans: Plan[]; onClose: () => void; onDone: () => void; onRenew: () => void; onCancel: () => void }) {
  const [plan, setPlan] = useState(business.plan);
  const [email, setEmail] = useState(business.contactEmail ?? "");
  const [phone, setPhone] = useState(business.contactPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await call(`businesses/${business.id}`, { method: "PATCH", body: JSON.stringify({ plan, contactEmail: email, contactPhone: phone }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return void toast.error("Couldn't save the change.");
    toast.success("Account updated");
    onDone();
  };

  const reset = async () => {
    setResetting(true);
    const res = await call(`businesses/${business.id}`, { method: "PATCH", body: JSON.stringify({ ownerPassword: newPassword }) }).catch(() => null);
    setResetting(false);
    if (!res?.ok) return void toast.error("Couldn't set the password. It needs at least 8 characters.");
    setNewPassword("");
    toast.success(`New password set for ${business.ownerUsername ?? "the owner"}. They have been signed out.`);
  };

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{business.name}</DialogTitle>
        <DialogDescription>{business.ownerUsername ? `Username ${business.ownerUsername} · ` : ""}{business.users} user{business.users === 1 ? "" : "s"} · {formatBytes(business.storageBytes)} stored</DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="grid gap-0.5">
            <span className="text-sm font-medium">Subscription</span>
            <span className="text-xs text-muted-foreground">{business.state === "cancelled" ? "Cancelled. Nobody in this business can sign in." : business.expiresAt ? `${business.state === "expired" ? "Ended" : "Ends"} ${day(business.expiresAt)}` : "No end date"}</span>
          </div>
          <StateBadge state={business.state} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onRenew}><RefreshCwIcon />Renew</Button>
          {business.state !== "cancelled" && <Button type="button" variant="destructive" onClick={onCancel}><BanIcon />Cancel subscription</Button>}
        </div>
      </div>

      <form onSubmit={save} className="grid gap-4">
        <div className="grid gap-1.5"><Label htmlFor="m-plan">Package</Label><PlanSelect id="m-plan" plans={plans} value={plan} onChange={setPlan} /></div>
        <div className="grid gap-1.5"><Label htmlFor="m-email">Email</Label><Input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="off" /></div>
        <div className="grid gap-1.5"><Label htmlFor="m-phone">Phone</Label><PhoneInput id="m-phone" value={phone} onChange={setPhone} />{!isPhoneOk(phone) && <p role="alert" className="text-xs text-danger">That phone number doesn&apos;t look right for the chosen country.</p>}</div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button type="submit" disabled={busy || !isPhoneOk(phone)}>{busy && <Loader2Icon className="animate-spin" />}Save</Button>
        </DialogFooter>
      </form>
      <Separator />
      <div className="grid gap-2">
        <PasswordField id="m-pass" label="Set a new password for the owner" value={newPassword} onChange={setNewPassword} />
        <p className="text-xs text-muted-foreground">Passwords can be replaced here, never viewed. The owner is signed out and uses the new one.</p>
        <Button type="button" variant="outline" className="justify-self-start" disabled={resetting || newPassword.length < 8} onClick={reset}>{resetting && <Loader2Icon className="animate-spin" />}Set password</Button>
      </div>
    </div>
  );
}

function RenewForm({ business, onClose, onDone }: { business: Business; onClose: () => void; onDone: () => void }) {
  const [term, setTerm] = useState("1");
  const [busy, setBusy] = useState(false);
  const months = Number(term);
  // Mirrors the server: an active subscription is extended from its end date, anything else starts today.
  const from = business.state === "active" && business.expiresAt && new Date(business.expiresAt) > new Date() ? new Date(business.expiresAt) : new Date();
  const until = new Date(from);
  until.setMonth(until.getMonth() + months);

  const renew = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await call(`businesses/${business.id}/renew`, { method: "POST", body: JSON.stringify({ months }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return void toast.error("Couldn't renew the subscription.");
    toast.success(`${business.name} is renewed until ${day((await res.json()).expiresAt)}`);
    onDone();
  };

  return (
    <form onSubmit={renew} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Renew {business.name}</DialogTitle>
        <DialogDescription>{business.state === "active" ? "Adds time to the current term." : "Switches the subscription back on, counting from today."} Everyone in the business can sign in again.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5"><Label htmlFor="r-term">Renew for</Label><TermSelect id="r-term" value={term} onChange={setTerm} /></div>
      <p className="text-sm text-muted-foreground">New end date: <span className="font-medium text-foreground">{day(until.toISOString())}</span></p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy && <Loader2Icon className="animate-spin" />}Renew subscription</Button>
      </DialogFooter>
    </form>
  );
}

function CancelDialog({ business, onClose, onDone }: { business: Business | null; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    if (!business) return;
    setBusy(true);
    const res = await call(`businesses/${business.id}/cancel`, { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return void toast.error("Couldn't cancel the subscription.");
    toast.success(`${business.name}'s subscription is cancelled`);
    onDone();
  };
  return (
    <AlertDialog open={business !== null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {business?.name}&apos;s subscription?</AlertDialogTitle>
          <AlertDialogDescription>Everyone in this business is signed out now and cannot sign in until you renew. Their data is kept.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep subscription</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={(e) => { e.preventDefault(); void cancel(); }}>{busy && <Loader2Icon className="animate-spin" />}Cancel subscription</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteDialog({ business, onClose, onDone }: { business: Business | null; onClose: () => void; onDone: () => void }) {
  return (
    <AlertDialog open={business !== null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>{business && <DeleteBody key={business.id} business={business} onClose={onClose} onDone={onDone} />}</AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteBody({ business, onDone }: { business: Business; onClose: () => void; onDone: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const expected = business.ownerUsername ?? "";
  const ok = expected !== "" && typed.trim().toLowerCase() === expected.toLowerCase();

  const remove = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await call(`businesses/${business.id}`, { method: "DELETE", body: JSON.stringify({ confirmUsername: typed }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return void toast.error("Couldn't delete. Check the username.");
    toast.success(`${business.name} deleted`);
    onDone();
  };

  return (
    <form onSubmit={remove} className="grid gap-4">
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {business.name}?</AlertDialogTitle>
        <AlertDialogDescription>
          This permanently deletes the business, every user it created and all of its records. It can&apos;t be undone.
          {expected ? <> Type <strong className="font-semibold text-foreground">{expected}</strong> to confirm.</> : " This business has no owner username, so it can't be deleted from here."}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="del-confirm">Business username</Label>
        <Input id="del-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus disabled={!expected} />
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
        <Button type="submit" variant="destructive" disabled={!ok || busy}>{busy && <Loader2Icon className="animate-spin" />}Delete business</Button>
      </AlertDialogFooter>
    </form>
  );
}
