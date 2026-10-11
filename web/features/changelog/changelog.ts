import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ChangelogEntry, ChangelogKind, ChangelogMonth } from "@/components/arc/blocks/changelog-feed/changelog-feed";

const KINDS: Record<string, ChangelogKind> = { new: "new", improved: "improved", fixed: "fixed" };
const VERSION = /^###\s+v(\d+\.\d+\.\d+)\s+\((\d{4}-\d{2}-\d{2})\)\s*$/;
const ITEM = /^-\s+\*\*(New|Improved|Fixed):\s*(.+?)\.?\*\*\s*(.*)$/i;
const DETAIL = /^\s{2,}-\s+(.+)$/;

/**
 * Reads the `## Changelog` section of the README: `### vX.Y.Z (yyyy-mm-dd)` headings, each followed by
 * `- **New|Improved|Fixed: Title.** Summary.` lines with optional indented detail lines. Newest first, as written.
 */
export function parseChangelog(markdown: string): { entries: ChangelogEntry[]; months: ChangelogMonth[] } {
  const start = markdown.search(/^## Changelog\s*$/m);
  if (start < 0) return { entries: [], months: [] };
  const rest = markdown.slice(start).split("\n").slice(1);
  const end = rest.findIndex((l) => /^## /.test(l));
  const lines = end < 0 ? rest : rest.slice(0, end);

  const entries: ChangelogEntry[] = [];
  let version: { v: string; iso: string } | null = null;
  for (const line of lines) {
    const head = line.match(VERSION);
    if (head) { version = { v: head[1], iso: head[2] }; continue; }
    const item = version && line.match(ITEM);
    if (item && version) {
      const at = new Date(`${version.iso}T12:00:00Z`);
      entries.push({
        id: `${version.v}-${entries.length}`, version: version.v, iso: version.iso, month: version.iso.slice(0, 7),
        date: at.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        kind: KINDS[item[1].toLowerCase()], title: item[2].trim(), summary: item[3].trim(), details: [],
      });
      continue;
    }
    const detail = line.match(DETAIL);
    if (detail && entries.length) entries[entries.length - 1].details.push(detail[1].trim());
  }

  const months = [...new Set(entries.map((e) => e.month))].map((key) => {
    const at = new Date(`${key}-01T12:00:00Z`);
    return { key, label: at.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }), short: at.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) };
  });
  return { entries, months };
}

/** The repository README sits one level above the web app; it is read at build time, so the page is static. */
export async function readChangelog() {
  return parseChangelog(await readFile(join(process.cwd(), "..", "README.md"), "utf8").catch(() => ""));
}
