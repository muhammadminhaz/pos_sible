import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/** Lets a tablet or phone install POS-sible to the home screen and open it like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name}: ${SITE.tagline}`,
    short_name: SITE.name,
    description: SITE.description,
    id: "/",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fafafa",
    theme_color: SITE.themeColor,
    categories: ["business", "finance", "productivity"],
    lang: "en",
    icons: [
      { src: "/logo-192.png", sizes: "192x192", type: "image/png" },
      { src: "/logo-512.png", sizes: "512x512", type: "image/png" },
      { src: "/logo-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Open POS", url: "/pos", description: "Start selling" },
      { name: "Products", url: "/products" },
      { name: "Sales", url: "/sales" },
    ],
  };
}
