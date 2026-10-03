/** What the POS shows: skeleton while loading, the open-register form, or the register itself. */
export type GateState = "loading" | "locked" | "ready";

export function registerGate(location: unknown, register: { isPending: boolean; data?: unknown }): GateState {
  if (!location || register.isPending) return "loading";
  return register.data ? "ready" : "locked";
}
