/**
 * Workspace native workflow adapter. UI contract (also frontend/WORKFLOW-ADAPTER.md):
 * createWorkflowAdapter(ctx) -> {listThreads, bindThread, addressComments, stop,
 * openThread, status, recover, dispose}. All methods are async except dispose.
 *
 * addressComments(itemId, explicitItemIds = []) returns a persisted run, with native thread_id. The UI
 * refreshes state/status to display actual progress; no timer invents progress.
 * stop(run) revokes Workspace write authority BEFORE native prompt.cancel.
 * recover(run) unlocks locally with native terminal UNKNOWN. UI must explain
 * this action, partial edits and Restore; it does not prove native cancellation.
 * Native sessions are always accessed through an exact host.profileRoutes()
 * descriptor. Epoch and selected owner are captured before awaits. Profile
 * switches reject stale follow-on writes/publication. No model/approval settings.
 *
 * Server routes required (ctx.rest already supplies native profile scope):
 * POST /workflow/bind {item_id,thread_id};
 * POST /workflow/review-scope {item_id,selected_item_ids,expected_revision};
 * POST /workflow/prepare {item_id,session_id,explicit_item_ids,review_id?};
 * POST /workflow/consume {run_id} before status during active-run polling;
 * POST /workflow/status {run_id}; POST /workflow/stop {run_id};
 * POST /workflow/recover {run_id} is an EXPLICIT user recovery action only.
 * Every POST includes expected_scope from /state.scope_id.
 * prepare returns {run,prompt,submission_id}; consume returns {run,native_terminal}.
 * Pending consume makes no edits. Failed finalization surfaces explicit Recover.
 * Principal is injected by the authenticated server, never a JSON/header field.
 * status/stop return {run,native_terminal?,control?}.
 * Workspace item's thread_id is a durable native stored session id.
 */
import { host, gatewayActivationEpoch } from '@hermes/plugin-sdk';

