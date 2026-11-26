#!/usr/bin/env node
// Builds skills.viniapp.xyz into dist/: the pack's files as they are (agents fetch
// SKILL.md and its topics by URL), the landing page, and the release archives that
// an agent downloads when it needs the scripts and starter.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const notPack = new Set(['.git', '.vercel', '.vercelignore', 'dist', 'site', 'vercel.json', 'node_modules']);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
for (const name of readdirSync(root)) {
  if (!notPack.has(name)) cpSync(join(root, name), join(dist, name), { recursive: true });
}
for (const name of ['index.html', 'favicon.png', 'og-skills.png']) cpSync(join(root, 'site', name), join(dist, name));

// package.py refuses an output inside the pack, so build the archives elsewhere first.
const releases = mkdtempSync(join(tmpdir(), 'viniapp-skills-'));
execFileSync('python3', [join(root, 'scripts', 'package.py'), releases], { stdio: 'inherit' });
cpSync(releases, join(dist, 'download'), { recursive: true });
rmSync(releases, { recursive: true, force: true });
console.log(`Built ${dist}`);
