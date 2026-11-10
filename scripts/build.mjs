import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const toolRequire = createRequire(path.join(root, '.local/toolchain/package.json'));
const { build } = toolRequire('esbuild');
const outdir = path.join(root, 'desktop');
await mkdir(outdir, { recursive: true });
const result = await build({
  entryPoints: [path.join(root, 'frontend/index.jsx')],
  outfile: path.join(outdir, 'plugin.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: ['@hermes/plugin-sdk', 'react', 'react/jsx-runtime'],
  nodePaths: [path.join(root, '.local/toolchain/node_modules')],
  legalComments: 'inline',
  metafile: true,
  write: true
});
await mkdir(path.join(root, '.local/build'), { recursive: true });
await writeFile(path.join(root, '.local/build/esbuild-metafile.json'), JSON.stringify(result.metafile, null, 2));
const bytes = await readFile(path.join(outdir, 'plugin.js'));
console.log(JSON.stringify({ file: 'desktop/plugin.js', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }));
