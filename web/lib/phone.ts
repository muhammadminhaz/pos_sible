import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/** International form (+8801...) of a stored mobile; local numbers read as Bangladeshi. Null when it isn't a phone number. */
export function intlPhone(raw: string, country: CountryCode = "BD"): string | null {
  const p = parsePhoneNumberFromString(raw.trim(), country);
  return p?.isPossible() ? p.number : null;
}

export const telHref = (raw: string) => { const n = intlPhone(raw); return n ? `tel:${n}` : null; };

export const waHref = (raw: string, text: string) => { const n = intlPhone(raw); return n ? `https://wa.me/${n.slice(1)}?text=${encodeURIComponent(text)}` : null; };