export function createWorkflowAdapter(ctx) {
  let disposed = false;
  const owners = new Map();
  const creations = new Map();
  let threadSelections = new WeakMap();
  const selectedOwner = () => {
    const owner = {connectionId: host.activeConnectionId(), profile: host.state.profile.get()};
    if (!owner?.connectionId || !owner?.profile) throw new Error('Select a native Hermes profile first.');
    return {connectionId: owner.connectionId, profile: owner.profile};
  };
  const capture = () => ({epoch: gatewayActivationEpoch(), owner: selectedOwner()});
  const check = token => {
    const now = selectedOwner();
    if (disposed || token.epoch !== gatewayActivationEpoch() || now.connectionId !== token.owner.connectionId || now.profile !== token.owner.profile)
      throw new Error('Hermes profile or connection changed. Reopen Workspace before continuing.');
  };
  const routeFor = async token => {
    const routes = await host.profileRoutes();
    check(token);
    const matches = routes.filter(r => r.connectionId === token.owner.connectionId && r.profile === token.owner.profile);
    if (matches.length !== 1) throw new Error('The selected Hermes profile route is unavailable or ambiguous.');
    return Object.freeze({...matches[0]});
  };
  const rpc = async (token, route, method, params) => {
    check(token);
    const result = await host.requestProfile(route, method, {...params, profile: route.targetProfile});
    check(token);
    return result;
  };
  const post = async (token, path, body) => {
    check(token);
    if (!token.scope_id) throw new Error('Workspace scope must be loaded before a mutation.');
    const result = await ctx.rest(path, {method: 'POST', body: {...body, expected_scope: token.scope_id}});
    check(token);
    return result;
  };
  const loadScope = async token => {
    check(token);
    const response = await ctx.rest('/state');
    check(token);
    const state = response.state ?? response;
    if (!state.scope_id) throw new Error('Workspace storage scope unavailable.');
    token.scope_id = state.scope_id;
    return state;
  };
  const snapshot = async (token, route, threadId) => {
    const result = await rpc(token, route, 'session.resume', {session_id: threadId, omit_messages: true});
    if (result.info?.desktop_protocol !== 'hermes-gateway-v1' || !result.stored_session_id)
      throw new Error('Workspace requires the native Hermes gateway session lifecycle.');
    if (result.running || result.pending?.length) throw new Error('This Hermes thread is busy. Wait or select another thread.');
    return result;
  };
  const adapter = {
    async listThreads() {
      const token = capture();
      const route = await routeFor(token);
      // Open canonical threads are live; closed history is in the stored feed.
      // Both reads use this captured route and must succeed before publication.
      const live = await rpc(token, route, 'session.list', {scope: 'live', include_hidden: false});
      const stored = await rpc(token, route, 'session.list', {scope: 'stored', include_hidden: false});
      if (!Array.isArray(live.sessions) || !Array.isArray(stored.sessions))
        throw new Error('Native Hermes thread list is unavailable.');
      const threads = new Map();
      for (const row of [...live.sessions, ...stored.sessions]) {
        const id = row?.stored_session_id ?? row?.session_id ?? row?.id;
        if (typeof id !== 'string' || !id) throw new Error('Native Hermes thread identity is unavailable.');
        // A thread can close between reads. Keep its live snapshot once, using
        // the native identity also used by resume, never its title or row alias.
        if (!threads.has(id)) {
          const selection = Object.freeze({...row, id});
          threadSelections.set(selection, {token, route});
          threads.set(id, selection);
        }
      }
      return [...threads.values()];
    },
    async bindThread(itemId, threadId, selection = null) {
      const saved = selection && threadSelections.get(selection);
      if (selection && (!saved || selection.id !== threadId))
        throw new Error('Reopen the native thread picker before linking this thread.');
      const token = saved?.token ?? capture();
      check(token);
      const route = saved?.route ?? await routeFor(token);
      await loadScope(token);
      const session = await snapshot(token, route, threadId);
      return post(token, '/workflow/bind', {item_id: itemId, thread_id: session.stored_session_id});
    },
    async addressComments(itemId, explicitItemIds = [], confirmedReview = null) {
      if (!Array.isArray(explicitItemIds) || explicitItemIds.some(id => typeof id !== 'string') ||
          new Set(explicitItemIds).size !== explicitItemIds.length)
        throw new Error('Select valid Workspace targets for this run.');
      const targets = [...explicitItemIds];
      const token = capture();
      const route = await routeFor(token);
      const state = await loadScope(token);
      const item = state.items?.find(row => row.id === itemId);
      if (!item) throw new Error('Workspace item is unavailable.');
      let reviewId;
      if (confirmedReview) {
        // The UI captures this scene before opening the single run-review
        // dialog. Never silently replace stale approval with a fresh snapshot.
        if (confirmedReview.scope_id !== state.scope_id ||
            confirmedReview.revision !== state.revision)
          throw new Error('Workspace changed. Close and review this run again.');
        const reviewed = await post(token, '/workflow/review-scope', {
          item_id: itemId, selected_item_ids: targets,
          expected_revision: confirmedReview.revision,
        });
        if (!reviewed || typeof reviewed.review_id !== 'string' || !reviewed.review_id ||
            reviewed.scope_id !== state.scope_id || reviewed.item_id !== itemId ||
            reviewed.revision !== state.revision || !Array.isArray(reviewed.selected_item_ids) ||
            JSON.stringify([...reviewed.selected_item_ids].sort()) !== JSON.stringify([...targets].sort()))
          throw new Error('Workspace could not verify this run review. Close and review again.');
        reviewId = reviewed.review_id;
      } else {
        // Unreviewed/legacy calls keep the original saved-reference guard.
        const referenced = new Set(state.comments?.filter(c => c.item_id === itemId && !c.resolved)
          .flatMap(c => c.target_item_ids ?? []) ?? []);
        if (targets.some(id => !referenced.has(id)))
          throw new Error('These related items cannot be approved for this run. Your comments are unchanged.');
      }
      let session;
      if (item.thread_id) session = await snapshot(token, route, item.thread_id);
      else {
        const key = `${token.scope_id}:${itemId}`;
        const requestId = creations.get(key) || `workspace-${crypto.randomUUID()}`;
        creations.set(key, requestId);
        // Canonical create also adopts exact titles. A unique title prevents
        // same-named pages or restored detached pages adopting an old thread.
        session = await rpc(token, route, 'session.create', {source: 'gui', title: `Workspace: ${String(item.title).slice(0, 100)} (${requestId})`, request_id: requestId});
        if (session.info?.desktop_protocol !== 'hermes-gateway-v1') throw new Error('Native Hermes gateway required.');
      }
      // No Store bind/write between review and prepare. The server binds an
      // initially unbound matching thread atomically when consuming the review.
      const prepared = await post(token, '/workflow/prepare', {
        item_id: itemId, session_id: session.stored_session_id, explicit_item_ids: targets,
        ...(reviewId ? {review_id: reviewId} : {}),
      });
      owners.set(prepared.run.id, {token, route});
      creations.delete(`${token.scope_id}:${itemId}`);
      // submission_id is the server-issued run id. The tool checks the native
      // admission ledger, so history/document text cannot grant another turn access.
      await rpc(token, route, 'prompt.submit', {session_id: session.session_id, text: prepared.prompt, submission_id: prepared.submission_id, queued: true});
      await post(token, '/workflow/consume', {run_id: prepared.run.id});
      return (await post(token, '/workflow/status', {run_id: prepared.run.id})).run;
    },
    async status(run) {
      const token = owners.get(run.id)?.token || capture();
      if (!token.scope_id) await loadScope(token);
      // Authenticated server consumption joins canonical native terminal records.
      // Pending turns have no effects; missing/failed hooks surface a real error
      // and retain explicit Stop/Recover rather than claiming a saved edit.
      if (!['completed', 'cancelled', 'error'].includes(run.status))
        await post(token, '/workflow/consume', {run_id: run.id});
      return (await post(token, '/workflow/status', {run_id: run.id})).run;
    },
    async stop(run) {
      const saved = owners.get(run.id);
      const token = saved?.token || capture();
      const route = saved?.route || await routeFor(token);
      if (!token.scope_id) await loadScope(token);
      const stopped = await post(token, '/workflow/stop', {run_id: run.id});
      if (stopped.control?.admission_id) {
        await rpc(token, route, 'prompt.cancel', {session_id: stopped.control.session_id, admission_id: stopped.control.admission_id});
      }
      return (await post(token, '/workflow/status', {run_id: run.id})).run;
    },
    async recover(run) {
      const token = owners.get(run.id)?.token || capture();
      if (!token.scope_id) await loadScope(token);
      return (await post(token, '/workflow/recover', {run_id: run.id})).run;
    },
    async openThread(threadId) {
      const token = capture();
      const route = await routeFor(token);
      check(token);
      await host.openSession(threadId, {route, intent: 'tab', keepAllProfilesScope: true});
      check(token);
    },
    dispose() { disposed = true; owners.clear(); creations.clear(); threadSelections = new WeakMap(); }
  };
  ctx.onDispose?.(adapter.dispose);
  return adapter;
}
