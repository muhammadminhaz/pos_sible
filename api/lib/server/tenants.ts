import { randomUUID } from "node:crypto";
import type { DB } from "@/lib/data/schemas";
import { createSeed } from "@/lib/data/seed";
import { SEED_USER } from "@/lib/data/seed/mk";
import { hashPassword } from "./passwords";
import { pool } from "./pool";
import { insertBusiness } from "./store";

export type NewBusiness = {
  name: string;
  admin: { username: string; password: string; firstName: string; lastName?: string; email?: string };
};

/** Seed data comes with throwaway passwords; a real business never keeps them. */
function lockDemoAccounts(db: DB, tag: string): void {
  for (const u of db.users) {
    if (u.id === SEED_USER) continue;
    u.username = `${u.username}.${tag}`; // usernames are unique across all businesses
    u.allowLogin = false;
  }
}

/** A new business: the sample shop, one admin with the chosen credentials, and the welcome wizard still to run. */
export async function createBusiness(input: NewBusiness): Promise<{ businessId: string }> {
  const id = randomUUID();
  const db = createSeed();
  lockDemoAccounts(db, id.slice(0, 6));
  const admin = db.users.find((u) => u.id === SEED_USER)!;
  Object.assign(admin, {
    username: input.admin.username.trim(), password: hashPassword(input.admin.password), firstName: input.admin.firstName.trim(),
    lastName: input.admin.lastName?.trim() ?? "", email: input.admin.email?.trim() ?? "",
  });
  for (const u of db.users) if (u.id !== SEED_USER) u.password = hashPassword(randomUUID());
  db.settings.business.name = input.name.trim();
  db.meta.onboarding = { done: false };
  await insertBusiness(id, db);
  return { businessId: id };
}

/** First start on an empty database: create the public demo shop (admin / 112233 …) unless told not to. */
export async function seedDemoIfEmpty(): Promise<void> {
  if (process.env.POS_SEED_DEMO === "false") return;
  if (process.env.NODE_ENV === "production" && process.env.POS_SEED_DEMO !== "true") return;
  const client = await pool().connect();
  try {
    // Two servers starting together must not both seed.
    await client.query("SELECT pg_advisory_lock(727002)");
    const { rows } = await client.query("SELECT 1 FROM businesses LIMIT 1");
    if (rows.length) return;
    const db = createSeed();
    const hashed = hashPassword("112233"); // one hash for every demo account keeps start-up quick
    for (const u of db.users) u.password = hashed;
    db.settings.business.name = "pos_sible demo";
    await insertBusiness(randomUUID(), db);
  } finally {
    await client.query("SELECT pg_advisory_unlock(727002)").catch(() => {});
    client.release();
  }
}
