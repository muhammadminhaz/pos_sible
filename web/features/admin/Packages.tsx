"use client";

import { useState, type FormEvent } from "react";
import { Loader2Icon, PackageIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "@/lib/toast";
import { DataTable, RowActions, useTableQuery } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AdminHeader, useAdmin } from "./AdminShell";
import { call, formatMoney, priceText, termText, type ModuleDef, type PeriodUnit, type Plan } from "./api";
import { CurrencyPicker, sortAndPage } from "./parts";

type Row = Plan & { businesses: number };
const SORTS: Record<string, (p: Row) => string | number> = {
  label: (p) => p.label.toLowerCase(), price: (p) => p.price, maxUsers: (p) => p.maxUsers ?? Infinity, modules: (p) => p.modules.length, businesses: (p) => p.businesses,
};

export function PackagesPage() {
  const { plans, businesses, reload } = useAdmin();
  const [query, setQuery] = useTableQuery("admin-packages");
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [removing, setRemoving] = useState<Plan | null>(null);

  const rows: Row[] = plans.map((p) => ({ ...p, businesses: (businesses ?? []).filter((b) => b.plan === p.id).length }));
  const term = query.search.trim().toLowerCase();
  const filtered = rows.filter((p) => !term || p.label.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));
  const { sorted, page } = sortAndPage(filtered, query, SORTS);

  const col = (id: string, label: string, cell: ColumnDef<Row>["cell"], meta: ColumnDef<Row>["meta"] = {}): ColumnDef<Row> => ({ id, accessorFn: SORTS[id], header: label, cell, meta: { label, ...meta } });
  const columns: ColumnDef<Row>[] = [
    col("label", "Package", ({ row }) => (
      <div className="grid gap-0.5"><span className="font-medium">{row.original.label}</span>{row.original.description && <span className="max-w-72 truncate text-xs text-muted-foreground">{row.original.description}</span>}</div>
    ), { csv: (p) => p.label }),
    col("price", "Price", ({ row }) => <span className="whitespace-nowrap tabular-nums">{priceText(row.original)}</span>, { align: "right", csv: (p) => priceText(p) }),
    col("maxUsers", "Users", ({ row }) => <span className="tabular-nums">{row.original.maxUsers ?? "Unlimited"}</span>, { align: "right", csv: (p) => p.maxUsers ?? "Unlimited" }),
    col("modules", "Modules", ({ row }) => <span className="tabular-nums">{row.original.modules.length}</span>, { align: "right", csv: (p) => p.modules.length }),
    col("businesses", "Businesses", ({ row }) => <span className="tabular-nums">{row.original.businesses}</span>, { align: "right" }),
    {
      id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10", csv: () => undefined },
      cell: ({ row }) => (
        <RowActions items={[
          { label: "Edit package", icon: PencilIcon, onClick: () => setEditing(row.original) },
          { label: "Delete package", icon: Trash2Icon, destructive: true, onClick: () => setRemoving(row.original) },
        ]} />
      ),
    },
  ];

  const done = async (close: () => void) => { close(); await reload(); };

  return (
    <>
      <AdminHeader
        title="Packages"
        description="A package says how long a term lasts, what it costs, which modules a business can use and how many users it can have."
        actions={<Button onClick={() => setEditing("new")}><PlusIcon />New package</Button>}
      />
      <div className="flex justify-end"><CurrencyPicker /></div>
      <DataTable
        tableId="admin-packages" columns={columns} data={page} total={sorted.length} loading={!businesses} query={query} onQueryChange={setQuery} exportName="packages" audit={false} fill="22rem"
        exportRows={async () => sorted} getRowId={(p) => p.id}
        empty={<EmptyState icon={PackageIcon} title={plans.length ? "No packages match" : "No packages yet"} description={plans.length ? "Try a different search." : "Create one to start selling subscriptions."} />}
      />

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">{editing && <PlanForm key={editing === "new" ? "new" : editing.id} plan={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}</DialogContent>
      </Dialog>
      <RemovePlan plan={removing} onClose={() => setRemoving(null)} onDone={() => done(() => setRemoving(null))} />
    </>
  );
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
