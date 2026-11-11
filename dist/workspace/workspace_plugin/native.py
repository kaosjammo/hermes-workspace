"""Native Hermes identity checks. No inference client, model configuration or owner start.

The renderer uses the supported Desktop host.requestProfile adapter. Server-side
checks read ONLY the explicitly captured owner's existing native SessionDB. Lazy
imports let the standalone package be inspected without a Hermes installation.
The pinned host APIs are qualified by tests against synthetic SessionDB instances.
"""
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
import hashlib
import json


class NativeSessions:
    def __init__(self, profile_home: Path, *, db=None):
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
            raise ValueError('Native Hermes session database unavailable; create or select a thread first')
        from hermes_state import SessionDB
        db = SessionDB(path)
        try:
            yield db
        finally:
            db.close()

    def require_session(self, session_id):
        if not isinstance(session_id, str) or not session_id:
            raise ValueError('An exact native stored session id is required')
        with self.database() as db:
            row = db.get_session(session_id)
            if row is None:
                raise ValueError('Native thread is unavailable in this profile')
            lineage = db.get_compression_lineage(session_id)
            return lineage[0] if lineage else session_id

    def receipt(self, session_id, request_id, admission_id=None):
        from hermes_state_runtime import get_session_admission, list_session_admissions
        with self.database() as db:
            if admission_id:
                rows = [get_session_admission(db, admission_id=admission_id)]
            else:
                rows = list_session_admissions(db, session_id=session_id, pending_only=False)
            matches = [row for row in rows if row and row['target_session_id'] == session_id and row['request_id'] == request_id]
            if len(matches) > 1:
                raise ValueError('Ambiguous native admission identity')
            return matches[0] if matches else None

    def terminal_snapshot(self, *, session_id, request_id, principal_id, prompt, expected_epoch):
        """Exact canonical terminal observation, NEVER live-owner/effect authority.

        The gateway may omit local turn_id but retain a complete persisted_turn
        row-address receipt. A retired authority can retain this epoch until its
        successor starts, so callers must not treat this read as a commit fence.
        """
        if (not all(isinstance(value, str) and value for value in
                    (session_id, request_id, principal_id, prompt))
                or type(expected_epoch) is not int or expected_epoch < 1):
            raise ValueError('Exact server-supplied native observation identity is required')
        from hermes_state_runtime import _row
        from hermes_state_terminal import RESULT_PREFIX, load_result
        from gateway.session_operator import is_viewer_input
        with self.database() as db:
            if db.get_compression_lineage(session_id) not in ([], [session_id]):
                raise ValueError('Compacted native continuity has not been qualified')
            with db._read_ctx() as conn:
                epoch = conn.execute('SELECT epoch FROM runtime_epoch WHERE singleton=1').fetchone()
                rows = conn.execute('SELECT * FROM session_admissions WHERE target_session_id=? AND request_id=?',
                    (session_id, request_id)).fetchall()
                if len(rows) != 1:
                    raise ValueError('Missing or ambiguous exact canonical admission')
                row = _row(rows[0])
                if (epoch is None or epoch[0] != expected_epoch or row['owner_epoch'] != expected_epoch
                        or row['principal_id'] != principal_id or row['payload'].get('text') != prompt
                        or not is_viewer_input(row) or row['status'] != 'terminal'):
                    raise ValueError('Canonical admission does not match the exact terminal observation')
                saved = conn.execute('SELECT value FROM state_meta WHERE key=?', (RESULT_PREFIX+row['admission_id'],)).fetchone()
                stored = load_result(saved[0]) if saved else None
                if not isinstance(stored, dict) or not isinstance(stored.get('result'), dict):
                    raise ValueError('Canonical terminal result is unavailable')
                return {'admission': row, 'result': stored['result'], 'observed_epoch': epoch[0],
                        'profile_home': str(self.profile_home), 'live_owner_verified': False,
                        'commit_authority': False}

    def runtime_epoch(self):
        with self.database() as db:
            with db._read_ctx() as conn:
                row = conn.execute('SELECT epoch FROM runtime_epoch WHERE singleton=1').fetchone()
        if row is None:
            raise ValueError('Native Hermes runtime epoch unavailable')
        return row[0]

    def history_fingerprint(self, session_id):
        """Exact persisted transcript continuity, including edits/compaction after a hook."""
        value = hashlib.sha256()
        with self.database() as db, db._read_ctx() as conn:
            for row in conn.execute('SELECT id,role,content,tool_calls FROM messages WHERE session_id=? ORDER BY id', (session_id,)):
                value.update(json.dumps(list(row), ensure_ascii=False, separators=(',', ':')).encode())
                value.update(b'\n')
        return value.hexdigest()

    def require_success(self, record, *, expected_revision, expected_history):
        """Strict canonical success plus unchanged native rows; flags alone never grant."""
        row, value = record['admission'], record['result']
        if (row['outcome'] != 'completed' or value.get('completed') is not True
                or value.get('turn_exit_reason') not in {'text_response(finish_reason=stop)', 'text_response(finish_reason=end_turn)'}
                or type(value.get('api_calls')) is not int or value['api_calls'] < 1
                or any(value.get(k) for k in ('interrupted','failed','partial','error','_compressed','compacted_in_place','compression_exhausted'))):
            raise ValueError('Native result does not prove a successful final proposal; policy veto, interruption and partial results cannot commit')
        receipt = value['persisted_turn']
        with self.database() as db, db._read_ctx() as conn:
            session = conn.execute('SELECT runtime_generation,runtime_revision FROM sessions WHERE id=?', (row['target_session_id'],)).fetchone()
            if session is None or list(session) != [row['generation'], expected_revision]:
                raise ValueError('Native generation/revision changed after finalization')
            messages = {r[0]: list(r[1:]) for r in conn.execute(
                'SELECT id,role,content,tool_calls FROM messages WHERE session_id=? AND id IN (?,?)',
                (row['target_session_id'], receipt['user_row_id'], receipt['final_assistant_row_id']))}
            if (messages.get(receipt['user_row_id']) != ['user', row['payload']['text'], None]
                    or messages.get(receipt['final_assistant_row_id']) != ['assistant', value['final_response'], None]):
                raise ValueError('Native persisted proposal rows no longer match their exact canonical content')
        if self.history_fingerprint(row['target_session_id']) != expected_history:
            raise ValueError('Native persisted history changed after the original final hook')

    def validate_call(self, *, session_id, task_id, admission_id, run_id, owner_session_id, prompt, expected_epoch=None):
        if not task_id or not admission_id:
            raise ValueError('Workspace edits require a trusted native task and admission')
        with self.database() as db:
            lineage = db.get_compression_lineage(owner_session_id) or [owner_session_id]
            if session_id not in lineage:
                raise ValueError('Calling native session does not own this run')
            row = self.receipt(owner_session_id, run_id, admission_id)
            if row is None or row['status'] != 'started' or row['payload'].get('text') != prompt:
                raise ValueError('Calling native admission does not own this active run')
            with db._read_ctx() as conn:
                epoch = conn.execute('SELECT epoch FROM runtime_epoch WHERE singleton=1').fetchone()
            if epoch is None or row['owner_epoch'] != epoch[0] or (expected_epoch is not None and expected_epoch != epoch[0]):
                raise ValueError('Native run belongs to an interrupted runtime epoch')
            return row


@contextmanager
def native_tool_call(session_id, task_id, run_id):
    """Read the real viewer turn stamp; model arguments never supply identity.

    Keeping the stream lock through the write prevents a concurrent native turn
    stamp change. Workflow's profile-local lock serializes Stop and late tools.
    A plugin host without this native context fails closed, never guesses a turn.
    """
    from gateway.session_ingress import viewer_turn
    live = viewer_turn.get()
    if live is None or not session_id or not task_id:
        raise ValueError('Workspace tool requires a native viewer-submitted session turn')
    with live.event_stream.lock:
        stamp = live.event_stream.execution
        admission_id = stamp.get('admission_id')
        if not admission_id or not stamp.get('execution_generation'):
            raise ValueError('Native execution identity is unavailable')
        from gateway.session_display import admission_submission
        # This accessor checks the immutable task-local admission scope. The live
        # stream stamp alone can move to a successor while an old callback waits.
        submitted = admission_submission(SimpleNamespace(message_id=admission_id))
        if submitted.get('submission_id') != run_id:
            raise ValueError('Calling execution is not the native admission for this Workspace run')
        yield {'session_id': session_id, 'task_id': task_id, 'admission_id': admission_id}
