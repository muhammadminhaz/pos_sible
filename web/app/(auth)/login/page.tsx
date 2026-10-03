"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { AlertCircleIcon, EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { LogoMark } from "@/components/layout/LogoMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { refreshAuth, useAuth } from "@/lib/auth/authStore";
import { API_MODE } from "@/lib/data/api/mode";
import { useSession } from "@/lib/auth/session";
import Link from "next/link";

const schema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  remember: z.boolean(),
});
type Values = z.infer<typeof schema>;

/** Quick-fill buttons for the public demo logins: always in the browser demo, opt-in with a server. */
const showDemo = !API_MODE || process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === "true";

const DEMO = [
  { username: "admin", role: "Admin" },
  { username: "cashier", role: "Cashier" },
];

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const localUserId = useSession((s) => s.userId);
  const serverStatus = useAuth((s) => s.status);
  const userId = API_MODE ? (serverStatus === "in" ? "server" : null) : localUserId;
  const login = useSession((s) => s.login);
  const [failed, setFailed] = useState<false | "invalid" | "throttled" | "suspended" | "expired">(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "", remember: true },
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (API_MODE && useAuth.getState().status === "loading") void refreshAuth();
  }, []);
  useEffect(() => {
    if (userId) router.replace("/home");
  }, [userId, router]);

  const onSubmit = form.handleSubmit(async ({ username, password, remember }) => {
    setFailed(false);
    if (API_MODE) {
      const res = await fetch("/api/auth/login", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password, remember }) }).catch(() => null);
      if (res?.ok) {
        const body = await res.json();
        useAuth.getState().set({ user: body.user, role: body.role, businessName: body.businessName });
        return;
      }
      const reason = await res?.json().then((b: { reason?: string }) => b.reason).catch(() => undefined);
      setFailed(res?.status === 429 ? "throttled" : reason === "suspended" || reason === "expired" ? reason : "invalid");
      form.setFocus("password");
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
    if (!login(username, password, remember)) {
      setFailed("invalid");
      form.setFocus("password");
    }
  });

  const fillDemo = (username: string) => {
    form.reset({ username, password: "112233", remember: true });
    setFailed(false);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <LogoMark className="size-11 rounded-xl" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("auth.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("auth.subtitle")}</p>
        </div>
      </div>

      <Card className="w-full shadow-sm">
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            {failed && (
              <div role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-foreground">
                <AlertCircleIcon className="size-4 shrink-0" />
                {failed === "invalid" ? t("auth.invalid") : t(`auth.${failed}`)}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">{t("auth.username")}</Label>
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                className="h-9"
                aria-invalid={!!errors.username || !!failed}
                {...form.register("username")}
              />
              {errors.username && <p className="text-xs text-danger">{t("errors.required")}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-9 pr-9"
                  aria-invalid={!!errors.password || !!failed}
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                  className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-danger">{t("errors.required")}</p>}
            </div>

            <label className="flex w-fit items-center gap-2 text-sm">
              <Controller
                control={form.control}
                name="remember"
                render={({ field }) => (
                  <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                )}
              />
              {t("auth.rememberMe")}
            </label>

            <Button type="submit" size="lg" className="mt-1 w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true" && (
        <p className="text-sm text-muted-foreground">
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">{t("auth.createAccount")}</Link>
        </p>
      )}

      {showDemo && (
      <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <span>{t("auth.demoHint")}</span>
        <div className="flex gap-2">
          {DEMO.map((d) => (
            <button
              key={d.username}
              type="button"
              onClick={() => fillDemo(d.username)}
              className="rounded-md border bg-card px-2 py-1 font-mono text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              {d.username} · {d.role}
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
