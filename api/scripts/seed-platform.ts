/**
 * Sets up the platform's packages and a set of paying businesses with staff on different roles, for the admin console.
 *   npm run db:seed-platform
 *
 * Safe to run again: packages and module prices are rewritten to the values below, and a business is created only if
 * its code is not taken yet. There is no payment gateway, so the payments it records are manual entries, back-dated to
 * make a believable history. Every sign-in gets a random password that is printed once at the end and never stored in
 * clear text; nothing here uses a published password.
 */
import { randomBytes } from "node:crypto";
import { addDays, addMonths, subDays } from "date-fns";
import { PERMISSIONS } from "../lib/auth/permissions";
import { role as roleSchema, type DB } from "../lib/data/schemas";
import { MODULE_IDS, type ModuleId } from "../lib/server/plans";
import { hashPassword } from "../lib/server/passwords";
import { migrate, pool } from "../lib/server/pool";
import { setSubscription } from "../lib/server/platform";
import { createBusiness } from "../lib/server/tenants";

// ── Packages and prices (BDT per month) ─────────────────────────────────

type PlanDef = { id: string; label: string; maxUsers: number | null; price: number; description: string; benefits: string[] };
const PLANS: PlanDef[] = [
  {
    id: "starter", label: "Starter", maxUsers: 3, price: 700,
    description: "For a single-counter shop getting started.",
    benefits: ["Up to 3 staff sign-ins", "Products, customers, dashboard and settings included", "Add only the modules you need", "Backup and restore from Settings", "Email support, reply within 2 working days"],
  },
  {
    id: "standard", label: "Standard", maxUsers: 10, price: 1800,
    description: "For growing shops with a team to manage.",
    benefits: ["Up to 10 staff sign-ins", "Roles with per-area permissions and per-person module access", "Several locations with a branch switcher", "Backup and restore from Settings", "Phone and chat support, same working day"],
  },
  {
    id: "premium", label: "Premium", maxUsers: null, price: 3500,
    description: "For chains and busy multi-branch shops.",
    benefits: ["Unlimited staff sign-ins", "Everything in Standard", "Priority support by phone", "Help moving your records over", "A review call each quarter"],
  },
];
const MODULE_PRICE: Record<ModuleId, number> = { pos: 400, sales: 300, purchases: 300, stock: 250, expenses: 200, accounts: 400, reports: 500 };

// ── Roles added to a business, on top of Admin, Manager and Cashier ─────

const EXTRA_ROLES = {
  accountant: { id: "role_accountant", name: "Accountant", permissions: ["dashboard.view", "account.view", "account.create", "account.update", "expense.view", "expense.create", "expense.update", "purchase.view", "purchase.payments", "sell.view", "sell.payments", "report.view", "report.profit_loss"] },
  stock: { id: "role_stock", name: "Stock keeper", permissions: ["dashboard.view", "product.view", "product.create", "product.update", "product.opening_stock", "catalog.create", "catalog.update", "purchase.view", "purchase.create", "purchase.update", "stock_transfer.view", "stock_transfer.create", "stock_adjustment.view", "stock_adjustment.create", "report.stock"] },
  agent: { id: "role_agent", name: "Sales agent", permissions: ["dashboard.view", "contacts.customer", "customer.create", "product.view", "sell.view", "sell.create", "sell.update", "quotation.view", "draft.view", "discount.view", "pos.access"] },
} as const;
const ROLE_ID = { manager: "role_manager", cashier: "role_cashier", accountant: "role_accountant", stock: "role_stock", agent: "role_agent" } as const;
type RoleKey = keyof typeof ROLE_ID;

// The sample shop ships with seven staff records that its sales point at, so staff are written over those, in order.
const SLOTS = ["user_manager", "user_cashier", "user_nipun", "user_sales1", "user_sales2", "user_sales3", "user_tech"] as const;
const LOCS = ["loc_rango", "loc_nipun"] as const;

