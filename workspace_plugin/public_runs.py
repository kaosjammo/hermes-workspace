"""Plugin-owned final saves over public session and native hook contracts.

Local candidate under qualification. Authority, effects and receipts use the
plugin Store's single transaction; native reads use public SessionDB methods.
Missing, stale or revoked lifecycle bindings independently refuse effects.
"""
from contextlib import contextmanager
import hashlib
import json
import secrets
from pathlib import Path

from .run_journal import RunJournal, TERMINAL
from .proposals import parse_proposal, validate_proposal

_PROTOCOL = 'workspace-public-hooks-v1'
_SUCCESS = {'text_response(finish_reason=stop)', 'text_response(finish_reason=end_turn)'}


class PublicSessions:
    def __init__(self, profile_home, *, db=None):
        self.profile_home = Path(profile_home).resolve()
        self._db = db

    @contextmanager
    def database(self):
        if self._db is not None:
            if Path(self._db.db_path).resolve() != self.profile_home / 'state.db':
                raise ValueError('Native database does not belong to this Workspace profile')
            yield self._db
            return
        path = self.profile_home / 'state.db'
        if not path.is_file():
            raise ValueError('Create or select a native thread before Address')
        from hermes_state import SessionDB
        db = SessionDB(path, read_only=True)
        try:
            yield db
        finally:
            db.close()

    def require_session(self, session_id):
        if not isinstance(session_id, str) or not session_id:
            raise ValueError('An exact native stored session id is required')
        with self.database() as db:
            if db.get_session(session_id) is None:
                raise ValueError('Native thread is unavailable in this profile')
            lineage = db.get_compression_lineage(session_id)
            return lineage[0] if lineage else session_id


def _origin(session_id, task_id, turn_id):
    values = (session_id, task_id, turn_id)
    if not all(isinstance(v, str) and 0 < len(v) <= 1024 for v in values):
        raise ValueError('Exact public native session/task/turn identity is required')
    return dict(zip(('session_id', 'task_id', 'turn_id'), values))


def _digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
        separators=(',', ':'), allow_nan=False).encode()).hexdigest()


