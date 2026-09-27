import { addDays, addMonths, isAfter, parseISO } from "date-fns";
import { roundMoney } from "./money";

export type PaymentStatus = "paid" | "partial" | "due" | "overdue";
export type PayTerm = { number: number; type: "days" | "months" };

export function paymentSummary(
  total: number,
  payments: { amount: number; isReturn?: boolean }[],
): { paid: number; due: number; change: number } {
  const paid = roundMoney(payments.filter((p) => !p.isReturn).reduce((s, p) => s + p.amount, 0));
  return {
    paid,
    due: roundMoney(Math.max(0, total - paid)),
    change: roundMoney(Math.max(0, paid - total)),
  };
}

export function dueDate(date: string, term: PayTerm): Date {
  const d = parseISO(date);
  return term.type === "days" ? addDays(d, term.number) : addMonths(d, term.number);
}

export function paymentStatus(args: {
  total: number;
  paid: number;
  date: string;
  payTerm?: PayTerm | null;
  today?: string;
}): PaymentStatus {
  const due = roundMoney(args.total - args.paid);
  if (due <= 0) return "paid";
  if (args.payTerm && args.payTerm.number > 0) {
    const today = args.today ? parseISO(args.today) : new Date();
    if (isAfter(today, dueDate(args.date, args.payTerm))) return "overdue";
  }
  return args.paid > 0 ? "partial" : "due";
}
