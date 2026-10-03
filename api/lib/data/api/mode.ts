/**
 * "local": the browser keeps everything itself (the original demo, no server needed).
 * "api":   every service call goes to the Postgres-backed server over /api/rpc.
 * Set NEXT_PUBLIC_DATA_MODE at build time.
 */
export const API_MODE = process.env.NEXT_PUBLIC_DATA_MODE === "api";
