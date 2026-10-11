import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const serif = Cormorant_Garamond({ subsets: ["latin"], weight: "500", style: "italic", variable: "--font-serif", display: "swap" });

/** The landing page's type: Geist for text, Geist Mono for labels, Cormorant italic for the accent words. Put on the page root. */
export const landingFonts = cn(geist.variable, mono.variable, serif.variable);
