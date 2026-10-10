"use client";

import { useState, type FormEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BanIcon, Building2Icon, EyeIcon, EyeOffIcon, Loader2Icon, PlusIcon, RefreshCwIcon, SettingsIcon, Trash2Icon } from "lucide-react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { toast } from "@/lib/toast";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag, isPhoneOk, PhoneInput } from "@/components/shared/PhoneInput";
import { DataTable, RowActions, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, useUrlFilters, type FilterDef } from "@/components/shared/FilterBar";
import { decodeRange } from "@/components/shared/FilterBar/useUrlFilters";
import { Switch } from "@/components/ui/switch";
import { AdminHeader, useAdmin } from "./AdminShell";
import { call, day, formatBytes, STATE_LABEL, type Business, type ModuleDef, type Plan } from "./api";
import { inRange, sortAndPage, StateBadge } from "./parts";
import { ActivateForm, CancelDialog, planText } from "./SubscriptionDialogs";

function PlanSelect({ id, plans, value, onChange }: { id: string; plans: Plan[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label="Package" className="w-full"><SelectValue placeholder="Choose a package" /></SelectTrigger>
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

/** One switch per module the package includes. */
function ModulePicker({ modules, value, onChange, disabled }: { modules: ModuleDef[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <fieldset className="grid gap-2 disabled:opacity-50" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">Modules in use</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {modules.map((m) => (
          <label key={m.id} htmlFor={`mod-${m.id}`} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2">
            <span className="truncate text-sm font-medium">{m.label}</span>
            <Switch id={`mod-${m.id}`} checked={value.includes(m.id)} onCheckedChange={(on) => onChange(on ? [...value, m.id] : value.filter((x) => x !== m.id))} />
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Only the modules in the package can be switched on. Switched-off modules are hidden and blocked. Dashboard, products, contacts and settings are always included.</p>
    </fieldset>
  );
}

function FreeSwitch({ id, value, onChange }: { id: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="grid gap-0.5">
        <Label htmlFor={id}>Free account</Label>
        <p className="text-xs text-muted-foreground">No charge, no end date, every module, unlimited users.</p>
      </div>
      <Switch id={id} checked={value} onCheckedChange={onChange} />
    </div>
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

type Url = { plan?: string; status?: string; free?: string; joined?: string };
const URL_KEYS = ["plan", "status", "free", "joined"] as const;
const SORTS: Record<string, (b: Business) => string | number> = {
  name: (b) => b.name.toLowerCase(), code: (b) => b.code, ownerUsername: (b) => (b.ownerUsername ?? "").toLowerCase(), planLabel: (b) => b.planLabel.toLowerCase(),
  modules: (b) => b.modules.length, state: (b) => b.state, expiresAt: (b) => b.expiresAt ?? "", users: (b) => b.users, storageBytes: (b) => b.storageBytes, lastActiveAt: (b) => b.lastActiveAt ?? "",
};

export function BusinessesPage() {
  const { businesses, plans, modules, reload } = useAdmin();
  const [url, setUrl, reset] = useUrlFilters<Url>([...URL_KEYS]);
  const [query, setQuery] = useTableQuery("admin-businesses");
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState<Business | null>(null);
  const [deleting, setDeleting] = useState<Business | null>(null);
  const [activating, setActivating] = useState<Business | null>(null);
  const [cancelling, setCancelling] = useState<Business | null>(null);

  const term = query.search.trim().toLowerCase();
  const planIds = url.plan?.split(",");
  const states = url.status?.split(",");
  const joined = decodeRange(url.joined);
  const filtered = (businesses ?? []).filter((b) =>
    (!term || b.name.toLowerCase().includes(term) || (b.ownerUsername ?? "").toLowerCase().includes(term) || b.code.includes(term)) &&
    (!planIds || planIds.includes(b.plan)) && (!states || states.includes(b.state)) && (url.free !== "1" || b.free) &&
    inRange(b.createdAt, joined));
  const { sorted, page: rows } = sortAndPage(filtered, query, SORTS);

  const col = (id: string, label: string, cell: ColumnDef<Business>["cell"], meta: ColumnDef<Business>["meta"] = {}): ColumnDef<Business> => ({ id, accessorFn: SORTS[id], header: label, cell, meta: { label, ...meta } });
  const columns: ColumnDef<Business>[] = [
    col("name", "Business", ({ row }) => <span className="font-medium">{row.original.name}</span>, { csv: (b) => b.name }),
    col("code", "Business code", ({ row }) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{row.original.code}</code>),
    col("ownerUsername", "Owner username", ({ row }) => <span className="text-muted-foreground">{row.original.ownerUsername ?? "—"}</span>),
    { id: "contact", header: "Contact", enableSorting: false, accessorFn: (b) => [b.contactEmail, b.contactPhone].filter(Boolean).join(" · "), meta: { label: "Contact" }, cell: ({ row }) => <Contact email={row.original.contactEmail} phone={row.original.contactPhone} /> },
    col("planLabel", "Package", ({ row }) => <>{row.original.planLabel}{row.original.free && <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs text-success-foreground">Free</span>}</>),
    col("modules", "Modules", ({ row }) => <span className="text-muted-foreground">{row.original.modules.length}/{modules.length}</span>, { csv: (b) => b.modules.length }),
    col("state", "Subscription", ({ row }) => <StateBadge state={row.original.state} />, { csv: (b) => STATE_LABEL[b.state] }),
    col("expiresAt", "Ends", ({ row }) => <span className="whitespace-nowrap">{day(row.original.expiresAt)}</span>, { csv: (b) => day(b.expiresAt) }),
    col("users", "Users", ({ row }) => <span className="tabular-nums">{row.original.users}{row.original.maxUsers !== null ? ` / ${row.original.maxUsers}` : ""}</span>, { align: "right", csv: (b) => b.users }),
    col("storageBytes", "Storage", ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatBytes(row.original.storageBytes)}</span>, { align: "right", csv: (b) => formatBytes(b.storageBytes) }),
    col("lastActiveAt", "Last active", ({ row }) => <span className="whitespace-nowrap">{day(row.original.lastActiveAt)}</span>, { csv: (b) => day(b.lastActiveAt) }),
    {
      id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined },
      cell: ({ row }) => (
        <RowActions items={[
          { label: "Manage account", icon: SettingsIcon, onClick: () => setManaging(row.original) },
          { label: "Activate subscription", icon: RefreshCwIcon, onClick: () => setActivating(row.original) },
          { label: "Cancel subscription", icon: BanIcon, destructive: true, onClick: () => setCancelling(row.original), hidden: row.original.state === "cancelled" },
          { label: "Delete business", icon: Trash2Icon, destructive: true, onClick: () => setDeleting(row.original) },
        ]} />
      ),
    },
  ];
  const defs: FilterDef[] = [
    { key: "plan", label: "Package", type: "select", options: plans.map((p) => ({ value: p.id, label: p.label })) },
    { key: "status", label: "Subscription", type: "select", options: Object.entries(STATE_LABEL).map(([value, label]) => ({ value, label })) },
    { key: "free", label: "Free accounts", type: "toggle" },
    { key: "joined", label: "Joined", type: "daterange" },
  ];

  return (
    <>
      <AdminHeader
        title="Businesses"
        description="Each business is a separate account. You see its package, users and storage, never its data."
        actions={<Button onClick={() => setAdding(true)}><PlusIcon />Add business</Button>}
      />
      <FilterBar defs={defs} value={url} onChange={(p) => { setUrl(p); setQuery({ page: 0 }); }} onReset={() => { reset(); setQuery({ page: 0 }); }} />
      <DataTable
        tableId="admin-businesses" columns={columns} data={rows} total={sorted.length} loading={!businesses} query={query} onQueryChange={setQuery} exportName="businesses" audit={false} fill="22rem"
        exportRows={async () => sorted} getRowId={(b) => b.id}
        empty={<EmptyState icon={Building2Icon} title={businesses?.length ? "No businesses match" : "No business accounts yet"} description={businesses?.length ? "Try a different search or clear the filters." : "Add the first one to get started."} />}
      />

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">{adding && <AddForm plans={plans} onClose={() => setAdding(false)} onDone={async () => { setAdding(false); await reload(); }} />}</DialogContent>
      </Dialog>
      <Dialog open={managing !== null} onOpenChange={(o) => !o && setManaging(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">{managing && <ManageForm key={managing.id} business={managing} modules={modules} onClose={() => setManaging(null)} onDone={async () => { setManaging(null); await reload(); }} onActivate={() => { setActivating(managing); setManaging(null); }} onCancel={() => { setCancelling(managing); setManaging(null); }} />}</DialogContent>
      </Dialog>
      <Dialog open={activating !== null} onOpenChange={(o) => !o && setActivating(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">{activating && <ActivateForm key={activating.id} business={activating} plans={plans} onClose={() => setActivating(null)} onDone={async () => { setActivating(null); await reload(); }} />}</DialogContent>
      </Dialog>
      <CancelDialog business={cancelling} onClose={() => setCancelling(null)} onDone={async () => { setCancelling(null); await reload(); }} />
      <DeleteDialog business={deleting} onClose={() => setDeleting(null)} onDone={async () => { setDeleting(null); await reload(); }} />
    </>
  );
}

function AddForm({ plans, onClose, onDone }: { plans: Plan[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState(plans.find((p) => p.id === "standard")?.id ?? plans[0]?.id ?? "");
  const [free, setFree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await call("businesses", { method: "POST", body: JSON.stringify({ businessName: name, username, ...(code.trim() ? { code: code.trim() } : {}), password, email, phone, plan, free }) }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      toast.success("Business account created");
      return onDone();
    }
    const body = await res?.json().catch(() => null);
    setError(body?.reason === "code_taken" ? "That business code is already used by another business." : body?.reason === "username_taken" ? "That owner username is already used by another business." : "Check the details: the username needs 3+ letters or digits and the password at least 8 characters.");
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Add business</DialogTitle>
        <DialogDescription>Creates the account and the sign-in its owner will use. Share the username and password with them.</DialogDescription>
      </DialogHeader>
      {error && <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-foreground">{error}</div>}
      <div className="grid gap-1.5"><Label htmlFor="b-name">Business name</Label><Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} autoFocus /></div>
      <div className="grid gap-1.5"><Label htmlFor="b-user">Owner username</Label><Input id="b-user" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={40} pattern="[a-zA-Z0-9._-]+" autoComplete="off" /><p className="text-xs text-muted-foreground">Letters, digits, dot, dash or underscore. The business signs in with this.</p></div>
      <div className="grid gap-1.5"><Label htmlFor="b-code">Business code (optional)</Label><Input id="b-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,39}" placeholder={username.trim().toLowerCase() || "same as the owner username"} autoComplete="off" /><p className="text-xs text-muted-foreground">Staff type this at sign-in, so the same staff username can exist in many businesses. Leave empty to use the owner username.</p></div>
      <PasswordField id="b-pass" label="Password" value={password} onChange={setPassword} />
      <div className="grid gap-1.5"><Label htmlFor="b-email">Email (optional)</Label><Input id="b-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="off" /></div>
      <div className="grid gap-1.5"><Label htmlFor="b-phone">Phone (optional)</Label><PhoneInput id="b-phone" value={phone} onChange={setPhone} />{!isPhoneOk(phone) && <p role="alert" className="text-xs text-danger">That phone number doesn&apos;t look right for the chosen country.</p>}</div>
      <div className="grid gap-1.5"><Label htmlFor="b-plan">Package</Label><PlanSelect id="b-plan" plans={plans} value={plan} onChange={setPlan} /></div>
      <p className="text-xs text-muted-foreground">The account is switched off until you activate its subscription, after its first payment arrives. It starts with every module its package includes.</p>
      <FreeSwitch id="b-free" value={free} onChange={setFree} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={busy || !plan || !isPhoneOk(phone)}>{busy && <Loader2Icon className="animate-spin" />}Create business</Button>
      </DialogFooter>
    </form>
  );
}

function ManageForm({ business, modules, onClose, onDone, onActivate, onCancel }: { business: Business; modules: ModuleDef[]; onClose: () => void; onDone: () => void; onActivate: () => void; onCancel: () => void }) {
  const [code, setCode] = useState(business.code);
  const [email, setEmail] = useState(business.contactEmail ?? "");
  const [phone, setPhone] = useState(business.contactPhone ?? "");
  const [picked, setPicked] = useState(business.modules);
  const [free, setFree] = useState(business.free);
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await call(`businesses/${business.id}`, { method: "PATCH", body: JSON.stringify({ ...(code.trim().toLowerCase() !== business.code ? { code: code.trim() } : {}), contactEmail: email, contactPhone: phone, modules: picked, free }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      return void toast.error(body?.reason === "code_taken" ? "That business code is already used by another business." : res?.status === 400 && code.trim() ? "Check the business code: 3 to 40 letters, digits, dot, dash or underscore." : "Couldn't save the change.");
    }
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

      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid content-start gap-4">
          <div className="grid gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="grid gap-0.5">
                <span className="text-sm font-medium">Subscription</span>
                <span className="text-xs text-muted-foreground">{business.state === "cancelled" ? "Cancelled. Nobody in this business can sign in." : business.free ? "Free account, no end date" : business.expiresAt ? `${business.state === "expired" ? "Ended" : "Ends"} ${day(business.expiresAt)}` : "No end date"}</span>
              </div>
              <StateBadge state={business.state} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" className="h-8" onClick={onActivate}><RefreshCwIcon />Activate or change package</Button>
              {business.state !== "cancelled" && <Button type="button" variant="destructive" className="h-8" onClick={onCancel}><BanIcon />Cancel subscription</Button>}
            </div>
          </div>
          <div className="grid gap-3 rounded-lg border p-3">
            <span className="text-sm font-medium">Set a new owner password</span>
            <PasswordField id="m-pass" label="New password" value={newPassword} onChange={setNewPassword} />
            <p className="text-xs text-muted-foreground">Passwords can be replaced, never viewed. The owner is signed out.</p>
            <Button type="button" variant="outline" size="sm" className="justify-self-start" disabled={resetting || newPassword.length < 8} onClick={reset}>{resetting && <Loader2Icon className="animate-spin" />}Set password</Button>
          </div>
        </div>

        <form id="manage-form" onSubmit={save} className="grid content-start gap-4">
          <div className="grid gap-1.5"><Label htmlFor="m-code">Business code</Label><Input id="m-code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={40} autoComplete="off" /><p className="text-xs text-muted-foreground">What staff type at sign-in. Changing it means staff must use the new one straight away.</p></div>
          <div className="grid gap-0.5 text-sm"><span className="font-medium">Package</span><span className="text-muted-foreground">{business.planLabel}{business.nextPlanLabel ? `, then ${business.nextPlanLabel}` : ""}. Change it with Activate or change package.</span></div>
          <FreeSwitch id="m-free" value={free} onChange={setFree} />
          <ModulePicker modules={modules.filter((m) => business.planModules.includes(m.id))} value={picked} onChange={setPicked} disabled={free} />
          <div className="grid gap-1.5"><Label htmlFor="m-email">Email</Label><Input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="off" /></div>
          <div className="grid gap-1.5"><Label htmlFor="m-phone">Phone</Label><PhoneInput id="m-phone" value={phone} onChange={setPhone} />{!isPhoneOk(phone) && <p role="alert" className="text-xs text-danger">That phone number doesn&apos;t look right for the chosen country.</p>}</div>
        </form>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        <Button type="submit" form="manage-form" disabled={busy || !isPhoneOk(phone)}>{busy && <Loader2Icon className="animate-spin" />}Save changes</Button>
      </DialogFooter>
    </div>
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
