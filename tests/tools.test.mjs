import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const run = (script, args) => spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], { encoding: "utf8" });
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "viniapp-skills-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("create copies a runnable manifest and matching lockfile, then refuses overwrite", t => {
  const app = path.join(fixture(t), "reading-list");
  const created = run("create.mjs", [app]);
  assert.equal(created.status, 0, created.stderr);
  const pkg = JSON.parse(readFileSync(path.join(app, "package.json")));
  const lock = JSON.parse(readFileSync(path.join(app, "package-lock.json")));
  assert.equal(pkg.name, "reading-list");
  assert.equal(lock.packages[""].name, "reading-list");
  assert(existsSync(path.join(app, "app/page.tsx")));
  assert(existsSync(path.join(app, "LICENSE")));
  writeFileSync(path.join(app, ".env.local"), "PRESERVE_THIS_FILE=yes\n");
  assert.equal(run("create.mjs", [app]).status, 1);
  assert.equal(readFileSync(path.join(app, ".env.local"), "utf8"), "PRESERVE_THIS_FILE=yes\n");
});

test("create --miniapp overlays the provider, manifest route and SDK-pinned lockfile", t => {
  const app = path.join(fixture(t), "cast-card");
  const created = run("create.mjs", [app, "--miniapp"]);
  assert.equal(created.status, 0, created.stderr);
  const pkg = JSON.parse(readFileSync(path.join(app, "package.json")));
  const lock = JSON.parse(readFileSync(path.join(app, "package-lock.json")));
  assert.equal(pkg.name, "cast-card");
  assert.equal(lock.packages[""].name, "cast-card");
  assert.match(pkg.dependencies["@farcaster/miniapp-sdk"], /^\d+\.\d+\.\d+$/);
  assert.deepEqual(lock.packages[""].dependencies, pkg.dependencies);
  assert(existsSync(path.join(app, "components/MiniappProvider.tsx")));
  assert(existsSync(path.join(app, "app/.well-known/farcaster.json/route.ts")));
  assert(existsSync(path.join(app, "scripts/miniapp-assets.mjs")));
  assert.match(readFileSync(path.join(app, "app/layout.tsx"), "utf8"), /<MiniappProvider>/);
  assert.equal(run("create.mjs", [path.join(fixture(t), "two-a"), path.join(fixture(t), "two-b")]).status, 1);
});

test("create --onchain adds contracts, deploy script, pinned wagmi and mounts Web3Provider", t => {
  for (const extra of [[], ["--miniapp"]]) {
    const app = path.join(fixture(t), "chain-app");
    const created = run("create.mjs", [app, "--onchain", ...extra]);
    assert.equal(created.status, 0, created.stderr);
    const pkg = JSON.parse(readFileSync(path.join(app, "package.json")));
    assert.match(pkg.dependencies.wagmi, /^\d+\.\d+\.\d+$/);
    assert.equal(Boolean(pkg.dependencies["@farcaster/miniapp-wagmi-connector"]), extra.length > 0);
    assert(pkg.scripts["contracts:deploy"] && pkg.scripts["contracts:setup"]);
    assert(existsSync(path.join(app, "contracts/foundry.toml")));
    assert(existsSync(path.join(app, "scripts/deploy-contract.mjs")));
    assert(existsSync(path.join(app, "scripts/test-local.mjs")) && pkg.scripts["test:local"]);
    assert.match(pkg.devDependencies["@openzeppelin/contracts"], /^\d+\.\d+\.\d+$/);
    assert(existsSync(path.join(app, "lib/contracts.ts")));
    assert(!existsSync(path.join(app, "lib/wagmi.miniapp.ts")));
    assert.equal(/farcasterMiniApp/.test(readFileSync(path.join(app, "lib/wagmi.ts"), "utf8")), extra.length > 0);
    assert.match(readFileSync(path.join(app, "app/layout.tsx"), "utf8"), /<Web3Provider>\{children\}<\/Web3Provider>/);
    assert.match(readFileSync(path.join(app, ".env.example"), "utf8"), /DEPLOYER_PRIVATE_KEY=/);
  }
});

