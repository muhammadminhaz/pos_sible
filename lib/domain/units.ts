export type UnitLike = { id: string; baseUnitId?: string | null; multiplier?: number | null };

/** Converts a quantity in `unit` to its base unit (a unit without a base is its own base). */
export function toBaseQty(qty: number, unit: UnitLike): number {
  return unit.baseUnitId && unit.multiplier ? qty * unit.multiplier : qty;
}

export function fromBaseQty(baseQty: number, unit: UnitLike): number {
  return unit.baseUnitId && unit.multiplier ? baseQty / unit.multiplier : baseQty;
}
