import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../.local/toolchain/package.json', import.meta.url));
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div></div>', { url: 'https://workspace.test' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { plugin, host, advanceEpoch } = await import(process.env.WORKSPACE_REGISTRATION_RUNTIME ?? '../../.local/frontend/ui-runtime.mjs');

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

test('saved enabled Workspace registers its sidebar after cold startup without toggling', async () => {
  const initial = { profile: host.state.profile.get(), connection: host.state.connectionId.get(), gateway: host.state.gateway.get() };
  try {
    for (let restart = 0; restart < 2; restart++) {
      const calls = [], contributions = [], disposers = [];
      host.state.gateway.set('idle');
      host.state.profile.set('');
      host.state.connectionId.set(null);
      await withBackend(async (_route, _method, params) => {
        calls.push(params);
        return { plugins: [{ key: 'workspace', status: 'enabled' }] };
      }, async () => {
        const activation = plugin.register({ register: c => contributions.push(c), onDispose: fn => disposers.push(fn) });
        await Promise.resolve();
        assert.deepEqual(calls, []);
        assert.deepEqual(contributions, []);
        host.state.connectionId.set('local');
        host.state.profile.set('synthetic-a');
        host.state.gateway.set('connecting');
        await Promise.resolve();
        assert.deepEqual(calls, []);
        host.state.gateway.set('open');
        await activation;
        assert.deepEqual(calls.map(call => call.action), ['list']);
        assert.deepEqual(contributions.map(c => c.area).sort(), ['routes', 'sidebar.nav']);
        disposers.forEach(fn => fn());
      });
    }
  } finally {
    host.state.profile.set(initial.profile);
    host.state.connectionId.set(initial.connection);
    host.state.gateway.set(initial.gateway);
  }
});

test('startup route replacement during profile discovery still publishes the production sidebar', async () => {
  const originalRoutes = host.profileRoutes;
  let discoveries = 0;
  const contributions = [], disposers = [], calls = [];
  host.profileRoutes = async () => {
    const routes = await originalRoutes();
    if (++discoveries === 1) advanceEpoch();
    return routes;
  };
  try {
    await withBackend(async (_route, _method, params) => {
      calls.push(params.action);
      return { plugins: [{ key: 'workspace', status: 'enabled' }] };
    }, async () => {
      await plugin.register({ register: c => contributions.push(c), onDispose: fn => disposers.push(fn) });
    });
    assert.equal(discoveries, 2);
    assert.deepEqual(calls, ['list']);
    assert.deepEqual(contributions.map(c => c.area).sort(), ['routes', 'sidebar.nav']);
  } finally {
    host.profileRoutes = originalRoutes;
    disposers.forEach(fn => fn());
  }
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
