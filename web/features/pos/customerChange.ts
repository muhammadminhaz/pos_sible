import { posService } from "@/lib/data/services/pos";
import { reapplyRuleDiscounts, setContact, type Cart } from "@/lib/pos/cart";

/**
 * Switches the cart's customer now, then re-prices rule discounts for them (a customer-only offer must follow the
 * customer, both ways). `update` must apply to the latest cart; a later switch wins over a slow answer.
 */
export async function changeCustomer(update: (fn: (c: Cart) => Cart) => void, cart: Cart, contactId: string, locationId: string) {
  update((c) => setContact(c, contactId));
  const productIds = [...new Set(cart.lines.filter((l) => l.ruleId !== undefined).map((l) => l.productId))];
  if (!productIds.length || !locationId) return;
  const rules = await posService.ruleDiscounts({ locationId, contactId, productIds });
  update((c) => (c.contactId === contactId ? reapplyRuleDiscounts(c, rules) : c));
}
