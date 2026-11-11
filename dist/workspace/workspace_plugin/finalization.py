"""Bounded UNTRUSTED final-proposal data, with no effect/authorisation endpoint.

A post hook is not a success receipt or Address authority. Nothing in this module
calls Store.apply_run, changes a run, grants a capability, or resolves a comment.
Canonical row-address association is diagnostic until a live owner/retirement
fence is available through the actual effect transaction.
"""
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import stat
import time

from .store import MAX_COMMENTS, MAX_STATE, MAX_TEXT, MAX_CONTENT
from .targeted_edits import validate_content_edits

EDIT_FIELDS = {'title', 'content', 'content_edits', 'properties', 'columns'}
MAX_STAGED = 1000
MAX_STAGED_BYTES = 4 * MAX_STATE
RETENTION_SECONDS = 86400


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate proposal field')
        result[key] = value
    return result


def _text(value, limit=256):
    if not isinstance(value, str) or not value or len(value) > limit or '\x00' in value:
        raise ValueError('Expected bounded nonempty proposal text')
    return value


def _canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def parse_proposal(text):
    """Parse finite DATA only; there are deliberately no model-owned identity fields."""
    _text(text, MAX_STATE)
    if len(text.encode('utf-8')) > MAX_STATE:
        raise ValueError('Final proposal exceeds Workspace storage bound')
    def nonfinite(_value):
        raise ValueError('Non-finite proposal number')
    try:
        value = json.loads(text, object_pairs_hook=_object, parse_constant=nonfinite)
        if not isinstance(value, dict) or set(value) != {'edits', 'replies'}:
            raise ValueError('Final proposal accepts only edits and replies')
        edits, replies = value['edits'], value['replies']
        if not isinstance(edits, list) or len(edits) > 100 or not isinstance(replies, list) or len(replies) > MAX_COMMENTS:
            raise ValueError('Final proposal arrays exceed Workspace bounds')
        for edit in edits:
            if not isinstance(edit, dict) or set(edit) != {'item_id', 'patch'}:
                raise ValueError('Each proposed edit requires item_id and patch')
            _text(edit['item_id'])
            if not isinstance(edit['patch'], dict) or not set(edit['patch']) <= EDIT_FIELDS:
                raise ValueError('Proposal cannot change ownership, binding, deletion or resolution')
            for name, data in edit['patch'].items():
                expected = {'title': str, 'content': str, 'content_edits': dict, 'properties': dict, 'columns': list}[name]
                if not isinstance(data, expected):
                    raise ValueError('Proposed patch values must match their typed fields')
                if name == 'content_edits':
                    if 'content' in edit['patch']:
                        raise ValueError('Choose targeted edits or full content, never both')
                    validate_content_edits(data, MAX_CONTENT)
        seen = set()
        for reply in replies:
            if not isinstance(reply, dict) or set(reply) != {'comment_id', 'text'}:
                raise ValueError('Each proposed outcome requires comment_id and text')
            _text(reply['comment_id']); _text(reply['text'], MAX_TEXT)
            if reply['comment_id'] in seen:
                raise ValueError('Duplicate proposed comment outcome')
            seen.add(reply['comment_id'])
        _canonical(value)  # Reject overflow to infinity, even when its JSON token was finite.
        return value
    except (RecursionError, OverflowError, UnicodeError) as exc:
        raise ValueError('Final proposal must be bounded finite JSON') from exc


def validate_proposal(proposal, run):
    """Validate DATA against captured server scope; this never grants write authority."""
    proposal = parse_proposal(_canonical(proposal))
    if {reply['comment_id'] for reply in proposal['replies']} != set(run['comment_ids']):
        raise ValueError('An outcome is required for every captured unresolved comment')
    if any(edit['item_id'] not in run['allowed_item_ids'] for edit in proposal['edits']):
        raise ValueError('Proposed edit is outside captured user-approved scope')
    return proposal


