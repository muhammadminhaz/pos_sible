/** Sizes are in inches, as stored in the barcode settings. */
export type LabelSheet = {
  isContinuous: boolean;
  paperWidth: number;
  paperHeight: number | null;
  labelWidth: number;
  labelHeight: number;
  topMargin: number;
  leftMargin: number;
  rowDistance: number;
  colDistance: number;
  perRow: number;
  perSheet: number | null;
};

export const isValidLabelQty = (n: number) => Number.isInteger(n) && n >= 1;

/** `[{ item: A, qty: 2 }]` → `[A, A]`. Throws on a quantity that isn't a whole number ≥ 1. */
export function expandLabels<T>(entries: { item: T; qty: number }[]): T[] {
  return entries.flatMap(({ item, qty }) => {
    if (!isValidLabelQty(qty)) throw new RangeError(`Invalid label quantity: ${qty}`);
    return Array.from({ length: qty }, () => item);
  });
}

/** How many label rows fit on one sheet. A continuous roll has no page height, so it never breaks. */
export function rowsPerPage(s: LabelSheet): number {
  if (s.isContinuous || s.paperHeight == null) return Number.POSITIVE_INFINITY;
  return Math.max(1, Math.floor((s.paperHeight - s.topMargin + s.rowDistance + 1e-9) / (s.labelHeight + s.rowDistance)));
}

/** Labels per sheet: the configured count, or what fits when none is set. */
export function labelsPerPage(s: LabelSheet): number {
  if (s.isContinuous) return Number.POSITIVE_INFINITY;
  return s.perSheet ?? s.perRow * rowsPerPage(s);
}

/** Splits labels into sheets; a continuous roll is always a single page. */
export function paginateLabels<T>(labels: T[], s: LabelSheet): T[][] {
  if (labels.length === 0) return [];
  const per = labelsPerPage(s);
  if (!Number.isFinite(per)) return [labels];
  const pages: T[][] = [];
  for (let i = 0; i < labels.length; i += per) pages.push(labels.slice(i, i + per));
  return pages;
}
