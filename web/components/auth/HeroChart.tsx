/** Decorative sales-growth illustration for the sign-in page: area chart, bars and floating KPI chips. */
export function HeroChart({ className }: { className?: string }) {
  const bars = [38, 52, 44, 66, 58, 80, 72, 96];
  return (
    <svg viewBox="0 0 480 300" role="img" aria-label="Sales growth chart" className={className}>
      <defs>
        <linearGradient id="hc-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a5b4fc" stopOpacity="0.55" />
          <stop offset="1" stopColor="#a5b4fc" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hc-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <g stroke="#ffffff" strokeOpacity="0.14">
        {[60, 110, 160, 210, 260].map((y) => <line key={y} x1="24" x2="456" y1={y} y2={y} />)}
      </g>
      {bars.map((h, i) => (
        <rect key={i} className="grow-bar" style={{ animationDelay: `${0.1 + i * 0.07}s` }} x={40 + i * 52} y={260 - h * 1.5} width="28" height={h * 1.5} rx="6" fill="url(#hc-bar)" />
      ))}
      <path d="M30 220 C 80 200, 110 210, 150 170 S 230 150, 270 120 S 360 100, 400 62 L 452 40 L 452 260 L 30 260 Z" fill="url(#hc-area)" />
      <path className="draw-line" style={{ ["--len" as string]: 560 }} d="M30 220 C 80 200, 110 210, 150 170 S 230 150, 270 120 S 360 100, 400 62 L 452 40" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="452" cy="40" r="7" fill="#34d399" stroke="#ffffff" strokeWidth="3" />
      <g className="float-slow">
        <rect x="286" y="6" width="150" height="38" rx="12" fill="#ffffff" fillOpacity="0.95" />
        <text x="300" y="22" fontSize="10" fill="#6b7280" fontFamily="Inter, sans-serif">Today&apos;s sales</text>
        <text x="300" y="37" fontSize="14" fontWeight="700" fill="#312e81" fontFamily="Inter, sans-serif">৳ 1,24,580</text>
        <text x="392" y="37" fontSize="11" fontWeight="700" fill="#059669" fontFamily="Inter, sans-serif">▲ 18%</text>
      </g>
    </svg>
  );
}