class PublicRuns(RunJournal):
    def __init__(self, profile_home, *, store=None, native=None):
        super().__init__(profile_home, store=store, native=native or PublicSessions(profile_home))

    @contextmanager
    def _locked(self):
        # Authority rows and Store effects share this exact SQLite connection.
        with self.store.atomic() as conn:
            yield conn

    def _context(self, conn, run_id):
        if conn.execute('SELECT 1 FROM run_context WHERE run_id=?', (run_id,)).fetchone() is not None:
            return super()._context(conn, run_id)
        # Baseline runs kept their context in workflow.sqlite3. A missing
        # current context must remain recoverable, but no private legacy grant
        # or review may become a public save grant. Do not open that old journal.
        run = self._run(run_id)
        from .identity import human_id
        context = {'protocol': 'workspace-recovery-only-v1',
            'principal_id': human_id(self.profile_home), 'revoked': True,
            'binding': None, 'native_terminal': 'UNKNOWN', 'calls': {},
            'scope_id': self.store.scope_id,
            'run_scope': {k: run[k] for k in ('id', 'item_id', 'session_id', 'comment_ids', 'allowed_item_ids', 'version_ids')},
            'initial_reply_ids': [r['id'] for c in self.store.snapshot()['comments']
                if c['id'] in run['comment_ids'] for r in c['replies']]}
        if run['status'] not in TERMINAL:
            self.store.set_run_progress(run_id,
                'Earlier or incomplete workflow; native outcome UNKNOWN. Recover document to revoke local edits and unlock. Partial work and Restore are retained.')
        self._save(conn, run_id, context)
        return context

    def prepare(self, item_id, session_id, explicit_item_ids=None, *, principal_id=None, review_id=None, display_title=None):
        if not isinstance(principal_id, str) or not principal_id:
            raise ValueError('Authenticated Workspace user is required')
        with self._locked() as conn:
            if review_id is not None:
                self._review(conn, review_id, principal_id)
            item = self._item(item_id)
            if item.get('executor') or item.get('thread_owner'):
                raise ValueError('Saved cross-owner executor binding is not qualified')
            owner = self.native.require_session(session_id)
            if item.get('thread_id') and self.native.require_session(item['thread_id']) != owner:
                raise ValueError('Select this native thread explicitly before starting a run')
            # No native owner/epoch/grant. Store independently checks the complete
            # one-use review again after waiting for its own writer.
            review = (lambda: self._review(conn, review_id, principal_id)['review']) if review_id else None
            from .identity import executor
            run = self.store.begin_run(item_id, owner, explicit_item_ids, scope_review=review,
                                       executor_identity=executor(self.profile_home, display_title))
            try:
                if review_id:
                    record = self._review(conn, review_id, principal_id)
                    record['consumed_by'] = run['id']
                    conn.execute('UPDATE run_review SET body=? WHERE id=?', (json.dumps(record, allow_nan=False), review_id))
                state = self.store.snapshot(include_content_revisions=True)
                comments = [c for c in state['comments'] if c['id'] in run['comment_ids']]
                items = [i for i in state['items'] if i['id'] in run['allowed_item_ids']]
                prompt = self._prompt(run, comments, items, reviewed=review_id is not None)
                self._save(conn, run['id'], {'protocol': _PROTOCOL, 'principal_id': principal_id,
                    'prompt': prompt, 'revoked': False, 'binding': None, 'proposal': None,
                    'native_terminal': 'UNKNOWN', 'post_observed': False, 'calls': {},
                    'scope_id': self.store.scope_id, 'run_scope': {k: run[k] for k in ('id', 'item_id', 'session_id', 'comment_ids', 'allowed_item_ids', 'version_ids')},
                    'initial_reply_ids': [r['id'] for c in comments for r in c['replies']]})
            except BaseException:
                self.store.finish_run(run['id'], 'error', 'Failed to persist public run context; no edits authorised')
                raise
            return {'run': run, 'prompt': prompt, 'submission_id': run['id']}

    def _contexts(self, conn):
        runs = {run['id']: run for run in self.store.snapshot()['runs']}
        for row in conn.execute('SELECT run_id, body FROM run_context').fetchall():
            context = json.loads(row[1])
            if context.get('protocol') == _PROTOCOL and row[0] in runs:
                yield runs[row[0]], context

    def _scope(self, run, context):
        if context.get('scope_id') != self.store.scope_id or any(
                run[k] != value for k, value in context.get('run_scope', {}).items()):
            raise ValueError('Captured Workspace run scope changed')


    def pre(self, *, session_id, task_id, turn_id, user_message, **_):
        origin = _origin(session_id, task_id, turn_id)
        owner = self.native.require_session(session_id)
        with self._locked() as conn:
            matches = []
            failure = None
            for run, context in self._contexts(conn):
                if run['session_id'] != owner or run['status'] in TERMINAL or context['revoked']:
                    continue
                bound = context.get('binding')
                if context['prompt'] == user_message:
                    matches.append((run, context))
                if bound and bound != origin:
                    # A newer originating turn is not permission for an older
                    # callback/tool to finish this one. Keep recovery explicit.
                    context['revoked'] = True
                    self._save(conn, run['id'], context)
            if len(matches) != 1:
                failure = 'No unique prepared Workspace prompt in this native profile/thread'
            else:
                run, context = matches[0]
                if context['revoked'] or context['binding'] not in (None, origin):
                    failure = 'Run token was already bound to another native turn'
                else:
                    context['binding'] = origin
                    self._save(conn, run['id'], context)
                    result = {'bound': True, 'run_id': run['id'], 'commit_authority': False}
        # Commit successor revocation even when that turn has no Workspace token.
        if failure:
            raise ValueError(failure)
        return result

    def _bound(self, conn, origin):
        owner = self.native.require_session(origin['session_id'])
        matches = [(run, context) for run, context in self._contexts(conn)
            if run['session_id'] == owner and context.get('binding')
            and context['binding']['task_id'] == origin['task_id']
            and context['binding']['turn_id'] == origin['turn_id']]
        if len(matches) != 1:
            raise ValueError('Native callback does not own an exact bound Workspace run')
        run, context = matches[0]
        self._scope(run, context)
        return run, context

    def post(self, *, session_id, task_id, turn_id, user_message, assistant_response, **_):
        # Model response is DATA. Even a valid JSON proposal cannot save a page.
        if not isinstance(assistant_response, str) or not assistant_response.strip() or len(assistant_response.encode('utf-8')) > 8 * 1024 * 1024:
            raise ValueError('A bounded native final response is required')
        proposal = parse_proposal(assistant_response) if assistant_response.lstrip().startswith('{') else None
        origin = _origin(session_id, task_id, turn_id)
        with self._locked() as conn:
            run, context = self._bound(conn, origin)
            if context['revoked'] or run['status'] in TERMINAL:
                raise ValueError('Workspace run authority was revoked')
            if context['prompt'] != user_message:
                raise ValueError('Native original prompt differs from the prepared run')
            if proposal is not None:
                proposal = validate_proposal(proposal, run)
            if context['proposal'] not in (None, proposal):
                raise ValueError('Conflicting final proposal for the same originating turn')
            context['proposal'] = proposal
            context['post_observed'] = True
            self._save(conn, run['id'], context)
            return {'staged': True, 'commit_authority': False}

    def end(self, *, session_id, task_id, turn_id, completed=None, interrupted=None,
            failed=None, turn_exit_reason=None, **_):
        origin = _origin(session_id, task_id, turn_id)
        if any(type(v) is not bool for v in (completed, interrupted, failed)):
            raise ValueError('Native completion/failure/interruption outcome is unknown')
        with self._locked() as conn:
            run, context = self._bound(conn, origin)
            if run['status'] in TERMINAL:
                if run['status'] == 'cancelled' and context['native_terminal'] == 'UNKNOWN':
                    context['native_terminal'] = ('interrupted' if interrupted else 'failed' if failed or not completed
                        or turn_exit_reason not in _SUCCESS else 'completed')
                    self._save(conn, run['id'], context)
                return {'run': run, 'native_terminal': context['native_terminal']}
            if context['revoked'] or interrupted:
                context['native_terminal'] = 'interrupted' if interrupted else 'UNKNOWN'
                run = self._finish(conn, run, context, 'cancelled')
            elif not completed or failed or turn_exit_reason not in _SUCCESS:
                context['native_terminal'] = 'failed'
                run = self._finish(conn, run, context, 'error', 'Native turn did not positively complete; no proposed edits saved')
            elif context['proposal'] is None:
                context['native_terminal'] = 'completed'
                if context.get('post_observed') and set(run['comment_ids']) <= self._outcomes(run, context):
                    run = self._finish(conn, run, context, 'completed')
                else:
                    run = self._finish(conn, run, context, 'error', 'Native turn ended without all saved outcomes or a correlated final response. Accepted partial edits and Restore are retained.')
            else:
                proposal = validate_proposal(context['proposal'], run)
                fingerprint = _digest([proposal['edits'], proposal['replies']])
                def authorize():
                    # Called by Store AFTER its SQLite writer wait. Holding the
                    # durable plugin journal lock serialises Workspace Stop and
                    # recovery against the entire atomic effect/receipt commit.
                    if context['revoked'] or self._context(conn, run['id'])['revoked']:
                        raise ValueError('Workspace run authority was revoked before Store acceptance')
                try:
                    self.store.apply_run(run['id'], **proposal, authorize=authorize,
                        operation_id=fingerprint, operation_digest=fingerprint)
                except ValueError as exc:
                    context['native_terminal'] = 'completed'
                    run = self._finish(conn, run, context, 'error', 'Native turn completed but proposed edits were not saved: '+str(exc))
                else:
                    context['native_terminal'] = 'completed'
                    run = self._finish(conn, self._run(run['id']), context, 'completed')
            return {'run': run, 'native_terminal': context['native_terminal']}

    def status(self, run_id):
        with self._locked() as conn:
            context = self._context(conn, run_id)
            run = self._run(run_id)
            return {'run': run, 'native_terminal': context.get('native_terminal', 'UNKNOWN'),
                'recovery_required': context.get('protocol') != _PROTOCOL and run['status'] not in TERMINAL}

    def stop(self, run_id):
        with self._locked() as conn:
            context = self._context(conn, run_id)
            run = self._run(run_id)
            if run['status'] not in TERMINAL:
                context['revoked'] = True
                context['stop_requested'] = True
                self._save(conn, run_id, context)
        # Authority is already durably revoked if progress persistence fails.
        if run['status'] not in TERMINAL:
            run = self.store.set_run_progress(run_id, 'Stop requested; Workspace saves revoked. Native cancellation awaits confirmation; Restore/recovery remain available.')
            with self._locked() as conn:
                context = self._context(conn, run_id)
                run = self._run(run_id)
                if run['status'] not in TERMINAL:
                    # A queued cancellation has no native turn-end callback.
                    # Revocation already committed, so local editing can safely
                    # resume without claiming that the provider has stopped.
                    run = self._finish(conn, run, context, 'cancelled')
        control = {'control': {'session_id': run['session_id'], 'admission_id': context['admission_id']}} if context.get('stop_requested') and context.get('admission_id') else {}
        return {'run': run, 'native_terminal': context.get('native_terminal', 'UNKNOWN'), **control}

    def recover(self, run_id=None):
        if run_id is None:
            raise ValueError('Public runs require explicit run recovery')
        with self._locked() as conn:
            context = self._context(conn, run_id)
            context.update(revoked=True, native_terminal='UNKNOWN')
            self._save(conn, run_id, context)
        with self._locked() as conn:
            context = self._context(conn, run_id)
            run = self._run(run_id)
            if run['status'] not in TERMINAL:
                run = self._finish(conn, run, context, 'error', 'Recovered locally; native outcome UNKNOWN. Staged edits were not saved; pre-run Restore and any prior receipts retained.')
            return {'run': run, 'native_terminal': 'UNKNOWN'}

    @staticmethod
    def _operation(args, run):
        if not isinstance(args, dict) or set(args) - {'run_id', 'edits', 'replies', '_workspace_call'} or args.get('run_id') != run['id']:
            raise ValueError('workspace_apply accepts only the captured run and edit/outcome fields')
        operation = parse_proposal(json.dumps({'edits': args.get('edits', []), 'replies': args.get('replies', [])}, allow_nan=False))
        if any(e['item_id'] not in run['allowed_item_ids'] for e in operation['edits']) or any(
                r['comment_id'] not in run['comment_ids'] for r in operation['replies']):
            raise ValueError('Workspace operation is outside captured user-approved scope')
        return operation

    def pre_tool(self, *, tool_name, args, session_id, task_id, turn_id, tool_call_id, **_):
        if tool_name != 'workspace_apply':
            return None
        origin = _origin(session_id, task_id, turn_id)
        if not isinstance(tool_call_id, str) or not tool_call_id or len(tool_call_id) > 1024:
            raise ValueError('An exact native tool call identity is required')
        with self._locked() as conn:
            run, context = self._bound(conn, origin)
            if context['revoked'] or run['status'] in TERMINAL:
                raise ValueError('Workspace run authority was revoked')
            # _bound proved public compression continuity and exact task/turn.
            # A compression child is the same admitted turn, so retain that
            # binding's session identity in the ticket as well as in the handler.
            origin = dict(context['binding'])
            operation = self._operation(args, run)
            digest = _digest([operation['edits'], operation['replies']])
            for nonce, call in context['calls'].items():
                if call['call_id'] == tool_call_id:
                    if call['origin'] != origin or call['digest'] != digest:
                        raise ValueError('Native call identity was reused with different arguments')
                    break
            else:
                if len(context['calls']) >= 1000:
                    raise ValueError('Workspace run call limit exceeded')
                nonce = secrets.token_hex(24)
                context['calls'][nonce] = {'origin': origin, 'call_id': tool_call_id, 'digest': digest, 'used': False}
                self._save(conn, run['id'], context)
            # The model's ticket, even if present, is always overwritten here.
            return {'action': 'modify', 'args': {'run_id': run['id'], **operation, '_workspace_call': nonce}}

    def apply_call(self, args, *, session_id, task_id):
        if not isinstance(args, dict) or not isinstance(args.get('_workspace_call'), str):
            raise ValueError('Public Workspace call requires a turn-bound one-use hook ticket')
        owner = self.native.require_session(session_id)
        with self._locked() as conn:
            context = self._context(conn, args.get('run_id'))
            run = self._run(args.get('run_id'))
            self._scope(run, context)
            operation = self._operation(args, run)
            digest = _digest([operation['edits'], operation['replies']])
            call = context.get('calls', {}).get(args['_workspace_call'])
            if (context.get('protocol') != _PROTOCOL or not call or call['digest'] != digest
                    or call['origin']['task_id'] != task_id or run['session_id'] != owner
                    or call['origin'] != context.get('binding')):
                raise ValueError('Workspace call ticket does not own this native turn and operation')
            if call['used']:
                # Separately authorised readback, not a new effect after Stop.
                return {'run': run, 'receipt': digest, 'replayed': True}
            if context['revoked'] or run['status'] in TERMINAL:
                raise ValueError('Workspace run authority was revoked before Store acceptance')
            result = self.store.apply_run(run['id'], **operation,
                operation_id=digest, operation_digest=digest)
            call['used'] = True
            self._save(conn, run['id'], context)
            return {'run': result, 'receipt': digest, 'replayed': False}

    def consume(self, run_id, *, principal_id):
        # Completion is driven by trusted native hooks, never a client consume.
        with self._locked() as conn:
            context = self._context(conn, run_id)
            if context.get('principal_id') != principal_id:
                raise ValueError('Workspace run does not belong to this admitted profile actor')
            return {'run': self._run(run_id), 'native_terminal': context.get('native_terminal', 'UNKNOWN')}

    def record_submission(self, run_id, admission_id):
        """Persist only an exact cancellation address, not a completion grant.

        The native RPC still authorises session/admission ownership on cancel.
        This data never binds a turn or authorises Store effects.
        """
        if not isinstance(admission_id, str) or not 0 < len(admission_id) <= 1024:
            raise ValueError('An exact native submission acknowledgement is required')
        with self._locked() as conn:
            context = self._context(conn, run_id)
            if context.get('protocol') != _PROTOCOL:
                raise ValueError('Unknown public Workspace run')
            if context.get('admission_id') not in (None, admission_id):
                raise ValueError('Conflicting native submission acknowledgement')
            context['admission_id'] = admission_id
            self._save(conn, run_id, context)
            run = self._run(run_id)
            control = {'control': {'session_id': run['session_id'], 'admission_id': admission_id}} if context.get('stop_requested') else {}
            return {'run': run, 'native_terminal': context.get('native_terminal', 'UNKNOWN'), **control}
