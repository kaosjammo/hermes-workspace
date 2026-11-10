import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = join(root, 'desktop/plugin.js');

test('frontend bundle is identical when invoked outside the repository', async () => {
  const original = await readFile(bundle);
  const elsewhere = await mkdtemp(join(tmpdir(), 'workspace-build-cwd-'));
  try {
    const hashes = [];
    for (const cwd of [root, elsewhere]) {
      const result = spawnSync(process.execPath, [join(root, 'scripts/build.mjs')], {
        cwd, encoding: 'utf8', env: process.env,
      });
      assert.equal(result.status, 0, result.stderr);
      const bytes = await readFile(bundle);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      console.log(JSON.stringify({ cwdKind: cwd === root ? 'repository' : 'external', bytes: bytes.length, sha256 }));
      hashes.push(sha256);
    }
    assert.equal(hashes[0], hashes[1], 'cwd must not change distributed bundle bytes or embed local checkout paths');
  } finally {
    await writeFile(bundle, original);
    await rm(elsewhere, { recursive: true, force: true });
  }
});
