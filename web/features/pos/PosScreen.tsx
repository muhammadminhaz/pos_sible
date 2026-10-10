"use client";

import { useState } from "react";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentRegister } from "@/lib/data/hooks/pos";
import { ActionBar } from "./ActionBar";
import { CartTable } from "./cart/CartTable";
import { CartTotals } from "./cart/CartTotals";
import { CustomerPicker } from "./cart/CustomerPicker";
import { MetaRow } from "./cart/MetaRow";
import { ProductSearch } from "./cart/ProductSearch";
import { AddCustomerDialog } from "./dialogs/AddCustomer";
import { AddExpenseDialog } from "./dialogs/AddExpense";
import { CancelDialog } from "./dialogs/Cancel";
import { DiscountDialog } from "./dialogs/Discount";
import { OrderTaxDialog } from "./dialogs/OrderTax";
import { PaymentDialog } from "./dialogs/Payment";
import { RecentSheet } from "./dialogs/Recent";
import { RedeemPointsDialog } from "./dialogs/RedeemPoints";
import { ReceiptModal } from "./receipt/ReceiptModal";
import { ShortcutsDialog } from "./dialogs/Shortcuts";
import { WeighingScaleDialog } from "./dialogs/WeighingScale";
import { PosHotkeys } from "./PosHotkeys";
import { RegisterDialog } from "./dialogs/RegisterClose";
import { RegisterGate } from "./dialogs/RegisterGate";
import { ShippingDialog } from "./dialogs/Shipping";
import { SuspendDialog } from "./dialogs/Suspend";
import { SuspendedSheet } from "./dialogs/Suspended";
import { ProductGrid } from "./grid/ProductGrid";
import { TopBar } from "./TopBar";
import { PaneSwitch } from "./PaneSwitch";
import { registerGate } from "@/lib/pos/gate";
import { usePosLocation } from "./usePos";

export function PosScreen() {
  const t = useTranslations("pos");
  const { location, allowed } = usePosLocation();
  const register = useCurrentRegister(location?.id ?? "");
  const gate = registerGate(location, register);
  const ready = gate === "ready";
  // Below 1024px (tablets and phones) the cart and the product grid share the screen as two tabs.
  const [pane, setPane] = useState<"products" | "cart">("products");

  return (
    <>
      <div className="flex h-dvh flex-col overflow-hidden bg-muted/30" data-print-hide>
        <TopBar location={location} allowed={allowed} register={register.data ?? null} />
        {gate === "loading" ? (
          <div className="flex flex-1 gap-4 p-4">
            <Skeleton className="w-[44%]" />
            <Skeleton className="flex-1" />
          </div>
        ) : gate === "locked" ? (
          <RegisterGate location={location!} />
        ) : (
          <>
            <PaneSwitch pane={pane} onChange={setPane} locationId={location.id} />
            <div className="flex min-h-0 flex-1">
              <section aria-label={t("cart.caption")} className={cn("w-full flex-col border-r bg-card lg:flex lg:w-[44%] lg:min-w-[440px]", pane === "cart" ? "flex" : "hidden")}>
                <div className="grid gap-2 border-b p-3">
                  <CustomerPicker locationId={location.id} />
                  <ProductSearch locationId={location.id} />
                  <MetaRow locationId={location.id} />
                </div>
                <CartTable locationId={location.id} />
                <CartTotals locationId={location.id} />
                {/* slot:cart */}
              </section>
              <section className={cn("min-w-0 flex-1 flex-col lg:flex", pane === "products" ? "flex" : "hidden")}>
                <ProductGrid locationId={location.id} />
                {/* slot:grid */}
              </section>
            </div>
            <ActionBar location={location} />
            {/* slot:actions */}
          </>
        )}
      </div>
      <ShortcutsDialog />
      {ready && (
        <>
          <AddCustomerDialog locationId={location!.id} />
          <PaymentDialog location={location!} />
          <DiscountDialog locationId={location!.id} />
          <OrderTaxDialog locationId={location!.id} />
          <ShippingDialog locationId={location!.id} />
          <RedeemPointsDialog locationId={location!.id} />
          <CancelDialog locationId={location!.id} />
          <SuspendDialog locationId={location!.id} />
          <SuspendedSheet locationId={location!.id} />
          <RecentSheet locationId={location!.id} />
          <RegisterDialog location={location!} />
          <AddExpenseDialog location={location!} />
          <ReceiptModal />
          <WeighingScaleDialog locationId={location!.id} />
          <PosHotkeys location={location!} />
          {/* slot:dialogs */}
        </>
      )}
    </>
  );
}
