# Backend (Postgres inside the Next.js app)

pos_sible runs in two modes from the same code:

| Mode | How | Where the data lives |
|---|---|---|
| **Local** (default) | no setup | the browser (IndexedDB). Single device, perfect for demos. |
| **API** | `NEXT_PUBLIC_DATA_MODE=api` + `DATABASE_URL` | Postgres. Real sign-in, many users and devices, many businesses. |

`NEXT_PUBLIC_DATA_MODE` is read at **build time**, so build the mode you intend to run (`npm run build:api`).

## Quick start

```bash
docker compose up -d                 # Postgres on :5432
cp .env.example .env.local           # DATABASE_URL, demo seeding, sign-up switch
npm run dev:api                      # migrations run on first request
# or:  npm run db:migrate && npm run db:seed && npm run build:api && npm start
```

Sign in as `admin` / `112233` (the demo shop). Create your own business with
`npm run db:create-business -- "My Shop" myname 'a good password' "My Name"`, or set `POS_ALLOW_SIGNUP=true` and
`NEXT_PUBLIC_ALLOW_SIGNUP=true` to offer `/signup`.

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | Postgres connection string (required in API mode) |
| `POS_SEED_DEMO` | `true`/`false`. Create the demo shop on an empty database. Defaults to on in development, off in production. |
| `POS_ALLOW_SIGNUP`, `NEXT_PUBLIC_ALLOW_SIGNUP` | Public business sign-up (server check, and the link on the sign-in page). |
| `NEXT_PUBLIC_SHOW_DEMO_LOGINS` | Show the quick-fill demo accounts on the sign-in page. |
| `PG_POOL_MAX` | Connection pool size (default 10). |

## How it works

The screens never changed: every screen talks to a *service* (`lib/data/services/*`), and the services hold all the
business rules. In API mode the browser's copy of a service is a proxy (`lib/data/api/facade.ts`) that posts the call to
`/api/rpc`; on the server the **same service code** runs against Postgres. So the rules that were tested for the demo
(FIFO stock, ledger, credit limits, edit windows...) are the rules the server enforces, with nothing re-implemented.

```
browser ── POST /api/rpc {service, method, args} ──▶ route handler
                                                      1. cookie session → user, role, business
                                                      2. gate: allow-listed service, permission for that service
                                                      3. load the business (cached by version) into a request context
                                                      4. run the service method (assertCan, commit(), ...)
                                                      5. diff the result against what was loaded
                                                      6. one transaction: upsert/delete changed rows, version + 1
                                                      7. redact password hashes, reply (errors keep their class)
```

* **Storage.** One Postgres table per collection, each `(business_id, id, data jsonb, seq)` with the tenant, primary key
  and insertion order as real columns, plus indexed generated columns on `transactions` (type, status, date, location,
  contact). `businesses` holds settings, metadata and a `version`. `logins` is the global username index, `sessions`
  the sign-ins, `audit_log` one row per call that changed data.
* **Concurrency.** Reads take no lock. A call that changed data saves inside a transaction guarded by the business's
  version (`SELECT ... FOR UPDATE`); if someone saved first, the call is simply run again on fresh data. Nothing is
  written when a service throws. The loaded database is deep-frozen, so a service that mutates data outside
  `commit()` fails loudly instead of corrupting the shared cache.
* **Auth.** `scrypt` password hashes (plain-text values are never accepted), random 256-bit session tokens stored
  hashed, `HttpOnly` + `SameSite=Lax` (+ `Secure` in production) cookie, origin check on every POST, 5 wrong passwords
  per user and address per 15 minutes, constant-work login so usernames can't be probed. A user's `isActive`/`allowLogin`
  and role are re-checked on every request, so deactivating someone or changing a role takes effect immediately.
* **Authorization.** Every write checks its permission inside the service (`assertCan`). In addition, each service is
  gated by the permissions of the screens that use it, the generic table endpoint only reaches reference tables, and
  nothing outside the allow-list is callable.
* **Tenants.** Every query is scoped by `business_id`. New businesses start with the sample shop and the welcome wizard
  (which can swap it for an empty one); the sample staff accounts are locked and given unguessable passwords.

## Tests

`npm test` includes `tests/server/*`, which run against a real Postgres (`TEST_DATABASE_URL`, default
`postgres://postgres@127.0.0.1:5433/pos_sible_test`) and are skipped when none is reachable. They cover sign-in,
lock-out, hashing, permissions, rollback, concurrent sales, tenant isolation and a 240-action random-user run whose
books must balance after every step. `npm run e2e:api` and `E2E_API=1 npm run e2e` exercise a built API-mode app.

## Limits worth knowing

* The unit of caching and locking is the **business**: each business's data is held in server memory (a few MB for a
  busy shop) and writes to one business are serialised. That is plenty for a shop or a chain of shops; the path beyond
  it is moving the hot reports and lists to SQL queries on the generated columns.
* Uploaded images and documents are stored in the record (as data URLs / file names), not in object storage.
* Email and SMS are still mocked; they need a provider key and a worker.
