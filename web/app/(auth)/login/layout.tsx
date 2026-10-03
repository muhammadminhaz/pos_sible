import type { Metadata } from "next";
import { SITE } from "@/lib/site";

const description = `Sign in to ${SITE.name}, the point of sale, inventory and accounting system for retail shops. Business owners and staff sign in here.`;

export const metadata: Metadata = {
  title: "Sign in",
  description,
  alternates: { canonical: "/login" },
  openGraph: { title: `Sign in · ${SITE.name}`, description, url: "/login", type: "website", siteName: SITE.name, images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${SITE.name}: ${SITE.tagline}` }] },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
