---
name: qa
description: Verify an app against its real acceptance criteria with production build/lint, real browser interactions, data and wallet failure paths, accurate evidence, and bounded repairs.
license: MIT
---

# Acceptance and release checks

For each requested interaction: locate its real route and rendered entry point,
drive it, assert the promised effect, check a relevant failure path, and record
the observation. Correct orphaned code is still a missing feature.

## Check layers

1. Static preflight plus the app's lint and production build. Keep type checking
   active. Do not treat preflight's small rule set as a comprehensive audit.
2. Focused tests for nontrivial changed logic, concurrency, parsers, money,
   and security boundaries. Avoid tests that merely repeat implementation text.
3. Browser checks against a production server when practical: mobile and desktop,
   main interaction, resulting state, navigation, loading/error paths, and reload.
4. Real route/driver/database effects when server persistence is present. For
   device-local state test actual browser storage and reload instead. Authenticated success,
   unauthenticated/unauthorized rejection, duplicate/idempotent behavior, and
   actual stored results must be exercised. See [data](../data/SKILL.md).
5. For Ethereum/EVM features, use the relevant verification guidance from
   [ETHSkills](https://ethskills.com/SKILL.md). For embedded hosts, exercise
   requested native capabilities separately from ordinary browser emulation.

Use the browser tool already available in the agent, or the project's Playwright
setup. If Chromium cannot launch (for example an agent sandbox denying it with a
`Permission denied` / `MachPortRendezvous` error), browser QA is blocked: run the
remaining checks, report the browser cases as not run, and give the exact command
to run outside the sandbox. Never relabel them as passed. The bundled starter's `npm run test:e2e` runs against `next start` after
`npm run build`. Extend its tests to cover the requested product; the initial
counter interaction proves only that the template works. Playwright re-evaluates
its config in every worker, so reset test data in `globalSetup`, never at the
config's top level, and it loads the starter's TypeScript as CommonJS (no
`import.meta` there).

## Browser assertions

- Assert a real action followed by its visible or persisted effect. Prefer role
  and label selectors; use stable test IDs for custom canvas/complex controls.
  Scope role queries to the app's own region: Next.js adds a hidden route
  announcer with `role="alert"`, so `page.getByRole("alert")` matches two
  elements; use `page.locator("main").getByRole("alert")`.
- Fail on uncaught runtime errors and same-origin `/api/` 5xx responses. A page
  can render while every data request fails. Check expected negative responses
  deliberately instead of suppressing console failures globally.
- Test for horizontal overflow, reachable CTAs, and keyboard/focus behavior.
  Compare footer/action bounds at the initial mobile scroll position.
- Embedded apps need response-header framing checks and manifest/embed checks,
  not only source greps. A wildcard subdomain does not include an apex origin.
- Games need held input and in-play evidence, not only start-screen screenshots.
- Use isolated fixtures and real auth mechanics; never ship a public “test
  login,” fake payout state, or bypass query parameter to obtain a green test.
- Tests write to their own store (a test database file or schema set in the
  test server's environment), never to data real users see. Test names on a
  leaderboard or feed are a failed check.

## Evidence and review

Keep short command results and observed effects in `BUILD_STATE.md` or a small
`CHECKS.md`. Include what source/revision was checked. Redact secrets and keep
screenshots/test output outside public assets. Distinguish passed, failed,
blocked, and not run. A mock does not establish a real integration passed.

Review the final complete diff against the brief and existing behavior. If an
independent reviewer is used, give it the request, diff, and actual evidence;
do not tell it the expected verdict. Without one, label review as self-review.

Apply the bounded repair procedure in [procedures](../procedures/SKILL.md).
After deployment, verify the live URL/revision, public assets, framing headers,
and main flow again before claiming `DEPLOYED_VERIFIED`. A local-only handoff
can be `VERIFIED_LOCAL`; unresolved requested functionality remains explicitly
blocked or incomplete.
