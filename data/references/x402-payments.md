# x402 paid endpoints and clients

Read when the app charges for an HTTP endpoint with HTTP 402 / x402, or calls
someone else's x402 endpoint from a wallet or a server.

x402 is an open protocol, and its headers, schemes, and package APIs change
between versions. Verify against [docs.x402.org](https://docs.x402.org) and
[x402.org](https://x402.org) before coding, and pin a verified version of each
`@x402/*` package. For wallet setup, follow [Ethereum](../../wallets/SKILL.md).

## Flow

1. The client calls the resource without payment. The server answers `402`
   with payment requirements: protocol version and an `accepts` list. Each
   entry carries `scheme` (for example `exact`), `network` as a CAIP-2 id
   (`eip155:8453` Base, `eip155:84532` Base Sepolia), `amount` in the asset's
   atomic units as a string, `asset` (token contract), `payTo`,
   `maxTimeoutSeconds`, and scheme `extra` data. Version 2 sends this as base64
   JSON in a `PAYMENT-REQUIRED` header; version 1 put it in the JSON response
   body, with `maxAmountRequired` and names like `base-sepolia` instead.
2. The client signs a payment payload for one entry (for USDC with `exact`, an
   EIP-3009 transfer authorization; Permit2 for other ERC-20s) and retries with
   it as base64 JSON in `PAYMENT-SIGNATURE` (v2) or `X-PAYMENT` (v1).
3. The server asks a facilitator to **verify** (`POST /verify`) the payload
   against its own requirements, does the work, then asks it to **settle**
   (`POST /settle`) on chain, and returns the result with `PAYMENT-RESPONSE`
   (v2) or `X-PAYMENT-RESPONSE` (v1): `success`, `transaction`, `network`, `payer`.

## Serving a paid endpoint

- Use the official middleware for the framework when it fits; it builds
  requirements and calls verify and settle. Check the docs for current package
  names.
- Requirements come from server configuration. Never derive price, asset,
  network, or `payTo` from the request. `payTo` is the user's own recipient
  address, read from server config; never a hardcoded or invented address.
- Express amounts in minor units with integer math: USDC has 6 decimals, so
  $0.01 is `"10000"`. Use `BigInt` or strings, never floats.
- Validate input before returning `402`, so callers never pay for a request
  that will be rejected. Unsupported input fails before any payment.
- Choose a facilitator that supports the network. The public x402.org
  facilitator is for development and testnets; mainnet needs a production
  facilitator the user selects, or self-hosting. Keep its credentials server-side.
- Settle before releasing anything that cannot be withdrawn. If settlement
  fails, return `402` or `5xx` without the paid result. If the work fails after
  settlement, record it and apply a stated refund or credit policy.

## Never trust client-claimed payment

A body field `paid: true`, a transaction hash, or a success screen from the
client is not payment. Grant access only after verifying, through the
facilitator or chain data you read yourself, that the asset, amount, network,
recipient, and validity window all match the requirements you issued, and that
the proof has not been used before. Keep the record of granted access
authoritative on the server. Follow [Security](../../security/SKILL.md) for
replay and idempotency rules.

## Idempotency and replay

- Store each settlement under a unique constraint (transaction hash, or payer
  plus authorization nonce) in the same transaction that grants the purchase.
  A second use of the same proof must fail or return the original result.
- Accept a client idempotency key for paid actions. A retry after a dropped
  connection returns the stored result instead of charging again.
- Never retry a settle or a paid request blindly; check whether the first
  attempt went through.

## Paying from the browser (default)

Default to the user's own wallet paying, so the app holds no funds. Ask before
building server-side payment. With `@x402/fetch` and `@x402/evm`, wrap `fetch`
so a `402` triggers signing and one paid retry. Recent `@x402/evm` versions need
a signer with `readContract`, which a wagmi wallet client lacks; build one with
`toClientEvmSigner` from the wallet's `signTypedData` and a public client. Use
the app's configured public client rather than a bare default RPC transport,
which overloads public endpoints.

```ts
const { address } = useAccount();
const { data: wallet } = useWalletClient();
const publicClient = usePublicClient({ chainId: base.id });
const payFetch = useMemo(() => {
  if (!wallet || !address || !publicClient) return null; // disable the action
  const signer = toClientEvmSigner(
    { address, signTypedData: args => wallet.signTypedData(args) },
    publicClient,
  );
  return wrapFetchWithPaymentFromConfig(corsSafeFetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(signer) }],
  });
}, [wallet, address, publicClient]);
```

`corsSafeFetch` deletes an `Access-Control-Expose-Headers` request header that
some client versions add on the paid retry; servers that do not allow it fail
the CORS preflight. When the wallet is not ready, keep the action disabled with
a connect prompt instead of throwing deep inside the call.

## Paying from the server

Only when the user asks (bots, subsidized calls). Use `x402Client`,
`ExactEvmScheme` (or `registerExactEvmScheme`) from `@x402/evm/exact/client`,
and `wrapFetchWithPayment(fetch, client)`; `x402HTTPClient.processResponse`
decodes the settlement header. Keep a dedicated wallet's key in server-only
environment variables, never `NEXT_PUBLIC_*`. Add per-user rate limits and a
spend cap. Keep the route disabled until the key and a funded wallet are
configured; never invent a fallback wallet or simulate a balance.

## Price display

Make an unpaid request, decode the requirements, and show the amount in display
units before the wallet prompt. Cache it per endpoint, but treat the live `402`
as authoritative. Never hardcode a price that the server may change.

## Failure handling

Map failures to clear states: user rejected the signature, insufficient
balance, wrong network, expired authorization, invalid signature, no matching
requirement, verification or settlement failure, and upstream error after
payment. On a final `402`, decode the `error` field from the requirements
header. Third-party paid APIs may change field types between calls (array vs
newline string); normalize at the boundary before rendering.

When serving cross-origin, allow the payment request headers and expose
`PAYMENT-REQUIRED` and `PAYMENT-RESPONSE` (plus the v1 `X-PAYMENT-RESPONSE`).

## Verify

- `curl -s -o /dev/null -w "%{http_code}"` against the real API URL returns
  `402`. Marketplace playground pages often use a different path from the API.
- Run normal checks at zero spend. On a test network with test funds, run one
  opt-in end-to-end check: wallet prompt, paid retry, settlement header, stored
  grant, and a replayed proof rejected. Mainnet runs need the user's approval.
- Confirm rejected input never reaches the payment prompt. See
  [Data](../SKILL.md) for proving the stored record with a real database.
