/** REST cache and write queue. The captured native owner is never rebound. */
export class StaleWorkspaceError extends Error {
  constructor() {
    super("Workspace source changed. Reopen the page in the selected profile.");
    this.name = "StaleWorkspaceError";
  }
}
export class WorkspaceClient {
  constructor(ctx, readOwner) {
    this.ctx = ctx;
    this.readOwner = readOwner;
    this.owner = JSON.stringify(readOwner());
    this.value = null;
    this.scopeVersion = 0;
    this.listeners = new Set();
    this.queue = Promise.resolve();
    this.active = true;
    this.replacement = null;
    this.searchActive = false;
    this.searchPending = null;
    this.searchVersion = 0;
    this.loadPending = null;
  }
  current() {
    return this.active && JSON.stringify(this.readOwner()) === this.owner;
  }
  assertCurrent() {
    if (!this.current()) throw new StaleWorkspaceError();
  }
  snapshot = () => this.value;
  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  accept(state) {
    this.assertCurrent();
    if (
      !state ||
      !state.scope_id ||
      !Array.isArray(state.items) ||
      !Number.isFinite(state.revision)
    )
      throw new Error("Workspace returned an invalid state.");
    if (
      this.value?.scope_id === state.scope_id &&
      state.revision < this.value.revision
    )
      return;
    if (this.value?.scope_id !== state.scope_id) this.scopeVersion++;
    this.value = state;
    for (const fn of this.listeners) fn();
  }
  assertScope(scope) {
    this.assertCurrent();
    if (!scope || !this.value?.scope_id)
      throw new Error("Load Workspace before making changes.");
    if (this.value.scope_id !== scope) throw new StaleWorkspaceError();
  }
  load() {
    // The status query and normal state query can refresh together. Share only
    // this in-flight read; no cross-owner or retained snapshot cache is added.
    if (this.loadPending) return this.loadPending;
    const request = this.loadState();
    this.loadPending = request;
    request.finally(() => { if (this.loadPending === request) this.loadPending = null; }).catch(() => {});
    return request;
  }
  async loadState() {
    this.assertCurrent();
    if (this.replacement) return null;
    const generation = this.scopeVersion;
    const response = await this.ctx.rest("/state", { timeoutMs: 120000 });
    this.assertCurrent();
    const state = response.state ?? response;
    if (generation !== this.scopeVersion) throw new StaleWorkspaceError();
    this.accept(state);
    return state;
  }
  /** Read-only full Store search uses the supported ordinary command contract.
   * One transport plus one replaceable latest request bounds rapid typing. It
   * never waits behind draft writes or publishes a search snapshot into them.
   * ctx.rest exposes no cancellation signal; retired requests drain privately. */
  search(query, { offset = 0, revision = null } = {}) {
    this.assertScope(this.value?.scope_id);
    if (!Number.isInteger(offset) || offset < 0 ||
        (offset > 0 && !Number.isInteger(revision)))
      throw new Error('Restart the search before opening another results page.');
    const version = ++this.searchVersion;
    if (this.searchPending) this.searchPending.reject(new StaleWorkspaceError());
    return new Promise((resolve, reject) => {
      this.searchPending = { query, offset, revision,
        scope: this.value.scope_id,
        generation: this.scopeVersion, version, resolve, reject };
      void this.drainSearch();
    });
  }
  cancelSearch() {
    this.searchVersion++;
    this.searchPending?.reject(new StaleWorkspaceError());
    this.searchPending = null;
  }
  async drainSearch() {
    if (this.searchActive) return;
    this.searchActive = true;
    try {
      while (this.searchPending) {
        const request = this.searchPending;
        this.searchPending = null;
        try {
          this.assertScope(request.scope);
          if (request.generation !== this.scopeVersion || request.version !== this.searchVersion)
            throw new StaleWorkspaceError();
          const expectedRevision = request.revision ?? this.value.revision;
          const response = await this.ctx.rest('/command', {
            method: 'POST', timeoutMs: 30000, body: {
              op: 'search_page', expected_scope: request.scope, include_state: false,
              payload: { query: request.query, offset: request.offset, limit: 100,
                expected_revision: expectedRevision },
            },
          });
          this.assertScope(request.scope);
          if (request.generation !== this.scopeVersion || request.version !== this.searchVersion ||
              (response.state && response.state.scope_id !== request.scope)) throw new StaleWorkspaceError();
          const result = response.result;
          if (!result || result.scope_id !== request.scope || result.revision !== expectedRevision ||
              this.value.revision !== expectedRevision ||
              !Array.isArray(result.items) || result.offset !== request.offset ||
              !Number.isInteger(result.total) || result.total < result.items.length)
            throw new Error('Workspace returned invalid search results.');
          request.resolve(result);
        } catch (error) { request.reject(error); }
      }
    } finally { this.searchActive = false; }
  }
  command(op, payload = {}) {
    const scope = this.value?.scope_id,
      generation = this.scopeVersion;
    const invoke = async () => {
      this.assertScope(scope);
      if (generation !== this.scopeVersion) throw new StaleWorkspaceError();
      const response = await this.ctx.rest("/command", {
        method: "POST",
        body: {
          op,
          expected_scope: this.value.scope_id,
          payload: {
            ...(typeof payload === "function" ? payload(this.value) : payload),
            expected_revision: this.value.revision,
          },
        },
      });
      this.assertScope(scope);
      if (generation !== this.scopeVersion) throw new StaleWorkspaceError();
      if (response.state && response.state.scope_id !== scope)
        throw new StaleWorkspaceError();
      if (response.state) this.accept(response.state);
      return response.result;
    };
    const result = this.queue.then(invoke);
    this.queue = result.catch(() => {});
    return result;
  }
  /** Interchange shares the same write queue, owner fence and response publication. */
  transfer(path, body) {
    const scope = this.value?.scope_id,
      generation = this.scopeVersion;
    const invoke = async () => {
      this.assertScope(scope);
      if (generation !== this.scopeVersion) throw new StaleWorkspaceError();
      const result = await this.ctx.rest(
        path,
        body === undefined
          ? undefined
          : {
              method: "POST",
              body: {
                ...body,
                expected_scope: this.value.scope_id,
                expected_revision: this.value.revision,
              },
            },
      );
      this.assertScope(scope);
      if (generation !== this.scopeVersion) throw new StaleWorkspaceError();
      if (result.state && result.state.scope_id !== scope)
        throw new StaleWorkspaceError();
      if (result.state) this.accept(result.state);
      return result;
    };
    const result = this.queue.then(invoke);
    this.queue = result.catch(() => {});
    return result;
  }
  /** Capture once for file selection/confirmation; never bind to a later ambient snapshot. */
  captureRestore() {
    this.assertScope(this.value?.scope_id);
    if (this.replacement)
      throw new Error(
        "Check the previous replacement before starting another.",
      );
    const id = [...crypto.getRandomValues(new Uint8Array(16))]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    return Object.freeze({
      restore_id: id,
      scope: this.value.scope_id,
      revision: this.value.revision,
      generation: this.scopeVersion,
    });
  }
  assertRestore(ticket, before = false) {
    this.assertCurrent();
    if (before) {
      this.assertScope(ticket.scope);
      if (
        this.replacement ||
        ticket.generation !== this.scopeVersion ||
        ticket.revision !== this.value.revision
      )
        throw new StaleWorkspaceError();
    } else if (
      this.replacement !== ticket ||
      this.scopeVersion !== ticket.generation + 1
    )
      throw new StaleWorkspaceError();
  }
  restoreBackup(ticket, data_base64) {
    const invoke = async () => {
      this.assertRestore(ticket, true);
      this.replacement = ticket;
      this.scopeVersion++;
      this.value = null;
      for (const fn of this.listeners) fn();
      let response;
      try {
        response = await this.ctx.rest("/restore-backup", {
          method: "POST",
          timeoutMs: 120000,
          body: {
            data_base64,
            expected_scope: ticket.scope,
            expected_revision: ticket.revision,
            restore_id: ticket.restore_id,
            include_state: false,
          },
        });
      } catch (error) {
        this.assertRestore(ticket);
        return this.restoreStatus(ticket);
      }
      this.assertRestore(ticket);
      return this.restoreReceipt(ticket, response);
    };
    const result = this.queue.then(invoke);
    this.queue = result.catch(() => {});
    return result;
  }
  restoreReceipt(ticket, response) {
    this.assertRestore(ticket);
    if (
      response?.restore_id !== ticket.restore_id ||
      !["running", "committed", "refused", "unknown"].includes(response.status)
    )
      return {
        restore_id: ticket.restore_id,
        status: "unknown",
        detail: "The server did not return a matching replacement receipt.",
      };
    if (
      response.status === "committed" &&
      response.result?.scope_id !== ticket.scope
    )
      throw new StaleWorkspaceError();
    return response;
  }
  async restoreStatus(ticket) {
    this.assertRestore(ticket);
    try {
      const response = await this.ctx.rest(
        "/restore-status/" +
          ticket.restore_id +
          "?expected_scope=" +
          encodeURIComponent(ticket.scope),
        { timeoutMs: 60000 },
      );
      this.assertRestore(ticket);
      return this.restoreReceipt(ticket, response);
    } catch (error) {
      this.assertRestore(ticket);
      return {
        restore_id: ticket.restore_id,
        status: "unknown",
        detail: error.message,
      };
    }
  }
  async inspectRestore(ticket) {
    this.assertRestore(ticket);
    const response = await this.ctx.rest("/state", { timeoutMs: 120000 });
    this.assertRestore(ticket);
    const state = response.state ?? response;
    if (state.scope_id !== ticket.scope) throw new StaleWorkspaceError();
    return state;
  }
  async reloadRestore(ticket) {
    this.assertRestore(ticket);
    const response = await this.ctx.rest("/state", { timeoutMs: 120000 });
    this.assertRestore(ticket);
    const state = response.state ?? response;
    if (state.scope_id !== ticket.scope) throw new StaleWorkspaceError();
    this.accept(state);
    this.replacement = null;
    return state;
  }
  dispose() {
    this.active = false;
    this.cancelSearch();
    this.value = null;
    this.listeners.clear();
  }
}
