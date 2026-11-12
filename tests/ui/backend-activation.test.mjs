import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateWorkspaceBackend } from '../../frontend/backend-activation.mjs';

function fixture({ enabled = false, decision = true, routes, reply, starting = false } = {}) {
  let profile = starting ? '' : 'writer', connectionId = starting ? null : 'local', epoch = 1, dispose;
  const calls = [];
  const route = { connectionId: 'local', profile: 'writer', targetProfile: 'writer-backend', mode: 'local' };
  const listeners = new Set();
  let gateway = starting ? 'idle' : 'open';
  const atom = get => ({ get, subscribe(fn) { listeners.add(fn); fn(); return () => listeners.delete(fn); } });
  const notify = () => { for (const fn of [...listeners]) fn(); };
  const ctx = { onDispose(fn) { dispose = fn; } };
  const row = () => ({ plugins: [{ key: 'workspace', status: enabled ? 'enabled' : 'disabled' }] });
  const host = {
    activeConnectionId: () => connectionId,
    state: { profile: atom(() => profile), connectionId: atom(() => connectionId), gateway: atom(() => gateway) },
    pluginDecisions: { get: () => ({ workspace: decision }) },
    profileRoutes: async () => typeof routes === 'function' ? routes() : routes ?? [{
      ...route, connectionId, profile, targetProfile: profile === 'writer' ? 'writer-backend' : profile + '-backend',
    }],
    requestProfile: async (captured, method, params) => {
      calls.push({ route: captured, method, params });
      const custom = await reply?.(params, calls.length);
      if (custom !== undefined) return custom;
      if (params.action === 'list') return row();
      enabled = params.enable;
      return { ok: true, plugin: row().plugins[0] };
    },
  };
  return { ctx, host, calls, route, run: () => activateWorkspaceBackend(ctx, host, () => epoch),
    listeners,
    connect() { connectionId = 'local'; profile = 'writer'; epoch++; gateway = 'connecting'; notify(); },
    ready() { gateway = 'open'; notify(); },
    dispose: () => dispose(), switchProfile: () => { profile = 'other'; },
    switchConnection: () => { connectionId = 'remote'; }, restart: () => { epoch++; } };
}

test('cold startup waits for profile and gateway readiness before checking the backend', async () => {
  const f = fixture({ starting: true, enabled: true });
  const activation = f.run();
  // Observe a rejection immediately so the pre-fix regression has a clean failure.
  const result = activation.then(value => ({ value }), error => ({ error }));
  await Promise.resolve();
  assert.equal(f.calls.length, 0);
  f.connect();
  await Promise.resolve();
  assert.equal(f.calls.length, 0, 'profile hydration must not race gateway startup');
  f.ready();
  const settled = await result;
  assert.equal(settled.error, undefined);
  assert.equal(settled.value, true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.listeners.size, 0);
});

test('turning Workspace off while startup is pending releases listeners and never activates later', async () => {
  const f = fixture({ starting: true });
  const activation = f.run();
  const result = activation.then(value => ({ value }), error => ({ error }));
  f.dispose();
  f.connect();
  f.ready();
  const settled = await result;
  assert.equal(settled.error, undefined);
  assert.equal(settled.value, false);
  assert.deepEqual(f.calls, []);
  assert.equal(f.listeners.size, 0);
});

test('Desktop On enables Workspace through admitted RPC and confirms the captured profile', async () => {
  const f = fixture();
  assert.equal(await f.run(), true);
  assert.deepEqual(f.calls.map(call => call.params), [
    { action: 'list', profile: 'writer-backend' },
    { action: 'toggle', key: 'workspace', enable: true, profile: 'writer-backend' },
    { action: 'list', profile: 'writer-backend' },
  ]);
  assert.ok(f.calls.every(call => call.method === 'plugins.manage' && Object.isFrozen(call.route)));
  assert.deepEqual(f.calls[1].route, f.route);
});

test('already-enabled backend causes no configuration write, including default loading', async () => {
  const f = fixture({ enabled: true, decision: undefined });
  assert.equal(await f.run(), true);
  assert.equal(f.calls.length, 1);
});

test('default loading and explicit Desktop Off never override a disabled backend', async () => {
  for (const decision of [undefined, false]) {
    const f = fixture({ decision });
    // Omitted decisions are represented by an empty host decision map.
    f.host.pluginDecisions.get = () => decision === undefined ? {} : { workspace: decision };
    await assert.rejects(f.run(), /Turn Workspace on/);
    assert.equal(f.calls.length, 1);
  }
});

