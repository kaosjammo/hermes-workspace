/** Enable only this package, through the same admitted RPC as Hermes's Plugins tab. */
export async function activateWorkspaceBackend(ctx, host, activationEpoch, publish = () => {}) {
  let disposed = false;
  let finishWaiting = () => {};
  ctx.onDispose(() => { disposed = true; finishWaiting(); });
  // Desktop loads disk plugins before restoring its selected connection/profile.
  // Wait for the SDK's live state instead of permanently failing registration
  // against that temporary empty state. Capture ownership only once it is ready.
  const ready = () => host.activeConnectionId() && host.state.profile.get()
    && host.state.gateway.get() === 'open';
  const waitForReady = async () => {
    while (!disposed && !ready()) {
      await new Promise(resolve => {
        const subscriptions = [];
        let settled = false;
        finishWaiting = () => {
          if (settled) return;
          settled = true;
          subscriptions.splice(0).forEach(stop => stop());
          resolve();
        };
        const check = () => { if (disposed || ready()) finishWaiting(); };
        for (const atom of [host.state.connectionId, host.state.profile, host.state.gateway]) {
          const stop = atom.subscribe(check);
          // subscribe() may emit synchronously, including the ready state.
          if (settled) stop();
          else subscriptions.push(stop);
        }
        check();
      });
    }
  };
  const pluginRow = result => {
    const rows = Array.isArray(result?.plugins) ? result.plugins.filter(row => row.key === 'workspace') : [];
    if (rows?.length !== 1)
      throw new Error('Workspace is not installed unambiguously in this profile. Install its package before enabling it.');
    return rows[0];
  };
  while (!disposed) {
    if (!ready()) await waitForReady();
    if (disposed) return false;
    finishWaiting = () => {};
    const connectionId = host.activeConnectionId();
    const profile = host.state.profile.get();
    const epoch = activationEpoch();
    const current = () => !disposed && ready() && host.activeConnectionId() === connectionId
      && host.state.profile.get() === profile && activationEpoch() === epoch;
    const complete = () => {
      if (!current()) return false;
      publish();
      console.info('[workspace] registered page and sidebar');
      return true;
    };
    let route, inventory;
    try {
      const routes = await host.profileRoutes();
      if (!current()) continue;
      const matches = routes.filter(route => route.connectionId === connectionId && route.profile === profile);
      if (matches.length !== 1)
        throw new Error('The selected Hermes profile route is unavailable or ambiguous.');
      route = Object.freeze({ ...matches[0] });
      inventory = await host.requestProfile(route, 'plugins.manage', { action: 'list', profile: route.targetProfile });
    } catch (error) {
      // Startup can replace its initial route while either read is in flight.
      // Discard that source's result/error and recapture the current route.
      // Errors from the current source still surface normally.
      if (!current()) continue;
      throw error;
    }
    if (!current()) continue;
    if (pluginRow(inventory).status === 'enabled') return complete();
    // Default loading must preserve a backend opt-out. An explicit Desktop On
    // decision authorizes enabling this package, including after an app restart.
    if (host.pluginDecisions?.get()?.workspace !== true)
      throw new Error('Workspace backend is off. Turn Workspace on in Capabilities → Plugins to enable it.');
    const request = params => host.requestProfile(route, 'plugins.manage', { ...params, profile: route.targetProfile });
    const afterMutation = () => {
      if (disposed) return false;
      if (!current())
        throw new Error('Hermes profile or connection changed while enabling Workspace. Toggle Workspace on again.');
      return true;
    };
    // Once a mutation starts, do not retry it or replace an uncertain outcome.
    const result = await request({ action: 'toggle', key: 'workspace', enable: true });
    if (!afterMutation()) return false;
    if (result?.ok !== true)
      throw new Error(result?.error || 'Hermes refused to enable the Workspace backend.');
    if (result.activation?.missing_dependencies?.length)
      throw new Error('Workspace was enabled, but Hermes must restart to load its dependencies.');
    const confirmed = await request({ action: 'list' });
    if (!afterMutation()) return false;
    if (pluginRow(confirmed).status !== 'enabled')
      throw new Error('Hermes did not confirm that the Workspace backend is enabled.');
    return complete();
  }
  return false;
}
