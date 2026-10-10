/**
 * "local": the browser keeps everything itself (the original demo, no server needed).
 * "api":   every service call goes to the Postgres-backed server over /api/rpc.
 * Set NEXT_PUBLIC_DATA_MODE at build time.
 */
export const BUILD_API_MODE = process.env.NEXT_PUBLIC_DATA_MODE === "api";

/** sessionStorage key that marks this tab as the public demo (/demo). Gone when the tab closes. */
export const DEMO_FLAG = "posible:demo";

function readDemoFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(DEMO_FLAG) === "1";
  } catch {
    return false;
  }
}

/**
 * This tab runs the public demo: the same services as the server, but on a freshly seeded shop kept in this browser.
 * Read once at load, so entering or leaving the demo reloads the page (see lib/demo.ts).
 */
export const DEMO = readDemoFlag();

/** Data goes to the server. Always false in a demo tab, even on an API build. */
export const API_MODE = BUILD_API_MODE && !DEMO;
