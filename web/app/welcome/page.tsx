import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { Welcome } from "@/features/welcome/Welcome";

// ponytail: noindex while / is still the waitlist; drop it when this moves to /.
export const metadata: Metadata = {
  title: { absolute: `${SITE.name}: ${SITE.tagline}` },
  robots: { index: false, follow: false },
  alternates: { canonical: "/welcome" },
};

export default function WelcomePage() {
  return <Welcome />;
}
