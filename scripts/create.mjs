#!/usr/bin/env node
import { appendFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const flags = ["--miniapp", "--onchain"];
const args = process.argv.slice(2);
const miniapp = args.includes("--miniapp");
const onchain = args.includes("--onchain");
const positional = args.filter(arg => !flags.includes(arg));
const destination = positional[0];
if (positional.length !== 1 || destination.startsWith("-")) {
  console.error("Usage: node scripts/create.mjs <new-app-directory> [--miniapp] [--onchain]");
  process.exit(1);
}
const target = path.resolve(destination);
const name = path.basename(target);
if (!/^[a-z][a-z0-9-]*$/.test(name) || name.length > 80) {
  console.error("Use a directory name starting with a lowercase letter, followed by lowercase letters, digits or hyphens (max 80 characters).");
  process.exit(1);
}
if (existsSync(target) || target === root.slice(0, -1) || target.startsWith(root)) {
  console.error("Choose a new directory outside this skill. Existing directories are never overwritten.");
  process.exit(1);
}
const source = path.join(root, "assets/starter");
// The miniapp overlay replaces layout, package manifest/lockfile and .env.example, and adds the provider and manifest route.
const overlay = path.join(root, "assets/miniapp");
// The onchain overlay adds contracts/, the deploy script and wagmi; its pinned dependencies are merged into package.json.
const chain = path.join(root, "assets/onchain");
function checkSource(directory) {
  for (const item of readdirSync(directory)) {
    const file = path.join(directory, item);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error("Starter must not contain symbolic links.");
    if (stat.isDirectory()) checkSource(file);
  }
}
try {
  checkSource(source);
  if (miniapp) checkSource(overlay);
  if (onchain) checkSource(chain);
  const realTarget = path.join(realpathSync(path.dirname(target)), name);
  if (realTarget.startsWith(realpathSync(root) + path.sep)) throw new Error("Target resolves inside the skill directory.");
  mkdirSync(target);
  for (const item of readdirSync(source)) {
    cpSync(path.join(source, item), path.join(target, item), { recursive: true, force: false, errorOnExist: true });
  }
  if (miniapp) cpSync(overlay, target, { recursive: true, force: true });
  const manifest = JSON.parse(readFileSync(path.join(target, "package.json"), "utf8"));
  manifest.name = name;
  if (onchain) {
    for (const dir of ["contracts", "scripts", "lib", "components"]) cpSync(path.join(chain, dir), path.join(target, dir), { recursive: true, force: false, errorOnExist: true });
    const miniappWagmi = path.join(target, "lib/wagmi.miniapp.ts");
    if (miniapp) renameSync(miniappWagmi, path.join(target, "lib/wagmi.ts"));
    else rmSync(miniappWagmi);
    const fragment = JSON.parse(readFileSync(path.join(chain, "package.fragment.json"), "utf8"));
    manifest.dependencies = { ...manifest.dependencies, ...fragment.dependencies, ...(miniapp ? fragment.miniappDependencies : {}) };
    manifest.dependencies = Object.fromEntries(Object.entries(manifest.dependencies).sort(([a], [b]) => a.localeCompare(b)));
    manifest.devDependencies = Object.fromEntries(Object.entries({ ...manifest.devDependencies, ...fragment.devDependencies }).sort(([a], [b]) => a.localeCompare(b)));
    manifest.scripts = { ...manifest.scripts, ...fragment.scripts };
    appendFileSync(path.join(target, ".env.example"), `\n${readFileSync(path.join(chain, "env.onchain.example"), "utf8")}`);
    const layout = path.join(target, "app/layout.tsx");
    const text = readFileSync(layout, "utf8");
    const wrapped = text
      .replace('import "./globals.css";', 'import { Web3Provider } from "../components/Web3Provider";\nimport "./globals.css";')
      .replace("{children}</", "<Web3Provider>{children}</Web3Provider></");
    if (wrapped === text || !wrapped.includes("<Web3Provider>")) throw new Error("Could not mount Web3Provider in app/layout.tsx.");
    writeFileSync(layout, wrapped);
  }
  writeFileSync(path.join(target, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const lockPath = path.join(target, "package-lock.json");
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    lock.name = name;
    lock.packages[""].name = name;
    writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  }
  const kind = [miniapp && "Farcaster miniapp", onchain && "onchain"].filter(Boolean).join(", ");
  console.log(`Created ${target}${kind ? ` (${kind})` : ""}\nNext: cd into this directory, run ${onchain ? "npm install (adds the pinned onchain packages to the lockfile)" : "npm ci"}, then npm run dev. Replace the starter interaction with the requested product.`);
  if (miniapp) console.log("Before publishing: write public/icon.png, splash.png and embed.png with node scripts/miniapp-assets.mjs <icon.svg> [embed.svg], set NEXT_PUBLIC_APP_URL, and get the owner's signed account association. See miniapps/SKILL.md.");
  if (onchain) console.log("Contracts: needs Foundry (forge, anvil). Run npm run contracts:setup once (forge-std; OpenZeppelin comes from npm), then see wallets/references/contracts-in-a-plain-app.md.");
} catch (error) {
  console.error(`Could not create starter: ${error.message}`);
  process.exit(1);
}
