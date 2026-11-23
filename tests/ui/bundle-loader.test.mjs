import { test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { sharedReact } from '../../scripts/shared-react.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(path.join(root, '.local/toolchain/package.json'));
function smoke(bundle) {
  return execFileSync(process.execPath, ['--experimental-vm-modules',
    path.join(root, 'scripts/bundle-smoke.mjs'), bundle,
    path.join(root, 'tests/ui/sdk-fixture.jsx')], { encoding: 'utf8', timeout: 15000 });
}

test('shipped Desktop bundle evaluates directly without a CommonJS require global', () => {
  assert.match(smoke(path.join(root, 'desktop/plugin.js')), /BUNDLE_SMOKE_PASS/);
});

test('bundled React DOM creates real portals using the host React singleton in browser ESM', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'workspace-portal-'));
  try {
    const bundle = path.join(directory, 'plugin.mjs');
    const result = await require('esbuild').build({
      stdin: { contents: `import React from 'react'; import {createPortal} from 'react-dom';
        export default {id:'workspace', register(ctx) {
          const target=document.createElement('div'), child=React.createElement('span',null,'Portal');
          const portal=createPortal(child,target);
          if (portal.containerInfo!==target || portal.children!==child) throw Error('Portal ownership changed');
          ctx.register({area:'routes', render:()=>child});
          ctx.register({area:'sidebar.nav', data:{path:'/workspace'}});
        }};`, resolveDir: root },
      bundle: true, write: false, format: 'esm', platform: 'browser',
      external: ['@hermes/plugin-sdk', 'react', 'react/jsx-runtime'],
      nodePaths: [path.join(root, '.local/toolchain/node_modules')], plugins: [sharedReact()],
    });
    await writeFile(bundle, result.outputFiles[0].text);
    assert.match(smoke(bundle), /BUNDLE_SMOKE_PASS/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
