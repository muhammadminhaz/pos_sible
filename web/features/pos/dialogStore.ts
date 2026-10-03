import { create } from "zustand";
import type { PaymentMethod } from "@/lib/data/schemas";

export type PosDialog =
  | "payment" | "discount" | "orderTax" | "shipping" | "points" | "suspend" | "suspended" | "recent"
  | "registerDetails" | "registerClose" | "expense" | "addCustomer" | "scale" | "shortcuts" | "receipt" | "cancel";
export type PaymentMode = "multiple" | PaymentMethod;

type State = {
  open: PosDialog | null;
  paymentMode: PaymentMode;
  receiptId: string | null;
  show: (d: PosDialog) => void;
  showPayment: (mode: PaymentMode) => void;
  showReceipt: (id: string) => void;
  hide: () => void;
};

/** Exactly one POS dialog at a time; hotkeys and buttons both go through here. */
export const usePosDialogs = create<State>()((set) => ({
  open: null,
  paymentMode: "multiple",
  receiptId: null,
  show: (open) => set({ open }),
  showPayment: (paymentMode) => set({ open: "payment", paymentMode }),
  showReceipt: (receiptId) => set({ open: "receipt", receiptId }),
  hide: () => set({ open: null }),
}));

/** Name of the cart line a checkout error pointed at (stock, serials, gone); CartRow rings and expands it. */
export const useCartFlag = create<{ name: string | null; flag: (name: string | null) => void }>()((set) => ({
  name: null,
  flag: (name) => set({ name }),
}));
