import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_MODE } from "@/lib/data/api/mode";
import { SITE } from "@/lib/site";
import { Waitlist } from "@/features/waitlist/Waitlist";

export const metadata: Metadata = { title: { absolute: `${SITE.name}: ${SITE.tagline}` }, alternates: { canonical: "/" } };

/** The public home page. A signed-in visitor goes straight to the app (demo mode does it in the browser, see SignedInRedirect). */
export default async function RootPage() {
  if (API_MODE && (await cookies()).has("posible_sid")) redirect("/home");
  return <Waitlist />;
}
