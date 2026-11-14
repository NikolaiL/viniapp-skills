# ViniApp Skills

Build complete web apps and optional miniapps with your own coding agent.
An open-source snapshot of [ViniApp](https://www.viniapp.xyz)'s development
knowledge, with local procedures replacing the managed build controller.
Version **0.3.0**.

## Use it in one line

Paste this into any coding agent that can edit files and run commands:

> Read https://skills.viniapp.xyz/SKILL.md and follow it to build my app: [describe your app]

The agent reads the topics it needs by URL and downloads the pack for the starter
and scripts. More at [skills.viniapp.xyz](https://skills.viniapp.xyz).

Prefer not to run an agent yourself? [ViniApp](https://www.viniapp.xyz) builds,
deploys and hosts Farcaster and Base mini apps from a prompt. This pack is the
do-it-yourself version of that knowledge.

The layout follows [ETHSkills](https://ethskills.com/): one entry point at
`SKILL.md`, an end-to-end `ship/SKILL.md`, and focused `topic/SKILL.md` files.
Ethereum/EVM knowledge is delegated to [ETHSkills](https://ethskills.com/SKILL.md)
through links, not duplicated or bundled. This pack can be read from disk or
served as ordinary static files with relative topic links.

## Download and install

The release contains equivalent `viniapp-skills.zip` and `viniapp-skills.skill`
archives, each with a single top-level `viniapp-skills/` directory. `.skill` is
a ZIP-format package for clients that support that import; other agents can
use the ZIP. Keep the complete directory, including scripts and assets.

For any coding agent with file and terminal access:

> Read `/path/to/viniapp-skills/SKILL.md`, follow its ship procedure, and build
> my app in a separate project directory: [describe the product].

For Codex, unpack the directory into `~/.codex/skills/` (or your configured
skills directory) and invoke `$viniapp-skills`. On macOS, Codex's default
`workspace-write` sandbox blocks Chromium, so the agent reports browser tests as
blocked; run `npm run test:e2e` yourself afterwards, or allow the browser. Do not overwrite an existing
installation without checking its changes. Other clients can read the same
directory or use their own documented skill installation path. There is no
compulsory MCP server, model, or provider account.

The instructions are in English for portability; the agent should communicate
in the user's language. Installation does not itself install Node, app
dependencies, a browser, database, or wallet.

## What it does

1. Converts the brief into observable acceptance criteria.
2. Chooses only the necessary host, wallet, data, and game capabilities.
3. Builds complete slices with progress recorded in the app when useful.
4. Runs local checks and drives real interactions, then repairs with a limit.
5. Hands over working source, exact commands, evidence, and remaining prerequisites.

Topics: ship, procedures, design, mobile, data, miniapps, ETHSkills routing, games, media,
security, and QA. The root entry point loads them only when relevant.

The bundled web starter has pinned Next.js, React, TypeScript, CSS, a health
route, and Playwright tests against the production server on phone and desktop
viewports. Wallets and SDKs are added only for requested features. Ethereum/EVM
work routes to upstream ETHSkills; this pack maintains no parallel Ethereum
guide or platform-managed extension. Ordinary web builds do not need ETHSkills.

```sh
node /path/to/viniapp-skills/scripts/create.mjs ./my-app
cd my-app
npm ci
npm run dev
```

See [starter instructions](assets/starter/README.md) for Node requirements and
verification commands. The initial interaction is a scaffold smoke check;
the agent must implement and test the actual requested product.

## Independence and boundaries

No ViniApp backend, `vini` CLI, platform keys/hub, mandatory branding,
transaction attribution, fee recipients, remote telemetry, Vercel setup,
Neon provisioning, managed queue, or billing is included. Dependencies may
contain upstream vendor names; this does not configure or require their hosting.

Persistent shared data still requires a real database. Publishing requires an
appropriate runtime/domain; onchain deployment requires an authorized signer
and funds; signed host manifests require their owner's participation. The
skill documents those prerequisites rather than inventing them. Hosting and
database vendors are selected by the user, with no bundled deployment adapters.

Default delivery is `VERIFIED_LOCAL`; use `DEPLOYED_VERIFIED` only after a
requested deployment is actually exercised. Missing requested functionality
is explicitly `BLOCKED_EXTERNAL` or incomplete. Skills guide an agent; they
do not provide the platform controller's enforcement or guarantee its results.

## Maintain and package

Requires Node.js 22.11+ for tools and Python 3 for the stdlib-only packager.

```sh
node scripts/validate.mjs
node --test tests/tools.test.mjs
python3 scripts/package.py ../releases
```

The packager validates first, rejects symlinks/unexpected artifacts, and writes
ZIP, `.skill`, and SHA-256 checksums. Run the app's own production build and
browser tests separately; pack validation proves structure, not app correctness.
The same directory can later become its own Git repository and be served from
any static host. No public repository or website is assumed or created.

## Provenance and license

[MIT](LICENSE). [SOURCES.json](SOURCES.json) records the ViniApp source revisions,
input hashes, topic derivation, exclusions, and the ETHSkills layout reference.
This is a curated extraction, not a copy of every source skill. It contains no
production credentials, generated customer app code, investor material, or
private build transcripts. Preserve notices when adding third-party code.

See [VALIDATION.md](VALIDATION.md) for checks run on this release and the limits
of the initial validation. This pack is updated through deliberate snapshots. ETHSkills remains upstream
and is read only for relevant work; no remote code is executed automatically.