test('missing or ambiguous profile routing never issues a request', async () => {
  for (const routes of [[], [{ connectionId: 'other', profile: 'writer' }],
    [{ connectionId: 'local', profile: 'writer' }, { connectionId: 'local', profile: 'writer' }]]) {
    const f = fixture({ routes });
    await assert.rejects(f.run(), /unavailable or ambiguous/);
    assert.deepEqual(f.calls, []);
  }
});

test('canonical Workspace key is required; unrelated and ambiguous packages are never toggled', async () => {
  for (const plugins of [[], [{ key: 'other', name: 'workspace', status: 'disabled' }],
    [{ key: 'workspace' }, { key: 'workspace' }]]) {
    const f = fixture({ reply: () => ({ plugins }) });
    await assert.rejects(f.run(), /not installed unambiguously/);
    assert.equal(f.calls.length, 1);
  }
});

test('admission refusal surfaces without fallback, retry, or success', async () => {
  const f = fixture({ reply: params => params.action === 'toggle' ? { ok: false, error: 'Dependency conflict' } : undefined });
  await assert.rejects(f.run(), /Dependency conflict/);
  assert.equal(f.calls.length, 2);
});

test('transport rejection surfaces without retrying a possibly committed mutation', async () => {
  const f = fixture({ reply: params => { if (params.action === 'toggle') throw new Error('Request timed out'); } });
  await assert.rejects(f.run(), /Request timed out/);
  assert.equal(f.calls.length, 2);
});

test('successful response without enabled readback cannot publish success', async () => {
  const f = fixture({ reply: params => params.action === 'toggle' ? { ok: true } : undefined });
  await assert.rejects(f.run(), /did not confirm/);
  assert.equal(f.calls.length, 3);
});

test('missing dependencies require restart rather than reporting availability', async () => {
  const f = fixture({ reply: params => params.action === 'toggle'
    ? { ok: true, activation: { missing_dependencies: ['pypdf'] } } : undefined });
  await assert.rejects(f.run(), /must restart/);
  assert.equal(f.calls.length, 2);
});

test('profile, connection and gateway changes during inventory restart only the read checks', async () => {
  for (const change of ['switchProfile', 'switchConnection', 'restart']) {
    const f = fixture({ enabled: true, reply: (_params, call) => { if (call === 1) f[change](); } });
    assert.equal(await f.run(), true);
    assert.deepEqual(f.calls.map(call => call.params.action), ['list', 'list']);
    assert.equal(f.calls[1].route.profile, f.host.state.profile.get());
    assert.equal(f.calls[1].route.connectionId, f.host.activeConnectionId());
  }
});

test('native startup source replacement while profileRoutes is pending captures the new epoch automatically', async () => {
  const f = fixture({ enabled: true });
  const routes = f.host.profileRoutes;
  let inventories = 0;
  f.host.profileRoutes = async () => {
    const result = await routes();
    if (++inventories === 1) f.restart();
    return result;
  };
  assert.equal(await f.run(), true);
  assert.equal(inventories, 2);
  assert.deepEqual(f.calls.map(call => call.params.action), ['list']);
});

test('failed read from a replaced startup source is discarded before trying the current source', async () => {
  const f = fixture({ enabled: true, reply: (_params, call) => {
    if (call === 1) { f.restart(); throw new Error('Old source closed'); }
  } });
  assert.equal(await f.run(), true);
  assert.deepEqual(f.calls.map(call => call.params.action), ['list', 'list']);
});

test('read error from the current source surfaces without an automatic retry', async () => {
  const f = fixture({ reply: () => { throw new Error('Current source unavailable'); } });
  await assert.rejects(f.run(), /Current source unavailable/);
  assert.equal(f.calls.length, 1);
});

test('profile change during admission prevents follow-up publication in a new owner', async () => {
  const f = fixture({ reply: params => { if (params.action === 'toggle') f.switchProfile(); } });
  await assert.rejects(f.run(), /changed while enabling/);
  assert.equal(f.calls.length, 2);
});

test('disposal before admission prevents writes and late registration', async () => {
  const f = fixture({ reply: (_params, call) => { if (call === 1) f.dispose(); } });
  assert.equal(await f.run(), false);
  assert.equal(f.calls.length, 1);
});

test('disposal during admission permits no stale readback or registration', async () => {
  const f = fixture({ reply: params => { if (params.action === 'toggle') f.dispose(); } });
  assert.equal(await f.run(), false);
  assert.equal(f.calls.length, 2);
});
