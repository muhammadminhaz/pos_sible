"use server";

import { cookies } from "next/headers";
import type { Locale } from "@/i18n/request";

export async function setLocale(locale: Locale) {
  (await cookies()).set("NEXT_LOCALE", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
