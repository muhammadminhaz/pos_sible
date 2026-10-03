import { randomUUID } from "node:crypto";
import type { DB } from "@/lib/data/schemas";
import { createSeed } from "@/lib/data/seed";
import { SEED_USER } from "@/lib/data/seed/mk";
import { hashPassword } from "./passwords";
import { defaultCode } from "./code";
import { pool } from "./pool";
import { insertBusiness } from "./store";

const DEMO_DAYS = 90;

export type NewBusiness = {
  name: string;
  admin: { username: string; password: string; firstName: string; lastName?: string; email?: string };
  /** What staff type at sign-in to reach this business. Defaults to the owner's username. */
  code?: string;
  /** A showcase account: a fresh random three months of sample data, and no welcome wizard. */
  demo?: boolean;
  /** Last chance to change the new business's data (names, roles, staff) before it is saved. */
  tailor?: (db: DB) => void;
};

/** Seed data comes with throwaway passwords; a real business never keeps them. */
function lockDemoAccounts(db: DB): void {
  for (const u of db.users) if (u.id !== SEED_USER) u.allowLogin = false;
}

/** A new business: the sample shop, one admin with the chosen credentials, and the welcome wizard still to run (not for a demo). */
export async function createBusiness(input: NewBusiness): Promise<{ businessId: string }> {
  const id = randomUUID();
  const db = input.demo ? createSeed({ seed: Math.floor(Math.random() * 2 ** 31), days: DEMO_DAYS }) : createSeed();
  lockDemoAccounts(db);
  const admin = db.users.find((u) => u.id === SEED_USER)!;
  Object.assign(admin, {
    username: input.admin.username.trim(), password: hashPassword(input.admin.password), firstName: input.admin.firstName.trim(),
    lastName: input.admin.lastName?.trim() ?? "", email: input.admin.email?.trim() ?? "",
  });
  for (const u of db.users) if (u.id !== SEED_USER) u.password = hashPassword(randomUUID());
  db.settings.business.name = input.name.trim();
  input.tailor?.(db);
  db.meta.onboarding = input.demo ? { done: true, mode: "demo", completedAt: new Date().toISOString(), checklistDismissed: true, visited: [] } : { done: false };
  await insertBusiness(id, db, input.code?.trim().toLowerCase() || defaultCode(input.admin.username));
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
    db.settings.business.name = "POS-sible demo";
    await insertBusiness(randomUUID(), db, "demo");
  } finally {
    await client.query("SELECT pg_advisory_unlock(727002)").catch(() => {});
    client.release();
  }
}
