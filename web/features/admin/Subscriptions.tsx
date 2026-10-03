"use client";

import { useState, type FormEvent } from "react";
import { Loader2Icon, PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminHeader, useAdmin } from "./AdminShell";
import { call, formatMoney, type ModuleDef, type Plan } from "./api";

export function SubscriptionsPage() {
  const { plans, modules, businesses } = useAdmin();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [pricing, setPricing] = useState<ModuleDef | null>(null);
  const list = businesses ?? [];

  return (
    <>
      <AdminHeader title="Subscriptions" description="A business pays for its package (which sets the user limit) plus each module it uses. Changes apply to every business straight away." />
      <div className="overflow-x-auto rounded-xl border bg-card">
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
      <div className="overflow-x-auto rounded-xl border bg-card">
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

function PlanForm({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const { reload } = useAdmin();
  const [label, setLabel] = useState(plan.label);
  const [unlimited, setUnlimited] = useState(plan.maxUsers === null);
  const [max, setMax] = useState(String(plan.maxUsers ?? 10));
  const [price, setPrice] = useState(String(plan.priceMonthly));
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await call(`plans/${plan.id}`, { method: "PATCH", body: JSON.stringify({ label, maxUsers: unlimited ? null : Number(max), priceMonthly: Number(price) }) }).catch(() => null);
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
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy && <Loader2Icon className="animate-spin" />}Save</Button>
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
