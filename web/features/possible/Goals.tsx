"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { CoinsIcon, EllipsisIcon, PencilIcon, PiggyBankIcon, PlusIcon, ReceiptIcon, RefreshCwIcon, ShoppingCartIcon, TargetIcon, Trash2Icon, TrendingUpIcon, TriangleAlertIcon, UserPlusIcon, UsersIcon, WalletIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { CARD } from "@/components/shared/card-surface";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RubberSegment from "@/components/ui/rubber-segment";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_METRICS, GOAL_PERIODS, type GoalMetric, type GoalPeriod } from "@/lib/data/schemas";
import { goalsService, type GoalInput, type GoalProgress } from "@/lib/data/services/reports/possible";
import { useFormat } from "@/lib/i18n/format";
import { toast } from "@/lib/toast";
import { useCountUp } from "@/lib/useCountUp";

const ICON: Record<GoalMetric, LucideIcon> = {
  sales: CoinsIcon, grossProfit: TrendingUpIcon, netProfit: PiggyBankIcon, orders: ShoppingCartIcon, aov: ReceiptIcon, newCustomers: UserPlusIcon, activeCustomers: UsersIcon, expenses: WalletIcon,
};
const IS_MONEY = (m: GoalMetric) => m !== "orders" && m !== "newCustomers" && m !== "activeCustomers";
/** Only totals that build up day by day can be turned into "how much per day from here". */
const PER_DAY = new Set<GoalMetric>(["sales", "grossProfit", "netProfit", "orders"]);
const NO_PROJECTION = new Set<GoalMetric>(["aov", "activeCustomers"]);
const STARTERS: { metric: GoalMetric; key: "sales" | "newCustomers" | "expenses" }[] = [
  { metric: "sales", key: "sales" }, { metric: "newCustomers", key: "newCustomers" }, { metric: "expenses", key: "expenses" },
];

function useAmount() {
  const f = useFormat();
  return (m: GoalMetric, n: number) => (IS_MONEY(m) ? f.money(n) : f.number(n));
}

// ── Goal card ───────────────────────────────────────────────────────────

const TONE: Record<GoalProgress["status"], string> = {
  achieved: "bg-primary text-primary-foreground",
  ahead: "bg-success-soft text-success-foreground",
  behind: "bg-warning-soft text-warning-foreground",
  over: "bg-danger-soft text-danger-foreground",
};

