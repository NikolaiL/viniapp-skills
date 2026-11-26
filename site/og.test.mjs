import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
test('site build serves the dedicated PNG referenced by OG and Twitter metadata', () => {
  execFileSync(process.execPath, ['site/build.mjs'], { cwd: root, stdio: 'pipe' });
  const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
  const image = readFileSync(join(root, 'dist/og-skills.png'));
  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
  assert.deepEqual(image, readFileSync(join(root, 'site/og-skills.png')));
  assert.match(html, /property="og:image" content="https:\/\/skills\.viniapp\.xyz\/og-skills\.png"/);
  assert.match(html, /name="twitter:image" content="https:\/\/skills\.viniapp\.xyz\/og-skills\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
});
