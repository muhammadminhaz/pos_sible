"use client";

import { useMemo, useState } from "react";
import { GlobeIcon } from "lucide-react";
import { getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import * as Flags from "country-flag-icons/react/3x2";
import { cn } from "cn";
import GlideSelect from "@/components/ui/glide-select";
import { Input } from "@/components/ui/input";

const POPULAR: CountryCode[] = ["BD", "IN", "PK", "AE", "SA", "MY", "SG", "GB", "US"];

/** True when `value` (international format, e.g. +8801711000111) is a real phone number. Empty is fine: the field is optional. */
export const isPhoneOk = (value: string) => value === "" || isValidPhoneNumber(value);

/** The country's flag as an inline SVG: flag emoji don't draw on Windows, these do everywhere. */
export function Flag({ country, className }: { country: string; className?: string }) {
  const Svg = (Flags as unknown as Record<string, React.ComponentType<{ className?: string; title?: string }>>)[country];
  return Svg ? <Svg aria-hidden className={cn("h-3.5 w-5 shrink-0 rounded-[3px] shadow-[0_0_0_1px_rgb(0_0_0/0.12)]", className)} /> : <GlobeIcon className={cn("size-4 shrink-0 text-muted-foreground", className)} />;
}

type Country = { code: CountryCode; name: string; dial: string };

function useCountries(): { popular: Country[]; all: Country[] } {
  return useMemo(() => {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    const all = getCountries()
      .map((code) => ({ code, name: names.of(code) ?? code, dial: `+${getCountryCallingCode(code)}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { popular: POPULAR.map((c) => all.find((x) => x.code === c)!).filter(Boolean), all };
  }, []);
}

/**
 * A phone field with a searchable country-code dropdown (flag, name, dial code). `value` is the full international
 * number or "" and `onChange` always gets that same format, so it can be stored as it comes.
 */
export function PhoneInput({ id, value, onChange, defaultCountry = "BD", "aria-label": ariaLabel }: { id?: string; value: string; onChange: (e164: string) => void; defaultCountry?: CountryCode; "aria-label"?: string }) {
  const { popular, all } = useCountries();
  const parsed = value ? parsePhoneNumberFromString(value) : undefined;
  const [country, setCountry] = useState<CountryCode>(parsed?.country ?? defaultCountry);
  const [national, setNational] = useState(parsed?.nationalNumber ?? "");
  const current = all.find((c) => c.code === country)!;

  const emit = (c: CountryCode, text: string) => {
    const digits = text.replace(/[^\d]/g, "");
    if (!digits) return onChange("");
    // Parsing drops a leading trunk "0" (01711… → 1711…) so what is stored is always proper E.164.
    const p = parsePhoneNumberFromString(digits, c);
    onChange(p ? p.number : `+${getCountryCallingCode(c)}${digits}`);
  };

  const invalid = value !== "" && !isValidPhoneNumber(value);
  const options = [...popular, ...all.filter((c) => !popular.includes(c))].map((c) => ({
    value: c.code,
    label: <span className="flex min-w-0 items-center gap-2"><Flag country={c.code} /><span className="truncate">{c.name}</span></span>,
    tag: c.dial,
    chip: <span className="flex items-center gap-1.5"><Flag country={c.code} />{c.dial}</span>,
    keywords: `${c.name} ${c.code}`,
  }));

  return (
    <div className="flex gap-2">
      <GlideSelect
        field
        searchable
        searchPlaceholder="Search country or code…"
        emptyText="No country found."
        ariaLabel={`Country code, ${current.name} ${current.dial}`}
        menuWidth={288}
        value={country}
        onChange={(c) => { setCountry(c as CountryCode); emit(c as CountryCode, national); }}
        options={options}
        className="w-28 shrink-0"
      />
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-invalid={invalid}
        placeholder="1711 000111"
        value={national}
        onChange={(e) => { setNational(e.target.value); emit(country, e.target.value); }}
      />
    </div>
  );
}
