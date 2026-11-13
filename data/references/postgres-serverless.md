# Postgres for serverless apps

Read when a serverless Next.js (or similar) app stores data in Postgres.

The user chooses the provider. Neon is used as the example below; check the
equivalent features of any other host. Verify against
[Neon docs](https://neon.com/docs) and the
[PostgreSQL error codes](https://www.postgresql.org/docs/current/errcodes-appendix.html).

## Connection setup

- Initialize the client lazily inside the request path. A module-level
  `neon(process.env.DATABASE_URL!)` runs during `next build`, where the
  variable is often absent, and crashes the build.
- Validate the URL before constructing a client: `postgres:` or `postgresql:`
  protocol, a hostname, credentials, and no loopback host unless the app targets
  a local database. Fail closed with a stable code (`DATABASE_URL_INVALID`),
  never the URL or raw driver error.
- An exported empty `DATABASE_URL` in the shell shadows `.env` files (Next.js
  does not override existing keys). Unset it before calling the database missing.
- Confirm the URL targets the intended project and branch.

```ts
import { neon } from "@neondatabase/serverless";
type Sql = (s: TemplateStringsArray, ...v: unknown[]) => Promise<Record<string, unknown>[]>;
let sql: ReturnType<typeof neon> | null = null;
export function getDb(): Sql {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    sql = neon(url);
  }
  return sql as unknown as Sql; // cast once, not per query
}
```

## Driver choice

- **Serverless HTTP** (`neon()` from `@neondatabase/serverless`; pin a verified
  version): one HTTP round trip per query, no connection held, works in Node and
  edge runtimes. Non-interactive multi-statement transactions use
  `sql.transaction([...])`.
- **WebSocket `Pool`/`Client`** (same package): sessions, interactive
  transactions. Connect, use, and close within one request. Node < 22 needs
  `neonConfig.webSocketConstructor = ws`.
- **TCP drivers** such as `pg`: fine in a Node runtime with a pooled
  connection string; unavailable on edge runtimes.
- Use pooled endpoints (Neon: `-pooler` in the host) for app traffic. Direct
  connections are capped by compute size; the pooler runs in transaction mode,
  which breaks session features (`LISTEN`, session `SET`, SQL-level `PREPARE`;
  driver-level prepared statements work). Check current limits in
  [connection pooling](https://neon.com/docs/connect/connection-pooling).

## The driver's real query API

- `neon()` is a tagged template: only `${value}` interpolation, each sent as a
  bind parameter. Calling `sql(text, params)` throws "can now be called only as
  a tagged-template function". For `$1` text queries and raw DDL strings, use
  `sql.query(text, params)`. Do not carry tagged-template habits to `pg`, whose
  API is `client.query(text, [params])`, or vice versa.
- Identifiers, `ORDER BY` columns, and SQL fragments cannot be interpolated.
  `ORDER BY ${col}` becomes `ORDER BY $1` and sorts by a constant. Branch whole
  queries per whitelisted name, or use a whitelisted `CASE` expression.
- One bind used as two types (a `smallint` column value and an integer comparison) fails with `42P08` "inconsistent types deduced"; cast each use.
- Untyped binds fail with `42P18` "could not determine data type of parameter".
  Cast when Postgres cannot infer: a value that may be `NULL` (`${v}::text`),
  arguments to `jsonb_build_object`, and both uses in guards like
  `(${x}::text IS NULL OR col = ${x}::text)`.
- Never put a bind inside a string literal: `INTERVAL '${n} days'` is invalid.
  Write `NOW() - (${n}::int * INTERVAL '1 day')`.
- Timestamps may arrive as `Date` objects; normalize first.
  Select large `NUMERIC`/`bigint` values as `::text` and parse with `BigInt`;
  never `Number()` a balance.
- `json_agg` returns `NULL` for no rows: `COALESCE(json_agg(...), '[]'::json)`.
- `ON CONFLICT (cols)` needs a matching unique constraint or primary key
  (`42P10` otherwise). Against a partial unique index, repeat its predicate:
  `ON CONFLICT (tx_hash) WHERE tx_hash IS NOT NULL DO NOTHING`.
- `RETURNING (xmax = 0) AS inserted` distinguishes insert from conflict update.
- Prefer `TEXT` to `varchar(N)` for evolving identifiers (overflow: `22001`).

Money, balances, claims, and cooldowns use one guarded statement, such as
`UPDATE ... SET balance = balance - ${n} WHERE id = ${id} AND balance >= ${n} RETURNING id`,
and reject when no row returns. Write the columns of one visible state change in
one statement, or pollers see a half-written row.

## Errors

Catch narrowly; an empty list on every error hides `42703` (undefined
column) and binding bugs. Treat only known codes specially (`42P01`
during a migration gap, `23505` unique violation as a conflict) and log
`code`, `message`, `detail`, `hint`, `position`, `table`, `column` server-side.
On read screens, distinguish "database unavailable" from "no data yet".

## Migrations

- Keep ordered SQL files in the repository and apply them with a runner or the
  project's migration tool. Make them idempotent (`ADD COLUMN IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`); earlier runs may have stopped partway.
- Give `NOT NULL` columns a `DEFAULT`, and backfill derived columns in the same
  transaction as the `ALTER TABLE`. Guard backfills
  (`WHERE new_col IS NULL`) so reruns are no-ops.
- A statement splitter on `;` breaks `$$`-quoted function bodies (`42601`).
  Track dollar-quote tags or run each file as one statement batch.
- Before querying older tables, check `information_schema.columns` or run the
  query with `LIMIT 0`. Remove code references before dropping a column.
- When converting a column type, keep `NULL` distinct from zero:
  `USING CASE WHEN c IS NULL THEN NULL ELSE <expr> END`.

## Branches for test databases

Neon branches are copy-on-write copies of a database. Create one for each test
run or risky migration, apply the migration there, run the app's real handlers
against it, then apply to main and delete the test branch. Elsewhere, use a
separate database or a disposable local container. Without an account or
Docker, a Homebrew `postgresql@17` cluster inside the app folder works: `initdb
--no-locale` and start `postgres` with `LC_ALL=C` (a shell without a locale
otherwise fails with "invalid locale settings" or "postmaster became
multithreaded"), on its own port with the unix socket off, plus separate dev and
test databases that the Playwright web server points at.
See [branching](https://neon.com/docs/introduction/branching).

## Live data on serverless

`LISTEN/NOTIFY` needs a long-lived direct (unpooled) session. Functions have time
limits, so a Server-Sent Events handler needs heartbeats and a reconnect event
before the limit, and each subscriber holds a connection. Quote channel names
as identifiers. Modest polling or a hosted realtime service often fits better.
Neon Realtime (live queries) is in beta, off by default, and enabled per project
and branch; check [Realtime](https://neon.com/docs/realtime/overview) for status
and authorization rules. A connection string alone does not enable it.

## Verify with a real route

SQL consoles and MCP tools send literals, not driver binds, so they cannot
reproduce `42P18`; mocked SQL proves nothing. Point the app at a test branch or database, call the actual
route handler with a real test identity, and check: the row is written and read
back, a duplicate request is rejected or idempotent, `NULL` and invalid input
return the right status, and another user's record is refused. If no test
database is available, report verification as blocked. See
[Data](../SKILL.md) and [Security](../../security/SKILL.md).
