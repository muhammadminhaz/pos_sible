import { ROUTES } from "./routes";

/** Screens that are not in the route table (they have their own layouts). */
const EXTRA: Record<string, string> = { "/home": "home", "/pos": "pos" };

/** Route patterns as regexes, most specific first, so "/products/new" wins over "/products/[id]". */
const PATTERNS = [...Object.entries(ROUTES).map(([pattern, meta]) => [pattern, meta.title] as const), ...Object.entries(EXTRA)]
  .map(([pattern, key]) => ({
    key,
    dynamic: (pattern.match(/\[/g) ?? []).length,
    length: pattern.length,
    re: new RegExp(`^${pattern.replace(/\[[^\]]+\]/g, "[^/]+")}/?$`),
  }))
  .sort((a, b) => a.dynamic - b.dynamic || b.length - a.length);

/** The `nav.*` message key naming the page at `pathname`, or undefined for an unknown address. */
export function routeTitleKey(pathname: string): string | undefined {
  return PATTERNS.find((p) => p.re.test(pathname))?.key;
}
