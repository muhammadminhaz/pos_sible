import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/** The sign-in pages are public; the shop itself and the platform console are private, and the API is not a page. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/login", "/signup"], disallow: ["/admin", "/api/"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
