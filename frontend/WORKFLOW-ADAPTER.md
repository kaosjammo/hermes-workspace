# UI/native workflow seam

UI imports `createWorkflowAdapter(ctx)` from workflow-owned `./workflow.js`.
The owner agreed this contract through the coordinator. Async operations:

- `listThreads()` -> bounded recent live + stored native rows. Rows retain private captured source/profile/activation-epoch bindings in an adapter WeakMap.
- `bindThread(itemId, threadId, listedRow?)` -> validate the listed row binding, resume the native session, reject busy/non-native sessions, then persist canonical durable `stored_session_id`. Picker callers pass the exact listed row; legacy callers capture the current route.
- `addressComments(itemId, explicitItemIds?, confirmedReview?)` -> prepare one native run over unresolved comments, with explicit related-item choices from the single run-review dialog.
- `status(run)` -> read durable results from the public lifecycle hooks; polling never grants completion.
- `recover(run)` -> explicit user-only local authority revocation; native terminal UNKNOWN.
- `stop(run)` -> durably revoke Workspace saves and finish/unlock the local cancelled run, then request cancellation of its exact acknowledged native admission. Provider outcome can remain UNKNOWN.
- `openThread(threadId)` -> open native linked session using supported host API.
- `dispose()` -> remove adapter subscriptions on unmount/profile/source change.

UI captures connection/profile + `gatewayActivationEpoch` around calls and refreshes
`GET /state` after mutations. The adapter must independently enforce the same
identity fences before each native mutation, preserve native approvals, and never
resolve comments. Run progress/locks/status are authoritative in state.runs.
A failed/stopped/native-completed turn is never displayed as successful edits.
UI flushes pending document edits before Address comments. Restore is a user action
through `restore_version {id}` and is unavailable while the page is locked.

Snapshots require persistent `scope_id`. Every UI command envelope sends
`expected_scope` at the envelope level, and interchange POST bodies send it too.
Client refuses writes before a scoped snapshot and rechecks selected
`host.activeConnectionId()`, `host.state.profile`, and `gatewayActivationEpoch()`
before each queued mutation and after responses. Workflow adapter implements its
own route descriptors/scope handshake and uses `status` on the SDK query interval.

Recovery is never automatic. The UI confirmation explains that the native thread
may continue, Workspace edits are revoked, saved partial changes and pre-run
Restore remain available, and native outcome is UNKNOWN. Recovery deliberately
does not flush an unsaved draft to a locked document; it revokes authority first.

## Lane B integration boundaries

`ThreadPicker` composes public `Dialog`, `SearchField`, and `Button` controls. It explicitly says that search filters the bounded recent list. This does **not** complete full-history search: the pinned public `session.list` contract has no substring query/cursor/offset, and `host.listPersistedSessions` clamps the limit to 500 with offset zero. Exact-title lookup is not general search and may collapse same-title history. `host.sessions` only supplies row mutations; the sidebar's `useServerSessionSearch` / `searchSessions` are private. No private imports, ambient HTTP fetch, invented SDK endpoint or full-history claim is used.

The composer no longer contains a target checklist. Saved legacy references remain inert data and are preserved on retained-draft submission. `reviewScope` offers all active related nonfolder items in the single existing run-review dialog, unchecked each time, and includes unavailable legacy references. Its signature binds unresolved comments/anchors and target identity/metadata. Existing workspace orchestration checks that signature before and after flush.

The integrated ordinary user-review contract captures the dialog's `scope_id`, `revision`, comment/anchor signature and exact selected item IDs. Workspace checks that capture before and after flushing pending edits. The adapter then sends authenticated `POST /workflow/review-scope` with `item_id`, `selected_item_ids`, `expected_revision` and `expected_scope` **before native create/resume**. It validates the returned scope, item, revision, exact IDs and nonempty `review_id`; prepare receives the same `explicit_item_ids` and `review_id`. There is no intervening Store thread-bind write. An initially unbound thread is bound atomically during prepare.

The backend receipt is owner/private-scope/item/current-revision/comment-signature/selected-ID bound, single use and expires after 300 seconds. Changed or expired review fails explicitly; the adapter never silently refreshes consent. Legacy calls without a confirmed dialog may select only saved unresolved-comment references and remain rejected before native effects otherwise. Raw `reviewed_item_ids` is not authority. This is ordinary authenticated user review, not a native grant, shared executor bridge or UI04 acceptance. Native admission, run locks, result reconciliation and Stop guards remain authoritative.

Deletion calls only `command('delete_comment', {id})`. The normal client adds scope/revision fences. The integrated backend tombstones deleted discussions, hides their replies from current snapshots, preserves recovery provenance and refuses locked/stale/late run mutations. After a successful response, the UI drops only that discussion's retained reply, selection/hover and bubbles, preserving other drafts. Saved source state remains authoritative for document highlight/count updates. Synthetic browser/HTTP and backend receipts qualify these bounded behaviours; installed-native and provider execution remain separate gates.

Ctrl+Enter belongs only to the focused new-comment textarea and calls its form's `requestSubmit()`. Composition, 229, repeat, empty, locked, busy and synchronous duplicate submission guards apply to the same form path as the labelled button. `Tip` is the public native hover/focus tooltip; the button retains its text and an `arrow-right` Codicon. No global shortcut contribution/remapping or event replay is used. A host-claimed/prevented event does not also post. Actual-host capture, running-chat queueing and installed-native qualification remain separate gates.

## Public lifecycle and display metadata

The authenticated server prepares a plugin-owned run and exact prompt. Public
pre_llm_call binds session/task/turn; pre_tool_call mints a scoped one-use nonce
in modified args. The ordinary handler receives only host session/task and must
independently validate/consume that ticket. Scope, ticket consumption, revocation,
effects and receipts share the Store transaction. Post text alone never proves
completion; on_session_end completed/failed/interrupted/exit flags determine the
terminal result. Accepted-before-revocation partial work and Restore remain.

The adapter persists prompt.submit's exact admission_id through workflow/submitted
only as a cancellation address. A late ACK after local Stop returns that address
for exact native cancellation without restoring authority. Queued local Stop does
not depend on a native turn-end callback and never claims provider confirmation.

At preparation, profiles.list on the captured exact route supplies optional
friendly display text for its backend targetProfile. The server validates/bounds
that text and derives canonical profile/source/agent identity itself from its
selected home. Missing/invalid text falls back to canonical profile; labels never
select permissions, scope, origin or reply alignment. Saved names are retained.