function GoalCard({ g, onEdit, onDelete }: { g: GoalProgress; onEdit: () => void; onDelete: () => void }) {
  const t = useTranslations("possible");
  const tc = useTranslations("common");
  const amount = useAmount();
  const reduced = useReducedMotion();
  const Icon = ICON[g.metric];
  const ceiling = g.metric === "expenses";
  const shown = useCountUp(g.value) ?? g.value;
  const pct = Math.min(100, Math.round((g.value / g.target) * 100));
  const label = ceiling ? t(`ceilingStatus.${g.status === "achieved" ? "ahead" : g.status}`) : t(`status.${g.status}`);

  let guide: string | null = null;
  if (g.status === "achieved") guide = t("reached", { days: g.daysLeft });
  else if (ceiling) guide = g.status === "over" ? null : t("leftToSpend", { amount: amount(g.metric, g.target - g.value) });
  else if (g.status === "behind" && PER_DAY.has(g.metric) && g.daysLeft > 0) guide = t("needPerDay", { amount: amount(g.metric, Math.ceil((g.target - g.value) / g.daysLeft)) });
  else if (!NO_PROJECTION.has(g.metric)) guide = t("projection", { amount: amount(g.metric, g.projected) });

  return (
    <article className={cn(CARD, "flex flex-col", g.status === "achieved" && "ring-2 ring-primary/50")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden /></span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{t(`metric.${g.metric}`)}</h3>
            <p className="truncate text-xs text-muted-foreground">{t(`period.${g.period}`)}{g.note && ` · ${g.note}`}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-2 shrink-0 rounded-full" aria-label={t("actions")}><EllipsisIcon aria-hidden /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}><PencilIcon aria-hidden />{t("editGoal")}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2Icon aria-hidden />{tc("remove")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cn("text-3xl leading-tight font-semibold tabular tracking-tight", g.status === "over" && "text-danger")}>{amount(g.metric, g.metric === "aov" ? g.value : shown)}</span>
        <span className="text-sm text-muted-foreground">{ceiling ? t("limit", { target: amount(g.metric, g.target) }) : t("of", { target: amount(g.metric, g.target) })}</span>
      </div>

      <div className="relative mt-4" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t("progressLabel", { pct })}>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <motion.div
            className={cn("h-full origin-left rounded-full", g.status === "over" ? "bg-danger" : "bg-primary")}
            style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
            initial={reduced ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          />
        </div>
        {g.status !== "achieved" && (
          <span className="absolute -top-1 h-5 w-0.5 -translate-x-1/2 rounded-full bg-foreground/70" style={{ left: `${g.elapsed}%` }} title={t("paceMarker")} aria-hidden />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <motion.span
          className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", TONE[g.status])}
          initial={reduced || g.status !== "achieved" ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 18 }}
        >
          {label}
        </motion.span>
        {guide && <span className="text-sm text-muted-foreground">{guide}</span>}
      </div>
      <p className="mt-auto pt-4 text-xs text-muted-foreground">{t("previous", { period: t(`periodWord.${g.period}`), amount: amount(g.metric, g.previous) })}</p>
    </article>
  );
}

// ── Create / edit dialog ────────────────────────────────────────────────

type Draft = { id?: string; metric: GoalMetric; period: GoalPeriod; target: string; note: string };

/** Remounts per goal, so the form always starts from the draft it was opened with. */
function GoalDialog({ draft, onClose, onSave, saving }: { draft: Draft | null; onClose: () => void; onSave: (g: GoalInput) => void; saving: boolean }) {
  return draft ? <GoalForm key={`${draft.id ?? "new"}:${draft.metric}`} draft={draft} onClose={onClose} onSave={onSave} saving={saving} /> : null;
}

function GoalForm({ draft, onClose, onSave, saving }: { draft: Draft; onClose: () => void; onSave: (g: GoalInput) => void; saving: boolean }) {
  const t = useTranslations("possible");
  const amount = useAmount();
  const [form, setForm] = useState<Draft>(draft);
  const [touched, setTouched] = useState(false);
  const base = useQuery({
    queryKey: ["transactions", "goals", "baseline", form.metric, form.period],
    queryFn: () => goalsService.baseline(form.metric, form.period),
    placeholderData: keepPreviousData,
  });

  const set = (patch: Partial<Draft>) => setForm({ ...form, ...patch });
  const target = Number(form.target.replace(/,/g, ""));
  const valid = Number.isFinite(target) && target > 0;
  const ceiling = form.metric === "expenses";
  const last = base.data ?? 0;
  const picks = (ceiling ? [1, 0.9, 0.8] : [1, 1.1, 1.25]).filter(() => last > 0);
  const period = t(`periodWord.${form.period}`);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{form.id ? t("editGoal") : t("newGoal")}</DialogTitle>
          <DialogDescription>{t("goalsDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (valid) onSave({ id: form.id, metric: form.metric, period: form.period, target, note: form.note.trim() });
          }}
        >
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t("form.what")}</legend>
            <div role="radiogroup" aria-label={t("form.what")} className="grid grid-cols-2 gap-2">
              {GOAL_METRICS.map((m) => {
                const Icon = ICON[m];
                const on = form.metric === m;
                return (
                  <button key={m} type="button" role="radio" aria-checked={on} onClick={() => set({ metric: m })}
                    className={cn("flex min-w-0 items-start gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none", on ? "border-primary bg-primary/10" : "hover:bg-muted")}>
                    <Icon className={cn("mt-0.5 size-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{t(`metric.${m}`)}</span>
                      <span className="block text-xs text-pretty text-muted-foreground">{t(`metricHint.${m}`)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-2">
            <Label>{t("form.when")}</Label>
            <RubberSegment
              aria-label={t("form.when")} size="md" className="w-full"
              items={GOAL_PERIODS.map((p) => ({ value: p, label: t(`period.${p}`) }))}
              value={form.period} onChange={(v) => set({ period: v as GoalPeriod })}
              trackColor="var(--muted)" thumbColor="var(--primary)" textColor="var(--muted-foreground)" activeTextColor="var(--primary-foreground)"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="goal-target">{t("form.target")}</Label>
            <Input id="goal-target" inputMode="decimal" autoComplete="off" value={form.target} onChange={(e) => set({ target: e.target.value })}
              aria-invalid={touched && !valid} aria-describedby="goal-target-hint" className="h-11 text-lg tabular" />
            {touched && !valid && <p className="text-sm text-danger" role="alert">{t("targetError")}</p>}
            <p id="goal-target-hint" className="text-xs text-muted-foreground">{last > 0 ? t(ceiling ? "form.targetHintCeiling" : "form.targetHint", { period, amount: amount(form.metric, last) }) : " "}</p>
            {picks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("form.picks")}>
                {picks.map((m) => (
                  <Button key={m} type="button" size="sm" variant="outline" className="rounded-full tabular" onClick={() => set({ target: String(Math.round(last * m)) })}>
                    {m === 1 ? t("form.same", { period }) : t(m > 1 ? "form.plus" : "form.minus", { pct: Math.round(Math.abs(m - 1) * 100) })}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="goal-note">{t("form.note")}</Label>
            <Input id="goal-note" maxLength={80} value={form.note} onChange={(e) => set({ note: e.target.value })} placeholder={t("form.notePlaceholder")} />
          </div>

          <DialogFooter>
            <Button type="submit" className="rounded-full" disabled={saving}>{form.id ? t("form.save") : t("form.create")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

/** Say "possible unlocked" once per goal per period, not on every visit. */
function useCelebrate(goals: GoalProgress[] | undefined) {
  const t = useTranslations("possible");
  useEffect(() => {
    for (const g of goals ?? []) {
      if (g.status !== "achieved") continue;
      const key = `posible:goal-won:${g.id}:${g.from}`;
      try {
        if (localStorage.getItem(key)) continue;
        localStorage.setItem(key, "1");
      } catch { /* storage blocked: skip the toast rather than repeat it */ continue; }
      toast.success(t("celebrate", { metric: t(`metric.${g.metric}`) }));
    }
  }, [goals, t]);
}

export function Goals() {
  const t = useTranslations("possible");
  const tc = useTranslations();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["transactions", "goals"], queryFn: () => goalsService.list(), placeholderData: keepPreviousData });
  const goals = q.data;
  useCelebrate(goals);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<GoalProgress | null>(null);
  const done = () => qc.invalidateQueries({ queryKey: ["transactions"] });
  const save = useMutation({
    mutationFn: goalsService.save,
    onSuccess: (_id, input) => { done(); setDraft(null); toast.success(input.id ? t("saved") : t("created")); },
    onError: () => toast.error(tc("errors.generic")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => goalsService.remove(id),
    onSuccess: () => { done(); setRemoving(null); toast(t("deleted")); },
    onError: () => toast.error(tc("errors.generic")),
  });

  const start = (metric: GoalMetric = "sales"): Draft => ({ metric, period: "month", target: "", note: "" });
  const edit = (g: GoalProgress): Draft => ({ id: g.id, metric: g.metric, period: g.period, target: String(g.target), note: g.note });

  return (
    <>
      <PageHeader title={t("goalsTitle")} description={t("goalsDescription")}
        actions={<Button className="rounded-full" onClick={() => setDraft(start())}><PlusIcon aria-hidden />{t("newGoal")}</Button>} />
      {q.isError && !goals ? (
        <div className={CARD}>
          <EmptyState icon={TriangleAlertIcon} title={t("goalsErrorTitle")} description={t("errorHint")}
            action={<Button variant="outline" className="rounded-full" onClick={() => q.refetch()}><RefreshCwIcon aria-hidden />{tc("common.tryAgain")}</Button>} />
        </div>
      ) : !goals ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy>
          {[0, 1].map((i) => <Skeleton key={i} className="h-64 rounded-3xl" />)}
        </div>
      ) : !goals.length ? (
        <div className={CARD}>
          <EmptyState icon={TargetIcon} title={t("goalsEmptyTitle")} description={t("goalsEmptyHint")}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <Button key={s.key} variant="outline" className="rounded-full" onClick={() => setDraft(start(s.metric))}>{t(`starters.${s.key}`)}</Button>
                ))}
              </div>
            } />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => <GoalCard key={g.id} g={g} onEdit={() => setDraft(edit(g))} onDelete={() => setRemoving(g)} />)}
        </div>
      )}
      <GoalDialog draft={draft} onClose={() => setDraft(null)} onSave={(g) => save.mutate(g)} saving={save.isPending} />
      <ConfirmDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} destructive
        title={t("deleteTitle")} description={t("deleteBody")} confirmLabel={tc("common.remove")} cancelLabel={tc("common.cancel")}
        onConfirm={() => removing && remove.mutateAsync(removing.id)} />
    </>
  );
}
