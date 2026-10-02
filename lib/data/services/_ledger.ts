import { currentUser } from "@/lib/auth/session";
import { NotFoundError, ValidationError } from "@/lib/data/errors";
import { accountTxn, type AccountTxn, type DB } from "@/lib/data/schemas";
import { roundMoney } from "@/lib/domain/money";
import { nowISO, uid } from "./_util";

/** Credits minus debits, opening balance included (it is stored as an `opening_balance` credit). */
export function accountBalance(d: DB, accountId: string, upTo?: string): number {
  let sum = 0;
  for (const a of d.accountTxns) {
    if (a.accountId !== accountId || (upTo && a.date.slice(0, 10) > upTo)) continue;
    sum += a.kind === "credit" ? a.amount : -a.amount;
  }
  return roundMoney(sum);
}

/** Throws unless the account exists and is open for posting. */
export function assertPostable(d: DB, accountId: string, field = "accountId") {
  const a = d.accounts.find((x) => x.id === accountId);
  if (!a) throw new NotFoundError("Account");
  if (a.status === "closed") throw new ValidationError({ [field]: "closed" });
  return a;
}

export type NewAccountTxn = Pick<AccountTxn, "accountId" | "kind" | "subType" | "amount" | "date"> &
  Partial<Pick<AccountTxn, "transactionId" | "paymentId" | "transferPairId" | "note">>;

export function pushAccountTxn(d: DB, x: NewAccountTxn): AccountTxn {
  const row = accountTxn.parse({ id: uid("at"), createdAt: nowISO(), createdBy: currentUser()?.user.id ?? null, ...x });
  d.accountTxns.push(row);
  return row;
}
