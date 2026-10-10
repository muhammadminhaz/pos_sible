/** What the product is called and how it describes itself, in one place for the page head, social previews, manifest and sitemap. */
export const SITE = {
  name: "POS-sible",
  tagline: "More than a POS",
  description:
    "POS-sible is more than a POS. It adds an intelligence layer on top of your sales, stock, customers and dues that drives your decisions: what to restock, who to win back, which dues to collect, where to raise prices. Includes barcode checkout, split payments, inventory, accounts and reports in English and Bangla.",
  /** The public address, used for canonical links and social previews. Set NEXT_PUBLIC_SITE_URL on the deployment. */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://pos-sible.vercel.app").replace(/\/+$/, ""),
  keywords: [
    "point of sale", "POS with analytics", "business growth software", "POS software", "retail POS", "inventory management", "stock management", "billing software",
    "accounting software", "barcode scanner POS", "multi-location retail", "Bangladesh POS", "Bangla POS", "POS-sible",
  ],
  themeColor: "#4f46e5",
} as const;

/** "Products · POS-sible" */
export const withSiteName = (page: string) => `${page} · ${SITE.name}`;
