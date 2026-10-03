import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import bn from "@/messages/bn.json";
import en from "@/messages/en.json";

const ROOT = new URL("..", import.meta.url).pathname;
const get = (tree: unknown, key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], tree);

function files(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (["node_modules", ".next", "messages"].includes(f)) continue;
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) out.push(p);
  }
  return out;
}

describe("every translation key used in the code exists in both languages", () => {
  it("t(\"literal\") calls resolve", () => {
    const missing: string[] = [];
    let checked = 0;
    for (const dir of ["app", "components", "features", "lib"]) {
      for (const file of files(join(ROOT, dir))) {
        const src = readFileSync(file, "utf8");
        if (!src.includes("useTranslations") && !src.includes("getTranslations")) continue;
        // Only files whose translators all share one namespace can be resolved with confidence.
        const spaces = new Set([...src.matchAll(/(?:useTranslations|getTranslations)\((?:"([^"]*)")?\)/g)].map((m) => m[1] ?? ""));
        if (spaces.size !== 1) continue;
        const ns = [...spaces][0];
        for (const m of src.matchAll(/(?<![\w.])t\("([A-Za-z][\w.]*)"/g)) {
          const key = ns ? `${ns}.${m[1]}` : m[1];
          // `t.has(...)` guarded lookups are allowed to miss.
          if (src.includes(`t.has(`) && src.includes(`"${m[1]}"`) && src.split(`"${m[1]}"`).length > 2) continue;
          checked++;
          for (const [lang, tree] of [["en", en], ["bn", bn]] as const) {
            if (typeof get(tree, key) !== "string") missing.push(`${lang}: ${key}  (${file.replace(ROOT, "")})`);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
    expect(missing).toEqual([]);
  });
});
