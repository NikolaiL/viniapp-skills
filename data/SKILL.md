---
name: data
description: Implement provider-independent persistence, server-verified identity, safe migrations, external API handling, and real route-level database verification.
license: MIT
---

# Data and identity

Use the database/driver already in the project. For a new app, choose the
simplest store meeting its durability and concurrency requirements; document
that choice. This skill does not create managed databases or require a vendor.
The user can supply a connection through the environment or run a local database.
With no connection supplied, local development can use Node's built-in
`node:sqlite` (Node 22.13+, one file, nothing to install) behind one data
module, with the production database documented as a prerequisite. A
serverless or multi-instance host needs a shared database instead; see
[Postgres for serverless apps](references/postgres-serverless.md).

Keep device-local preferences in browser storage, with SSR/hydration and
storage-unavailable handling. Shared lists, leaderboards, purchases, and
cross-device progress need real server persistence. In-memory maps are not a
durable database and do not coordinate multiple processes.

## Auth and ownership

- Use server-verified sessions. A client-provided wallet, FID, username, SDK
  context, or anonymous identifier is not proof of identity.
- In a wallet app, use a normalized verified wallet as the stable owner when
  available. FID/host profile is optional enrichment, not a verified wallet
  association. Use the app's ordinary auth for apps without wallets.
- Farcaster Quick Auth proves an FID after issuer/audience/token verification;
  it does not alone prove ownership of an arbitrary supplied wallet. Preserve
  an FID-owned identity when no independently verified wallet link exists.
- For Ethereum wallet-signature authentication use Sign-In with Ethereum
  (EIP-4361) from `viem/siwe`: issue a single-use, expiring nonce from the
  server, build the message with `createSiweMessage` using the domain of
  `NEXT_PUBLIC_APP_URL` (not the request host), and check it with
  `publicClient.verifySiweMessage`, which also accepts smart-wallet (EIP-1271)
  signatures. Sign-in alone needs no `--onchain` overlay (its wagmi install
  takes minutes): call the injected EIP-1193 provider's `personal_sign`. In
  Playwright, install a minimal `window.ethereum` with `addInitScript` whose
  `personal_sign` calls a `page.exposeFunction` signer backed by viem's
  `privateKeyToAccount`; no anvil needed. Never add a public auth bypass to
  make tests easier.
- Check ownership on every read and mutation, ideally in the query predicate.
  Define anonymous limits explicitly. Public row IDs do not grant access.

## Database operations

Use parameterized queries or the existing ORM. Initialize connections lazily
when build-time environment values may be absent. Use the chosen driver's real
API; do not transfer tagged-template assumptions to a different driver.

Before changing a schema, inspect existing tables and migrations. Preserve
data, apply compatible migrations, and backfill derived fields when needed.
Use constraints for uniqueness and transaction/idempotency boundaries. Money,
balances, cooldowns, inventory, and claims require atomic guarded writes, not
read-then-write checks. Use integer minor units or exact decimal types.

Validate and bound input, pagination, and upload sizes server-side. Handle
unknown/null bind types with the actual driver. Return accurate HTTP statuses;
distinguish unauthenticated, forbidden, invalid input, conflict, and unavailable.

## External services

Use bounded timeouts and retries for transient idempotent operations. Cache
safe reads where appropriate. Do not retry a non-idempotent charge blindly.
Keep keys server-side. For missing credentials, disable only the affected branch
and explain the prerequisite; never fabricate data or success.

For same-origin/CSRF checks use an explicitly configured public origin or
trusted-proxy configuration. Do not trust arbitrary forwarded-host headers or
assume the internal request origin equals the public site.

## Prove persistence

For device-local state, exercise real browser storage across reload and its
read/write failure paths; no server identity or database is required.

Against an isolated test database, invoke the real handler and driver with a
real verified test identity. Create, read back, reload, mutate, and verify the
actual stored result. Exercise duplicate requests, invalid/null inputs,
unauthenticated access, and another user's record. Keep production data intact.

Mocked SQL, a standalone `SELECT 1`, and an unauthenticated request rejected by
auth do not prove the application's authenticated data path. If no real database
is available, report that verification as blocked rather than passed.

## References

| Reference | Read when |
| --- | --- |
| [Postgres for serverless apps](references/postgres-serverless.md) | The app stores shared data in Postgres on a serverless host |
| [x402 payments](references/x402-payments.md) | The app charges per HTTP request, or pays someone else's x402 endpoint |
