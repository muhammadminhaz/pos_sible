"use client";

import { useState, type FormEvent } from "react";
import { BoxesIcon, CheckIcon, CreditCardIcon, Loader2Icon, PencilIcon } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CARD } from "@/components/shared/card-surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminHeader, useAdmin } from "./AdminShell";
import { call, formatMoney, type ModuleDef, type Plan } from "./api";
import { Empty } from "./parts";

export function SubscriptionsPage() {
  const { plans, modules, businesses } = useAdmin();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [pricing, setPricing] = useState<ModuleDef | null>(null);
  const list = businesses ?? [];

  return (
    <>
      <AdminHeader title="Subscriptions" description="A business pays for its package (which sets the user limit) plus each module it uses. Changes apply to every business straight away." />
      {plans.length > 0 && (
        <section aria-label="What each package includes" className="grid gap-4 md:grid-cols-3">
          {plans.map((p, i) => {
            const on = list.filter((b) => b.plan === p.id && b.state === "active").length;
            const best = i === plans.length - 2 && plans.length > 2;
            return (
              <article key={p.id} className={`${CARD} flex flex-col ${best ? "ring-2 ring-primary/50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold tracking-tight">{p.label}</h3>
                  {best && <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">Most chosen</span>}
                </div>
                <p className="mt-1 min-h-10 text-sm text-muted-foreground">{p.description || "No description yet."}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tabular-nums tracking-tight">{formatMoney(p.priceMonthly)}</span>
                  <span className="text-sm text-muted-foreground">/ month</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Modules are added on top. {on} active business{on === 1 ? "" : "es"}.</p>
                <ul className="mt-4 grid gap-2 text-sm">
                  {p.benefits.length === 0 ? <li className="text-muted-foreground">No benefits listed yet.</li> : p.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2"><CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{b}</li>
                  ))}
                </ul>
                <Button variant="outline" size="sm" className="mt-5 w-fit rounded-full self-start" onClick={() => setEditing(p)}><PencilIcon />Edit</Button>
              </article>
            );
          })}
        </section>
      )}
      <h2 className="mt-2 text-lg font-semibold tracking-tight">Packages</h2>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package</TableHead>
              <TableHead className="text-right">Users allowed</TableHead>
              <TableHead className="text-right">Price per month</TableHead>
              <TableHead className="text-right">Businesses</TableHead>
              <TableHead className="text-right">Monthly revenue</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 && <EmptyRow cols={6} icon={CreditCardIcon}>No packages yet. They are created with the database, so if this stays empty check the API&apos;s migrations ran.</EmptyRow>}
            {plans.map((p) => {
              const on = list.filter((b) => b.plan === p.id);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.maxUsers ?? "Unlimited"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(p.priceMonthly)}</TableCell>
                  <TableCell className="text-right tabular-nums">{on.length}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(on.filter((b) => b.state === "active").reduce((sum, b) => sum + b.priceMonthly, 0))}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setEditing(p)}><PencilIcon />Edit</Button></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">Modules</h2>
      <p className="-mt-3 text-sm text-muted-foreground">Optional extras a business can switch on. Each adds its price to the monthly total.</p>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead className="text-right">Adds per month</TableHead>
              <TableHead className="text-right">Businesses using it</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.length === 0 && <EmptyRow cols={4} icon={BoxesIcon}>No modules to price yet. They appear here once the API has loaded them, so try reloading the page.</EmptyRow>}
            {modules.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.label}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(m.priceMonthly)}</TableCell>
                <TableCell className="text-right tabular-nums">{list.filter((b) => b.modules.includes(m.id)).length}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setPricing(m)}><PencilIcon />Edit</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={pricing !== null} onOpenChange={(o) => !o && setPricing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">{pricing && <ModuleForm key={pricing.id} module={pricing} onClose={() => setPricing(null)} />}</DialogContent>
      </Dialog>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">{editing && <PlanForm key={editing.id} plan={editing} onClose={() => setEditing(null)} />}</DialogContent>
      </Dialog>
    </>
  );
}

/** A table with no rows says so, instead of showing only its header. */
function EmptyRow({ cols, icon, children }: { cols: number; icon: Parameters<typeof Empty>[0]["icon"]; children: React.ReactNode }) {
  return <TableRow className="hover:bg-transparent"><TableCell colSpan={cols} className="whitespace-normal text-center"><Empty icon={icon}>{children}</Empty></TableCell></TableRow>;
}

function PlanForm({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const { reload } = useAdmin();
  const [label, setLabel] = useState(plan.label);
  const [unlimited, setUnlimited] = useState(plan.maxUsers === null);
  const [max, setMax] = useState(String(plan.maxUsers ?? 10));
  const [price, setPrice] = useState(String(plan.priceMonthly));
  const [description, setDescription] = useState(plan.description);
  const [benefits, setBenefits] = useState(plan.benefits.join("\n"));
  const [busy, setBusy] = useState(false);
  const lines = benefits.split("\n").map((l) => l.trim()).filter(Boolean);
  const tooMany = lines.length > 12;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (tooMany) return;
    setBusy(true);
    const res = await call(`plans/${plan.id}`, { method: "PATCH", body: JSON.stringify({ label, maxUsers: unlimited ? null : Number(max), priceMonthly: Number(price), description: description.trim(), benefits: lines }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return void toast.error("Couldn't save the package. Check the numbers.");
    toast.success("Package updated");
    await reload();
    onClose();
  };

  return (
    <form onSubmit={save} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Edit {plan.label}</DialogTitle>
        <DialogDescription>Applies to every business on this package straight away.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5"><Label htmlFor="p-label">Name</Label><Input id="p-label" value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={40} /></div>
      <div className="grid gap-1.5"><Label htmlFor="p-price">Price per month (৳)</Label><Input id="p-price" type="number" min={0} step="1" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="p-unl">Unlimited users</Label>
        <Switch id="p-unl" checked={unlimited} onCheckedChange={setUnlimited} />
      </div>
      {!unlimited && <div className="grid gap-1.5"><Label htmlFor="p-max">Users who can sign in</Label><Input id="p-max" type="number" min={1} step="1" value={max} onChange={(e) => setMax(e.target.value)} required /></div>}
      <div className="grid gap-1.5"><Label htmlFor="p-desc">Who it is for</Label><Input id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="For a single-counter shop getting started." /></div>
      <div className="grid gap-1.5">
        <Label htmlFor="p-ben">What it includes</Label>
        <Textarea id="p-ben" rows={6} value={benefits} onChange={(e) => setBenefits(e.target.value)} aria-invalid={tooMany} aria-describedby="p-ben-hint" />
        <p id="p-ben-hint" className={tooMany ? "text-sm text-danger" : "text-xs text-muted-foreground"}>{tooMany ? "Twelve benefits at most." : "One benefit per line. These show on the package card."}</p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={busy || tooMany}>{busy && <Loader2Icon className="animate-spin" />}Save</Button>
      </DialogFooter>
    </form>
  );
}

function ModuleForm({ module, onClose }: { module: ModuleDef; onClose: () => void }) {
  const { reload } = useAdmin();
  const [price, setPrice] = useState(String(module.priceMonthly));
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await call(`modules/${module.id}`, { method: "PATCH", body: JSON.stringify({ priceMonthly: Number(price) }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return void toast.error("Couldn't save the price.");
    toast.success("Module price updated");
    await reload();
    onClose();
  };

  return (
    <form onSubmit={save} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{module.label}</DialogTitle>
        <DialogDescription>Added to the package price of every business that has this module.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5"><Label htmlFor="mod-price">Price per month (৳)</Label><Input id="mod-price" type="number" min={0} step="1" value={price} onChange={(e) => setPrice(e.target.value)} required autoFocus /></div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy && <Loader2Icon className="animate-spin" />}Save</Button>
      </DialogFooter>
    </form>
  );
}
