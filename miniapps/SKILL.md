---
name: miniapps
description: Add requested embedded-host integrations with a working web fallback, prompt splash dismissal, safe-area bridging, verified auth, sharing, and publish prerequisites.
license: MIT
---

# Embedded miniapps

Host support is opt-in. Write a small matrix of the requested hosts, detection,
identity, wallet, sharing, and unavailable capabilities. Do not add every host
to an ordinary web app or force every user to connect a wallet to browse it.

## Farcaster

Read the current [official SDK documentation](https://miniapps.farcaster.xyz/docs/getting-started)
before installing it. For a new app, `node <skill-dir>/scripts/create.mjs <dir> --miniapp`
adds the [provider](../assets/miniapp/components/MiniappProvider.tsx), a
[manifest route](../assets/miniapp/app/.well-known/farcaster.json/route.ts), the
embed metadata in the root layout, a lockfile pinning `@farcaster/miniapp-sdk`, and
[`scripts/miniapp-assets.mjs`](../assets/miniapp/scripts/miniapp-assets.mjs), which renders
opaque RGB `icon.png` (1024²), `splash.png` (200²) and `embed.png` (1200×800) from an SVG or HTML source.
In an existing app, copy the provider, mount it once in the root layout, pin a
verified SDK version and commit the resulting lockfile.

- Dismiss the host splash without waiting for context or authentication. Call
  `sdk.actions.ready()` without awaiting it. Guard other SDK reads/actions with
  confirmed host detection and `try/catch` plus a web fallback.
- Detect an injected different host first. Do not request Farcaster context in
  a runtime that has no Farcaster bridge: its promise can remain unresolved.
- Render the web app immediately. SDK initialization must not gate the entire
  page, navigation, server health, or anonymous core flow.
- Bridge host safe-area values into the variables from
  [mobile](../mobile/SKILL.md), keeping SDK reads in one provider.
- For authenticated server data use verified Quick Auth. The miniapp starter
  ships both halves: call your API with `authFetch` from `lib/auth-fetch.ts`
  (attaches the token inside a Farcaster host, plain fetch on the web) and read
  the caller in route handlers with `await verifiedFid(request)` from
  `lib/quick-auth.ts` (null when signed out; throws a 401 `Response` for forged,
  expired or malformed tokens, including an unknown key id; JWKS outages stay 5xx).
  Keep them rather than rewriting them. See [data](../data/SKILL.md). Never use an
  unverified SDK user object or a client-sent fid to authorize writes.
- Invoke sharing/wallet actions only in a supported host. On web use Web Share
  or a copy-link fallback; treat share cancellation as cancellation.

## Manifest, embeds, and launch

Follow the current [publishing guide](https://miniapps.farcaster.xyz/docs/guides/publishing).
Serve `/.well-known/farcaster.json` or a supported hosted-manifest redirect.
Use one explicit public origin, absolute launch/asset URLs, actual product
metadata, and real generated/supplied icon and splash files. The starter reads
`NEXT_PUBLIC_APP_URL` at build time: without it the manifest returns 503 and
the root embed is omitted, so check one build with it set (then rebuild). In
`next dev`, `request.url` says `localhost` even when the browser opened
`127.0.0.1`; never derive a signed domain from it. Validate current
image dimensions and metadata constraints from the official spec.

The account association is signed for the owner's domain. It cannot be
fabricated or copied from another app. Keep local functionality working while
recording the owner signature/public domain as a publish prerequisite. Emit
the current embed metadata and verify the preview's launch URL and images.

Check actual HTTP framing headers: remove restrictive `X-Frame-Options`; any
enforced `frame-ancestors` policy must allow `https://farcaster.xyz` and
`https://warpcast.com`. Wildcard subdomains alone do not include those apex
origins. Keep other CSP directives intact. Check hosted responses again after
deployment because a proxy may add headers absent locally.

## Other hosts and optional features

For MiniPay use [its official docs](https://docs.minipay.xyz/); for World App use
[its official docs](https://docs.world.org/mini-apps). Verify current SDK methods,
supported chain/assets, wallet behavior, host navigation and safe areas. Do not
assume Farcaster behavior or hardcode payment assets based on stale guidance.

Notifications require an app-owned verified webhook/token store/sender and
user consent, or an explicitly chosen service. Never silently send them through
a platform backend. Snap/in-feed behavior, when explicitly requested, is a
separate deliverable: verify the current specification and real interaction,
including its server response, rather than substituting a launch link.

Test ordinary web and each requested host separately. Browser emulation does
not prove native launch, notification delivery, wallet bridging, or signing.

## References

Read only the one the feature needs.

| Reference | Read when |
| --- | --- |
| [Host features and launch](references/host-features-and-launch.md) | Splash, context, composer/share actions, add-app prompts, haptics, manifest URLs |
| [Share pages and OG images](references/share-pages-and-og-images.md) | Per-item share links with Farcaster and X previews |
| [User search](references/user-search.md) | Finding or looking up Farcaster accounts by name or FID |
| [Notifications](references/notifications.md) | App-owned Farcaster notifications |
| [MiniPay](references/minipay.md) | The user asks for Opera MiniPay |
| [World App](references/world-app.md) | The user asks for a World App mini app |
