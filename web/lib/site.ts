/** What the product is called and how it describes itself, in one place for the page head, social previews, manifest and sitemap. */
export const SITE = {
  name: "POS-sible",
  tagline: "The POS that tells you what to do next",
  description:
    "POS-sible is a point of sale for retail shops that also finds your opportunities: stock about to run out, regulars who went quiet, old dues and dead stock, with a suggested next step for each. Includes barcode checkout, split payments, inventory, accounts and reports in English and Bangla.",
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
