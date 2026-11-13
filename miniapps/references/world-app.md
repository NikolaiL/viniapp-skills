# World App (MiniKit)

Read this when the user explicitly asks for the app to run as a World App mini app.

World App opens mini apps in a webview and exposes its features through
`@worldcoin/minikit-js`. Its API has changed between major versions, so check
the version first: `node -p "require('@worldcoin/minikit-js/package.json').version"`.
Then verify every method below against the [World mini app docs](https://docs.world.org/mini-apps)
(there is also an [LLM index](https://docs.world.org/llms.txt)). That index may
describe an older version. If they disagree, trust the TypeScript types in the
installed package.

## Prerequisites

- An app registered in the World Developer Portal. You need its app ID
  (`app_...`), which is public and can go in an env var.
- A Developer Portal API key to verify payments. It's server-only and never
  goes in client code or `.env.example`.
- A World ID action per check. Recipient allowlisting in the portal is
  unverified, but pay fails with `invalid_receiver` for a "not allowed" address.
- These are owner tasks. Build the app, gate the affected operations, and
  report the exact missing value.

## Install and detection

- Use `window.WorldApp` (the raw host payload) as the host signal. World App
  injects it before your code runs.
- Initialize only when `window.WorldApp` exists, in the browser:
  `MiniKit.install()` outside React, or `MiniKitProvider` from
  `@worldcoin/minikit-js/minikit-provider`. Older versions took the app ID as
  an argument. Installing everywhere sets `window.MiniKit`, so checks like
  `WorldApp || MiniKit` mistake Farcaster, Base, and the web for World App.
- `MiniKit.isInstalled()` is true only after install inside World App. Run
  commands after install succeeds, not in a separate early effect.
- A wagmi connector for World App is unverified in the docs; if your version
  ships one, register it only inside the `window.WorldApp` check, after install.
- World App has no Farcaster context. Read identity from `MiniKit.user`
  (`walletAddress`, `username`), never from a Farcaster hook.

```ts
const inWorldApp = typeof window !== "undefined" && !!(window as any).WorldApp;
if (inWorldApp) MiniKit.install();
```

## Commands

Current docs use static methods (`MiniKit.walletAuth()`, `MiniKit.pay()`,
`MiniKit.sendTransaction()`); 1.x used `MiniKit.commandsAsync.*`. Don't mix
them. `Tokens` and `tokenToDecimals` come from `@worldcoin/minikit-js/commands`,
`verifySiweMessage` from `@worldcoin/minikit-js/siwe`.

**Wallet auth (SIWE).** Generate the nonce on the server and store it, for
example in an httpOnly cookie. It must be alphanumeric, at least 8 characters:
use hex, not a UUID. Pass `expirationTime` as a `Date`. Send the returned
`{ address, message, signature }` to the server and check it with
`verifySiweMessage` and the stored nonce (it throws in the browser). Then start
the app's own session, and use this address for server writes.

**Pay.** Create a `reference` on the server and store it as pending. Call
`pay({ reference, to, tokens: [{ symbol, token_amount }], description })`,
amounts in smallest units via `tokenToDecimals`. Send `data.transactionId` to
the server; grant only after it verifies. Pay supports WLD and local
stablecoins; no minimum is documented. See the [pay docs](https://docs.world.org/mini-apps/commands/pay).

**World ID.** Verification moved from `MiniKit.verify` to IDKit
(`@worldcoin/idkit`); follow
[IDKit for mini apps](https://docs.world.org/world-id/idkit/mini-apps). Verify
the proof on the server and store the nullifier with a unique constraint.

**Send transaction** returns `userOpHash`, not a transaction hash. Never pass it
to `waitForTransactionReceipt`; resolve it via `/api/v2/minikit/userop/{hash}`.

More: [commands](https://docs.world.org/mini-apps/quick-start/commands).

## Server-side verification

- `GET https://developer.world.org/api/v2/minikit/transaction/{id}?app_id=<id>&type=payment`
  with `Authorization: Bearer <API key>`
  ([reference](https://docs.world.org/api-reference/developer-portal/get-transaction)).
- Documented fields are snake_case (`transaction_status`: pending, mined,
  failed; `to`, `token`, `token_amount`, `reference`). camelCase variants have
  been observed live (undocumented); normalize both in one helper.
- Before you unlock anything, match reference, recipient, token, amount, and
  `mined` status.
- The indexer can lag the chain. Treat a 404 as "retry later". Fall back to the
  receipt and `Transfer` logs on World Chain (`480`); chain state is authoritative.
- World App wallets are smart contract accounts. Pass a public client to viem's
  `verifyMessage` so ERC-1271 checks run; without it valid signatures fail.

See [../../security/SKILL.md](../../security/SKILL.md) and [../../data/SKILL.md](../../data/SKILL.md)
for sessions, idempotent receipts, and replay protection.

## Safe areas and UI

- Insets: `window.WorldApp.safe_area_insets` or
  `MiniKit.deviceProperties.safeAreaInsets`. Raise the shared safe-area variables in
  the provider, and never read the host value in layout code. See
  [../../mobile/SKILL.md](../../mobile/SKILL.md).
- Use the share command, Web Share, or copy-link. Farcaster compose isn't
  available.
- Hide calls to action meant for other hosts. If a World username exists, show
  it instead of a bare address.

## Testing

- Desktop browsers don't have `window.WorldApp`. Test the web fallback there.
- Open the app in World App on a phone through the Developer Portal's test
  QR code or link. Point it at an HTTPS tunnel or a preview deployment.
- Emulation doesn't prove that wallet auth, payment, or World ID work. Run each
  one for real before you report it as working.
