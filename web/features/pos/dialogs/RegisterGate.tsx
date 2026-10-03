"use client";

import { useState, type FormEvent } from "react";
import { LockOpenIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/lib/auth/useCan";
import type { Location } from "@/lib/data/schemas";
import { usePosMutations } from "@/lib/data/hooks/pos";
import { useFormat } from "@/lib/i18n/format";
import { focusSearch } from "../focus";
import { usePosError } from "../usePosAction";

/** The POS stays locked until this user opens a register at this location. */
export function RegisterGate({ location }: { location: Location }) {
  const t = useTranslations("pos.register");
  const user = useCurrentUser()?.user;
  const { openRegister } = usePosMutations();
  const onError = usePosError();
  const f = useFormat();
  const [cash, setCash] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await openRegister.mutateAsync({ locationId: location.id, openingCash: Math.max(0, Number(cash) || 0) });
      toast.success(t("opened"));
      focusSearch();
    } catch (err) {
      onError(err);
    }
  };

  return (
    <div className="grid flex-1 place-items-center p-6">
      <Card className="w-full max-w-sm">
        <form onSubmit={submit}>
          <CardHeader>
            <span className="mb-2 grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <LockOpenIcon className="size-5" />
            </span>
            <CardTitle>{t("openTitle")}</CardTitle>
            <CardDescription>{t("openBody", { location: location.name })}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 py-4">
            <Label htmlFor="opening-cash">{t("openingCash")}</Label>
            <InputGroup className="h-11">
              <InputGroupAddon>
                <InputGroupText>{f.money(0).replace(/[\d.,\s-]/g, "")}</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="opening-cash"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                autoFocus
                placeholder={f.amount(0)}
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                className="text-lg tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </InputGroup>
            {user && <p className="text-xs text-muted-foreground">{`${user.firstName} ${user.lastName}`.trim()}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" size="lg" className="w-full" disabled={openRegister.isPending}>
              {t("open")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
