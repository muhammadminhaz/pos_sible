export function nextRef(prefix: string, year: number, seq: number, digits = 4): string {
  return `${prefix}${year}/${String(seq).padStart(digits, "0")}`;
}

export type InvoiceSchemeLike = {
  prefix: string;
  startFrom: number;
  count: number;
  digits: number;
  numberingType: "sequential" | "random";
};

export function nextInvoiceNo(scheme: InvoiceSchemeLike, rand: () => number = Math.random): string {
  if (scheme.numberingType === "random") {
    const min = 10 ** (scheme.digits - 1);
    const n = Math.floor(min + rand() * (10 ** scheme.digits - min));
    return `${scheme.prefix}${n}`;
  }
  return `${scheme.prefix}${String(scheme.startFrom + scheme.count).padStart(scheme.digits, "0")}`;
}
