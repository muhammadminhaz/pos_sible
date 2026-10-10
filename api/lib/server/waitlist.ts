import { z } from "zod";
import { pool, ready } from "./pool";
import { recordFail, throttled } from "./throttle";

export const waitlistEmail = z.string().trim().toLowerCase().email().max(254);

const LIMIT = 5;
const WINDOW_MS = 60 * 60_000;

/** Adds an email to the waitlist. Joining twice is not an error, so the answer never reveals who is already on it. */
export async function joinWaitlist(email: string, ip: string): Promise<"ok" | "throttled"> {
  await ready();
  const key = `waitlist:${ip}`;
  if (await throttled(key, LIMIT, WINDOW_MS)) return "throttled";
  await recordFail(key, WINDOW_MS);
  await pool().query("INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT DO NOTHING", [email]);
  return "ok";
}
