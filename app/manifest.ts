import type { MetadataRoute } from "next";

/** Lets a tablet or phone install pos_sible to the home screen and open it like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "pos_sible",
    short_name: "pos_sible",
    description: "Point of sale, inventory and accounting for retail",
    start_url: "/home",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#4f46e5",
    icons: [
      { src: "/logo-192.png", sizes: "192x192", type: "image/png" },
      { src: "/logo-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
