import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../.local/toolchain/package.json', import.meta.url));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div></div>', { url: 'https://workspace.test' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { plugin, host } = await import('../../.local/frontend/ui-runtime.mjs');

async function withBackend(request, check) {
  const original = { request: host.requestProfile, decisions: host.pluginDecisions };
  host.requestProfile = request;
  host.pluginDecisions = { get: () => ({ workspace: true }) };
  try { await check(); }
  finally {
    host.requestProfile = original.request;
    if (original.decisions === undefined) delete host.pluginDecisions;
    else host.pluginDecisions = original.decisions;
  }
}

test('production Desktop registration enables backend before publishing route and navigation', async () => {
  const calls = [], contributions = [];
  let enabled = false;
  await withBackend(async (route, method, params) => {
    calls.push({ route, method, params });
    assert.equal(contributions.length, 0);
    if (params.action === 'toggle') {
      enabled = true;
      return { ok: true };
    }
    return { plugins: [{ key: 'workspace', status: enabled ? 'enabled' : 'disabled' }] };
  }, async () => {
    const activation = plugin.register({ register: c => contributions.push(c), onDispose() {} });
    assert.equal(contributions.length, 0);
    await activation;
    assert.equal(plugin.defaultEnabled, true);
    assert.deepEqual(calls.map(call => call.params.action), ['list', 'toggle', 'list']);
    assert.equal(calls[1].params.key, 'workspace');
    assert.equal(calls[1].params.enable, true);
    assert.ok(calls.every(call => call.route.profile === 'synthetic-a' && call.params.profile === 'synthetic-a'));
    assert.deepEqual(contributions.map(c => c.area).sort(), ['routes', 'sidebar.nav']);
  });
});

test('production registration rejects refused backend activation without publishing Workspace', async () => {
  const contributions = [];
  await withBackend(async (_route, _method, params) => params.action === 'list'
    ? { plugins: [{ key: 'workspace', status: 'disabled' }] }
    : { ok: false, error: 'Activation denied' }, async () => {
    await assert.rejects(plugin.register({ register: c => contributions.push(c), onDispose() {} }), /Activation denied/);
    assert.deepEqual(contributions, []);
  });
});

test('turning Desktop off during registration prevents late route and navigation publication', async () => {
  let answer, disposed;
  const contributions = [];
  await withBackend(() => new Promise(resolve => { answer = resolve; }), async () => {
    const activation = plugin.register({ register: c => contributions.push(c), onDispose(fn) { disposed = fn; } });
    await Promise.resolve();
    assert.equal(typeof answer, 'function');
    disposed();
    answer({ plugins: [{ key: 'workspace', status: 'enabled' }] });
    await activation;
    assert.deepEqual(contributions, []);
  });
});
