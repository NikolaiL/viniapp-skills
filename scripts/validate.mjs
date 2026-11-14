#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    // The website (site/, its dist/ output, vercel.json) is not part of the pack.
    if ([".git", ".vercel", "site", "dist", "vercel.json"].includes(name) && directory === root) continue;
    if (name === ".git") continue;
    const file = path.join(directory, name);
    const stat = lstatSync(file);
    assert(!stat.isSymbolicLink(), `Symbolic link is not distributable: ${path.relative(root, file)}`);
    assert(!["node_modules", ".next", "__pycache__", ".DS_Store", "test-results", "playwright-report"].includes(name), `Unexpected artifact: ${name}`);
    assert(!name.startsWith(".env") || name === ".env.example", "Real environment files must not be distributed.");
    if (stat.isDirectory()) walk(file);
    else files.push(file);
  }
}

try {
  walk(root);
  const skills = files.filter(file => path.basename(file) === "SKILL.md");
  assert.equal(skills.length, 12, "Expected entry point and eleven topic skills.");
  for (const file of skills) {
    const text = readFileSync(file, "utf8");
    const header = text.match(/^---\n([\s\S]*?)\n---\n/);
    assert(header, `Missing frontmatter: ${file}`);
    const name = header[1].match(/^name: ([a-z0-9-]+)$/m)?.[1];
    const description = header[1].match(/^description: (.+)$/m)?.[1];
    assert.equal(name, path.basename(path.dirname(file)), `Skill name/directory mismatch: ${file}`);
    assert(description && description.length <= 1024, `Invalid description: ${file}`);
    assert(/^["']/.test(description) || !/[:#]\s/.test(description), `Quote description punctuation for valid YAML: ${file}`);
    assert(text.split("\n").length < 500, `Skill entry point is too large: ${file}`);
  }
  for (const file of files.filter(file => /\.(?:md|txt)$/.test(file))) {
    for (const match of readFileSync(file, "utf8").matchAll(/\]\(([^)]+)\)/g)) {
      const link = match[1].split("#")[0];
      if (!link || /^[a-z]+:/i.test(link)) continue;
      const resolved = path.resolve(path.dirname(file), link);
      assert(resolved.startsWith(root), `Link escapes the pack: ${link}`);
      assert(existsSync(resolved), `Broken local link in ${path.relative(root, file)}: ${link}`);
    }
  }
  const manifests = {};
  for (const dir of ["assets/starter", "assets/miniapp"]) {
    const manifest = JSON.parse(readFileSync(path.join(root, dir, "package.json"), "utf8"));
    const lock = JSON.parse(readFileSync(path.join(root, dir, "package-lock.json"), "utf8"));
    assert.equal(lock.name, manifest.name, `${dir} lockfile name mismatch`);
    for (const section of ["dependencies", "devDependencies"]) {
      assert.deepEqual(lock.packages[""][section], manifest[section], `${dir} lockfile ${section} mismatch`);
      for (const version of Object.values(manifest[section])) assert(/^\d+\.\d+\.\d+$/.test(version), `${dir} dependencies must be pinned.`);
    }
    manifests[dir] = manifest;
  }
  // The miniapp overlay must be the starter plus the host SDK, nothing else.
  const { "@farcaster/miniapp-sdk": sdk, ...miniappDeps } = manifests["assets/miniapp"].dependencies;
  assert(sdk, "Miniapp overlay must pin @farcaster/miniapp-sdk.");
  assert.deepEqual({ ...manifests["assets/miniapp"], dependencies: miniappDeps }, manifests["assets/starter"], "Miniapp package.json drifted from the starter.");
  const fragment = JSON.parse(readFileSync(path.join(root, "assets/onchain/package.fragment.json"), "utf8"));
  for (const version of [fragment.dependencies, fragment.devDependencies, fragment.miniappDependencies].flatMap(Object.values)) {
    assert(/^\d+\.\d+\.\d+$/.test(version), "Onchain overlay dependencies must be pinned.");
  }
  const sources = JSON.parse(readFileSync(path.join(root, "SOURCES.json"), "utf8"));
  assert.equal(sources.version, "0.3.0");
  assert(sources.inputs.length > 0 && sources.inputs.every(input => /^[a-f0-9]{64}$/.test(input.sha256)), "Missing source hashes.");
  console.log(`Validated ${skills.length} skills, relative links, pinned starter lockfile, and provenance (${files.length} files).`);
} catch (error) {
  console.error(`Pack validation failed: ${error.message}`);
  process.exitCode = 1;
}
