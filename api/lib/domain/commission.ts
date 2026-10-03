import { percentOf } from "./money";

export function commission(args: {
  percent: number;
  basis: "invoice_value" | "payment_received";
  invoiceTotal: number;
  paid: number;
}): number {
  return percentOf(args.basis === "invoice_value" ? args.invoiceTotal : args.paid, args.percent);
}
