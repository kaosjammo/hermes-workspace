/** Evaluate the shipped ESM directly, without Node's CommonJS globals. */
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const [bundlePath, fixturePath] = process.argv.slice(2);
assert(bundlePath && fixturePath, 'Usage: bundle-smoke.mjs <bundle> <SDK fixture>');
const require = createRequire(new URL('../.local/toolchain/package.json', import.meta.url));
const React = require('react');
const jsx = require('react/jsx-runtime');
const { JSDOM } = require('jsdom');
const { build } = require('esbuild');
// Use the normal SDK fixture, sharing the same React instance as the module map.
const fixture = await build({
  entryPoints: [path.resolve(fixturePath)], bundle: true, write: false,
  format: 'esm', platform: 'node',
  plugins: [{ name: 'fixture-react', setup(builder) {
    builder.onResolve({ filter: /^react$/ }, () => ({ path: pathToFileURL(require.resolve('react')).href, external: true }));
  } }],
});
const sdk = await import('data:text/javascript;base64,' + Buffer.from(fixture.outputFiles[0].text).toString('base64'));
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://workspace.test' });
const context = vm.createContext({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  console, setTimeout, clearTimeout, setInterval, clearInterval, URL, AbortController,
});
assert.equal(vm.runInContext('typeof require', context), 'undefined');
const modules = new Map();
for (const [name, values] of [['react', { ...React, default: React }], ['react/jsx-runtime', jsx], ['@hermes/plugin-sdk', sdk]]) {
  modules.set(name, new vm.SyntheticModule(Object.keys(values), function() {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context }));
}
const pluginModule = new vm.SourceTextModule(await readFile(bundlePath, 'utf8'), { context, identifier: path.resolve(bundlePath) });
await pluginModule.link(specifier => {
  assert(modules.has(specifier), 'Unsupported production import: ' + specifier);
  return modules.get(specifier);
});
await pluginModule.evaluate({ timeout: 5000 });
const plugin = pluginModule.namespace.default;
assert.equal(plugin.id, 'workspace');
const contributions = [], disposers = [];
await plugin.register({ register: c => contributions.push(c), onDispose: fn => disposers.push(fn) });
assert.deepEqual(contributions.map(c => c.area).sort(), ['routes', 'sidebar.nav']);
assert.equal(contributions.find(c => c.area === 'sidebar.nav').data.path, '/workspace');
assert(React.isValidElement(contributions.find(c => c.area === 'routes').render()));
disposers.forEach(fn => fn());
dom.window.close();
console.log('BUNDLE_SMOKE_PASS: direct browser ESM evaluation and Workspace registration');
