"use client";

import { useSettings } from "@/lib/data/hooks/settings";
import type { Location } from "@/lib/data/schemas";
import { useHotkeys } from "@/lib/pos/hotkeys";
import { useCart } from "@/lib/pos/store";
import { usePosDialogs } from "./dialogStore";
import { focusSearch } from "./focus";
import { usePosCommands } from "./usePosCommands";

/** Window-level POS shortcuts. Renders nothing. */
export function PosHotkeys({ location }: { location: Location }) {
  const { data: settings } = useSettings();
  const { cart } = useCart(location.id);
  const open = usePosDialogs((s) => s.open);
  const show = usePosDialogs((s) => s.show);
  const cmd = usePosCommands(location);
  const s = settings?.pos.shortcuts;
  const idle = open === null;

  useHotkeys({ f3: () => focusSearch(), "?": () => show("shortcuts") }, idle);
  useHotkeys(
    s
      ? {
          [s.expressCheckout]: cmd.express,
          [s.payAndCheckout]: () => cmd.pay("multiple"),
          [s.draft]: cmd.draft,
          [s.cancel]: cmd.cancel,
          [s.recentProductQty]: () => {
            const last = cart.lines.at(-1);
            const el = last && (document.getElementById(`pos-qty-${last.key}`) as HTMLInputElement | null);
            el?.focus();
            el?.select();
          },
          [s.weighingScale]: () => settings?.pos.enableWeighingScale && show("scale"),
          [s.editDiscount]: () => !settings?.pos.disableDiscount && cart.lines.length > 0 && show("discount"),
          [s.editOrderTax]: () => !settings?.pos.disableOrderTax && cart.lines.length > 0 && show("orderTax"),
          [s.addNewProduct]: () => window.open("/products/new", "_blank"),
        }
      : {},
    idle,
  );
  return null;
}
