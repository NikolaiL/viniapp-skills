#!/usr/bin/env node
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const target = process.argv[2];
if (!target || process.argv.length !== 3) {
  console.error("Usage: node scripts/preflight.mjs <app-directory>");
  process.exit(1);
}
const root = path.resolve(target);
const ignored = new Set(["node_modules", ".git", ".next", ".vercel", "dist", "build", "coverage", "playwright-report", "test-results", ".viniapp"]);
const findings = [];
let filesChecked = 0;
const report = (file, rule) => findings.push({ file: path.relative(root, file), rule });
// An app hosted on ViniApp (the platform writes .viniapp/hosted, which is gitignored) uses the
// platform's backend for notifications and tracking on purpose; exported apps still get the check.
const hosted = existsSync(path.join(root, ".viniapp", "hosted"));

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) visit(file);
      continue;
    }
    if (entry.name === ".env.example") {
      filesChecked++;
      for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
        const value = line.match(/^\s*(?:export\s+)?[A-Z][A-Z0-9_]*\s*=\s*(.*)$/)?.[1];
        if (value !== undefined && !/^(?:""|'')?\s*(?:#.*)?$/.test(value)) {
          report(file, "env-example-must-use-empty-placeholders");
          break;
        }
      }
    }
    if (!/\.(?:[cm]?[jt]sx?|json)$/.test(entry.name) || /(?:lock|snapshot|test|spec)\./.test(entry.name)) continue;
    filesChecked++;
    const content = readFileSync(file, "utf8");
    if (/ignoreBuildErrors\s*:\s*true|ignoreDuringBuilds\s*:\s*true/.test(content)) report(file, "production-validation-disabled");
    if (!hosted && /\b(?:(?:NEXT_PUBLIC_)?VINIAPP_BACKEND|CDP_PROXY_KEY)\b|viniapp\.api\.viniapp\.xyz|api\.viniapp\.xyz|\bvini\s+(?:db|deploy|verify|env|image)\b/.test(content)) report(file, "managed-platform-dependency");
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) report(file, "private-key-material");
  }
}

try {
  if (!existsSync(root) || !lstatSync(root).isDirectory()) throw new Error("App directory not found.");
  if (!existsSync(path.join(root, "package.json"))) throw new Error("Expected an app directory with package.json.");
  visit(root);
  console.log(JSON.stringify({ passed: findings.length === 0, filesChecked, findings, scope: "Limited static checks only; build, browser, auth, database and security review remain required." }, null, 2));
  process.exitCode = findings.length ? 1 : 0;
} catch (error) {
  console.error(`Preflight unavailable: ${error.message}`);
  process.exitCode = 1;
}
