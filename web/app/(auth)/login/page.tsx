"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { AlertCircleIcon, EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { refreshAuth, useAuth } from "@/lib/auth/authStore";
import { API_MODE } from "@/lib/data/api/mode";
import { useSession } from "@/lib/auth/session";
import Link from "next/link";
import { contactHref } from "@/lib/site";

const schema = z.object({
  business: z.string().trim().optional(),
  username: z.string().trim().min(1),
  password: z.string().min(1),
  remember: z.boolean(),
});
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const localUserId = useSession((s) => s.userId);
  const serverStatus = useAuth((s) => s.status);
  const userId = API_MODE ? (serverStatus === "in" ? "server" : null) : localUserId;
  const login = useSession((s) => s.login);
  const [failed, setFailed] = useState<false | "invalid" | "throttled">(false);
  const [showPassword, setShowPassword] = useState(false);
  const [staff, setStaff] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { business: "", username: "", password: "", remember: true },
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (API_MODE && useAuth.getState().status === "loading") void refreshAuth();
  }, []);
  useEffect(() => {
    if (userId) router.replace("/home");
  }, [userId, router]);

  const onSubmit = form.handleSubmit(async ({ business, username, password, remember }) => {
    setFailed(false);
    if (API_MODE && staff && !business) return form.setFocus("business");
    if (API_MODE) {
      const res = await fetch("/api/auth/login", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password, remember, ...(staff ? { business } : {}) }) }).catch(() => null);
      if (res?.ok) {
        const body = await res.json();
        useAuth.getState().set({ user: body.user, role: body.role, businessName: body.businessName, businessCode: body.businessCode, modules: body.modules });
        return;
      }
      const reason = await res?.json().then((b: { reason?: string }) => b.reason).catch(() => undefined);
      if (reason === "cancelled" || reason === "expired") return router.replace(`/locked?reason=${reason}`);
      setFailed(res?.status === 429 ? "throttled" : "invalid");
      form.setFocus("password");
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
    if (!login(username, password, remember)) {
      setFailed("invalid");
      form.setFocus("password");
    }
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.04em]">{t("auth.title")}</h1>
        <p className="mt-1.5 text-muted-foreground">{t("auth.subtitle")}</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            {failed && (
              <div role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-foreground">
                <AlertCircleIcon className="size-4 shrink-0" />
                {t(`auth.${failed}`)}
              </div>
            )}

            {API_MODE && (
              <SegmentedControl
                label={t("auth.signIn")}
                className="w-full"
                value={staff ? "staff" : "owner"}
                onValueChange={(v) => setStaff(v === "staff")}
                options={[{ value: "owner", label: t("auth.asOwner") }, { value: "staff", label: t("auth.asStaff") }]}
              />
            )}
            {API_MODE && staff && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="business">{t("auth.businessUsername")}</Label>
                <Input id="business" autoComplete="organization" autoCapitalize="none" className="h-11 rounded-xl" {...form.register("business")} />
                <p className="text-xs text-muted-foreground">{t("auth.staffHint")}</p>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">{t("auth.username")}</Label>
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                className="h-11 rounded-xl"
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
                  className="h-11 rounded-xl pr-11"
                  aria-invalid={!!errors.password || !!failed}
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
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

            <Button type="submit" size="lg" className="mt-2 h-12 w-full rounded-full bg-[#0a3cff] text-[15px] font-semibold text-white shadow-[0_12px_30px_-12px_rgb(10_60_255/0.7)] hover:bg-[#0833d9] active:scale-[0.99]" disabled={isSubmitting}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
      </form>

      {process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true" && (
        <p className="text-sm text-muted-foreground">
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="font-medium text-[#9fd0ff] underline-offset-4 hover:underline">{t("auth.createAccount")}</Link>
        </p>
      )}

      <p className="border-t pt-6 text-sm text-muted-foreground">
        {t("auth.forgotPassword")}{" "}
        <a href={contactHref({ topic: "support" })} className="font-medium text-[#9fd0ff] underline-offset-4 hover:underline">{t("auth.contactSupport")}</a>
      </p>
    </div>
  );
}
