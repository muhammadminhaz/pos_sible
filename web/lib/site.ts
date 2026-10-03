/** What the product is called and how it describes itself, in one place for the page head, social previews, manifest and sitemap. */
export const SITE = {
  name: "POS-sible",
  tagline: "Point of sale, inventory and accounting for retail",
  description:
    "POS-sible is a point of sale and back office for retail shops: fast checkout with barcode scanning and split payments, products and stock across locations, purchases, expenses, accounts, and reports. Works in English and Bangla.",
  /** The public address, used for canonical links and social previews. Set NEXT_PUBLIC_SITE_URL on the deployment. */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://pos-sible.vercel.app").replace(/\/+$/, ""),
  keywords: [
    "point of sale", "POS software", "retail POS", "inventory management", "stock management", "billing software",
    "accounting software", "barcode scanner POS", "multi-location retail", "Bangladesh POS", "Bangla POS", "POS-sible",
  ],
  themeColor: "#4f46e5",
} as const;

/** "Products · POS-sible" */
export const withSiteName = (page: string) => `${page} · ${SITE.name}`;
