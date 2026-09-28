import { currentUser } from "@/lib/auth/session";
import { ValidationError } from "@/lib/data/errors";
import { accountTxn, transaction, type PaymentMethod, type Transaction } from "@/lib/data/schemas";
import { commit } from "@/lib/data/store/db";
import { roundMoney } from "@/lib/domain/money";
import { delay, nowISO, takeRef, uid } from "./_util";

export type NewExpense = { locationId: string; categoryId: string; amount: number; method: PaymentMethod; note?: string };

export const expensesService = {
  /** Minimal paid expense (POS "Add expense"); the full form arrives with the Expenses sub-project. */
  async create(input: NewExpense): Promise<Transaction> {
    await delay();
    const amount = roundMoney(input.amount);
    if (!(amount > 0)) throw new ValidationError({ amount: "positive" });
    if (!input.categoryId) throw new ValidationError({ categoryId: "required" });
    let created!: Transaction;
    commit((d) => {
      const at = nowISO();
      const by = currentUser()?.user.id ?? null;
      const tid = uid("t");
      const pid = uid("pay");
      const accountId = d.locations.find((l) => l.id === input.locationId)?.defaultAccounts[input.method] ?? null;
      created = transaction.parse({
        id: tid,
        createdAt: at,
        createdBy: by,
        type: "expense",
        status: "final",
        locationId: input.locationId,
        refNo: takeRef(d, d.settings.prefixes.expense, at),
        date: at,
        lines: [],
        totals: { itemsCount: 0, linesTotal: amount, discount: 0, orderTax: 0, shipping: 0, additional: 0, redeemed: 0, roundOff: 0, total: amount },
        payments: [{ id: pid, refNo: takeRef(d, d.settings.prefixes.expensePayment, at), amount, method: input.method, accountId, paidOn: at, createdBy: by }],
        paymentStatus: "paid",
        expenseCategoryId: input.categoryId,
        notes: input.note?.trim() ?? "",
      });
      d.transactions.push(created);
      if (accountId) {
        d.accountTxns.push(
          accountTxn.parse({
            id: uid("at"),
            createdAt: at,
            createdBy: by,
            accountId,
            kind: "debit",
            subType: "payment",
            amount,
            date: at,
            transactionId: tid,
            paymentId: pid,
          }),
        );
      }
    });
    return created;
  },
};
