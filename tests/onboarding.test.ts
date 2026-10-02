import { beforeEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/auth/session";
import { createSeed } from "@/lib/data/seed";
import { getDB, resetDB } from "@/lib/data/store/db";
import { LOC_RANGO } from "@/lib/data/seed/mk";
import { addItem, emptyCart } from "@/lib/pos/cart";
import { ledgerReportsService } from "@/lib/data/services/ledgerReports";
import { checklistStatus, onboardingService } from "@/lib/data/services/onboarding";
import { posService, toCartItem } from "@/lib/data/services/pos";
import { productImportService } from "@/lib/data/services/productImport";
import { registersService } from "@/lib/data/services/registers";
import { salesService } from "@/lib/data/services/sales";

const profile = { businessName: "Lotus Mart", currencySymbol: "৳", currencyCode: "BDT", locationName: "Lotus Mart Mirpur", phone: "01711000111", city: "Dhaka", themeColor: "green" as const };

describe("onboarding", () => {
  beforeEach(() => {
    resetDB(createSeed({ seed: 42, today: "2026-09-28" }));
    useSession.setState({ userId: "user_admin" });
  });

  it("keeping the demo shop only records the choice and the profile", async () => {
    const products = getDB().products.length;
    await onboardingService.complete({ ...profile, mode: "demo" });
    const d = getDB();
    expect(d.products).toHaveLength(products);
    expect(d.settings.business.name).toBe("Lotus Mart");
    expect(d.settings.system.themeColor).toBe("green");
    expect(d.meta.onboarding).toMatchObject({ done: true, mode: "demo" });
  });

  it("a fresh shop is empty but fully usable: import a product, sell it, books stay balanced", async () => {
    await onboardingService.complete({ ...profile, mode: "fresh" });
    const d = getDB();
    expect([d.products.length, d.transactions.length, d.contacts.length, d.locations.length]).toEqual([0, 0, 1, 1]);
    expect(d.locations[0].name).toBe("Lotus Mart Mirpur");
    expect(d.users.every((u) => u.locationIds.every((l) => d.locations.some((x) => x.id === l)))).toBe(true);
    expect(checklistStatus(d)).toEqual({ product: false, customer: false, sale: false, expense: false, reports: false });

    const parsed = await productImportService.parseProducts("name,unit,purchase_exc,sell_exc\nTea 500g,Pieces,100,150");
    expect(parsed.errors).toEqual([]);
    await productImportService.commitProducts(parsed.rows, "t.csv");
    const sku = getDB().variations[0].sku;
    await productImportService.commitOpeningStock((await productImportService.parseOpeningStock(`sku,location,qty,unit_cost\n${sku},${d.locations[0].name},20,100`)).rows, "o.csv");

    await registersService.open(LOC_RANGO, 0);
    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows[0];
    const cart = addItem(emptyCart(), toCartItem(p, p.variations[0], 2), "new_row");
    const res = await salesService.checkout({ cart, locationId: LOC_RANGO, status: "final", payments: [{ method: "cash", amount: 300 }] });
    expect(res.total).toBe(300);

    const tb = await ledgerReportsService.trialBalance({});
    expect(tb.debit).toBeCloseTo(tb.credit, 2);
    const status = checklistStatus(getDB());
    expect(status).toMatchObject({ product: true, sale: true, customer: false });

    await onboardingService.visit("reports");
    expect(checklistStatus(getDB()).reports).toBe(true);
  });

  it("only someone who can change business settings may run it", async () => {
    useSession.setState({ userId: "user_cashier" });
    await expect(onboardingService.complete({ ...profile, mode: "fresh" })).rejects.toMatchObject({ permission: "settings.business" });
  });
});
