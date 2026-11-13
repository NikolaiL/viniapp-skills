# Contracts in a plain app

Read when a new or existing app built from this pack's starter needs a smart
contract, a wallet connection, or onchain reads/writes. Contract design and
security still come from [ETHSkills](https://ethskills.com/SKILL.md).

## Start

- New app: `node <skill-dir>/scripts/create.mjs <dir> --onchain`, plus
  `--miniapp` for Farcaster (`--miniapp --onchain` together). Then `npm install`
  (not `npm ci`: it adds the pinned wagmi/viem/react-query packages to the
  lockfile; OpenZeppelin is a pinned npm devDependency) and
  `npm run contracts:setup` once: it installs pinned `forge-std` into the
  gitignored `contracts/lib` (rerun it after a fresh clone). Both are remapped
  in `contracts/foundry.toml`.
- Existing app: copy `assets/onchain/contracts`, `scripts/deploy-contract.mjs`,
  `lib/contracts.ts`, `lib/wagmi.ts` (or `wagmi.miniapp.ts`) and
  `components/Web3Provider.tsx`, merge `package.fragment.json`, and wrap the
  root layout's children in `<Web3Provider>`. Keep the app's framework and
  package manager.
- Requires Foundry (`forge`, `anvil`). Use full Scaffold-ETH 2 only when the
  user asks for it; measured builds took about twice as long (see the traps below).

## Loop

```sh
npm run chain                         # anvil on 127.0.0.1:8545, chain 31337
npm run contracts:test                # forge tests in contracts/test
npm run contracts:build
npm run contracts:deploy -- MyContract '[ "constructor", "args" ]'
NEXT_PUBLIC_CHAIN_ID=31337 npm run build && npm run test:e2e
```

`npm run test:local -- MyContract '[args]'` does the whole local check in one
command on a fresh chain: starts anvil (refusing a busy 8545), builds and
deploys, builds for 31337, runs Playwright and stops anvil. For several
contracts or deploy-time wiring (a mock token first, its address into the next
constructor), define a `contracts:deploy:local` script and run
`npm run test:local` with no arguments.

The deploy script writes `contracts/deployments.json` and regenerates
`lib/contracts.ts` (`deployments[chainId][Name].{address,abi}`, `as const`).
Commit both; redeploy after any contract change; never hand-edit addresses.
Until a chain has a deployment, look it up loosely and disable the action:

```ts
import type { Abi, Address } from "viem";
import { deployments } from "./contracts";
import { targetChain } from "./wagmi";
type Entry = { address: Address; abi: Abi };
export const myContract = (deployments as Record<string, Record<string, Entry>>)[String(targetChain.id)]?.MyContract;
```

## Frontend rules

- Import `injected`/`mock` from `wagmi`, never from `wagmi/connectors`: that
  barrel pulls every wallet SDK into the bundle and breaks the webpack build
  on missing optional modules.
- Use `useReadContract`, `useWriteContract`, `useWaitForTransactionReceipt`.
  Base polling is 30 s to spare public RPCs, so pass `pollingInterval: 1_000`
  to receipt waits, then refetch the affected reads explicitly.
- Approvals: wait for the approval receipt and re-read the allowance before
  the real transaction. Never send both back to back.
- Show the target chain, the connected address, pending/confirmed/failed
  states, and a switch-network action when `chainId` differs.
- BigInt literals (`7n`) need the starter's ES2020 TypeScript target.

## Server-signed claims

Never trust a client-reported score, prize or allowance onchain. Common shape:

1. The server issues a short-lived run ticket (HMAC over run id and expiry;
   the wallet is often unknown until the run ends), and the client returns the
   ticket plus the raw inputs (taps, moves) and the player address.
2. The server replays the inputs with the same pure game/rules module the
   client uses, rejects impossible timing, and signs an EIP-712 message
   (player, value, nonce, deadline) with a key kept in a server secret.
3. The contract verifies the signer, deadline and single use (nonce), and binds
   the claim to `msg.sender`. Fuzz-test replay, wrong player, tampered value,
   other signer and expiry.

Without a configured signer, keep the game playable and disable the claim.

## Testing

`NEXT_PUBLIC_CHAIN_ID=31337` adds a `mock` connector for anvil's public test
account, so Playwright can connect, sign and read back without a browser
extension: click "Connect Mock Connector", act, assert the onchain result. It
exists only for chain 31337. It does not reconnect after a page reload, so
tests reconnect explicitly (real injected wallets do). Drive a second actor
from the test with viem and anvil's account 1, and give Node-side viem clients
`pollingInterval: 100` on anvil (the 4 s default makes seeding slow). Isolate
tests with `evm_snapshot`/`evm_revert`. Test the contract itself with `forge test`,
including fuzz cases for value-bearing paths. If a Base-target build has no
deployment, tests should expect the explicit "not deployed" state.

## Deploying to Base

The owner supplies `DEPLOYER_PRIVATE_KEY` (funded for gas on Base) and, for
verification, `ETHERSCAN_API_KEY`. Without them, stop and report the exact
prerequisite; the script refuses unfunded or missing keys and sends nothing.

```sh
RPC_URL=https://mainnet.base.org DEPLOYER_PRIVATE_KEY=… npm run contracts:deploy -- MyContract
forge verify-contract <address> src/MyContract.sol:MyContract --root contracts --chain 8453 --watch
```

Then build the frontend with the default chain (Base), check the address on
the explorer, and exercise one real read/write before claiming it deployed.

## Known traps

- `forge install … --root contracts` fails ("prefix not found"); the setup
  script runs `forge install` from inside `contracts/` instead.
- Type-aware ESLint (`projectService`) over wagmi/viem types makes each lint a
  full type-check and slows every build; the starter's lint is not type-aware
  and `next build` already type-checks.
- On macOS, scripts that shell out to `make` fail until the Xcode license is
  accepted (an owner action); the starter's scripts do not use `make`.
- An onchain `data:` SVG `tokenURI` image can't go through `next/image`; use
  `<img>` with a one-line `@next/next/no-img-element` disable and its reason.

If the user requires full Scaffold-ETH 2:
- `create-eth` and its Foundry scripts call `make`. When that fails, create-eth
  still exits 0, but leaves no forge-std and no initial commit.
- Its frontend is wallet-first. Remove the providers, header, `/debug` and
  `/blockexplorer` pages, branding and default API keys that the app doesn't need.
- Its type-aware lint misses dot-folders such as `app/.well-known`; add them to
  `tsconfig` `include`.
- Run Playwright through `yarn`, not `npx`: Yarn 4 resolves a different binary.
