import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The hero's outlines and threads (TiltBackground's WIDE layout), redrawn for a 1200x630 card.
const BOXES = [
  { x: 40, y: 60, w: 220, h: 140 },
  { x: 90, y: 250, w: 170, h: 200 },
  { x: 30, y: 500, w: 240, h: 150 },
  { x: 930, y: 40, w: 240, h: 160 },
  { x: 960, y: 250, w: 190, h: 190 },
  { x: 900, y: 490, w: 270, h: 160 },
  { x: 360, y: -60, w: 480, h: 200 },
];
const THREADS = "M260 130 H360 M270 480 H330 M840 120 H930 M960 345 H900";
const DOTS = [[260, 130], [360, 130], [330, 480], [840, 120], [930, 120], [900, 345]];

/** The picture shown when a POS-sible link is shared: the hero's blue, its threads, the logo, and one line on what it does. */
export default async function OpenGraphImage() {
  const logo = `data:image/png;base64,${(await readFile(join(process.cwd(), "public/logo-192.png"))).toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          color: "white",
          // Electric blue base, a deeper pool top-left, a bright bloom top-right, and the hero's pale sky haze rising from the bottom-right.
          backgroundColor: "#0a3cff",
          backgroundImage: [
            "radial-gradient(ellipse 60% 70% at 88% 108%, rgba(230,246,255,0.95), rgba(159,208,255,0.6) 40%, transparent 72%)",
            "radial-gradient(ellipse 45% 55% at 100% 0%, rgba(63,130,255,0.85), transparent 70%)",
            "radial-gradient(ellipse 55% 70% at 0% 0%, rgba(4,22,140,0.9), transparent 70%)",
            "radial-gradient(ellipse 40% 50% at 10% 100%, rgba(26,79,255,0.9), transparent 70%)",
            "linear-gradient(160deg, #0a3cff 0%, #1a4fff 50%, #3f82ff 100%)",
          ].join(", "),
        }}
      >
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
          <g fill="none" stroke="white" strokeOpacity="0.18" strokeWidth="1.5">
            {BOXES.map((b) => <rect key={`${b.x}-${b.y}`} x={b.x} y={b.y} width={b.w} height={b.h} rx="26" />)}
            <path d={THREADS} />
          </g>
          {DOTS.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="white" fillOpacity="0.4" />)}
        </svg>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: "100%", padding: "0 110px" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 26px 10px 10px", borderRadius: 999, background: "#05050a" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img */}
            <img src={logo} width={56} height={56} alt="" style={{ borderRadius: 14 }} />
            <div style={{ display: "flex", marginLeft: 16, fontSize: 32, letterSpacing: -0.5 }}>{SITE.name}</div>
          </div>
          <div style={{ display: "flex", marginTop: 44, fontSize: 70, lineHeight: 1.05, letterSpacing: -2.8, textAlign: "center", maxWidth: 980, textShadow: "0 6px 40px rgba(4,22,140,0.45)" }}>
            The POS that reads your sales and tells you what to do next.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