class ProposalJournal:
    """Private immutable staging. Retained entries are always untrusted and bounded."""
    def __init__(self, profile_home):
        self.profile_home = Path(profile_home).resolve()
        self.root = self.profile_home / 'plugin-data' / 'workspace'
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = self.root / 'proposals.sqlite3'

    def _connect(self):
        flags = os.O_CREAT | os.O_RDWR | getattr(os, 'O_NOFOLLOW', 0)
        fd = os.open(self.path, flags, 0o600)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
                raise ValueError('Proposal journal must be an ordinary private file')
        finally:
            os.close(fd)
        conn = sqlite3.connect(self.path, timeout=5)
        os.chmod(self.path, 0o600)
        try:
            conn.execute('PRAGMA synchronous=FULL')
            conn.execute('BEGIN IMMEDIATE')
            conn.execute('CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, turn_id TEXT NOT NULL, user_row INTEGER NOT NULL, final_row INTEGER NOT NULL, created REAL NOT NULL, body TEXT NOT NULL)')
            return conn
        except BaseException:
            conn.close()
            raise

    def stage(self, *, session_id, turn_id, user_message, assistant_response, conversation_history):
        _text(session_id); _text(turn_id, 1024); _text(user_message, MAX_STATE)
        proposal = parse_proposal(assistant_response)
        if not isinstance(conversation_history, list) or not conversation_history:
            raise ValueError('No committed native proposal rows')
        from agent.persisted_turn_receipt import committed_row_id
        final = conversation_history[-1]
        user = next((row for row in reversed(conversation_history) if isinstance(row, dict) and row.get('role') == 'user'), None)
        if not isinstance(user, dict) or not isinstance(final, dict):
            raise ValueError('Final proposal requires a committed native user/final pair')
        user_row, final_row = committed_row_id(user), committed_row_id(final)
        if (user_row is None or final_row is None or not isinstance(final, dict)
                or final.get('role') != 'assistant' or final.get('tool_calls') or final.get('content') != assistant_response):
            raise ValueError('Final proposal requires exact committed native user/final rows')
        identity = [session_id, turn_id, user_row, final_row]
        ident = hashlib.sha256(_canonical(identity).encode()).hexdigest()
        body = {'proposal_id': ident, 'session_id': session_id, 'turn_id': turn_id,
                'user_row_id': user_row, 'final_assistant_row_id': final_row,
                'user_message': user_message, 'assistant_response': assistant_response,
                'proposal': proposal, 'commit_authority': False}
        encoded = _canonical(body)
        conn = self._connect()
        try:
            conn.execute('DELETE FROM proposals WHERE created<?', (time.time()-RETENTION_SECONDS,))
            old = conn.execute('SELECT body FROM proposals WHERE id=?', (ident,)).fetchone()
            if old is not None:
                if old[0] != encoded:
                    raise ValueError('Conflicting final proposal for the same native row identity')
            else:
                count, size = conn.execute('SELECT COUNT(*), COALESCE(SUM(LENGTH(CAST(body AS BLOB))),0) FROM proposals').fetchone()
                if count >= MAX_STAGED or size + len(encoded.encode('utf-8')) > MAX_STAGED_BYTES:
                    raise ValueError('Untrusted proposal staging is full; no effects authorised')
                conn.execute('INSERT INTO proposals VALUES(?,?,?,?,?,?,?)', (ident, session_id, turn_id, user_row, final_row, time.time(), encoded))
            conn.commit()
        except BaseException:
            conn.rollback()
            raise
        finally:
            conn.close()
        return {'proposal_id': ident, 'commit_authority': False}

    def get(self, proposal_id):
        conn = self._connect()
        try:
            row = conn.execute('SELECT body FROM proposals WHERE id=?', (proposal_id,)).fetchone()
            conn.commit()
            return json.loads(row[0]) if row else None
        finally:
            conn.close()

    def inspect_join(self, native, *, session_id, request_id, principal_id, prompt, expected_epoch):
        """Associate existing canonical row addresses. Result is NOT effect authority.

        No first-match binding: two local turns claiming the same canonical rows
        refuse. No inference from nonce/prose or a most-recent session admission.
        """
        if native.profile_home != self.profile_home:
            raise ValueError('Proposal and canonical native profiles differ')
        record = native.terminal_snapshot(session_id=session_id, request_id=request_id,
            principal_id=principal_id, prompt=prompt, expected_epoch=expected_epoch)
        value = record['result']
        receipt = value.get('persisted_turn')
        if (not isinstance(receipt, dict) or receipt.get('complete') is not True
                or receipt.get('user_row_ids') != [receipt.get('user_row_id')]
                or value.get('_compressed') or value.get('compacted_in_place') or value.get('session_id') != session_id):
            raise ValueError('Canonical native row continuity is unavailable')
        conn = self._connect()
        try:
            rows = conn.execute('SELECT body FROM proposals WHERE session_id=? AND user_row=? AND final_row=? AND created>=?',
                (session_id, receipt.get('user_row_id'), receipt.get('final_assistant_row_id'), time.time()-RETENTION_SECONDS)).fetchall()
            conn.commit()
        finally:
            conn.close()
        if len(rows) != 1:
            raise ValueError('Missing or ambiguous staged local origin for canonical native rows')
        staged = json.loads(rows[0][0])
        if staged['user_message'] != prompt or staged['assistant_response'] != value.get('final_response'):
            raise ValueError('Canonical result does not match exact staged proposal data')
        return {'proposal': staged, 'native_record': record, 'commit_authority': False,
                'live_owner_fence': 'UNAVAILABLE: native epoch alone does not fence retired authority'}


def capture_final_proposal(**payload):
    """Optional post_llm_call DATA sink; not registered in the product pending integration."""
    from hermes_constants import get_hermes_home
    try:
        selected = {key: payload.get(key) for key in ('session_id', 'turn_id', 'user_message', 'assistant_response', 'conversation_history')}
        return ProposalJournal(get_hermes_home()).stage(**selected)
    except (ValueError, TypeError, KeyError) as exc:
        return {'staged': False, 'commit_authority': False, 'reason': str(exc)}
