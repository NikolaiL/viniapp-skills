---
name: viniapp-skills
description: Build or improve complete web apps and optional embedded miniapps from a product brief. Use for ViniApp-style app creation, mobile UX, games, wallet flows, persistence, and end-to-end verification in the user's own repository. Runs locally through documented procedures without a managed app-building platform.
license: MIT
metadata:
  author: viniapp
  version: "0.3.0"
---

# ViniApp Skills

Turn a product request into a working, verified application in the user's own
repository. This is a portable snapshot of ViniApp's development practices.
It needs a coding agent with file and terminal access; browser verification
also needs a browser tool or Playwright. No account with ViniApp is required.

## Start here

For a new app or a substantial feature, read [ship/SKILL.md](ship/SKILL.md).
It selects relevant topics and follows [procedures/SKILL.md](procedures/SKILL.md),
which replaces the managed controller with agent-executed steps.
For a bounded bug fix, reproduce the failure, read the relevant topic, make the
smallest complete repair, and follow the verification and handoff procedure.

Read linked files relative to this file's location, not the target app's working
directory. If reading this over HTTP, resolve links against the fetched URL.
Fetch only the topic you need. Do not assume another skill or tool is installed.

| Topic | Read when |
| --- | --- |
| [Ship](ship/SKILL.md) | Turning an idea into an app; selecting scope and starter |
| [Procedures](procedures/SKILL.md) | Planning, building, verifying, repairing, resuming, handing off |
| [Design](design/SKILL.md) | Establishing visual identity, navigation, and interaction states |
| [Mobile](mobile/SKILL.md) | Responsive layouts, safe areas, footers, touch controls |
| [Data](data/SKILL.md) | Durable state, authentication, external APIs, migrations |
| [Miniapps](miniapps/SKILL.md) | Farcaster or another explicitly requested embedded host |
| [Ethereum / ETHSkills](wallets/SKILL.md) | Route Ethereum/EVM work to upstream ETHSkills |
| [Games](games/SKILL.md) | Game design, loops, input, score integrity, gameplay verification |
| [Media](media/SKILL.md) | Generated art, game graphics, music loops, sound effects |
| [Security](security/SKILL.md) | Auth, server writes, secrets, funds, external content |
| [QA](qa/SKILL.md) | Acceptance checks, browser interactions, failure paths, final review |

## Product contract

- For Ethereum/EVM work, read [ETHSkills](https://ethskills.com/SKILL.md) and
  its relevant topics. This pack links to that knowledge rather than duplicating it.
- Implement the user's actual request. Add wallets, chains, hosts, databases,
  generated imagery, or paid services only when the product needs them.
- Preserve an existing project's framework, package manager, lockfile, data,
  and environment files. The bundled starter is for a new directory only.
- Keep shared or financial state authoritative on the server or chain.
  Browser storage is suitable only for explicitly device-local state.
- Never invent credentials, transaction receipts, deployed contracts, funded
  balances, or evidence. A running page and a successful build do not establish
  that its features work.
- Missing infrastructure is an explicit prerequisite. Finish the independent
  work, disable affected operations honestly, and report the exact next action.
- Keep code, configuration, and verification owned by the app. Do not add
  platform callbacks, hidden attribution, telemetry, or a compulsory provider.
- Respect the host agent's permissions. Installing this skill does not authorize
  publishing, sending messages, spending funds, or bypassing approval controls.

## Included tools

- [Create a starter](scripts/create.mjs): `node <skill-dir>/scripts/create.mjs <new-app-dir>`.
  Copies the pinned Next.js/React/TypeScript starter; never overwrites a directory.
- [Preflight](scripts/preflight.mjs): `node <skill-dir>/scripts/preflight.mjs <app-dir>`.
  Reports a small set of static hazards; it is not a security audit.
- [Generate images](scripts/media-image.mjs) and [music](scripts/media-music.mjs) with the owner's
  `GEMINI_API_KEY`; see [media](media/SKILL.md).
- [Validate the pack](scripts/validate.mjs): `node <skill-dir>/scripts/validate.mjs`.

Use [README.md](README.md) for installation and distribution. Runtime setup,
current package versions, host requirements, and external deployments must be
checked against official documentation when implementing those integrations.
