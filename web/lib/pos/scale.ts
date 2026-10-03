export type ScaleSettings = { prefix: string; skuLength: number; qtyLength: number; qtyDecimalLength: number };

/** Weighing-scale label: prefix + SKU + integer qty digits + decimal qty digits (+ optional check digit). */
export function parseScaleBarcode(code: string, s: ScaleSettings): { sku: string; qty: number } | null {
  const c = code.trim();
  if (!s.prefix || !c.startsWith(s.prefix)) return null;
  const body = c.slice(s.prefix.length);
  const need = s.skuLength + s.qtyLength + s.qtyDecimalLength;
  if (body.length < need) return null;
  const sku = body.slice(0, s.skuLength);
  const int = body.slice(s.skuLength, s.skuLength + s.qtyLength);
  const dec = body.slice(s.skuLength + s.qtyLength, need);
  if (!/^\d+$/.test(int + dec)) return null;
  const qty = Number(`${int}.${dec || "0"}`);
  return qty > 0 ? { sku, qty } : null;
}
