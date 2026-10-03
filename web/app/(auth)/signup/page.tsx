"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/layout/LogoMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/authStore";

/** Open a new business on the server (API mode with POS_ALLOW_SIGNUP=true). */
export default function SignupPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [v, setV] = useState({ businessName: "", firstName: "", username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/signup", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      const body = await res.json();
      useAuth.getState().set({ user: body.user, role: body.role, businessName: body.businessName, businessCode: body.businessCode, modules: body.modules });
      router.replace("/home");
    } else setError(res?.status === 409 ? t("usernameTaken") : t("signupFailed"));
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <LogoMark className="size-11 rounded-xl" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("signupTitle")}</h1>
          <p className="mt-1 text-muted-foreground">{t("signupSubtitle")}</p>
        </div>
      </div>
      <Card className="w-full shadow-sm">
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-foreground">
                <AlertCircleIcon className="size-4 shrink-0" />{error}
              </div>
            )}
            <div className="grid gap-1.5"><Label htmlFor="su-biz">{t("businessName")}</Label><Input id="su-biz" required minLength={2} autoFocus value={v.businessName} onChange={set("businessName")} /></div>
            <div className="grid gap-1.5"><Label htmlFor="su-name">{t("yourName")}</Label><Input id="su-name" required value={v.firstName} onChange={set("firstName")} /></div>
            <div className="grid gap-1.5"><Label htmlFor="su-user">{t("username")}</Label><Input id="su-user" required minLength={3} autoComplete="username" value={v.username} onChange={set("username")} /></div>
            <div className="grid gap-1.5">
              <Label htmlFor="su-pass">{t("password")}</Label>
              <Input id="su-pass" type="password" required minLength={8} autoComplete="new-password" value={v.password} onChange={set("password")} />
              <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
            </div>
            <Button type="submit" size="lg" disabled={busy}>{busy && <Loader2Icon className="animate-spin" />}{t("createAccount")}</Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{t("haveAccount")} <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">{t("signIn")}</Link></p>
    </div>
  );
}
