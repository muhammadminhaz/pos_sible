import type { Metadata, Viewport } from "next";
import { Anek_Bangla, Inter } from "next/font/google";
import { getLocale, getMessages } from "next-intl/server";
import { SITE } from "@/lib/site";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const anekBangla = Anek_Bangla({
  variable: "--font-anek-bangla",
  subsets: ["bengali", "latin"],
  display: "swap",
});

const fullTitle = `${SITE.name}: ${SITE.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: fullTitle, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [...SITE.keywords],
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  publisher: SITE.name,
  category: "business",
  // Phone numbers and addresses in the page text are not links unless we make them so.
  formatDetection: { telephone: false, email: false, address: false },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: fullTitle,
    description: SITE.description,
    url: "/",
    locale: "en_US",
    alternateLocale: ["bn_BD"],
  },
  twitter: { card: "summary_large_image", title: fullTitle, description: SITE.description },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  appleWebApp: { capable: true, title: SITE.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: SITE.themeColor },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
  width: "device-width",
  initialScale: 1,
};

/** Tells search engines what this is: one software application, available in two languages. */
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE.url}/#organization`, name: SITE.name, url: SITE.url, logo: `${SITE.url}/logo-512.png` },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE.url}/#app`,
      name: SITE.name,
      description: SITE.description,
      url: SITE.url,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, installable on Android, iOS and desktop",
      inLanguage: ["en", "bn"],
      publisher: { "@id": `${SITE.url}/#organization` },
    },
    { "@type": "WebSite", "@id": `${SITE.url}/#website`, name: SITE.name, url: SITE.url, inLanguage: ["en", "bn"], publisher: { "@id": `${SITE.url}/#organization` } },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${anekBangla.variable}`}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </head>
      <body className="min-h-dvh">
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
