"use client";

import { useState, type FormEvent } from "react";
import { BanIcon, CreditCardIcon, Loader2Icon, MoreHorizontalIcon, PackageIcon, PencilIcon, PlusIcon, ReceiptIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { toast } from "@/lib/toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AdminHeader, useAdmin } from "./AdminShell";
import GlideSelect from "@/components/ui/glide-select";
import { currencyOptions } from "@/lib/i18n/currencies";
import { call, day, formatMoney, priceText, termText, type Business, type ModuleDef, type PeriodUnit, type Plan } from "./api";
import { Empty, Pager, StateBadge, usePaged } from "./parts";
import { ActivateForm, CancelDialog, PaymentsDialog } from "./SubscriptionDialogs";

export function SubscriptionsPage() {
  const { me, plans, businesses, reload } = useAdmin();
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [removing, setRemoving] = useState<Plan | null>(null);
  const [activating, setActivating] = useState<Business | null>(null);
  const [viewing, setViewing] = useState<Business | null>(null);
  const [cancelling, setCancelling] = useState<Business | null>(null);
  const list = businesses ?? [];
  const paged = usePaged(list, "");

  const done = async (close: () => void) => { close(); await reload(); };

  return (
    <>
      <AdminHeader
        title="Subscriptions"
        description="Packages say how long a term lasts, which modules a business can use and how many users a business can have. A business only runs while you keep its subscription active."
        actions={<Button onClick={() => setEditing("new")}><PlusIcon />New package</Button>}
      />

      <h2 className="mt-2 text-lg font-semibold tracking-tight">Subscriptions</h2>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last paid</TableHead>
                <TableHead>Ends</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!businesses && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {businesses && list.length === 0 && <EmptyRow cols={7} icon={CreditCardIcon}>No businesses yet. Add one under Businesses, then activate its subscription here once it pays.</EmptyRow>}
              {paged.rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>
                    <div className="grid gap-0.5">
                      <span>{b.planLabel}{b.free && <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs text-success-foreground">Free</span>}</span>
                      {b.nextPlanLabel && <span className="text-xs text-muted-foreground">Then {b.nextPlanLabel}</span>}
                    </div>
                  </TableCell>
                  <TableCell><StateBadge state={b.state} /></TableCell>
                  <TableCell className="whitespace-nowrap">{day(b.lastPaidAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{b.free ? "Never" : day(b.expiresAt)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{b.free ? "Free" : priceText(b)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`Actions for ${b.name}`}><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-56">
                        <DropdownMenuItem onSelect={() => setActivating(b)}><RefreshCwIcon />Activate or change package</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setViewing(b)}><ReceiptIcon />Payments and proof</DropdownMenuItem>
                        {b.state !== "cancelled" && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => setCancelling(b)}><BanIcon />Cancel subscription</DropdownMenuItem></>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Pager paged={paged} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Packages</h2>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">Shows all prices and revenue in this currency. Amounts are not converted.</span>
          <GlideSelect
            field
            searchable
            size="sm"
            ariaLabel="Subscription currency"
            searchPlaceholder="Search currency"
            options={currencyOptions("en")}
            value={me.currency}
            menuWidth={320}
            align="right"
            onChange={async (currency) => {
              const res = await call("settings", { method: "PATCH", body: JSON.stringify({ currency }) }).catch(() => null);
              if (!res?.ok) return void toast.error("Couldn't change the currency. Try again.");
              await reload();
              toast.success("Currency updated");
            }}
            className="w-40"
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead className="text-right">Modules</TableHead>
              <TableHead className="text-right">Businesses</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 && <EmptyRow cols={6} icon={PackageIcon}>No packages yet. Create one to start selling subscriptions.</EmptyRow>}
            {plans.map((p) => {
              const on = list.filter((b) => b.plan === p.id).length;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="grid gap-0.5"><span className="font-medium">{p.label}</span>{p.description && <span className="max-w-72 truncate text-xs text-muted-foreground">{p.description}</span>}</div>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{priceText(p)}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.maxUsers ?? "Unlimited"}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.modules.length}</TableCell>
                  <TableCell className="text-right tabular-nums">{on}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => setEditing(p)}><PencilIcon />Edit</Button>
                    <Button size="icon-sm" variant="ghost" className="ml-1" aria-label={`Delete ${p.label}`} onClick={() => setRemoving(p)}><Trash2Icon /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">{editing && <PlanForm key={editing === "new" ? "new" : editing.id} plan={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}</DialogContent>
      </Dialog>
      <Dialog open={activating !== null} onOpenChange={(o) => !o && setActivating(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">{activating && <ActivateForm key={activating.id} business={activating} plans={plans} onClose={() => setActivating(null)} onDone={() => done(() => setActivating(null))} />}</DialogContent>
      </Dialog>
      <PaymentsDialog business={viewing} onClose={() => setViewing(null)} />
      <CancelDialog business={cancelling} onClose={() => setCancelling(null)} onDone={() => done(() => setCancelling(null))} />
      <RemovePlan plan={removing} onClose={() => setRemoving(null)} onDone={() => done(() => setRemoving(null))} />
    </>
  );
}

/** A table with no rows says so, instead of showing only its header. */
function EmptyRow({ cols, icon, children }: { cols: number; icon: Parameters<typeof Empty>[0]["icon"]; children: React.ReactNode }) {
  return <TableRow className="hover:bg-transparent"><TableCell colSpan={cols} className="whitespace-normal text-center"><Empty icon={icon}>{children}</Empty></TableCell></TableRow>;
}

const UNITS: { value: PeriodUnit; label: string }[] = [{ value: "day", label: "Days" }, { value: "week", label: "Weeks" }, { value: "month", label: "Months" }];

function PlanForm({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const { me, modules, reload } = useAdmin();
  const [label, setLabel] = useState(plan?.label ?? "");
  const [price, setPrice] = useState(String(plan?.price ?? ""));
  const [count, setCount] = useState(String(plan?.periodCount ?? 1));
  const [unit, setUnit] = useState<PeriodUnit>(plan?.periodUnit ?? "month");
  const [unlimited, setUnlimited] = useState(plan ? plan.maxUsers === null : false);
  const [max, setMax] = useState(String(plan?.maxUsers ?? 3));
  const [picked, setPicked] = useState<string[]>(plan?.modules ?? modules.map((m) => m.id));
  const [description, setDescription] = useState(plan?.description ?? "");
  const [benefits, setBenefits] = useState((plan?.benefits ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const lines = benefits.split("\n").map((l) => l.trim()).filter(Boolean);
  const tooMany = lines.length > 12;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (tooMany) return;
    setBusy(true);
    const body = JSON.stringify({ label: label.trim(), price: Number(price), periodUnit: unit, periodCount: Number(count), maxUsers: unlimited ? null : Number(max), modules: picked, description: description.trim(), benefits: lines });
    const res = await call(plan ? `plans/${plan.id}` : "plans", { method: plan ? "PATCH" : "POST", body }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return void toast.error("Couldn't save the package. Check the numbers.");
    toast.success(plan ? "Package updated" : "Package created");
    await reload();
    onClose();
  };

  return (
    <form onSubmit={save} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{plan ? `Edit ${plan.label}` : "New package"}</DialogTitle>
        <DialogDescription>{plan ? "Applies to every business on this package straight away. A new term length starts counting at the next activation." : "Choose what a business gets for one term of this package."}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5"><Label htmlFor="p-label">Name</Label><Input id="p-label" value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={40} autoFocus={!plan} /></div>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="grid gap-1.5"><Label htmlFor="p-price">Price per term ({me.currency})</Label><Input id="p-price" type="number" min={0} step="any" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
        <div className="grid gap-1.5">
          <Label htmlFor="p-count">A term lasts</Label>
          <div className="flex gap-2">
            <Input id="p-count" type="number" min={1} max={365} step={1} value={count} onChange={(e) => setCount(e.target.value)} required className="w-20" />
            <Select value={unit} onValueChange={(v) => setUnit(v as PeriodUnit)}>
              <SelectTrigger aria-label="Term unit" className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="p-unl">Unlimited users</Label>
        <Switch id="p-unl" checked={unlimited} onCheckedChange={setUnlimited} />
      </div>
      {!unlimited && <div className="grid gap-1.5"><Label htmlFor="p-max">Users a business can have</Label><Input id="p-max" type="number" min={1} step="1" value={max} onChange={(e) => setMax(e.target.value)} required /></div>}
      <ModuleChoice modules={modules} value={picked} onChange={setPicked} />
      <div className="grid gap-1.5"><Label htmlFor="p-desc">Who it is for</Label><Input id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="For a single-counter shop getting started." /></div>
      <div className="grid gap-1.5">
        <Label htmlFor="p-ben">What it includes</Label>
        <Textarea id="p-ben" rows={4} value={benefits} onChange={(e) => setBenefits(e.target.value)} aria-invalid={tooMany} aria-describedby="p-ben-hint" />
        <p id="p-ben-hint" className={tooMany ? "text-sm text-danger" : "text-xs text-muted-foreground"}>{tooMany ? "Twelve lines at most." : "One line per promise, such as support times. Only the user limit and the modules are enforced by the software."}</p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={busy || tooMany}>{busy && <Loader2Icon className="animate-spin" />}{plan ? "Save" : "Create package"}</Button>
      </DialogFooter>
    </form>
  );
}

function ModuleChoice({ modules, value, onChange }: { modules: ModuleDef[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Modules a business can use</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {modules.map((m) => (
          <label key={m.id} htmlFor={`pm-${m.id}`} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
            <span className="truncate font-medium">{m.label}</span>
            <Switch id={`pm-${m.id}`} checked={value.includes(m.id)} onCheckedChange={(on) => onChange(on ? [...value, m.id] : value.filter((x) => x !== m.id))} />
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Dashboard, products, contacts and settings are always included.</p>
    </fieldset>
  );
}

function RemovePlan({ plan, onClose, onDone }: { plan: Plan | null; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (!plan) return;
    setBusy(true);
    const res = await call(`plans/${plan.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      toast.success(`${plan.label} deleted`);
      return onDone();
    }
    const body = await res?.json().catch(() => null);
    toast.error(body?.reason === "in_use" ? "A business is on this package or scheduled to move to it. Move them first." : body?.reason === "last" ? "Keep at least one package: new businesses need one to start on." : "Couldn't delete the package.");
  };
  return (
    <AlertDialog open={plan !== null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {plan?.label}?</AlertDialogTitle>
          <AlertDialogDescription>{plan && `${termText(plan.periodUnit, plan.periodCount)} at ${formatMoney(plan.price)}.`} A package that a business is on can&apos;t be deleted. Payments already recorded keep its name.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep package</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={(e) => { e.preventDefault(); void remove(); }}>{busy && <Loader2Icon className="animate-spin" />}Delete package</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
