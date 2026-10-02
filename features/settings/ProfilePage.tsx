"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/PageHeader";
import { catalogErrorMessage } from "@/features/catalog/catalogError";
import { useCurrentUser } from "@/lib/auth/useCan";
import type { User } from "@/lib/data/schemas";
import { accountService } from "@/lib/data/services/admin";
import { useQueryClient } from "@tanstack/react-query";

function Row({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="grid content-start gap-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function useSave() {
  const t = useTranslations();
  const qc = useQueryClient();
  return async (patch: Partial<User>) => {
    try {
      await accountService.updateProfile(patch);
      await qc.invalidateQueries();
      toast.success(t("common.saved"));
    } catch (e) {
      toast.error(catalogErrorMessage(e, t));
    }
  };
}

function PasswordTab() {
  const t = useTranslations("settings");
  const tt = useTranslations();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (next !== again) return setErr(t("passwordMismatch"));
    try {
      await accountService.changePassword(cur, next);
      setCur(""); setNext(""); setAgain("");
      toast.success(t("passwordChanged"));
    } catch (e2) {
      setErr(catalogErrorMessage(e2, tt));
    }
  };
  return (
    <form onSubmit={submit} className="grid max-w-md gap-4">
      <Row id="pw-cur" label={t("currentPassword")}><Input id="pw-cur" type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} /></Row>
      <Row id="pw-new" label={t("newPassword")}><Input id="pw-new" type="password" autoComplete="new-password" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} /></Row>
      <Row id="pw-again" label={t("confirmPassword")}><Input id="pw-again" type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} /></Row>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Button type="submit" className="w-fit">{tt("common.saveChanges")}</Button>
    </form>
  );
}

function PhotoTab({ user }: { user: User }) {
  const t = useTranslations("settings");
  const save = useSave();
  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-20">
        {user.avatar && <AvatarImage src={user.avatar} alt="" />}
        <AvatarFallback className="bg-primary text-xl text-primary-foreground">{user.firstName[0]}{user.lastName?.[0]}</AvatarFallback>
      </Avatar>
      <div className="grid gap-2">
        <Label htmlFor="avatar-file">{t("uploadPhoto")}</Label>
        <Input
          id="avatar-file" type="file" accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const r = new FileReader();
            r.onload = () => save({ avatar: String(r.result) });
            r.readAsDataURL(file);
          }}
        />
        {user.avatar && <Button variant="outline" className="w-fit" onClick={() => save({ avatar: null })}>{t("removePhoto")}</Button>}
      </div>
    </div>
  );
}

/** A form over a flat record of strings (profile / bank details). */
function RecordTab<K extends "profile" | "bankDetails">({ user, field, keys: ks }: { user: User; field: K; keys: [string, string, boolean?][] }) {
  const t = useTranslations();
  const save = useSave();
  const [v, setV] = useState<Record<string, string>>(() => ({ ...(user[field] as Record<string, string>) }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); void save({ [field]: v } as Partial<User>); }} className="grid gap-4 sm:grid-cols-2">
      {ks.map(([k, label, area]) => (
        <div key={k} className={area ? "sm:col-span-2" : ""}>
          <Row id={`${field}-${k}`} label={label}>
            {area
              ? <Textarea id={`${field}-${k}`} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
              : <Input id={`${field}-${k}`} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}
          </Row>
        </div>
      ))}
      <div className="sm:col-span-2"><Button type="submit">{t("common.saveChanges")}</Button></div>
    </form>
  );
}

function AccountTab({ user }: { user: User }) {
  const t = useTranslations();
  const save = useSave();
  const [d, setD] = useState({ prefix: user.prefix, firstName: user.firstName, lastName: user.lastName, email: user.email });
  const set = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(d); }} className="grid gap-4 sm:grid-cols-2">
      <Row id="p-prefix" label={t("settings.f.prefix")}><Input id="p-prefix" value={d.prefix} onChange={set("prefix")} /></Row>
      <Row id="p-first" label={t("settings.f.firstName")}><Input id="p-first" required value={d.firstName} onChange={set("firstName")} /></Row>
      <Row id="p-last" label={t("settings.f.lastName")}><Input id="p-last" value={d.lastName} onChange={set("lastName")} /></Row>
      <Row id="p-email" label={t("settings.f.email")}><Input id="p-email" type="email" value={d.email} onChange={set("email")} /></Row>
      <div className="sm:col-span-2"><Button type="submit">{t("common.saveChanges")}</Button></div>
    </form>
  );
}

export function ProfilePage() {
  const t = useTranslations("settings");
  const me = useCurrentUser();
  if (!me) return null;
  const { user } = me;
  return (
    <>
      <PageHeader title={`${user.firstName} ${user.lastName}`.trim()} description={`${user.username} · ${me.role.name}`} />
      <Tabs defaultValue="profile">
        <TabsList className="mb-4 flex-wrap">
          {["profile", "password", "photo", "moreInfo", "bank"].map((k) => <TabsTrigger key={k} value={k}>{t(`profileTabs.${k}`)}</TabsTrigger>)}
        </TabsList>
        <div className="rounded-xl border bg-card p-5">
          <TabsContent value="profile"><AccountTab user={user} /></TabsContent>
          <TabsContent value="password"><PasswordTab /></TabsContent>
          <TabsContent value="photo"><PhotoTab user={user} /></TabsContent>
          <TabsContent value="moreInfo">
            <RecordTab user={user} field="profile" keys={[
              ["mobile", t("f.mobile")], ["altNumber", t("f.altNumber")], ["familyNumber", t("f.familyNumber")], ["bloodGroup", t("f.bloodGroup")],
              ["guardianName", t("f.guardianName")], ["idProofName", t("f.idProofName")], ["idProofNumber", t("f.idProofNumber")],
              ["fbLink", "Facebook"], ["twitterLink", "Twitter"], ["permanentAddress", t("f.permanentAddress"), true], ["currentAddress", t("f.currentAddress"), true],
            ]} />
          </TabsContent>
          <TabsContent value="bank">
            <RecordTab user={user} field="bankDetails" keys={[
              ["accountHolderName", t("f.accountHolderName")], ["accountNumber", t("f.accountNumber")], ["bankName", t("f.bankName")],
              ["bankCode", t("f.bankCode")], ["branch", t("f.branch")], ["taxPayerId", t("f.taxPayerId")],
            ]} />
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}