type Staff = { username: string; first: string; last: string; role: RoleKey; modules?: ModuleId[]; at?: 0 | 1; commission?: number };
type Spec = {
  name: string; code: string; owner: { username: string; first: string; last: string }; phone: string; email: string;
  plan: string; modules: ModuleId[] | null; free?: boolean;
  state: "active" | "expired" | "cancelled";
  /** Days from today until the paid period ends (negative once it has lapsed). */
  endsInDays: number;
  /** Terms paid, oldest first; the last one ends on `endsInDays`. */
  terms: number[];
  places: [string, string];
  staff: Staff[];
};

const SPECS: Spec[] = [
  {
    name: "Rango Electronics", code: "rango", owner: { username: "rango", first: "Mahmud", last: "Rahman" }, phone: "+8801711223344", email: "owner@rango-electronics.com.bd",
    plan: "premium", modules: null, state: "active", endsInDays: 74, terms: [6, 6], places: ["Mirpur 10 Showroom", "Uttara Branch"],
    staff: [
      { username: "rafiq.mgr", first: "Rafiq", last: "Islam", role: "manager" },
      { username: "rubel.pos", first: "Rubel", last: "Hossain", role: "cashier", modules: ["pos"], at: 0 },
      { username: "mitu.acc", first: "Mitu", last: "Akter", role: "accountant", modules: ["accounts", "expenses", "reports"] },
      { username: "sabbir.sales", first: "Sabbir", last: "Ahmed", role: "agent", modules: ["pos", "sales"], at: 0, commission: 2 },
      { username: "farzana.sales", first: "Farzana", last: "Akter", role: "agent", modules: ["pos", "sales"], at: 1, commission: 1.5 },
      { username: "kamal.stock", first: "Kamal", last: "Uddin", role: "stock", modules: ["purchases", "stock"] },
    ],
  },
  {
    name: "Nipun Poultry & Fish Feed", code: "nipun", owner: { username: "nipun", first: "Nipun", last: "Chowdhury" }, phone: "+8801819556677", email: "nipun.feeds@gmail.com",
    plan: "standard", modules: ["pos", "sales", "purchases", "stock", "expenses", "reports"], state: "active", endsInDays: 19, terms: [3, 3, 1], places: ["Bhaluka Bazar", "Mymensingh Depot"],
    staff: [
      { username: "nazmul.mgr", first: "Nazmul", last: "Haque", role: "manager" },
      { username: "liton.pos", first: "Liton", last: "Das", role: "cashier", modules: ["pos"], at: 0 },
      { username: "sumon.stock", first: "Sumon", last: "Mia", role: "stock", modules: ["purchases", "stock"], at: 1 },
      { username: "jahid.acc", first: "Jahid", last: "Hasan", role: "accountant", modules: ["expenses", "reports"] },
    ],
  },
  {
    name: "Sheuli Fashion House", code: "sheuli", owner: { username: "sheuli", first: "Sheuli", last: "Begum" }, phone: "+8801912334455", email: "sheulifashion@gmail.com",
    plan: "starter", modules: ["pos", "sales"], state: "active", endsInDays: 52, terms: [3, 3], places: ["Chawkbazar Store", "Gulshan Boutique"],
    staff: [
      { username: "ruma.pos", first: "Ruma", last: "Khatun", role: "cashier", modules: ["pos"], at: 0 },
      { username: "tania.sales", first: "Tania", last: "Sultana", role: "agent", modules: ["pos", "sales"], at: 1, commission: 2 },
    ],
  },
  {
    name: "Karim Pharmacy", code: "karim", owner: { username: "karim", first: "Abdul", last: "Karim" }, phone: "+8801611445566", email: "karimpharmacy@yahoo.com",
    plan: "standard", modules: ["pos", "sales", "purchases", "stock"], state: "expired", endsInDays: -9, terms: [3, 3, 3], places: ["Dhanmondi 27", "Mohammadpur Counter"],
    staff: [
      { username: "helal.mgr", first: "Helal", last: "Uddin", role: "manager" },
      { username: "shila.pos", first: "Shila", last: "Rani", role: "cashier", modules: ["pos"], at: 0 },
      { username: "imran.stock", first: "Imran", last: "Hossain", role: "stock", modules: ["purchases", "stock"] },
    ],
  },
  {
    name: "Tanvir Mobile Hub", code: "tanvir", owner: { username: "tanvir", first: "Tanvir", last: "Ahmed" }, phone: "+8801511556677", email: "tanvirmobilehub@gmail.com",
    plan: "starter", modules: ["pos"], state: "cancelled", endsInDays: 38, terms: [1, 1, 1, 1], places: ["Elephant Road Shop", "Bashundhara Kiosk"],
    staff: [{ username: "arif.pos", first: "Arif", last: "Sheikh", role: "cashier", modules: ["pos"], at: 0 }],
  },
  {
    name: "Green Valley Agro", code: "greenvalley", owner: { username: "greenvalley", first: "Shamsul", last: "Alam" }, phone: "+8801311667788", email: "info@greenvalleyagro.com.bd",
    plan: "premium", modules: null, free: true, state: "active", endsInDays: 0, terms: [], places: ["Gazipur Farm Shop", "Savar Outlet"],
    staff: [
      { username: "yasin.mgr", first: "Yasin", last: "Arafat", role: "manager" },
      { username: "nasima.acc", first: "Nasima", last: "Akter", role: "accountant", modules: ["accounts", "expenses", "reports"] },
    ],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const password = () => Array.from(randomBytes(12), (b) => ALPHABET[b % ALPHABET.length]).join("");
const priceOf = (plan: PlanDef, modules: ModuleId[] | null, free?: boolean) => (free ? 0 : plan.price + (modules ?? [...MODULE_IDS]).reduce((s, m) => s + MODULE_PRICE[m], 0));

type Credential = { business: string; code: string; username: string; role: string; password: string };

function tailor(spec: Spec, creds: Credential[]) {
  return (db: DB) => {
    db.settings.business.name = spec.name;
    for (const [i, l] of db.locations.entries()) {
      l.name = spec.places[i] ?? l.name;
      l.email = i === 0 ? spec.email : "";
      l.mobile = i === 0 ? spec.phone.replace("+880", "0") : l.mobile;
    }
    const wanted = new Set<string>(spec.staff.map((s) => s.role));
    for (const key of ["accountant", "stock", "agent"] as const) {
      if (!wanted.has(key)) continue;
      const def = EXTRA_ROLES[key];
      for (const p of def.permissions) if (!(PERMISSIONS as readonly string[]).includes(p)) throw new Error(`Unknown permission ${p}`);
      db.roles.push(roleSchema.parse({ ...db.roles[0], id: def.id, name: def.name, permissions: [...def.permissions] }));
    }
    spec.staff.forEach((s, i) => {
      const u = db.users.find((x) => x.id === SLOTS[i])!;
      const pw = password();
      Object.assign(u, {
        username: s.username, firstName: s.first, lastName: s.last, email: `${s.username}@${spec.code}.test`, password: hashPassword(pw), roleId: ROLE_ID[s.role],
        locationIds: s.at === undefined ? [] : [LOCS[s.at]], modules: s.modules ?? [], isSalesAgent: s.role === "agent", commissionPercent: s.commission ?? 0, allowLogin: true, isActive: true,
      });
      creds.push({ business: spec.name, code: spec.code, username: s.username, role: db.roles.find((r) => r.id === ROLE_ID[s.role])!.name, password: pw });
    });
  };
}

async function upsertPackages() {
  for (const p of PLANS) {
    await pool().query("UPDATE plans SET label = $2, max_users = $3, price_monthly = $4, description = $5, benefits = $6 WHERE id = $1", [p.id, p.label, p.maxUsers, p.price, p.description, p.benefits]);
  }
  for (const m of MODULE_IDS) await pool().query("UPDATE modules SET price_monthly = $2 WHERE id = $1", [m, MODULE_PRICE[m]]);
}

/** Manual payments, one per term, each dated on the day its term began, with 12-month terms billed at ten months. */
async function recordHistory(businessId: string, name: string, planId: string, monthly: number, terms: number[], endsAt: Date) {
  let end = endsAt;
  const rows: { start: Date; months: number }[] = [];
  for (const months of [...terms].reverse()) {
    const start = addMonths(end, -months);
    rows.push({ start, months });
    end = start;
  }
  for (const r of rows) {
    const amount = Math.round(monthly * r.months * (r.months >= 12 ? 10 / 12 : 1));
    await pool().query("INSERT INTO subscription_payments (business_id, business_name, plan, months, amount, paid_at) VALUES ($1, $2, $3, $4, $5, $6)", [businessId, name, planId, r.months, amount, r.start]);
  }
  await pool().query("UPDATE businesses SET created_at = $2 WHERE id = $1", [businessId, subDays(end, 6)]);
}

async function main() {
  await migrate();
  const now = new Date();
  const creds: Credential[] = [];
  await upsertPackages();
  console.log(`Packages: ${PLANS.map((p) => `${p.label} ৳${p.price}`).join(", ")}. Modules: ${MODULE_IDS.map((m) => `${m} ৳${MODULE_PRICE[m]}`).join(", ")}.`);

  for (const spec of SPECS) {
    const taken = await pool().query("SELECT 1 FROM businesses WHERE code = $1 UNION ALL SELECT 1 FROM logins WHERE username = $2 AND user_id = 'user_admin'", [spec.code, spec.owner.username]);
    if (taken.rowCount) {
      console.log(`Skipped ${spec.name}: code "${spec.code}" or owner "${spec.owner.username}" already exists.`);
      continue;
    }
    const ownerPw = password();
    const { businessId } = await createBusiness({ name: spec.name, code: spec.code, demo: true, admin: { username: spec.owner.username, password: ownerPw, firstName: spec.owner.first, lastName: spec.owner.last, email: spec.email }, tailor: tailor(spec, creds) });
    creds.splice(creds.findIndex((c) => c.code === spec.code), 0, { business: spec.name, code: spec.code, username: spec.owner.username, role: "Owner (Admin)", password: ownerPw });
    const plan = PLANS.find((p) => p.id === spec.plan)!;
    const endsAt = addDays(now, spec.endsInDays);
    await setSubscription(businessId, {
      plan: spec.plan, status: spec.state === "cancelled" ? "cancelled" : "active", expiresAt: spec.free ? null : endsAt.toISOString(),
      contactEmail: spec.email, contactPhone: spec.phone, modules: spec.modules ?? undefined, free: !!spec.free,
    });
    if (!spec.free) await recordHistory(businessId, spec.name, spec.plan, priceOf(plan, spec.modules), spec.terms, endsAt);
    console.log(`Created ${spec.name}: ${plan.label}${spec.free ? " (free pilot)" : ` ৳${priceOf(plan, spec.modules).toLocaleString()}/month`}, ${spec.state}.`);
  }

  // "Sosa" already exists; it becomes a paying Standard account with a few modules.
  const sosa = (await pool().query<{ id: string; name: string; free: boolean }>("SELECT id, name, free FROM businesses WHERE name ILIKE '%sosa%'")).rows;
  if (sosa.length === 1 && !sosa[0].free) console.log(`${sosa[0].name} is already a paying account; left as it is.`);
  else if (sosa.length === 1) {
    const modules: ModuleId[] = ["pos", "sales", "purchases", "expenses", "reports"];
    const endsAt = addMonths(now, 2);
    await setSubscription(sosa[0].id, { plan: "standard", status: "active", expiresAt: endsAt.toISOString(), modules, free: false });
    const has = (await pool().query("SELECT 1 FROM subscription_payments WHERE business_id = $1", [sosa[0].id])).rowCount;
    if (!has) await recordHistory(sosa[0].id, sosa[0].name, "standard", priceOf(PLANS[1], modules), [3], endsAt);
    console.log(`${sosa[0].name} is now a paying Standard account (${modules.join(", ")}), active until ${endsAt.toISOString().slice(0, 10)}.`);
  } else console.log(sosa.length ? `Found ${sosa.length} businesses matching "sosa" (${sosa.map((b) => b.name).join(", ")}); left them alone.` : 'No business named "sosa" here, so nothing to convert.');

  if (creds.length) {
    console.log("\nSign-ins (shown once; staff type the business code, then their username):\n");
    console.table(creds);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool().end());
