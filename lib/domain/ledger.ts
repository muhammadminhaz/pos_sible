import type { Transaction } from "@/lib/data/schemas";

/** Expenses add to costs; a refund expense takes them back, so it counts negative everywhere. */
export const expenseSign = (t: Pick<Transaction, "isRefund">): 1 | -1 => (t.isRefund ? -1 : 1);