test("create refuses invalid names, an existing empty directory, and a path inside the skill", t => {
  const dir = fixture(t);
  assert.equal(run("create.mjs", [path.join(dir, "Bad Name")]).status, 1);
  const empty = path.join(dir, "empty");
  mkdirSync(empty);
  assert.equal(run("create.mjs", [empty]).status, 1);
  assert.equal(run("create.mjs", [path.join(root, "forbidden-app")]).status, 1);
  assert(!existsSync(path.join(root, "forbidden-app")));
  const alias = path.join(dir, "alias");
  symlinkSync(root, alias, "dir");
  assert.equal(run("create.mjs", [path.join(alias, "forbidden-app")]).status, 1);
  assert(!existsSync(path.join(root, "forbidden-app")));
});

test("media tools reject bad arguments and stop without a key, printing no secret", t => {
  const dir = fixture(t);
  const env = { ...process.env };
  delete env.GEMINI_API_KEY;
  const media = (script, args) => spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], { cwd: dir, env, encoding: "utf8" });
  assert.equal(media("media-image.mjs", ["--prompt", "x", "--out", "a.gif"]).status, 1);
  assert.equal(media("media-image.mjs", ["--prompt", "x", "--cutout", "--out", "a.jpg"]).status, 1);
  assert.equal(media("media-music.mjs", ["--prompt", "x", "--out", "a.wav"]).status, 1);
  writeFileSync(path.join(dir, ".env.local"), "OTHER=1\n");
  for (const [script, out] of [["media-image.mjs", "a.png"], ["media-music.mjs", "a.mp3"]]) {
    const result = media(script, ["--prompt", "x", "--out", out]);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /GEMINI_API_KEY is not set/);
  }
});

test("preflight passes starter and reports hazards without revealing values", t => {
  const app = path.join(fixture(t), "checked-app");
  assert.equal(run("create.mjs", [app]).status, 0);
  assert.equal(run("preflight.mjs", [app]).status, 0);
  writeFileSync(path.join(app, ".env.example"), 'OPTIONAL_KEY=""\nOTHER_KEY= # Owner supplied\n');
  assert.equal(run("preflight.mjs", [app]).status, 0);
  writeFileSync(path.join(app, ".env.example"), "SERVICE_SECRET=synthetic-test-value\n");
  writeFileSync(path.join(app, "next.config.ts"), "export default { typescript: { ignoreBuildErrors: true } };\n");
  const failed = run("preflight.mjs", [app]);
  assert.equal(failed.status, 1);
  assert(!failed.stdout.includes("synthetic-test-value"));
  assert.deepEqual(new Set(JSON.parse(failed.stdout).findings.map(item => item.rule)), new Set(["env-example-must-use-empty-placeholders", "production-validation-disabled"]));
});

test("preflight detects managed runtime dependency and fails closed on missing app", t => {
  const dir = fixture(t);
  assert.equal(run("preflight.mjs", [dir]).status, 1);
  writeFileSync(path.join(dir, "package.json"), "{}");
  writeFileSync(path.join(dir, "client.ts"), 'const endpoint = process.env.NEXT_PUBLIC_VINIAPP_BACKEND || "https://viniapp.api.viniapp.xyz";');
  const result = run("preflight.mjs", [dir]);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).findings[0].rule, "managed-platform-dependency");
});

test("packaging a Git checkout excludes metadata and creates equivalent archives", t => {
  const dir = fixture(t);
  const copy = path.join(dir, "viniapp-skills");
  cpSync(root, copy, { recursive: true, filter: source => path.basename(source) !== ".git" });
  mkdirSync(path.join(copy, ".git"));
  writeFileSync(path.join(copy, ".git/config"), "private repository metadata\n");
  const output = path.join(dir, "release");
  const packaged = spawnSync("python3", [path.join(copy, "scripts/package.py"), output], { encoding: "utf8" });
  assert.equal(packaged.status, 0, packaged.stderr + packaged.stdout);
  const zip = path.join(output, "viniapp-skills.zip");
  assert.deepEqual(readFileSync(zip), readFileSync(path.join(output, "viniapp-skills.skill")));
  const entries = spawnSync("python3", ["-c", "import json,sys,zipfile; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))", zip], { encoding: "utf8" });
  const names = JSON.parse(entries.stdout);
  assert(names.every(name => name.startsWith("viniapp-skills/") && !name.split("/").includes(".git")));
  assert(names.includes("viniapp-skills/assets/starter/LICENSE"));
});
