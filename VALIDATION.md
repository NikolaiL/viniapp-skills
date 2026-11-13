# Release validation

Version **0.3.0**, validated on **2026-11-03**. This shows the pack can carry an
unassisted agent through real miniapp, onchain, database and game builds. It is
not a guarantee that any agent will implement every requested app.

## What changed in 0.3.0

- `create.mjs --onchain`: Foundry contracts with OpenZeppelin from npm, typed
  deployments, wagmi on Base, a mock connector on anvil, and `npm run
  test:local` (fresh anvil → deploy → build → Playwright).
- New `media` skill: Gemini images with verified true-alpha cutouts
  (`media-image.mjs`), Lyria music loops (`media-music.mjs`), and `audio.ts`
  (gapless bar-aligned loops, synthesized SFX, persisted mute). Credentials stay
  the app owner's `GEMINI_API_KEY`; nothing is printed.
- Fixes from measured friction in the builds below: keyless Farcaster
  endpoints (profile casts with likes, channel names, hub paging and latency),
  share-page traps (`loading.tsx` 404s, bold fonts, filling the card), SIWE with
  `viem/siwe`, Quick Auth server verification and its error mapping, an
  account-free local Postgres recipe and `42P08`, `node:sqlite` as the default
  store, Playwright config and test-data isolation, game art direction rules.
- Starters pin TypeScript 5.8.3, which `@farcaster/quick-auth` requires.

## Builds behind 0.3.0 (2026-11-01 to 2026-11-03)

Each build ran from a creator-style brief in a folder holding only a clean pack
copy, with no deployment, accounts or real funds, and was then re-run
independently (lint, build, Playwright, unit tests) and its phone screenshots
inspected. Times come from transcripts, not from the agents' own logs.

| App | Model | Wall-clock | Independent re-run |
|---|---|---:|---|
| Best Mint (onchain mint) | Claude | 16.7 min | green |
| Castmap (activity heatmap) | Claude | 18.1 min | green |
| Tip jar (onchain) | Claude | 20.5 min | 12 passed on a fresh anvil |
| Farcanoid (brick-breaker, generated art and music) | Claude / Codex / DeepSeek | 35.7 / 16.1 / 30.9 min | 14 / 12 / 10 passed |
| Coilrush (snake game) | Claude | 14.2 min | 22 passed |
| Cast Wrapped (90-day stats) | Claude / Codex / DeepSeek | 16.2 / 17.9 / 17.5 min | 26 / 14 / 4 passed |
| Cast Poll (Postgres, SIWE, Quick Auth) | Claude | 14.0 min | 21 passed on a local test database |

**Confirmation pass on the fixed pack (`df3d62e`):**

| App | Model | Wall-clock | Independent re-run | Notes |
|---|---|---:|---|---|
| Farcanoid | Claude | 35.7 min | 9 browser + 7 engine tests | Art on par with the earlier build; 18 images, 1 track. Time went to 2K image calls of 5–14 min each |
| Cast Poll | Claude | 19.9 min | 7 passed on a local test database | SIWE, local Postgres and Quick Auth guidance worked first time; 6 min lost to choosing `--onchain` only for a test wallet |
| Cast Wrapped | Codex | 24.7 min | 8 passed | Slow public hub that day (pages up to 45 s) |

The fixed areas produced no repeat friction. The new friction (slow 2K image
calls with no progress output, style locks that name objects, teal subjects on
a green key, the wallet-sign-in-without-`--onchain` path, hub latency, empty
share cards, decoration over text) is fixed in 0.3.0.

**Findings.** Vision matters for visual work: DeepSeek V4 Pro, which cannot
view images, shipped a broken title screen unseen and wrote the fewest tests.
Codex was fastest on the game; on non-game apps Claude was level and wrote more
tests. Every build stopped at `VERIFIED_LOCAL`: hosting, a production database,
manifest signing and real-host checks remain owner steps.

## Pack and tools

- `node scripts/validate.mjs` passes: 12 skills, relative links, pinned
  lockfiles and devDependencies, overlay drift and provenance.
- `node --test tests/tools.test.mjs` passes 8 of 8, including the `--onchain`
  overlay and the media tools' argument and missing-key handling.
- Miniapp starter in a clean directory: `npm ci`, lint, production build and
  Playwright (mobile and desktop) all pass. With `NEXT_PUBLIC_APP_URL` set, the
  manifest route and `fc:miniapp` embed render with absolute URLs.

## Forward test (0.2.0)

**Setup.** A fresh Codex CLI agent (`gpt-6.1-sol`, reasoning `high`) started in
an empty scratch directory containing only a clean copy of this pack. It ran in
Codex's `workspace-write` sandbox with network access. It had no access to the
source repositories, keys, databases or the original app.

**Brief.** The creator-style brief asked for a Farcaster miniapp:
- username/FID search with suggestions as you type
- a 365-day casting heatmap with the total and busiest day
- share previews for Farcaster and X
- a dark purple theme, and it must also work in a normal browser

The data had to come from keyless public sources only. No deployment.

