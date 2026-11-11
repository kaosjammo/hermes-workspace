import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { sharedReact } from './shared-react.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const toolRequire = createRequire(path.join(root, '.local/toolchain/package.json'));
const { build } = toolRequire('esbuild');
const outdir = path.join(root, 'desktop');
await mkdir(outdir, { recursive: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'frontend/index.jsx')],
  outfile: path.join(outdir, 'plugin.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: ['@hermes/plugin-sdk', 'react', 'react/jsx-runtime'],
  plugins: [sharedReact()],
  nodePaths: [path.join(root, '.local/toolchain/node_modules')],
  legalComments: 'inline',
  metafile: true,
  write: true
});
await mkdir(path.join(root, '.local/build'), { recursive: true });
await writeFile(path.join(root, '.local/build/esbuild-metafile.json'), JSON.stringify(result.metafile, null, 2));
const bytes = await readFile(path.join(outdir, 'plugin.js'));
const smoke = spawnSync(process.execPath, ['--experimental-vm-modules',
  path.join(root, 'scripts/bundle-smoke.mjs'), path.join(outdir, 'plugin.js'),
  path.join(root, 'tests/ui/sdk-fixture.jsx')], { stdio: 'inherit', timeout: 15000 });
if (smoke.error) throw smoke.error;
if (smoke.status !== 0) throw new Error('Desktop bundle failed browser-module loading validation');
console.log(JSON.stringify({ file: 'desktop/plugin.js', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }));
