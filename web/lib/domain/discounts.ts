export type DiscountRule = {
  id: string;
  name: string;
  active: boolean;
  locationId: string | null;
  productIds: string[];
  brandId: string | null;
  categoryId: string | null;
  priority: number;
  type: "fixed" | "percentage";
  amount: number;
  startsAt: string;
  endsAt: string;
  contactIds?: string[];
};

export type DiscountContext = {
  productId: string;
  brandId?: string | null;
  categoryId?: string | null;
  locationId: string;
  at: string;
  contactId?: string;
};

function matches(r: DiscountRule, c: DiscountContext): boolean {
  if (!r.active) return false;
  if (c.at < r.startsAt.slice(0, c.at.length) || c.at > r.endsAt.slice(0, c.at.length)) return false;
  if (r.locationId && r.locationId !== c.locationId) return false;
  const who = r.contactIds ?? [];
  if (who.length && !(c.contactId && who.includes(c.contactId))) return false;
  // A customer-only rule with no item scope covers the whole basket.
  if (who.length && !r.productIds.length && !r.brandId && !r.categoryId) return true;
  if (r.productIds.includes(c.productId)) return true;
  if (r.brandId && r.brandId === c.brandId) return true;
  if (r.categoryId && r.categoryId === c.categoryId) return true;
  return false;
}

export function findDiscount(rules: DiscountRule[], ctx: DiscountContext): DiscountRule | null {
  return rules.filter((r) => matches(r, ctx)).sort((a, b) => b.priority - a.priority)[0] ?? null;
}
