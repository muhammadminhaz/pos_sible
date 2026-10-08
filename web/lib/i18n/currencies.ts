import type { GlideOption } from "@/components/ui/glide-select";

/** The symbol people write for a currency ("৳", "$", "€"), or the code when it has none. */
export function currencySymbol(code: string, locale = "en"): string {
  const part = new Intl.NumberFormat(locale, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((p) => p.type === "currency");
  return part?.value ?? code;
}

/** Every currency the runtime knows, as "৳  Bangladeshi Taka (BDT)"; the closed dropdown shows "৳ BDT". Searchable by code too. */
export function currencyOptions(locale = "en"): GlideOption[] {
  const names = new Intl.DisplayNames([locale], { type: "currency" });
  return Intl.supportedValuesOf("currency").map((code) => {
    const symbol = currencySymbol(code, locale);
    return { value: code, label: `${symbol}  ${names.of(code) ?? code} (${code})`, chip: `${symbol} ${code}`, keywords: code };
  });
}
