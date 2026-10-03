/**
 * Database admin from the command line:
 *   npm run db:migrate   apply pending migrations
 *   npm run db:seed      create the public demo shop if the database has no business yet
 *   npm run db:create-business -- "Shop Name" username password "Owner Name"
 */
import { migrate, pool } from "../lib/server/pool";
import { createBusiness, seedDemoIfEmpty } from "../lib/server/tenants";

const [cmd, ...rest] = process.argv.slice(2);

async function main() {
  await migrate();
  if (cmd === "migrate") console.log("Database is up to date.");
  else if (cmd === "seed") {
    process.env.POS_SEED_DEMO = "true";
    await seedDemoIfEmpty();
    console.log("Demo shop ready (admin / 112233).");
  } else if (cmd === "create-business") {
    const [name, username, password, firstName] = rest;
    if (!name || !username || !password) throw new Error('Usage: npm run db:create-business -- "Shop Name" username password "Owner Name"');
    const { businessId } = await createBusiness({ name, admin: { username, password, firstName: firstName ?? username } });
    console.log(`Created ${name} (${businessId}). Sign in as ${username}.`);
  } else throw new Error("Unknown command. Use migrate, seed or create-business.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool().end());
