import { sqlName, TABLE_NAMES } from "./tables";

/**
 * Database migrations, applied in order and recorded in `schema_migrations`. Never edit one that has shipped: add a new one.
 *
 * Each business-owned collection is a table of (business_id, id, data jsonb): relational where the app queries
 * (tenant, key, insertion order, a few hot columns on transactions) and JSONB for the document itself.
 */
const entityTables = TABLE_NAMES.map((t) => {
  const n = sqlName(t);
  const extra =
    t === "transactions"
      ? `,
  type text GENERATED ALWAYS AS (data->>'type') STORED,
  status text GENERATED ALWAYS AS (data->>'status') STORED,
  txn_date text GENERATED ALWAYS AS (data->>'date') STORED,
  location_id text GENERATED ALWAYS AS (data->>'locationId') STORED,
  contact_id text GENERATED ALWAYS AS (data->>'contactId') STORED`
      : "";
  const idx =
    t === "transactions"
      ? `\nCREATE INDEX IF NOT EXISTS ${n}_lookup ON ${n} (business_id, type, status, txn_date);\nCREATE INDEX IF NOT EXISTS ${n}_contact ON ${n} (business_id, contact_id);`
      : "";
  return `CREATE TABLE IF NOT EXISTS ${n} (
  seq bigserial,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  id text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()${extra},
  PRIMARY KEY (business_id, id)
);
CREATE INDEX IF NOT EXISTS ${n}_order ON ${n} (business_id, seq);${idx}`;
}).join("\n\n");

export const MIGRATIONS: { id: number; name: string; sql: string }[] = [
  {
    id: 1,
    name: "initial schema",
    sql: `
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  settings jsonb NOT NULL,
  meta jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

${entityTables}

-- Global sign-in index: one username belongs to exactly one business.
CREATE TABLE IF NOT EXISTS logins (
  username text PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id text NOT NULL
);
CREATE INDEX IF NOT EXISTS logins_user ON logins (business_id, user_id);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  business_id uuid,
  user_id text,
  service text NOT NULL,
  method text NOT NULL,
  changed_rows integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_business_time ON audit_log (business_id, at DESC);
`,
  },
  {
    id: 2,
    name: "subscriptions and platform admin sessions",
    sql: `
-- Which package a business has paid for, and whether it may sign in. Managed only from the platform admin console.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'suspended')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

-- Sign-ins of the platform owner. Separate from \`sessions\`, which belong to a business's own users.
CREATE TABLE IF NOT EXISTS platform_sessions (
  token_hash text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
`,
  },
  {
    id: 3,
    name: "editable subscription plans",
    sql: `
-- The packages a business can be on. Prices are what the platform owner charges per month (BDT) and drive the revenue view.
CREATE TABLE IF NOT EXISTS plans (
  id text PRIMARY KEY,
  label text NOT NULL,
  max_users integer CHECK (max_users IS NULL OR max_users > 0),
  price_monthly numeric(12, 2) NOT NULL DEFAULT 0 CHECK (price_monthly >= 0),
  sort integer NOT NULL DEFAULT 0
);
INSERT INTO plans (id, label, max_users, price_monthly, sort) VALUES
  ('starter', 'Starter', 3, 500, 1),
  ('standard', 'Standard', 10, 1500, 2),
  ('premium', 'Premium', NULL, 3000, 3)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE businesses ADD CONSTRAINT businesses_plan_fk FOREIGN KEY (plan) REFERENCES plans (id);
`,
  },
  {
    id: 4,
    name: "business contact details",
    sql: `
-- How the platform owner reaches a business (entered in the admin console; E.164 phone such as +8801711000111).
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS contact_email text, ADD COLUMN IF NOT EXISTS contact_phone text;
`,
  },
  {
    id: 5,
    name: "cancelled subscriptions",
    sql: `
-- "suspended" becomes "cancelled": the platform owner ends a subscription; renewing brings it back.
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_subscription_status_check;
UPDATE businesses SET subscription_status = 'cancelled' WHERE subscription_status = 'suspended';
ALTER TABLE businesses ADD CONSTRAINT businesses_subscription_status_check CHECK (subscription_status IN ('active', 'cancelled'));
`,
  },
  {
    id: 6,
    name: "module subscriptions and free accounts",
    sql: `
-- Modules a business has paid for (NULL = all of them) and whether the platform owner waived the subscription entirely.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS modules text[],
  ADD COLUMN IF NOT EXISTS free boolean NOT NULL DEFAULT false;

-- What each module adds to the monthly price. Prices start at 0 so existing businesses are billed exactly as before.
CREATE TABLE IF NOT EXISTS modules (
  id text PRIMARY KEY,
  label text NOT NULL,
  price_monthly numeric(12, 2) NOT NULL DEFAULT 0 CHECK (price_monthly >= 0),
  sort integer NOT NULL DEFAULT 0
);
INSERT INTO modules (id, label, sort) VALUES
  ('pos', 'POS', 1), ('sales', 'Sales', 2), ('purchases', 'Purchases', 3), ('stock', 'Stock transfers and adjustments', 4),
  ('expenses', 'Expenses', 5), ('accounts', 'Accounts', 6), ('reports', 'Reports', 7)
ON CONFLICT (id) DO NOTHING;
`,
  },
  {
    id: 7,
    name: "business codes and per-business usernames",
    sql: `
-- A short code identifies a business at sign-in, so staff usernames only need to be unique inside their own business.
-- Existing businesses get their owner's username as the code, which is what staff already type today.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS code text;
UPDATE businesses b SET code = lower(l.username) FROM logins l WHERE l.business_id = b.id AND l.user_id = 'user_admin' AND b.code IS NULL;
UPDATE businesses SET code = 'b' || substr(replace(id::text, '-', ''), 1, 10) WHERE code IS NULL;
ALTER TABLE businesses ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS businesses_code_key ON businesses (code);

-- Usernames are now unique per business. Owners still sign in with just their username, so those stay unique everywhere.
ALTER TABLE logins DROP CONSTRAINT IF EXISTS logins_pkey;
ALTER TABLE logins ADD PRIMARY KEY (business_id, username);
CREATE UNIQUE INDEX IF NOT EXISTS logins_owner_name ON logins (username) WHERE user_id = 'user_admin';
`,
  },
];
