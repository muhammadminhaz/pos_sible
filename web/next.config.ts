import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// API mode: the browser keeps calling same-origin /api/*, and this rewrite forwards it to the separately deployed
// backend (the `api` project). Cookies stay first-party and no CORS is needed. Read at build time, so set it on Vercel.
const backend = process.env.BACKEND_URL?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  rewrites: async () => (backend ? [{ source: "/api/:path*", destination: `${backend}/api/:path*` }] : []),
};

export default withNextIntl(nextConfig);
