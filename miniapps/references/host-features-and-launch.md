# Farcaster host features and launch flow

Read when wiring splash dismissal, host context, sharing, add-app prompts,
haptics, mention launch, or manifest and embed image URLs.

SDK method names and limits below drift. Verify against the
[SDK actions docs](https://miniapps.farcaster.xyz/docs/sdk/actions/ready) and
the [specification](https://miniapps.farcaster.xyz/docs/specification).

## Splash and init order

- Call `sdk.actions.ready()` on mount, unconditionally and without awaiting it.
  It is a no-op outside a miniapp. Gating it on `isInMiniApp()` is the classic
  bug: a slow or false-negative check leaves the splash or browser chrome up.
- Retry once after about 500 ms if it throws. That is a yield, not a backoff loop.
- Run host detection in parallel with `ready()`, never before it.
- Detect injected hosts with no Farcaster bridge (wallet-injecting web browsers,
  MiniPay, World App) synchronously first. On those hosts, and on plain web, set
  ready state and return. Never await `sdk.context`, `sdk.quickAuth`, or
  `addMiniApp()` there: those promises can never settle, and `try/catch` does not
  help. Anything gated on "ready" (auth, wallet auto-connect) silently dies.
- Await `sdk.context` only after `sdk.isInMiniApp()` returns true inside a race
  of about 1500 ms.
- Keep the one-shot init effect's deps empty; read wallet values via refs.

```ts
const callReady = () =>
  sdk.actions.ready().catch(() =>
    new Promise((r) => setTimeout(r, 500)).then(() => sdk.actions.ready()).catch(() => {}));
const detect = () =>
  Promise.race([sdk.isInMiniApp(), new Promise<boolean>((r) => setTimeout(() => r(false), 1500))])
    .catch(() => false);
const [, inMiniApp] = await Promise.all([callReady(), detect()]);
```

## Time ready to the first usable frame

The host splash is the loading screen. Call `ready()` when the first screen is
usable, not a shell that reflows when fonts, art, or the first query land. Cap
the wait at about 3 seconds so a slow asset never traps the user on the splash.

- Hold only what the first screen needs: a game's sprites and audio manifest, a
  home screen's first query, a heavy font.
- Never hold on identity, wallet connection, or anything shown in-page.
- A "Loading..." screen right after the splash means the holds are wrong. Fix
  them; do not add a second splash.
- Games with horizontal drag pass `ready({ disableNativeGestures: true })` so the
  host's swipe-to-dismiss does not fight the controls. See [games](../../games/SKILL.md).

## Context

`sdk.context` provides `user` (fid, username, displayName, pfpUrl), `client`
(including `added`, `safeAreaInsets`), and `location` (for example `cast_embed`,
`notification`, `launcher`). It is unverified display data. Use it to
personalize, never to authorize; see [security](../../security/SKILL.md).
Bridge `safeAreaInsets` into CSS variables in one provider; see
[mobile](../../mobile/SKILL.md).

## Actions

Check support with `sdk.getCapabilities()` before calling optional actions, and
keep a web path for each.

- Share: `sdk.actions.composeCast({ text, embeds })`, at most two embed URLs.
  A null `result.cast` means the user cancelled; not an error, not a share.
  Web: `navigator.share`, then copy link.
- Profiles and links: `sdk.actions.viewProfile({ fid })`, `sdk.actions.openUrl(url)`.
- Haptics: `sdk.haptics.impactOccurred("light" | "medium" | "heavy" | "soft" | "rigid")`,
  `notificationOccurred("success" | "warning" | "error")`, `selectionChanged()`.
  Capability: `"haptics.impactOccurred"` etc. Fire and forget on meaningful
  moments (hit, win, confirm), not every frame.

## Add-app prompt

In practice (not in the docs) `sdk.actions.addMiniApp()` needs a live user
gesture, and a "Not now" sticks for the session: a wasted prompt is the only chance.

- Never call it on launch or inside init, and never await it there.
- Call it as the first statement of the tap handler that follows the user's
  first success: "Play again", "Continue", or "Share" on a result card. Calling it
  after an `await` (for example a save request) can lose the gesture.
- An explicit "Add app" button may prompt at any time.
- Never open it during gameplay, a timed interaction, a form, a wallet signature,
  or any primary action in progress. The host sheet covers the app and can end a
  run. Hold prompting while a run is active; prompt only from the run-over card.
- Skip it when `context.client.added` is true, and for opens from a
  notification or cast embed if your heuristic auto-prompts.
- Handle `RejectedByUser` and `InvalidDomainManifestJson` quietly. It fails on
  tunnel domains and any domain other than the manifest's.

## Mention launch

Unverified, from observed behavior: typing `@yourapp` in a cast launches the
app only when `accountAssociation` is signed by the app's own Farcaster account,
not the creator's. Generate it at https://farcaster.xyz/~/developers/new while
signed in as that account, for the exact hosting domain. The header, payload, and signature are one set: regenerate all three
together. After a rename or domain move, fetch the live
`/.well-known/farcaster.json` and confirm the decoded payload domain matches the
public origin. A stale association fails silently. Signing is an owner action;
record it as a publish prerequisite.

## Manifest and embed images

- Every image URL in the manifest and `fc:miniapp` embed must be absolute
  `https://`. Resolve env values with `new URL(value, publicOrigin).toString()`;
  it returns absolute values unchanged. Derive the origin from deploy env, never
  hardcode production.
- Put real values in the deployed environment, not only `.env.example`.
- Hosts cache images per URL. When replacing art under the same filename, add
  `?v=N` from an asset-version setting, or rename the file.
- Icon 1024×1024 PNG, no alpha; splash 200×200; embed image 3:2 (600×400 to
  3000×2000, under 10 MB); URLs ≤ 1024 characters. See the
  [specification](https://miniapps.farcaster.xyz/docs/specification).

Verify in a real host: the splash dismisses within about a second, browser
chrome does not appear, and the prompt never interrupts a run.
