import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const LOCALES = ["en", "bn"] as const;
export type Locale = (typeof LOCALES)[number];

export default getRequestConfig(async () => {
  const cookie = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale: Locale = cookie === "bn" ? "bn" : "en";
  return {
    locale,
    timeZone: "Asia/Dhaka",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
