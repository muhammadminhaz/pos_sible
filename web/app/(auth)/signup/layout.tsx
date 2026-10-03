import type { Metadata } from "next";
import { SITE } from "@/lib/site";

const description = `Create your shop on ${SITE.name} and start selling: products, stock, purchases, expenses, accounts and reports in one place.`;

export const metadata: Metadata = {
  title: "Create your shop",
  description,
  alternates: { canonical: "/signup" },
  openGraph: { title: `Create your shop · ${SITE.name}`, description, url: "/signup", type: "website", siteName: SITE.name, images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${SITE.name}: ${SITE.tagline}` }] },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
