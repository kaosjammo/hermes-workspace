/** Enable only this package, through the same admitted RPC as Hermes's Plugins tab. */
export async function activateWorkspaceBackend(ctx, host, activationEpoch, publish = () => {}) {
  let disposed = false;
  ctx.onDispose(() => { disposed = true; });
  const connectionId = host.activeConnectionId();
  const profile = host.state.profile.get();
  const epoch = activationEpoch();
  const current = () => {
    if (disposed) return false;
    if (host.activeConnectionId() !== connectionId || host.state.profile.get() !== profile || activationEpoch() !== epoch)
      throw new Error('Hermes profile or connection changed while enabling Workspace. Toggle Workspace on again.');
    return true;
  };
  const complete = () => {
    if (!current()) return false;
    publish();
    return true;
  };
  if (!connectionId || !profile)
    throw new Error('Select a Hermes profile before enabling Workspace.');
  const routes = await host.profileRoutes();
  if (!current()) return false;
  const matches = routes.filter(route => route.connectionId === connectionId && route.profile === profile);
  if (matches.length !== 1)
    throw new Error('The selected Hermes profile route is unavailable or ambiguous.');
  const route = Object.freeze({ ...matches[0] });
  const request = params => host.requestProfile(route, 'plugins.manage', { ...params, profile: route.targetProfile });
  const pluginRow = result => {
    const rows = Array.isArray(result?.plugins) ? result.plugins.filter(row => row.key === 'workspace') : [];
    if (rows?.length !== 1)
      throw new Error('Workspace is not installed unambiguously in this profile. Install its package before enabling it.');
    return rows[0];
  };
  const inventory = await request({ action: 'list' });
  if (!current()) return false;
  if (pluginRow(inventory).status === 'enabled') return complete();
  // Default loading must preserve a backend opt-out. An explicit Desktop On
  // decision authorizes enabling this package, including after an app restart.
  if (host.pluginDecisions?.get()?.workspace !== true)
    throw new Error('Workspace backend is off. Turn Workspace on in Capabilities → Plugins to enable it.');
  const result = await request({ action: 'toggle', key: 'workspace', enable: true });
  if (!current()) return false;
  if (result?.ok !== true)
    throw new Error(result?.error || 'Hermes refused to enable the Workspace backend.');
  if (result.activation?.missing_dependencies?.length)
    throw new Error('Workspace was enabled, but Hermes must restart to load its dependencies.');
  const confirmed = await request({ action: 'list' });
  if (!current()) return false;
  if (pluginRow(confirmed).status !== 'enabled')
    throw new Error('Hermes did not confirm that the Workspace backend is enabled.');
  return complete();
}
