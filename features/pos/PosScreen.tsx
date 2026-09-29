"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentRegister } from "@/lib/data/hooks/pos";
import { CartTable } from "./cart/CartTable";
import { CartTotals } from "./cart/CartTotals";
import { CustomerPicker } from "./cart/CustomerPicker";
import { MetaRow } from "./cart/MetaRow";
import { ProductSearch } from "./cart/ProductSearch";
import { AddCustomerDialog } from "./dialogs/AddCustomer";
import { RegisterGate } from "./dialogs/RegisterGate";
import { ProductGrid } from "./grid/ProductGrid";
import { Narrow } from "./Narrow";
import { TopBar } from "./TopBar";
import { usePosLocation } from "./usePos";

export function PosScreen() {
  const t = useTranslations("pos");
  const { location, allowed } = usePosLocation();
  const register = useCurrentRegister(location?.id ?? "");
  const ready = !!location && !!register.data;

  return (
    <>
      <Narrow />
      <div className="hidden h-dvh flex-col overflow-hidden bg-muted/30 lg:flex" data-print-hide>
        <TopBar location={location} allowed={allowed} register={register.data ?? null} />
        {!location || register.isPending ? (
          <div className="flex flex-1 gap-4 p-4">
            <Skeleton className="w-[44%]" />
            <Skeleton className="flex-1" />
          </div>
        ) : !register.data ? (
          <RegisterGate location={location} />
        ) : (
          <>
            <div className="flex min-h-0 flex-1">
              <section aria-label={t("cart.caption")} className="flex w-[44%] min-w-[440px] flex-col border-r bg-card">
                <div className="grid gap-2 border-b p-3">
                  <CustomerPicker locationId={location.id} />
                  <ProductSearch locationId={location.id} />
                  <MetaRow locationId={location.id} />
                </div>
                <CartTable locationId={location.id} />
                <CartTotals locationId={location.id} />
                {/* slot:cart */}
              </section>
              <section className="flex min-w-0 flex-1 flex-col">
                <ProductGrid locationId={location.id} />
                {/* slot:grid */}
              </section>
            </div>
            {/* slot:actions */}
          </>
        )}
      </div>
      {ready && (
        <>
          <AddCustomerDialog locationId={location!.id} />
          {/* slot:dialogs */}
        </>
      )}
    </>
  );
}