**Result.**
- 14 minutes and about 134k tokens.
- The agent used `create.mjs --miniapp`, wrote `BUILD_SPEC.md`, `BUILD_STATE.md`
  and `CHECKS.md`, and built the app with real data. FID 3 showed 1,247 casts,
  155 active days and a busiest day of 49.
- Preflight, lint, production build and 8 non-browser tests passed. It verified
  and visually inspected the 1200×800 and 1200×600 preview PNGs.
- It flagged the public client endpoints as undocumented and rate-limited, as
  the user-search reference says.
- Chromium could not launch inside the sandbox. The agent reported those 6
  browser cases as blocked, gave the delivery status `BLOCKED_EXTERNAL`, and
  stated the exact command to run. It did not claim a pass.

**Independent re-run outside the sandbox.**
- Lint and build passed. 10 of 14 tests passed.
- The 4 failures came from one test-selector defect. Next.js adds a hidden
  route announcer with `role="alert"`, so `page.getByRole("alert")` matched two
  elements. With queries scoped to `main`, all 14 tests passed.
- Mobile (390 px) and desktop screenshots, plus the generated Farcaster preview
  image, were inspected: real data, readable layout, correct dimensions.
- One cosmetic issue remains: the account line wraps awkwardly on mobile.

**Lessons now in the pack.**
- `qa`: scope alert queries to the app's region; when the browser is blocked by
  a sandbox, report the cases as not run.
- `README`: Codex's macOS sandbox blocks Chromium.

### Claude Code runs (same day)

**Setup.** Fresh Claude Code desktop sessions (Opus 5.5, effort `high`) ran in a
new folder containing only a clean `v0.2.0` copy of the pack. There was no
project `CLAUDE.md` and no memory. The user's global plugins still loaded; none
of them carries this pack's content.

**Castmap** (the same brief as the Codex run):
- 19 minutes, 60 API calls, about 9.2M input-side tokens (99% cache reads) and
  66k output tokens. Delivery status `VERIFIED_LOCAL`.
- Reproduced independently: 10/10 Playwright cases across mobile and desktop,
  after building with `NEXT_PUBLIC_APP_URL` set to the test origin as its README
  documents. Without that, the 4 embed and manifest cases fail by design.
- UI and the 1200×600 X preview inspected: real data, correct layout. It looks
  plainer than the Codex build.
- Both builds agree on the busiest day. Their totals differ (1,338 vs 1,247)
  because they count activity differently. A product brief should define it.

**Racer** (a new creator-style brief): a simple phone racing game with touch
and keyboard controls, rising speed, a best score, and a Farcaster miniapp.
- 19 minutes, 48 API calls, about 7.9M input-side tokens (98% cache reads) and
  85k output tokens. Delivery status `VERIFIED_LOCAL`.
- It wrote a `GAME_SPEC.md` and built a seeded pure engine. Engine tests show:
  - idle and held-left/right runs crash in 2.8–5.5 s
  - a greedy pilot survives a median of 43 s
  - no three-lane walls
  - identical outcomes at 20/30/60/144 fps
- Reproduced independently: lint, build and 23/23 Playwright cases (9 engine,
  7 mobile touch, 7 desktop).
- Gameplay inspected at 390 px: title, in-play (score, speed, traffic,
  headlights) and the crash/results card with a saved best. On the title screen
  the overlay covers the mute button (minor).

**Limits.** Three builds, two agent products, one run each. Native Farcaster
launch, public crawler previews, notifications, wallets, databases and
deployment were not exercised. Codex's and Claude's token counts are reported
differently and are not directly comparable.

## Dependency audit and limits

The default web starter is unchanged from 0.1.x. Its production audit showed
zero known vulnerabilities. The full audit showed high-severity entries only in
development lint tooling: the `braces` → `micromatch` → `fast-glob` chain under
the Next ESLint config
([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)), with
no patched version at validation time.

The miniapp overlay's production audit (`npm audit --omit=dev`, 2026-10-31)
reports 8 advisories: 3 high and 5 moderate. All of the high ones come from the
`@farcaster/miniapp-sdk` → `@farcaster/quick-auth` → `zod` 3 chain: a memory
exhaustion advisory when validating oversized collections. No fix exists in that
chain today; SDK 0.4.0 and quick-auth 0.0.8 still depend on the affected range.
Bound and validate app-owned input before it reaches SDK-side validation, and
recheck before adopting a newer SDK.

Not tested:
- other agent products
- physical devices; Safari/Firefox
- native host launch, auth and notifications
- hosted databases, mainnet or testnet contract deployment and settlement
  (local Postgres, SQLite, anvil deploys and SIWE signatures were exercised)
- cloud hosting

No production system, customer app, account, signer or credential was used. No
site or repository was published as part of this validation.

To update a starter: change versions deliberately, regenerate its lockfile with
a full install (not `--package-lock-only`, which produced an out-of-sync
optional-dependency tree here), then rerun pack/tool checks and a clean
install/build/browser pass. Do not disable a failing check to refresh a pin.
