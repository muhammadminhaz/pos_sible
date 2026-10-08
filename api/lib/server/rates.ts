import { pool, ready } from "./pool";

/** Rates come from a free, key-less feed that quotes every currency against 1 USD. */
const FEED = "https://open.er-api.com/v6/latest/USD";
const MAX_AGE_DAYS = 3;
const CHECK_EVERY_MS = 6 * 3_600_000;
const LOCK_KEY = 727002;

export type Rates = { perUsd: Map<string, number>; at: Date | null };

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * `amount` moved from one currency to another, to 2 decimals. With no rate for either side the amount is returned
 * unchanged (shown relabelled, as before rates existed) rather than guessed.
 */
export function convert(amount: number, from: string, to: string, rates: Pick<Rates, "perUsd">): number {
  if (from === to) return round2(amount);
  const a = rates.perUsd.get(from);
  const b = rates.perUsd.get(to);
  if (!a || !b) return round2(amount);
  return round2((amount / a) * b);
}

/** True when both currencies have a rate, so a conversion between them is real. */
export const canConvert = (from: string, to: string, rates: Pick<Rates, "perUsd">) => from === to || (rates.perUsd.has(from) && rates.perUsd.has(to));

/** What the feed sent, kept only if it is a plain map of currency code to a positive number. */
export function parseFeed(body: unknown): Map<string, number> {
  const out = new Map<string, number>();
  const raw = (body as { result?: string; rates?: Record<string, unknown> } | null) ?? {};
  if (raw.result !== "success" || !raw.rates || typeof raw.rates !== "object") return out;
  for (const [code, v] of Object.entries(raw.rates)) if (/^[A-Z]{3}$/.test(code) && typeof v === "number" && Number.isFinite(v) && v > 0) out.set(code, v);
  return out;
}

export async function getRates(): Promise<Rates> {
  await ready();
  const { rows } = await pool().query<{ code: string; per_usd: string; fetched_at: Date }>("SELECT code, per_usd, fetched_at FROM currency_rates");
  return { perUsd: new Map(rows.map((r) => [r.code, Number(r.per_usd)])), at: rows.reduce<Date | null>((m, r) => (!m || r.fetched_at > m ? r.fetched_at : m), null) };
}

/** Downloads the feed and stores every rate, replacing the old ones. Throws if the feed is down or sends nothing usable. */
export async function fetchAndStoreRates(): Promise<number> {
  await ready();
  const res = await fetch(FEED, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`rate feed answered ${res.status}`);
  const rates = parseFeed(await res.json());
  if (rates.size < 10) throw new Error("rate feed sent too few currencies");
  await pool().query(
    `INSERT INTO currency_rates (code, per_usd, fetched_at) SELECT code, rate, now() FROM unnest($1::text[], $2::numeric[]) AS t(code, rate)
     ON CONFLICT (code) DO UPDATE SET per_usd = EXCLUDED.per_usd, fetched_at = EXCLUDED.fetched_at`,
    [[...rates.keys()], [...rates.values()]],
  );
  return rates.size;
}

/** Refreshes only when the stored rates are older than 3 days, and only one API instance at a time does it. */
export async function refreshRatesIfStale(): Promise<"fresh" | "updated" | "busy"> {
  await ready();
  const client = await pool().connect();
  try {
    if (!(await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [LOCK_KEY])).rows[0].ok) return "busy";
    const stale = (await client.query<{ stale: boolean }>("SELECT COALESCE(MAX(fetched_at) < now() - make_interval(days => $1), true) AS stale FROM currency_rates", [MAX_AGE_DAYS])).rows[0].stale;
    if (!stale) return "fresh";
    await fetchAndStoreRates();
    return "updated";
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    client.release();
  }
}

declare global {
  var __posibleRateJob: ReturnType<typeof setInterval> | undefined;
}

/**
 * The 3-day job. It checks every 6 hours whether the stored rates are 3 days old, so a restart or a failed download
 * never leaves them stale for long, and several API instances share one refresh. Failures are logged, never thrown.
 */
export function startRateJob(): void {
  if (globalThis.__posibleRateJob || process.env.RATES_JOB === "off" || !process.env.DATABASE_URL) return;
  const run = () =>
    refreshRatesIfStale()
      .then((r) => r === "updated" && console.log("[rates] currency rates updated"))
      .catch((e) => console.error("[rates] could not update currency rates:", e instanceof Error ? e.message : e));
  void run();
  globalThis.__posibleRateJob = setInterval(run, CHECK_EVERY_MS);
  globalThis.__posibleRateJob.unref();
}
