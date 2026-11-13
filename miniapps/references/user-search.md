# Farcaster user search

Read when the app needs to find or look up Farcaster accounts by name, username,
or FID: send-to-user, invite, mention, follow, or profile flows.

## Providers

Start keyless. The Farcaster client's web endpoints below need no key and cover
names, avatars, bios, and follower counts. They are unverified: not in the
[Farcaster client API reference](https://docs.farcaster.xyz/reference/farcaster/api),
which documents `api.farcaster.xyz` but no user search or profile lookup. They
can change or vanish, so fetch a sample response before relying on a field.

- Text search: `GET https://client.farcaster.xyz/v2/search-summary?q=<query>&maxUsers=<n>&maxChannels=0`
  returns `result.users`.
- Exact FID: `GET https://client.farcaster.xyz/v2/user-by-fid?fid=<fid>` returns
  `result.user` with `result.extras` beside it, not inside it.
- A user's own casts with like counts: `GET https://client.farcaster.xyz/v2/profile-casts?fid=<fid>&limit=50`
  (`result.casts[].reactions.count`, `next.cursor` for paging; 50 is the maximum,
  and replies are not included). `/v2/casts?fid=` returns a different feed: check
  the author FID of any endpoint you try.
- Channel names for hub `parentUrl`s: `GET https://api.farcaster.xyz/v2/all-channels`
  maps channel URLs to ids and names. It is about 8 MB, over Next's 2 MB fetch-cache
  limit and can take 30 s, so fetch it only when a channel URL needs a name and
  cache it in memory rather than with `fetch` caching.
- Documented: `GET https://api.farcaster.xyz/fc/primary-address?fid=<fid>&protocol=ethereum`
  returns `result.address.address`.

Neynar is an optional paid provider the user chooses when they need trust
scores or batch enrichment. It uses snake_case fields and a different shape:
see the [Neynar API reference](https://docs.neynar.com/reference). Keep the key
server-side and gate the feature off honestly when it is absent.

- Batch: `GET /v2/farcaster/user/bulk?fids=1,2,3` (up to 100 FIDs; response
  is a top-level `users` array). Use it for leaderboards instead of fanning out one
  lookup per FID, which dominates cold-start latency and burns rate limits.
- Pass `viewer_fid` when you have the viewer's FID for viewer-relative fields.
- Search responses have appeared both as `result.users` and bare `users`.
  Accept `data.result?.users ?? data.users` and log unexpected shapes.

| Data | Farcaster client API | Neynar |
| --- | --- | --- |
| Followers | `followerCount` | `follower_count` |
| ETH addresses | `extras.ethWallets` | `verified_addresses.eth_addresses` |
| Avatar | `pfp.url` | `pfp_url` |
| Trust score | none | `score` (0-1) |

Never assume field names match across providers. Normalize into one app type at
the server boundary.

## Server route

Proxy search through an app route so the browser never calls third parties
directly and responses can be cached. Validate `q` (required, trimmed) and clamp
`limit` (default 10, max 50).

- If the query is all digits, run the exact FID lookup in parallel with text
  search. Put the exact match first and drop its duplicate from the text results.
- Allow one-character numeric queries so small FIDs resolve; require at least
  two characters for text queries if the provider is noisy.
- Ranking: exact FID, then exact username, then username prefix, then display
  name matches, then the provider's order. Do not rely on prefix search alone.
- Cache for about 60 seconds: `Cache-Control: public, s-maxage=60, stale-while-revalidate=120`.
- Return `200 { users: [] }` for no matches, `400` for a missing query, and
  `502` when the upstream fails. Never hide an outage as an empty result.

```ts
const q = query.trim();
const isFid = /^\d+$/.test(q);
const [search, exact] = await Promise.all([
  fetch(searchUrl(q, limit)),
  isFid ? fetch(fidUrl(q)) : Promise.resolve(null),
]);
let users = search.ok ? (await search.json())?.result?.users ?? [] : [];
const hit = exact?.ok ? (await exact.json())?.result?.user : null;
if (hit) users = [hit, ...users.filter((u) => String(u.fid) !== String(hit.fid))];
```

## FIDs

FIDs are unsigned 64-bit integers in the protocol. Current values fit in a
JavaScript number, but do not build on that.

- Treat FIDs as decimal strings in URLs, keys, storage, and JSON you define.
  Validate with `/^\d+$/`; convert with `BigInt` if arithmetic is needed.
- If a provider returns a number, check `Number.isSafeInteger` before trusting it.
- Use a numeric database column wide enough for 64 bits, or text.
- An FID typed into search is a lookup, not proof of identity. Authorize writes
  with verified Quick Auth, as described in [data](../../data/SKILL.md).

## Client input

- Debounce about 300 ms. Abort the previous request with `AbortController`
  and ignore responses for a query that is no longer current, so a slow early
  response cannot overwrite a newer one.
- Show distinct states: idle, loading, results, no matches, and error with retry.
- Close the list on outside click and Escape; support arrow keys and Enter.
  Use real buttons for rows and keep tap targets at least 44 px.
- Show avatar, display name, `@username`, and FID so same-named accounts are
  distinguishable. After selection, show the chosen account as a removable chip.
- Inside a portaled modal, give the dropdown a z-index above the modal's.
- On a phone, keep the results visible above the on-screen keyboard; see
  [mobile](../../mobile/SKILL.md).

## Avatars

Profile pictures are arbitrary external URLs, often slow, large, or broken.

- Use a plain `<img>` (or allow the hosts explicitly in the image optimizer
  config), with fixed width and height and `object-fit: cover`.
- Fall back to a local placeholder or initials on missing URLs and in `onError`.
  Clear the handler after the first fallback to avoid an error loop.
- Add `loading="lazy"` and `referrerPolicy="no-referrer"` for long lists.

## Activity history

For a user's casts, reactions or follows without a key, a public Snapchain node
serves the hub HTTP API, e.g.
`GET https://snap.farcaster.xyz:3381/v1/castsByFid?fid=<fid>&pageSize=100&reverse=true`
(observed working 2026-11-01; undocumented public endpoint, so expect rate limits
and verify against the [Snapchain docs](https://snapchain.farcaster.xyz/)).
Timestamps are seconds since the Farcaster epoch (2021-01-01 UTC). The list
also contains `MESSAGE_TYPE_CAST_REMOVE` messages (deleted casts, about 1–2%);
count only `MESSAGE_TYPE_CAST_ADD`. Response times
vary from 2 s to over 45 s per page: use pages of 50–100, a per-request timeout
around 20 s, and fall back to partial results. Paging a
prolific account takes many requests: fetch server-side, cache per FID and day,
bound the page count, show progress, and mark capped results as partial. Route
handlers and pages are bundled separately in Next.js, so a module-level cache in
one is not visible to the other; share data through a cache both import
(`unstable_cache`/fetch cache) or one internal API.

## Optional data

- `extras.ethWallets` (or Neynar verified addresses) helps choose a payout
  address, but a user may have several. Prefer the documented primary address,
  and let the user confirm.
- `extras.publicSpamLabel` and Neynar `score` can filter or down-rank results.
  Do not silently hide accounts the user typed exactly.
- Cache enrichment by FID server-side with a short TTL. Do not store full
  profiles as authoritative state; they change.
