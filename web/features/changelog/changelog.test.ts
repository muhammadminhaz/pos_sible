import { describe, expect, it } from "vitest";
import { parseChangelog, readChangelog } from "./changelog";

const SAMPLE = `# App

## Changelog

Intro line.

### v1.1.0 (2026-11-02)
- **Fixed: Receipts print once.** No more double receipts.
- **Improved: Faster search** Finds products as you type.
  - Works offline.

### v1.0.0 (2026-10-11)
- **New: Point of sale.** Sell fast.
  - Barcode scanning.
  - Receipts.

## Tech stack
- **New: Not a release.** Outside the section.
`;

describe("parseChangelog", () => {
  it("reads versions, kinds, titles, summaries and details from the Changelog section only", () => {
    const { entries, months } = parseChangelog(SAMPLE);
    expect(entries.map((e) => [e.version, e.kind, e.title, e.summary])).toEqual([
      ["1.1.0", "fixed", "Receipts print once", "No more double receipts."],
      ["1.1.0", "improved", "Faster search", "Finds products as you type."],
      ["1.0.0", "new", "Point of sale", "Sell fast."],
    ]);
    expect(entries[1].details).toEqual(["Works offline."]);
    expect(entries[2].details).toEqual(["Barcode scanning.", "Receipts."]);
    expect(entries[0]).toMatchObject({ iso: "2026-11-02", month: "2026-11", date: "Nov 2" });
    expect(months).toEqual([{ key: "2026-11", label: "November 2026", short: "Nov" }, { key: "2026-10", label: "October 2026", short: "Oct" }]);
  });

  it("returns nothing when there is no Changelog section", () => {
    expect(parseChangelog("# App\n\n## Features\n")).toEqual({ entries: [], months: [] });
  });

  it("the repository README has a v1.0.0 release", async () => {
    const { entries } = await readChangelog();
    expect(entries.some((e) => e.version === "1.0.0")).toBe(true);
    expect(entries.every((e) => e.title && e.summary)).toBe(true);
  });
});
