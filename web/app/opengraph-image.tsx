import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CHIPS = ["POS & barcode", "Inventory", "Accounts", "Reports", "English + বাংলা"];

/** The picture shown when a Pos-sible link is shared: the mark, the name, what it does, and a rising sales line. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #4338ca 100%)", color: "white", fontFamily: "sans-serif" }}>
        {/* soft colour behind everything */}
        <div style={{ position: "absolute", top: -180, right: -120, width: 620, height: 620, borderRadius: 620, background: "rgba(129,140,248,0.35)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: -260, left: -160, width: 640, height: 640, borderRadius: 640, background: "rgba(16,185,129,0.18)", display: "flex" }} />

        {/* the sales line, running along the bottom */}
        <svg width="1200" height="200" viewBox="0 0 1200 260" preserveAspectRatio="none" style={{ position: "absolute", left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a5b4fc" stopOpacity="0.35" />
              <stop offset="1" stopColor="#a5b4fc" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#a5b4fc" />
              <stop offset="1" stopColor="#34d399" />
            </linearGradient>
          </defs>
          <path d="M0 210 C 140 205, 190 150, 320 160 S 520 215, 640 150 S 860 60, 1000 80 S 1130 40, 1200 20 L1200 260 L0 260 Z" fill="url(#fill)" />
          <path d="M0 210 C 140 205, 190 150, 320 160 S 520 215, 640 150 S 860 60, 1000 80 S 1130 40, 1200 20" fill="none" stroke="url(#line)" strokeWidth="7" strokeLinecap="round" />
          <circle cx="1000" cy="80" r="11" fill="#34d399" />
        </svg>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 84px 70px", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* the app mark: indigo tile, receipt, rising line */}
            <svg width="132" height="132" viewBox="0 0 64 64" style={{ borderRadius: 29 }}>
              <defs>
                <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#6366f1" />
                  <stop offset="1" stopColor="#4338ca" />
                </linearGradient>
              </defs>
              <rect width="64" height="64" fill="url(#tile)" />
              <path d="M16 11h32a2 2 0 0 1 2 2v39l-4.5-3.2-4.5 3.2-4.5-3.2-4.5 3.2-4.5-3.2-4.5 3.2-1.5-1V13a2 2 0 0 1 2-2z" fill="#fff" />
              <path d="M20 40l7-8 6 5 10-13" fill="none" stroke="#4f46e5" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="43" cy="24" r="3.1" fill="#10b981" />
              <path d="M20 21h12" stroke="#c7d2fe" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div style={{ display: "flex", fontSize: 128, fontWeight: 800, letterSpacing: -4, marginLeft: 36 }}>{SITE.name}</div>
          </div>
          <div style={{ display: "flex", marginTop: 34, fontSize: 42, fontWeight: 500, color: "#e0e7ff", maxWidth: 1040, lineHeight: 1.2 }}>{SITE.tagline}</div>
          <div style={{ display: "flex", flexWrap: "wrap", marginTop: 34 }}>
            {CHIPS.map((c) => (
              <div key={c} style={{ display: "flex", marginRight: 14, marginBottom: 12, padding: "10px 24px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.28)", fontSize: 26, color: "#eef2ff" }}>{c}</div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
