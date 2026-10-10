import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postgresAvailable } from "./helpers";

const up = await postgresAvailable();

describe.runIf(up)("waitlist", () => {
  let wl: typeof import("@/lib/server/waitlist");
  let poolMod: typeof import("@/lib/server/pool");
  const tag = `w${Date.now().toString(36)}`;
  const email = `${tag}@example.com`;

  beforeAll(async () => {
    wl = await import("@/lib/server/waitlist");
    poolMod = await import("@/lib/server/pool");
    await poolMod.ready();
  }, 60_000);

  afterAll(async () => {
    await poolMod.pool().query("DELETE FROM waitlist WHERE email LIKE $1", [`${tag}%`]);
    await poolMod.pool().query("DELETE FROM rate_limits WHERE key LIKE $1", [`waitlist:${tag}%`]);
    await poolMod.pool().end();
  });

  it("normalises the email and rejects junk", () => {
    expect(wl.waitlistEmail.parse("  A.B@Example.COM ")).toBe("a.b@example.com");
    expect(wl.waitlistEmail.safeParse("not-an-email").success).toBe(false);
  });

  it("stores one row per email and answers the same on a repeat", async () => {
    expect(await wl.joinWaitlist(email, `${tag}-1`)).toBe("ok");
    expect(await wl.joinWaitlist(email, `${tag}-1`)).toBe("ok");
    const rows = await poolMod.pool().query("SELECT 1 FROM waitlist WHERE email = $1", [email]);
    expect(rows.rowCount).toBe(1);
  });

  it("throttles one IP after five joins", async () => {
    const ip = `${tag}-2`;
    for (let i = 0; i < 5; i++) expect(await wl.joinWaitlist(`${tag}+${i}@example.com`, ip)).toBe("ok");
    expect(await wl.joinWaitlist(`${tag}+x@example.com`, ip)).toBe("throttled");
  });
});
