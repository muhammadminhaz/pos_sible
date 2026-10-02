import { beforeEach, describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { LOC_NIPUN, LOC_RANGO, mk } from "@/lib/data/seed/mk";
import { contact, customerGroup, discount, product, stockLot, variation } from "@/lib/data/schemas";
import { commit, getDB, resetDB } from "@/lib/data/store/db";
import { posService, toCartItem } from "./pos";

const seed = createSeed({ seed: 42, today: "2026-09-28" });

/** Shared base fields every fixture record needs (see lib/data/seed/*.ts for the pattern). */
const F = { createdAt: "2026-01-01T00:00:00", createdBy: null as string | null };

describe("posService", () => {
  beforeEach(() => resetDB(structuredClone(seed)));

  it("lists only sellable products at the location", async () => {
    const res = await posService.products({ locationId: LOC_RANGO, pageSize: -1 });
    const db = getDB();
    for (const p of res.rows) {
      const src = db.products.find((x) => x.id === p.id)!;
      expect(src.active && !src.notForSale && src.locationIds.includes(LOC_RANGO)).toBe(true);
    }
    expect(res.total).toBeGreaterThan(0);
  });

  it("hides deactivated products", async () => {
    const first = (await posService.products({ locationId: LOC_RANGO, pageSize: 1 })).rows[0];
    commit((d) => { d.products.find((p) => p.id === first.id)!.active = false; });
    const ids = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.map((p) => p.id);
    expect(ids).not.toContain(first.id);
  });

  it("stock is the location's lot sum", async () => {
    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.find((x) => x.manageStock)!;
    const lots = getDB().stockLots.filter((l) => l.productId === p.id && l.locationId === LOC_RANGO);
    expect(p.stock).toBeCloseTo(lots.reduce((s, l) => s + l.qtyRemaining, 0), 4);
  });

  it("finds an exact SKU first and flags it", async () => {
    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: 1 })).rows[0];
    const sku = p.variations[0].sku;
    const hits = await posService.search({ locationId: LOC_RANGO, term: sku.toLowerCase() });
    expect(hits[0]).toMatchObject({ exact: true });
    expect(hits[0].variation.sku).toBe(sku);
    expect((await posService.search({ locationId: LOC_RANGO, term: "NOPE-000" })).some((h) => h.exact)).toBe(false);
  });

  it("toCartItem maps price, tax and stock limit", async () => {
    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.find((x) => x.manageStock)!;
    const item = toCartItem(p, p.variations[0]);
    expect(item).toMatchObject({
      productId: p.id, variationId: p.variations[0].id, unitPrice: p.variations[0].unitPrice,
      taxType: p.taxType, maxQty: p.variations[0].stock,
    });
  });

  it("group pricing changes an untaxed product's price but leaves a taxed product at its taxType base", async () => {
    commit((d) => {
      d.customerGroups.push(mk(customerGroup, { ...F, id: "cg_test_disc20", name: "Test 20% Off", calcType: "percentage", amount: -20 }));
      d.contacts.push(mk(contact, {
        ...F, id: "ct_test_group", code: "CO9001", type: "customer", name: "Group Test Customer", mobile: "01700000000",
        address: {}, customerGroupId: "cg_test_disc20",
      }));
      d.products.push(
        mk(product, {
          ...F, id: "p_test_untaxed", name: "Test Untaxed Product", sku: "TU-001", barcodeType: "C128", unitId: "unit_pcs",
          locationIds: [LOC_RANGO], manageStock: false, taxId: null, taxType: "exclusive", type: "single",
        }),
        mk(product, {
          ...F, id: "p_test_taxed", name: "Test Taxed Product", sku: "TT-001", barcodeType: "C128", unitId: "unit_pcs",
          locationIds: [LOC_RANGO], manageStock: false, taxId: "tax_vat5", taxType: "inclusive", type: "single",
        }),
      );
      d.variations.push(
        mk(variation, { ...F, id: "v_test_untaxed", productId: "p_test_untaxed", name: "DUMMY", sku: "TU-001", purchasePriceExc: 0, purchasePriceInc: 0, margin: 0, sellPriceExc: 100, sellPriceInc: 100 }),
        mk(variation, { ...F, id: "v_test_taxed", productId: "p_test_taxed", name: "DUMMY", sku: "TT-001", purchasePriceExc: 0, purchasePriceInc: 0, margin: 0, sellPriceExc: 190, sellPriceInc: 200 }),
      );
    });

    const noGroup = await posService.products({ locationId: LOC_RANGO, pageSize: -1 });
    const withGroup = await posService.products({ locationId: LOC_RANGO, contactId: "ct_test_group", pageSize: -1 });

    // Untaxed: base sellPriceExc (100) is fed through resolveUnitPrice, so the customer group's -20% applies.
    expect(noGroup.rows.find((p) => p.id === "p_test_untaxed")!.variations[0].unitPrice).toBe(100);
    expect(withGroup.rows.find((p) => p.id === "p_test_untaxed")!.variations[0].unitPrice).toBe(80);

    // Taxed: unitPrice is always the taxType base (sellPriceInc, since inclusive) — group pricing never applies.
    expect(noGroup.rows.find((p) => p.id === "p_test_taxed")!.variations[0].unitPrice).toBe(200);
    expect(withGroup.rows.find((p) => p.id === "p_test_taxed")!.variations[0].unitPrice).toBe(200);
  });

  it("toCartItem.maxQty is null when the product doesn't manage stock, even if the variation has lots", async () => {
    commit((d) => {
      d.products.push(
        mk(product, {
          ...F, id: "p_test_nostock_mgmt", name: "Test No Stock Mgmt", sku: "NSM-001", barcodeType: "C128", unitId: "unit_pcs",
          locationIds: [LOC_RANGO], manageStock: false, taxType: "exclusive", type: "single",
        }),
      );
      d.variations.push(
        mk(variation, { ...F, id: "v_test_nostock_mgmt", productId: "p_test_nostock_mgmt", name: "DUMMY", sku: "NSM-001", purchasePriceExc: 0, purchasePriceInc: 0, margin: 0, sellPriceExc: 50, sellPriceInc: 50 }),
      );
      d.stockLots.push(
        mk(stockLot, {
          ...F, id: "lot_test_nsm", locationId: LOC_RANGO, variationId: "v_test_nostock_mgmt", productId: "p_test_nostock_mgmt",
          sourceTxnId: null, qtyIn: 5, qtyRemaining: 5, unitCost: 30, receivedAt: "2026-01-01",
        }),
      );
    });

    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.find((x) => x.id === "p_test_nostock_mgmt")!;
    expect(p.variations[0].stock).toBe(5); // stock is still tracked/summed regardless of manageStock
    expect(toCartItem(p, p.variations[0]).maxQty).toBeNull();
  });

  it("search ranks exact SKU, then name prefix, then name contains, then SKU contains", async () => {
    const V = { purchasePriceExc: 0, purchasePriceInc: 0, margin: 0, sellPriceExc: 10, sellPriceInc: 10 };
    commit((d) => {
      d.products.push(
        mk(product, { ...F, id: "p_rank_exact", name: "Rank Exact Product", sku: "RE-001", barcodeType: "C128", unitId: "unit_pcs", locationIds: [LOC_RANGO], manageStock: false, taxType: "exclusive", type: "single" }),
        mk(product, { ...F, id: "p_rank_prefix", name: "Zzq Prefix Product", sku: "RP-002", barcodeType: "C128", unitId: "unit_pcs", locationIds: [LOC_RANGO], manageStock: false, taxType: "exclusive", type: "single" }),
        mk(product, { ...F, id: "p_rank_contains", name: "Extra Zzq Middle Product", sku: "RC-003", barcodeType: "C128", unitId: "unit_pcs", locationIds: [LOC_RANGO], manageStock: false, taxType: "exclusive", type: "single" }),
        mk(product, { ...F, id: "p_rank_sku", name: "Random Fourth Product", sku: "RS-004", barcodeType: "C128", unitId: "unit_pcs", locationIds: [LOC_RANGO], manageStock: false, taxType: "exclusive", type: "single" }),
      );
      d.variations.push(
        mk(variation, { ...F, ...V, id: "v_rank_exact", productId: "p_rank_exact", name: "DUMMY", sku: "zzq" }),
        mk(variation, { ...F, ...V, id: "v_rank_prefix", productId: "p_rank_prefix", name: "DUMMY", sku: "RP-002" }),
        mk(variation, { ...F, ...V, id: "v_rank_contains", productId: "p_rank_contains", name: "DUMMY", sku: "RC-003" }),
        mk(variation, { ...F, ...V, id: "v_rank_sku", productId: "p_rank_sku", name: "DUMMY", sku: "SKUZZQEXTRA" }),
      );
    });

    const hits = await posService.search({ locationId: LOC_RANGO, term: "zzq" });
    expect(hits).toHaveLength(4);
    expect(hits.map((h) => h.product.id)).toEqual(["p_rank_exact", "p_rank_prefix", "p_rank_contains", "p_rank_sku"]);
    expect(hits[0].exact).toBe(true);
    expect(hits.slice(1).every((h) => !h.exact)).toBe(true);
  });

  it("excludes not-for-sale products and products not assigned to the location, from both products() and search()", async () => {
    const V = { purchasePriceExc: 0, purchasePriceInc: 0, margin: 0, sellPriceExc: 10, sellPriceInc: 10 };
    commit((d) => {
      d.products.push(
        mk(product, { ...F, id: "p_nfs", name: "Notforsale Zzqx Item", sku: "NFS-ZZQX", barcodeType: "C128", unitId: "unit_pcs", locationIds: [LOC_RANGO], manageStock: false, taxType: "exclusive", type: "single", notForSale: true }),
        mk(product, { ...F, id: "p_otherloc", name: "Otherloc Zzqx Item", sku: "OL-ZZQX", barcodeType: "C128", unitId: "unit_pcs", locationIds: [LOC_NIPUN], manageStock: false, taxType: "exclusive", type: "single" }),
      );
      d.variations.push(
        mk(variation, { ...F, ...V, id: "v_nfs", productId: "p_nfs", name: "DUMMY", sku: "NFS-ZZQX" }),
        mk(variation, { ...F, ...V, id: "v_otherloc", productId: "p_otherloc", name: "DUMMY", sku: "OL-ZZQX" }),
      );
    });

    const list = await posService.products({ locationId: LOC_RANGO, pageSize: -1 });
    expect(list.rows.map((r) => r.id)).not.toContain("p_nfs");
    expect(list.rows.map((r) => r.id)).not.toContain("p_otherloc");

    const hits = await posService.search({ locationId: LOC_RANGO, term: "zzqx" });
    expect(hits.map((h) => h.product.id)).not.toContain("p_nfs");
    expect(hits.map((h) => h.product.id)).not.toContain("p_otherloc");
  });

  it("attaches an active matching discount to the product and carries it through toCartItem", async () => {
    commit((d) => {
      d.products.push(
        mk(product, { ...F, id: "p_test_disc", name: "Test Discount Product", sku: "TD-001", barcodeType: "C128", unitId: "unit_pcs", locationIds: [LOC_RANGO], manageStock: false, taxType: "exclusive", type: "single" }),
      );
      d.variations.push(
        mk(variation, { ...F, id: "v_test_disc", productId: "p_test_disc", name: "DUMMY", sku: "TD-001", purchasePriceExc: 0, purchasePriceInc: 0, margin: 0, sellPriceExc: 100, sellPriceInc: 100 }),
      );
      d.discounts.push(
        mk(discount, {
          ...F, id: "disc_test_p", name: "Test Product Discount", locationId: LOC_RANGO, productIds: ["p_test_disc"],
          priority: 1, type: "percentage", amount: 15, startsAt: "2000-01-01", endsAt: "2100-01-01", active: true,
        }),
      );
    });

    const p = (await posService.products({ locationId: LOC_RANGO, pageSize: -1 })).rows.find((x) => x.id === "p_test_disc")!;
    const expected = { type: "percentage" as const, amount: 15 };
    expect(p.discount).toEqual(expected);
    expect(toCartItem(p, p.variations[0]).discount).toEqual(expected);
  });
});
