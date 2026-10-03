"use client";

import { useReducer } from "react";
import { CalculatorIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CALC_INIT, calcReducer, type CalcKey } from "@/lib/calculator";

const KEYS: CalcKey[][] = [
  ["C", "±", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["⌫", "0", ".", "="],
];

const KEYBOARD: Record<string, CalcKey> = {
  "+": "+", "-": "−", "*": "×", x: "×", "/": "÷", "%": "%", ".": ".", ",": ".",
  Enter: "=", "=": "=", Backspace: "⌫", Escape: "C", Delete: "C",
};

export function Calculator() {
  const t = useTranslations("header");
  const [state, press] = useReducer(calcReducer, CALC_INIT);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const key = /^\d$/.test(e.key) ? (e.key as CalcKey) : KEYBOARD[e.key];
    if (!key) return;
    e.preventDefault();
    if (key === "C" && e.key === "Escape" && state.display === "0") return; // let Escape close the popover
    press(key);
  };

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("calculator")}>
              <CalculatorIcon />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("calculator")}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-64 p-3" onKeyDown={onKeyDown}>
        <div className="mb-3 rounded-lg bg-muted px-3 py-2 text-right">
          <div className="h-4 text-xs text-muted-foreground tabular">
            {state.acc !== null && state.op ? `${state.acc} ${state.op}` : ""}
          </div>
          <output className="block truncate text-2xl font-semibold tabular" aria-live="polite">
            {state.display}
          </output>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {KEYS.flat().map((k) => {
            const isOp = ["÷", "×", "−", "+"].includes(k);
            return (
              <Button
                key={k}
                type="button"
                variant={k === "=" ? "default" : isOp ? "secondary" : "outline"}
                className={cn("h-10 text-base tabular", isOp && state.op === k && state.fresh && "ring-2 ring-primary/40")}
                onClick={() => press(k)}
              >
                {k}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
