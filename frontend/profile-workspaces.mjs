/** Lane D standalone data client. No ambient profile switch or native grants. */
export class ProfileWorkspaceError extends Error {}

export function createProfileWorkspacesClient(ctx, readOwner) {
  const owner = JSON.stringify(readOwner());
  let active = true, sequence = 0, pending = Promise.resolve();
  let value = Object.freeze({ loading: false, capabilities: null, workspaces: [],
    profileId: null, privateScope: null, selected: null, error: null });
  const listeners = new Set();
  const check = () => {
    if (!active || JSON.stringify(readOwner()) !== owner)
      throw new ProfileWorkspaceError('Workspace connection or profile changed. Reopen Workspace.');
  };
  const publish = patch => {
    check(); value = Object.freeze({ ...value, ...patch });
    for (const listener of listeners) listener();
  };
  const call = async (path, options) => {
    check(); const result = await ctx.rest(path, options); check(); return result;
  };
  const queue = work => {
    const next = pending.then(() => { check(); return work(); });
    pending = next.catch(() => {}); return next;
  };
  const id = projectId => {
    if (!/^[0-9a-f]{32}$/.test(projectId)) throw new ProfileWorkspaceError('Choose an available shared workspace.');
    return `/workspaces/${projectId}`;
  };
  const current = view => {
    if (!view?.workspace?.id || !view?.state?.scope_id || !Number.isInteger(view.state.revision) ||
        !Number.isInteger(view.workspace.membership_revision))
      throw new ProfileWorkspaceError('Load the shared workspace before making changes.');
    return view;
  };
  return {
    snapshot: () => value,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    async load() {
      const generation = ++sequence;
      publish({ loading: true, error: null });
      try {
        const capabilities = await call('/workspace-capabilities');
        if (generation !== sequence) return;
        if (!capabilities.shared_storage_configured) {
          publish({ capabilities, workspaces: [], profileId: null, privateScope: null, selected: null, loading: false });
          return;
        }
        const result = await call('/workspaces');
        if (generation !== sequence) return;
        publish({ capabilities, workspaces: result.workspaces, profileId: result.profile_id,
          privateScope: result.private_scope_id, selected: null, loading: false });
      } catch (error) {
        if (active && generation === sequence && JSON.stringify(readOwner()) === owner)
          publish({ loading: false, error: error.message });
        throw error;
      }
    },
    async select(projectId, { beforeSelect, onSelect } = {}) {
      return queue(async () => {
        // Serial integration supplies draft flush/recovery and document mounting.
        if (typeof beforeSelect !== 'function' || typeof onSelect !== 'function')
          throw new ProfileWorkspaceError('Workspace navigation integration is unavailable.');
        await beforeSelect({ kind: projectId ? 'shared' : 'private', id: projectId }); check();
        const view = projectId ? current(await call(id(projectId) + '/state')) : null;
        await onSelect({ kind: projectId ? 'shared' : 'private', id: projectId, view }); check();
        publish({ selected: view });
        return view;
      });
    },
    create(name, members = []) {
      const scope = value.privateScope;
      return queue(async () => {
        if (!scope || scope !== value.privateScope) throw new ProfileWorkspaceError('Reload your private Workspace first.');
        const workspace = await call('/workspaces', { method: 'POST', body: { name, members, expected_scope: scope } });
        publish({ workspaces: [...value.workspaces, workspace] }); return workspace;
      });
    },
    command(view, op, payload) {
      current(view);
      const captured = structuredClone(view);
      return queue(async () => {
        const response = await call(id(captured.workspace.id) + '/command', { method: 'POST', body: {
          op, payload: { ...payload, expected_revision: captured.state.revision },
          expected_scope: captured.state.scope_id, membership_revision: captured.workspace.membership_revision } });
        if (response.state.scope_id !== captured.state.scope_id)
          throw new ProfileWorkspaceError('Shared Workspace identity changed. Reopen it.');
        if (value.selected?.workspace.id === captured.workspace.id)
          publish({ selected: { workspace: captured.workspace, state: response.state } });
        return response;
      });
    },
    setMember(view, memberId, role = 'editor') {
      current(view);
      const captured = structuredClone(view);
      return queue(async () => {
        const workspace = await call(id(captured.workspace.id) + '/members', { method: 'POST', body: {
          profile_id: memberId, role, membership_revision: captured.workspace.membership_revision,
          expected_scope: captured.state.scope_id } });
        publish({ workspaces: value.workspaces.map(row => row.id === workspace.id ? workspace : row),
          selected: value.selected?.workspace.id === workspace.id ? { ...value.selected, workspace } : value.selected });
        return workspace;
      });
    },
    movePrivate(view, itemId, privateState, { confirmed = false } = {}) {
      current(view);
      if (confirmed !== true) return Promise.reject(new ProfileWorkspaceError('Confirm the move before sharing this document.'));
      const captured = structuredClone(view), source = structuredClone(privateState);
      return queue(async () => {
        try {
          return await call(id(captured.workspace.id) + '/move-private', { method: 'POST', body: {
            item_id: itemId, confirmed: true, expected_scope: captured.state.scope_id,
            membership_revision: captured.workspace.membership_revision, source_scope: source.scope_id,
            source_revision: source.revision, destination_revision: captured.state.revision } });
        } catch (error) {
          throw new ProfileWorkspaceError(`Move outcome is unconfirmed. Reload both workspaces before another move; do not retry automatically. ${error.message}`);
        }
      });
    },
    async inspect(projectId) { return current(await call(id(projectId) + '/state')); },
    dispose() { active = false; sequence++; listeners.clear(); },
  };
}

/** Executor UI seam. The native adapter must verify the exact source/thread and
 * save the binding authoritatively; selecting a row is never an execution grant. */
export function executorChoice(profile, thread) {
  if (!profile?.profileId || !thread?.id || profile.source?.kind !== 'local')
    throw new ProfileWorkspaceError('Select a supported local profile and matching native thread.');
  const sourceKey = source => JSON.stringify(['kind', 'connection_id', 'profile', 'target_profile'].map(key => source?.[key]));
  const fields = ['kind', 'connection_id', 'profile', 'target_profile'];
  if (Object.keys(profile.source).some(key => !fields.includes(key)) || fields.some(key => !(key in profile.source)) ||
      typeof profile.source.connection_id !== 'string' || !profile.source.connection_id ||
      ['profile', 'target_profile'].some(key => profile.source[key] !== null && (typeof profile.source[key] !== 'string' || !profile.source[key])))
    throw new ProfileWorkspaceError('The selected local executor source is unsupported or incomplete.');
  if (thread.profileId !== profile.profileId || sourceKey(thread.source) !== sourceKey(profile.source))
    throw new ProfileWorkspaceError('Native thread does not belong to the selected executor source.');
  return { profile_id: profile.profileId, source: Object.fromEntries(fields.map(key => [key, profile.source[key]])), thread_id: thread.id };
}
