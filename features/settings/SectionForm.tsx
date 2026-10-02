"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSettings, useUpdateSettings } from "@/lib/data/hooks/settings";
import { settings as settingsSchema, type Settings } from "@/lib/data/schemas";
import { ShortcutEditor, shortcutConflicts } from "./ShortcutEditor";

type Path = (string | number)[];

const humanize = (k: string) => k.replace(/([A-Z0-9])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
const secret = /password|secret|token/i;

/** Strips Default / Nullable / Optional wrappers; reports whether null is allowed. */
function unwrap(s: z.ZodTypeAny): { inner: z.ZodTypeAny; nullable: boolean } {
  let nullable = false;
  let cur = s;
  for (;;) {
    const tn = cur._def.typeName;
    if (tn === "ZodNullable") nullable = true;
    if (tn === "ZodDefault" || tn === "ZodNullable" || tn === "ZodOptional") cur = cur._def.innerType;
    else return { inner: cur, nullable };
  }
}

function getAt(v: unknown, path: Path): unknown {
  return path.reduce<unknown>((o, k) => (o as Record<string | number, unknown>)?.[k], v);
}
function setAt<T>(v: T, path: Path, value: unknown): T {
  if (!path.length) return value as T;
  const [k, ...rest] = path;
  const copy = (Array.isArray(v) ? [...v] : { ...(v as object) }) as Record<string | number, unknown>;
  copy[k] = setAt(copy[k], rest, value);
  return copy as T;
}

type Ctx = {
  section: string;
  draft: unknown;
  set: (p: Path, v: unknown) => void;
  options?: Record<string, { value: string; label: string }[]>;
  errors: Record<string, string>;
};

function useLabel(section: string) {
  const t = useTranslations("settings");
  return (path: Path) => {
    const key = path.filter((p) => typeof p === "string").join(".");
    const k = `fields.${section}.${key}`;
    return t.has(k) ? t(k) : humanize(String(path.filter((p) => typeof p === "string").at(-1) ?? ""));
  };
}

function Field({ schema, path, ctx }: { schema: z.ZodTypeAny; path: Path; ctx: Ctx }) {
  const t = useTranslations();
  const label = useLabel(ctx.section)(path);
  const id = `s-${ctx.section}-${path.join("-")}`;
  const { inner, nullable } = unwrap(schema);
  const value = getAt(ctx.draft, path);
  const set = (v: unknown) => ctx.set(path, v);
  const key = path.join(".");
  const err = ctx.errors[key];
  const tn = inner._def.typeName as string;
  const last = String(path.at(-1));

  if (tn === "ZodObject") {
    if (key === "shortcuts" && ctx.section === "pos") return <ShortcutEditor value={value as Record<string, string>} onChange={set} />;
    return (
      <fieldset className="col-span-full rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">{label}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries((inner as z.ZodObject<z.ZodRawShape>).shape).map(([k, s]) => (
            <Field key={k} schema={s} path={[...path, k]} ctx={ctx} />
          ))}
        </div>
      </fieldset>
    );
  }
  if (tn === "ZodBoolean")
    return (
      <div className="flex items-center gap-2 sm:col-span-1">
        <Switch id={id} checked={!!value} onCheckedChange={set} />
        <Label htmlFor={id}>{label}</Label>
      </div>
    );
  if (tn === "ZodString" && ctx.options?.[key]) {
    const opts = ctx.options[key];
    return (
      <div className="grid content-start gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Select value={(value as string | null) ?? "__none__"} onValueChange={(v) => set(v === "__none__" ? null : v)}>
          <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {nullable && <SelectItem value="__none__">—</SelectItem>}
            {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (tn === "ZodEnum" || tn === "ZodLiteral") {
    const opts = ctx.options?.[key] ?? (tn === "ZodEnum" ? (inner._def.values as string[]) : [String(inner._def.value)]).map((v) => ({ value: v, label: humanize(v.replace(/_/g, " ")) }));
    return (
      <div className="grid content-start gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Select value={String(value ?? "")} onValueChange={set}>
          <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    );
  }
  if (tn === "ZodNumber")
    return (
      <div className="grid content-start gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id} type="number" step="any" className="tabular-nums" value={value == null ? "" : String(value)} aria-invalid={!!err}
          onChange={(e) => set(e.target.value === "" ? (nullable ? null : 0) : Number(e.target.value))}
        />
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
    );
  if (tn === "ZodString")
    return (
      <div className="grid content-start gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id} type={secret.test(last) ? "password" : "text"} autoComplete="off" value={(value as string | null) ?? ""} aria-invalid={!!err}
          onChange={(e) => set(nullable && e.target.value === "" ? null : e.target.value)}
        />
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
    );
  if (tn === "ZodArray") {
    const el = unwrap((inner as z.ZodArray<z.ZodTypeAny>).element);
    const arr = (value as unknown[]) ?? [];
    const fixed = inner._def.exactLength?.value as number | undefined;
    const et = el.inner._def.typeName as string;
    if (et === "ZodEnum")
      return (
        <fieldset className="col-span-full grid gap-2">
          <legend className="mb-1 text-sm font-medium">{label}</legend>
          <div className="flex flex-wrap gap-4">
            {(el.inner._def.values as string[]).map((v) => (
              <Label key={v} className="gap-2 font-normal">
                <Checkbox checked={arr.includes(v)} onCheckedChange={(c) => set(c ? [...arr, v] : arr.filter((x) => x !== v))} />
                {t.has(`payMethods.${v}`) ? t(`payMethods.${v}`) : humanize(v)}
              </Label>
            ))}
          </div>
        </fieldset>
      );
    if (et === "ZodObject")
      return (
        <fieldset className="col-span-full grid gap-2">
          <legend className="mb-1 text-sm font-medium">{label}</legend>
          {arr.map((row, i) => (
            <div key={i} className="flex gap-2">
              {Object.keys((el.inner as z.ZodObject<z.ZodRawShape>).shape).map((k) => (
                <Input key={k} aria-label={`${label} ${k}`} placeholder={humanize(k)} value={(row as Record<string, string>)[k]} onChange={(e) => set(setAt(arr, [i, k], e.target.value))} />
              ))}
              <Button type="button" variant="ghost" size="icon" aria-label={t("common.remove")} onClick={() => set(arr.filter((_, j) => j !== i))}><XIcon /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" className="w-fit" onClick={() => set([...arr, { key: "", value: "" }])}><PlusIcon />{t("common.add")}</Button>
        </fieldset>
      );
    if (et === "ZodNumber")
      return (
        <div className="col-span-full grid gap-2">
          <Label htmlFor={id}>{label}</Label>
          <Input id={id} className="tabular-nums" value={arr.join(", ")} onChange={(e) => set(e.target.value.split(",").map((x) => Number(x.trim())).filter((n) => e.target.value.trim() && !Number.isNaN(n)))} />
        </div>
      );
    // Fixed-length string lists (custom labels): one input per slot.
    return (
      <fieldset className="rounded-lg border p-3 sm:col-span-1">
        <legend className="px-1 text-sm font-medium">{label}</legend>
        <div className="grid gap-2">
          {Array.from({ length: fixed ?? arr.length }, (_, i) => (
            <Input key={i} aria-label={`${label} ${i + 1}`} placeholder={`${i + 1}`} value={(arr[i] as string) ?? ""} onChange={(e) => set(setAt(arr, [i], e.target.value))} />
          ))}
        </div>
      </fieldset>
    );
  }
  return null;
}

/** One Business Settings tab: the section's zod schema decides which inputs appear. */
export function SectionForm({
  section, options, extra, hidden = [],
}: {
  section: keyof Settings;
  options?: Ctx["options"];
  extra?: (draft: Settings[keyof Settings]) => ReactNode;
  /** Keys inside the section that have their own UI elsewhere. */
  hidden?: string[];
}) {
  const t = useTranslations();
  const { data } = useSettings();
  const update = useUpdateSettings(section);
  const schema = settingsSchema.shape[section] as z.ZodObject<z.ZodRawShape>;
  const [draft, setDraft] = useState<Settings[keyof Settings] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!data) return null;
  const value = draft ?? data[section];
  const dirty = draft !== null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), t("errors.required")])));
      toast.error(t("settings.fixErrors"));
      return;
    }
    if (section === "pos" && shortcutConflicts((parsed.data as Settings["pos"]).shortcuts).size) {
      toast.error(t("settings.shortcutConflict"));
      return;
    }
    setErrors({});
    await update.mutateAsync(parsed.data as never);
    setDraft(null);
    toast.success(t("common.saved"));
  };

  const ctx: Ctx = { section, draft: value, set: (p, v) => setDraft(setAt(value, p, v)), options, errors };
  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(schema.shape).filter(([k]) => !hidden.includes(k)).map(([k, s]) => <Field key={k} schema={s} path={[k]} ctx={ctx} />)}
      </div>
      {extra?.(value)}
      <div className="flex gap-2">
        <Button type="submit" disabled={!dirty || update.isPending}>{t("common.saveChanges")}</Button>
        {dirty && <Button type="button" variant="outline" onClick={() => { setDraft(null); setErrors({}); }}>{t("common.reset")}</Button>}
      </div>
    </form>
  );
}
