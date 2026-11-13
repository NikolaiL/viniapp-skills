---
name: ship
description: Turn an app idea or substantial enhancement into the smallest complete, testable product. Select the stack, data ownership, user flow, optional hosts, and a verification plan before implementation.
license: MIT
---

# Ship an app

Read [procedures](../procedures/SKILL.md) for the execution loop. Start with the
user's requested outcome; do not invent dashboards, token economies, admin
screens, accounts, or a three-platform launch to fill a template.

## Establish the contract

For a nontrivial build, write a short `BUILD_SPEC.md` in the app:

1. Who uses it, their main action, and the visible successful result.
2. Requested features as observable acceptance criteria. Include negative paths.
3. Routes, data ownership, auth, persistence, external services, and hosts in scope.
4. The smallest implementation slices and how each will be exercised.
5. Required credentials/resources, whether available, and who provides them.

Keep exclusions from the request explicit: “no wallet” means no wallet setup.
If an essential detail is missing, ask one focused question while continuing
independent work. Use reasonable defaults for reversible implementation choices.

## Choose a foundation

- Existing app: inspect its entry points, scripts, callers, schema, and local
  instructions. Repair or extend in place; do not scaffold over working code.
- New ordinary web app: use the included [starter](../assets/starter/README.md).
  It is Next.js App Router, React, TypeScript, plain CSS, and Playwright. It has
  no wallet, database, host SDK, or deployment integration by default.
- Contracts or wallet actions: start from the same starter with `--onchain`
  (Foundry, typed deployments, wagmi on Base, local-chain browser tests;
  combine as `--miniapp --onchain` for a Farcaster miniapp) and
  follow [contracts in a plain app](../wallets/references/contracts-in-a-plain-app.md).
  Read [ETHSkills](https://ethskills.com/SKILL.md) for contract design, security
  and chain specifics. Use full Scaffold-ETH 2 only when the user asks for it.
  Preserve the user's scope, provider choices and existing stack.
- Embedded app requested: add only the hosts in scope using
  [miniapps](../miniapps/SKILL.md); the normal browser path must still launch.

For remote-only use, download the complete pack before invoking bundled scripts
or copying assets. A downloaded `SKILL.md` alone is not the starter.

## Choose state by its promise

| Product promise | Appropriate state |
| --- | --- |
| A preference or draft on this device | Browser storage with hydration/error handling |
| Shared content, accounts, cross-device progress | App-owned server database |
| Value transfer or trustless ownership | Verified onchain state |
| Missing service credentials | Explicit blocked branch; no fake replacement |

Do not replace a shared leaderboard with a local high score or an escrow with
an in-memory balance. Read [data](../data/SKILL.md) and
[security](../security/SKILL.md) when these boundaries exist.

Design before decorating: read [design](../design/SKILL.md) and
[mobile](../mobile/SKILL.md). For games, define the loop and difficulty in
[games](../games/SKILL.md) before implementing the engine. For illustrated
graphics, game art, music or sound, plan the asset set with [media](../media/SKILL.md).

## Delivery target

Default delivery is source that runs locally, passes relevant checks, and
includes exact production build/start instructions. Add deployment only when
requested, using the user's chosen environment. Classify the result accurately:
`VERIFIED_LOCAL`, `BLOCKED_EXTERNAL`, or `DEPLOYED_VERIFIED`. A successful local
build is never evidence for the last status.

Official framework references: [Next.js](https://nextjs.org/docs/app),
[Scaffold-ETH 2](https://docs.scaffoldeth.io/),
[Playwright](https://playwright.dev/docs/intro).
