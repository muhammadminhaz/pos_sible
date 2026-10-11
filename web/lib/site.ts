/** What the product is called and how it describes itself, in one place for the page head, social previews, manifest and sitemap. */
export const SITE = {
  name: "POS-sible",
  tagline: "More than a POS",
  description:
    "POS-sible is more than a POS. It adds an intelligence layer on top of your sales, stock, customers and dues that drives your decisions: what to restock, who to win back, which dues to collect, where to raise prices. Includes barcode checkout, split payments, inventory, accounts and reports in English and Bangla.",
  /** The public address, used for canonical links and social previews. Set NEXT_PUBLIC_SITE_URL on the deployment. */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://pos-sible.vercel.app").replace(/\/+$/, ""),
  /** The sales and support address, offered on /contact. NEXT_PUBLIC_CONTACT_EMAIL overrides it; set it empty to hide email. */
  contactEmail: (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@skorbit-labs.com") || null,
  /** Booking page for a discovery call, offered on /contact. NEXT_PUBLIC_DISCOVERY_CALL_URL overrides it; set it empty to hide booking. */
  discoveryCallUrl: (process.env.NEXT_PUBLIC_DISCOVERY_CALL_URL ?? "https://cal.com/asiful-islam-dm/30min") || null,
  keywords: [
    "point of sale", "POS with analytics", "business growth software", "POS software", "retail POS", "inventory management", "stock management", "billing software",
    "accounting software", "barcode scanner POS", "multi-location retail", "Bangladesh POS", "Bangla POS", "POS-sible",
  ],
  themeColor: "#0a3cff",
} as const;

/**
 * Where "Get started" goes. Accounts are created by the platform owner after a sales call and payment, so by default it is
 * the contact page; only a deployment that allows self sign-up (NEXT_PUBLIC_ALLOW_SIGNUP=true) sends people to /signup.
 */
export const getStarted = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true" ? "/signup" : "/contact";

/** The contact page, carrying what the visitor wants to talk about: a plan id from pricing, or a topic such as "support". */
export const contactHref = (q?: { plan?: string; topic?: string }) => (q?.plan ? `/contact?plan=${q.plan}` : q?.topic ? `/contact?topic=${q.topic}` : "/contact");

/** The booking page with `topic` in its notes (Cal.com reads `notes`; other tools ignore it), or null when no booking page is set. */
export function bookingHref(topic: string) {
  if (!SITE.discoveryCallUrl) return null;
  const url = new URL(SITE.discoveryCallUrl);
  url.searchParams.set("notes", topic);
  return url.toString();
}

/** A new email to sales with `topic` as the subject, or null when no address is set. */
export const emailHref = (topic: string) => (SITE.contactEmail ? `mailto:${SITE.contactEmail}?subject=${encodeURIComponent(topic)}` : null);

/** "Products · POS-sible" */
export const withSiteName = (page: string) => `${page} · ${SITE.name}`;
