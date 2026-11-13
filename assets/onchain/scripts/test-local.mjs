#!/usr/bin/env node
// Full local check on a fresh chain: start anvil on 8545, build and deploy the contract, build the app
// for chain 31337, run Playwright, then stop anvil. Refuses to touch an existing process on 8545.
// usage: npm run test:local -- <Name | File.sol:Name> ['[constructor args JSON]']   (PLAYWRIGHT_PORT picks the app port)
// Several contracts or deploy-time wiring: define a "contracts:deploy:local" npm script (it runs against
// the fresh chain with RPC_URL set) and run npm run test:local with no arguments.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { connect } from "node:net";

const deployArgs = process.argv.slice(2);
const localDeploy = Boolean(JSON.parse(readFileSync("package.json", "utf8")).scripts?.["contracts:deploy:local"]);
if (!deployArgs.length && !localDeploy) {
  console.error("Usage: npm run test:local -- <Name | File.sol:Name> ['[constructor args JSON]'], or define a contracts:deploy:local script.");
  process.exit(1);
}
const portOpen = () => new Promise(resolve => {
  const socket = connect(8545, "127.0.0.1", () => { socket.end(); resolve(true); });
  socket.on("error", () => resolve(false));
});
if (await portOpen()) {
  console.error("Port 8545 is already in use. Stop that process yourself (this script never does), then rerun.");
  process.exit(1);
}

const anvil = spawn("anvil", ["--port", "8545", "--silent"], { stdio: "inherit" });
// Never let a real deployer key from the shell reach the local chain; anvil's account 0 deploys.
const env = { ...process.env, NEXT_PUBLIC_CHAIN_ID: "31337", RPC_URL: "http://127.0.0.1:8545" };
delete env.DEPLOYER_PRIVATE_KEY;
const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit", env });
let code = 1;
try {
  for (let i = 0; i < 50 && !(await portOpen()); i++) await new Promise(r => setTimeout(r, 100));
  run("npm", ["run", "contracts:build"]);
  if (deployArgs.length) run("node", ["scripts/deploy-contract.mjs", ...deployArgs]);
  else run("npm", ["run", "contracts:deploy:local"]);
  run("npm", ["run", "build"]);
  run("npx", ["playwright", "test"]);
  code = 0;
} catch {
  // the failing command already printed its error
} finally {
  anvil.kill();
}
process.exit(code);
