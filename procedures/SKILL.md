---
name: procedures
description: "Execute the app-building controller as local agent procedures: plan, prepare, implement slices, verify, repair within a budget, resume from evidence, and hand off with accurate status."
license: MIT
---

# Agent-operated build procedures

Execute these steps yourself with the current agent's tools. No queue, daemon,
account, remote controller, fixed model, or subagent is required. If a reviewer
is available and authorized, it may review the final diff; collect its result
before finishing. Otherwise perform the review yourself and label it accordingly.

## 1. Plan

Read the brief and repository instructions, reproduce reported failures, inspect
every caller of the code you will touch, and establish the contract described
in [ship](../ship/SKILL.md). Choose relevant topics only. Keep a short
`BUILD_STATE.md` for a substantial task:

```markdown
# Build state
Status: implementing
Request: build a shared reading list
Current slice: authenticated save and reload
Acceptance: add, reload, delete own item; reject another user's delete
Evidence: lint passed; save/reload not yet exercised
Blocker: none
Next: exercise real route against the test database
```

This file records observations, not permission to change scope. Keep it free of
tokens, connection strings, full logs, and user-private content. An ordinary
one-file fix needs no new project paperwork.
For a small new app, the README and a short check result can carry the plan and
evidence instead of requiring separate specification/state files.

## 2. Prepare

Check required runtimes and existing package scripts. For a new directory, copy
the starter with `scripts/create.mjs` from the skill root, then run the install
command it prints in the created app (`npm ci`; `npm install` with `--onchain`). Read its README for the pinned Node requirement.
In an existing app, use its own package manager and lockfile.
Run dependency commands with an explicit app working directory containing its
own `package.json`; package managers may otherwise walk up to an unrelated project.

Classify prerequisites by capability: filesystem, terminal, browser, database,
optional SDK, signer. Missing browser support means browser QA is unverified;
it is not a passing check. Request an indispensable user-provided resource only
after confirming that it is absent, without printing secret values.

## 3. Implement a vertical slice

Start with the design and real data/auth boundary the flow depends on. Implement
one complete action through UI, handler, persistence, and visible feedback.
For Ethereum/EVM work, read [ETHSkills](https://ethskills.com/SKILL.md) before
choosing the onchain implementation and verification path.
Keep the repo buildable; preserve validation and error handling when moving code.

The starter's lint enforces the React 19 hook rules, and they fail most first drafts.
Write to them from the start: derive values during render instead of copying props or
state into state from an effect; read browser-only values (`localStorage`,
`matchMedia`, the clock) with `useSyncExternalStore` or a lazy `useState` initializer;
read and write refs only in effects and event handlers, never during render; and call
impure functions (`Date.now()`, `Math.random()`) in handlers, effects or initializers.

Record the changed files and the observation that proves the slice works. Run
targeted checks after a coherent slice, not after each keystroke. Give concise
progress updates that state what now works and what is next.

## 4. Verify the integrated app

Read [QA](../qa/SKILL.md). On the bundled starter run:

```sh
node <skill-dir>/scripts/preflight.mjs <app-dir>
npm run lint
npm run build
npm run test:e2e
```

Run those commands from their documented locations: preflight accepts the app
path; the npm commands run inside that app. Install Chromium with
`npx playwright install chromium` if this machine has no compatible browser.
Use the project's equivalent scripts on other stacks. Complete relevant unit,
real database, contract, and host checks in addition to this baseline.

Review the complete diff for acceptance, regressions, data loss, auth, secrets,
and unrequested infrastructure. A stub page passing its template smoke test is
not evidence that the requested application has been implemented.

## 5. Repair with a stopping condition

For a failed check, preserve its error, reproduce it, repair the app, and rerun
the affected check. Do not weaken assertions, disable type/lint checks, or
substitute a mock just to pass.

Use at most three repair cycles for the same failing acceptance check in one
pass. If the same failure persists, stop repeating it and hand off its exact
cause, current safe state, and next diagnostic action. A missing credential,
service outage, signature, or permission requires a prerequisite to change;
repeated builds cannot solve it. Finish independent work in the meantime.

After repairs, run impacted integration checks on the final source again.
When checks pass, proceed to handoff; do not keep rebuilding unchanged code.

## 6. Resume after an interruption

Read `BUILD_SPEC.md`, `BUILD_STATE.md`, and the current diff. Verify claimed
completion against actual files and behavior. Confirm external blockers are
still present. Invalidate evidence for changed code; resume the first unmet
criterion. Do not recreate a database, delete state, or restart a scaffold
because a previous session ended.

## 7. Handoff

Finish or stop your background work, leaving services running only when useful
and clearly identified. Update the app README with exact install, configuration,
build/start, and test commands. Describe required environment names, purpose,
and whether each is optional, never values.

Report: what works, checks actually run, anything unverified, exact next owner
action if blocked, and the delivery status from [ship](../ship/SKILL.md).
Commit or publish only within the user's authorization and repository rules.
If deployment was requested, run post-deploy checks against the actual URL and
revision before saying it is deployed and working.
