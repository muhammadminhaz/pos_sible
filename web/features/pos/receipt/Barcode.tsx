import { code128 } from "@/lib/pos/barcode";

/** Inline SVG Code 128 (set B). One module = 1 viewBox unit; the SVG scales to its box. */
export function Barcode({ value, height = 40, className }: { value: string; height?: number; className?: string }) {
  const widths = code128(value);
  const total = widths.reduce((s, w) => s + w, 0) + 20; // 10-module quiet zone each side
  const bars = widths.map((w, i) => {
    const x = 10 + widths.slice(0, i).reduce((s, v) => s + v, 0);
    return i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={height} /> : null;
  });
  return (
    <svg viewBox={`0 0 ${total} ${height}`} preserveAspectRatio="none" className={className} role="img" aria-label={value} fill="currentColor">
      {bars}
    </svg>
  );
}
