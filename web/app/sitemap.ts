import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/** Only the pages anyone can open. Everything else sits behind a sign-in and says so with noindex. */
export default function sitemap(): MetadataRoute.Sitemap {
      const pages: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE.url}/login`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE.url}/contact`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE.url}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
  if (process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true") pages.push({ url: `${SITE.url}/signup`, changeFrequency: "monthly", priority: 0.8 });
  return pages;
}
