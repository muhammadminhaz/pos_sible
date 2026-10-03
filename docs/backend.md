# Backend (the `api` project: Next.js route handlers on Postgres)

pos_sible runs in two modes. The backend is its own project in `api/`, deployed separately from the UI in `web/`:

| Mode | How | Where the data lives |
|---|---|---|
| **Local** (default) | no setup | the browser (IndexedDB). Single device, perfect for demos. |
| **API** | web: `NEXT_PUBLIC_DATA_MODE=api` + `BACKEND_URL`; api: `DATABASE_URL` | Postgres. Real sign-in, many users and devices, many businesses. |

`NEXT_PUBLIC_DATA_MODE` and `BACKEND_URL` are read at **build time** by the web project, so build the mode you intend to run (`npm run build:api` in `web/`).

## Quick start

```bash
cd api && cp .env.example .env && docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build   # API on :3001 + Postgres (migrations run on first request)
cd web && cp .env.example .env.local && npm run dev:api     # UI on :3000, /api/* proxied to :3001
```

Deployment (Vercel for `web/`, Coolify for `api/`) is in the README, section C. Sign in as `admin` / `112233` (the demo
shop). Create your own business with `npm run db:create-business -- "My Shop" myname 'a good password' "My Name"` from
`api/` (with `DATABASE_URL` set), or set `POS_ALLOW_SIGNUP=true` on the API and `NEXT_PUBLIC_ALLOW_SIGNUP=true` on the
web project to offer `/signup`.

API variables:

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | Postgres connection string (required) |
| `ALLOWED_ORIGINS` | Exact browser origins allowed to call the API, comma separated (the web app's origin). Without it only same-host requests pass the origin check. |
| `POS_SEED_DEMO` | `true`/`false`. Create the demo shop on an empty database. Defaults to on in development, off in production. |
| `POS_ALLOW_SIGNUP` | Public business sign-up (server check). |
| `PG_POOL_MAX` | Connection pool size (default 10). |

Web variables (build time): `NEXT_PUBLIC_DATA_MODE`, `BACKEND_URL`, `NEXT_PUBLIC_ALLOW_SIGNUP` (the sign-up link),
`NEXT_PUBLIC_SHOW_DEMO_LOGINS` (quick-fill demo accounts on the sign-in page).

## How the two projects connect

The browser only talks to the web origin. `web/next.config.ts` rewrites `/api/:path*` to `${BACKEND_URL}/api/:path*`, so
the session cookie the API sets belongs to the web domain (first-party, no CORS, works with Safari's tracking
protection). The API's origin check (`sameOrigin` in `api/lib/server/auth.ts`) accepts a request when its `Origin` is
the API's own host or is listed in `ALLOWED_ORIGINS`; anything else gets `403 forbidden_origin`. Client IPs for
sign-in throttling come from `x-forwarded-for`.

## How it works

The screens never changed: every screen talks to a *service* (`lib/data/services/*`, present in both projects), and the services hold all the
business rules. In API mode the browser's copy of a service is a proxy (`lib/data/api/facade.ts`) that posts the call to
`/api/rpc`; on the server the **same service code** runs against Postgres. So the rules that were tested for the demo
(FIFO stock, ledger, credit limits, edit windows...) are the rules the server enforces, with nothing re-implemented.

```
browser ── POST /api/rpc {service, method, args} ──▶ route handler (api/app/api/rpc)
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
* **Who did what.** `commit()` compares the database before and after every change and stamps each new or changed row
  with `createdBy` / `updatedBy` (the signed-in user) and `updatedAt`, so the four fields exist on every record without
  any service having to remember. Roles carry a `permVersion`; older roles are upgraded when a business is loaded so
  they keep exactly what they could do (see `upgradeRole` in `lib/auth/permissions.ts`).
* **Granting.** Create / update / delete are separate permissions. Editing roles or users can never hand out more than
  the editor's own role holds, and a less powerful user cannot change a more powerful role or user.
* **Authorization.** Every write checks its permission inside the service (`assertCan`). In addition, each service is
  gated by the permissions of the screens that use it, the generic table endpoint only reaches reference tables, and
  nothing outside the allow-list is callable.
* **Tenants.** Every query is scoped by `business_id`. New businesses start with the sample shop and the welcome wizard
  (which can swap it for an empty one); the sample staff accounts are locked and given unguessable passwords.

## Tests

`npm test` in `api/` runs `tests/server/*`, which run against a real Postgres (`TEST_DATABASE_URL`, default
`postgres://postgres@127.0.0.1:5433/pos_sible_test`) and are skipped when none is reachable. They cover sign-in,
lock-out, hashing, permissions, rollback, concurrent sales, tenant isolation and a 240-action random-user run whose
books must balance after every step. `tests/origin.test.ts` covers the origin check. `npm run e2e:api` and `E2E_API=1 npm run e2e` (run from `web/` against both running) exercise the split stack end to end.

## Limits worth knowing

* The unit of caching and locking is the **business**: each business's data is held in server memory (a few MB for a
  busy shop) and writes to one business are serialised. That is plenty for a shop or a chain of shops; the path beyond
  it is moving the hot reports and lists to SQL queries on the generated columns.
* Uploaded images and documents are stored in the record (as data URLs / file names), not in object storage.
* Email and SMS are still mocked; they need a provider key and a worker.
