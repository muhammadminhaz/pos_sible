import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postgresAvailable } from "./helpers";

const up = await postgresAvailable();

describe.runIf(up)("durable throttling and audit", () => {
  let throttle: typeof import("@/lib/server/throttle");
  let poolMod: typeof import("@/lib/server/pool");
  let store: typeof import("@/lib/server/store");
  const tag = `t${Date.now().toString(36)}`;

  beforeAll(async () => {
    throttle = await import("@/lib/server/throttle");
    poolMod = await import("@/lib/server/pool");
    store = await import("@/lib/server/store");
    await poolMod.ready();
  }, 60_000);

  afterAll(async () => {
    await poolMod.pool().query("DELETE FROM rate_limits WHERE key LIKE $1", [`${tag}%`]);
    await poolMod.pool().end();
  });

  it("locks a key after the limit, counts concurrent failures exactly, and clears", async () => {
    const key = `${tag}-a`;
    await Promise.all(Array.from({ length: 5 }, () => throttle.recordFail(key, 60_000)));
    expect((await poolMod.pool().query("SELECT hits FROM rate_limits WHERE key = $1", [key])).rows[0].hits).toBe(5); // no lost updates
    expect(await throttle.throttled(key, 5, 60_000)).toBe(true);
    expect(await throttle.throttled(key, 6, 60_000)).toBe(false);
    await throttle.clearFails(key);
    expect(await throttle.throttled(key, 1, 60_000)).toBe(false);
  });

  it("starts a fresh window once the old one has passed, and the count is shared through the database", async () => {
    const key = `${tag}-b`;
    for (let i = 0; i < 3; i++) await throttle.recordFail(key, 60_000);
    await poolMod.pool().query("UPDATE rate_limits SET window_start = now() - interval '2 minutes' WHERE key = $1", [key]);
    expect(await throttle.throttled(key, 3, 60_000)).toBe(false); // the old window no longer counts
    await throttle.recordFail(key, 60_000);
    expect((await poolMod.pool().query("SELECT hits FROM rate_limits WHERE key = $1", [key])).rows[0].hits).toBe(1);
  });

  it("writes the audit row in the same transaction as the change, and none when the change fails", async () => {
    const { createBusiness } = await import("@/lib/server/tenants");
    const { businessId } = await createBusiness({ name: `Audit ${tag}`, admin: { username: `audit${tag}`, password: "owner-pass-1", firstName: "A" } });
    try {
      const count = async () => Number((await poolMod.pool().query("SELECT count(*) AS n FROM audit_log WHERE business_id = $1", [businessId])).rows[0].n);
      const crud = (await import("@/lib/server/rpc"));
      const owner = (await poolMod.pool().query("SELECT user_id FROM logins WHERE business_id = $1 AND user_id = 'user_admin'", [businessId])).rows[0].user_id as string;
      const role = (await store.loadBusiness(businessId)).db.roles[0];
      const call = (name: string) => crud.handleRpc({ businessId, userId: owner, role }, { service: "crud:brands", method: "create", args: [{ name, description: "" }] });
      expect((await call("One")).ok).toBe(true);
      expect(await count()).toBe(1);
      // A failing audit insert must roll the data change back too.
      await poolMod.pool().query("ALTER TABLE audit_log ADD CONSTRAINT audit_fail CHECK (method <> 'create') NOT VALID");
      try {
        expect((await call("Two")).ok).toBe(false);
      } finally {
        await poolMod.pool().query("ALTER TABLE audit_log DROP CONSTRAINT audit_fail");
      }
      const brands = (await crud.handleRpc({ businessId, userId: owner, role }, { service: "crud:brands", method: "all", args: [] })) as { ok: true; result: { name: string }[] };
      const names = brands.result.map((b) => b.name);
      expect(names).toContain("One");
      expect(names).not.toContain("Two");
    } finally {
      await poolMod.pool().query("DELETE FROM audit_log WHERE business_id = $1", [businessId]);
      await poolMod.pool().query("DELETE FROM businesses WHERE id = $1", [businessId]);
    }
  });
});
