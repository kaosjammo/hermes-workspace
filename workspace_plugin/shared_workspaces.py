"""Explicit-member LOCAL data service, separate from native execution authority.

The deployment supplies an approved absolute application data root and derives
profile IDs from authenticated request context. Neither is a browser-provided
path. No constructor scans, pools or relocates private profile stores. The default
plugin router leaves this service unavailable until that host contract exists.
Membership is an application permission, not isolation from same-user OS tools.
"""
from contextlib import contextmanager
import copy
import hashlib
import os
from pathlib import Path
import re
import sqlite3
import stat

from .store import Store, StoreError, CATEGORIES, ACTIVE, _id, _identifier, _keys, _text


def profile_key(profile_home: Path):
    """Opaque local data identity from the server's admitted home, never JSON."""
    if not isinstance(profile_home, Path) or not profile_home.is_absolute():
        raise StoreError('An authenticated absolute profile home is required')
    return hashlib.sha256(str(profile_home.resolve()).encode()).hexdigest()


def validate_executor(binding):
    """Validate inert saved selection; this shape alone never grants execution."""
    _keys(binding, {'profile_id', 'source', 'thread_id'}, {'profile_id', 'source', 'thread_id'})
    _identifier(binding['profile_id'], 'executor profile')
    _identifier(binding['thread_id'], 'native thread')
    source = binding['source']
    _keys(source, {'kind', 'connection_id', 'profile', 'target_profile'},
          {'kind', 'connection_id', 'profile', 'target_profile'})
    if source['kind'] != 'local':
        raise StoreError('Shared Workspace supports local executor sources only')
    _identifier(source['connection_id'], 'connection')
    for key in ('profile', 'target_profile'):
        if source[key] is not None:
            _identifier(source[key], key)
    return copy.deepcopy(binding)


def desktop_default_enabled(decision=None, *, restricted=False):
    """Pure policy for serial UI wiring; never edits host decisions/settings."""
    if decision is not None and type(decision) is not bool:
        raise StoreError('Desktop decision must be true, false or unset')
    return not restricted and decision is not False


class SharedWorkspaces:
    def __init__(self, application_root: Path):
        if not isinstance(application_root, Path) or not application_root.is_absolute():
            raise StoreError('An approved absolute local application data root is required')
        if application_root.resolve() != application_root:
            raise StoreError('Shared application data root must not traverse symlinks')
        self.root = application_root
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.path = self.root / 'catalog.sqlite3'
        with self._catalog() as conn:
            conn.execute('CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner TEXT NOT NULL, revision INTEGER NOT NULL)')
            conn.execute('CREATE TABLE IF NOT EXISTS members (project_id TEXT NOT NULL REFERENCES projects(id), profile_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN (\'editor\',\'read_only\')), PRIMARY KEY(project_id,profile_id))')

    @contextmanager
    def _catalog(self):
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR | getattr(os, 'O_NOFOLLOW', 0), 0o600)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
                raise StoreError('Shared catalog must be an ordinary private file')
            os.fchmod(fd, 0o600)
        finally:
            os.close(fd)
        conn = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute('PRAGMA foreign_keys=ON')
            conn.execute('PRAGMA synchronous=FULL')
            conn.execute('BEGIN IMMEDIATE')
            yield conn
            conn.commit()
        except BaseException:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _access(self, conn, project_id, profile_id, *, write=False, membership_revision=None):
        _identifier(profile_id, 'authenticated profile')
        if not isinstance(project_id, str) or re.fullmatch('[0-9a-f]{32}', project_id) is None:
            raise StoreError('Shared workspace not found', 404)
        row = conn.execute('SELECT p.*,m.role FROM projects p JOIN members m ON m.project_id=p.id WHERE p.id=? AND m.profile_id=?',
                           (project_id, profile_id)).fetchone()
        if row is None:
            raise StoreError('Profile is not a member of this shared workspace', 403)
        if membership_revision is not None and (type(membership_revision) is not int or row['revision'] != membership_revision):
            raise StoreError('Shared membership changed; reopen before continuing', 409)
        if write and row['role'] != 'editor':
            raise StoreError('Shared workspace membership is read-only', 403)
        return row

    def _store(self, project_id):
        # Called only after membership admission. Never opens another profile.
        home = self.root / 'projects' / project_id
        if home.resolve() != home:
            raise StoreError('Shared workspace directory must not traverse symlinks')
        return Store(home)

    @staticmethod
    def _revision(value):
        if type(value) is not int or value < 1:
            raise StoreError('Capture the current shared membership revision before writing', 409)

    @staticmethod
    def _view(conn, row):
        return {'id': row['id'], 'name': row['name'], 'owner_profile_id': row['owner'],
                'membership_revision': row['revision'], 'role': row['role'],
                'members': [dict(m) for m in conn.execute('SELECT profile_id,role FROM members WHERE project_id=? ORDER BY profile_id', (row['id'],))]}

    def list(self, profile_id):
        _identifier(profile_id, 'authenticated profile')
        with self._catalog() as conn:
            rows = conn.execute('SELECT p.*,m.role FROM projects p JOIN members m ON p.id=m.project_id WHERE m.profile_id=? ORDER BY p.rowid', (profile_id,)).fetchall()
            return [self._view(conn, row) for row in rows]

    def create(self, profile_id, name, members=None):
        _identifier(profile_id, 'authenticated profile')
        name = _text(name, 'workspace name', 200)
        members = [] if members is None else members
        if not isinstance(members, list) or len(members) > 100:
            raise StoreError('Choose at most 100 explicit workspace members')
        chosen = {profile_id: 'editor'}
        for member in members:
            _keys(member, {'profile_id', 'role'}, {'profile_id'})
            key = _identifier(member['profile_id'], 'member profile')
            role = member.get('role', 'editor')
            if role not in ('editor', 'read_only') or key in chosen:
                raise StoreError('Invalid or duplicate member')
            chosen[key] = role
        with self._catalog() as conn:
            if conn.execute('SELECT count(*) FROM projects').fetchone()[0] >= 1000:
                raise StoreError('Shared workspace limit exceeded')
            ident = _id()
            self._store(ident)
            conn.execute('INSERT INTO projects VALUES(?,?,?,1)', (ident, name, profile_id))
            conn.executemany('INSERT INTO members VALUES(?,?,?)', [(ident, key, role) for key, role in chosen.items()])
            return self._view(conn, self._access(conn, ident, profile_id))

    def set_member(self, profile_id, project_id, member_profile_id, *, role='editor', membership_revision):
        self._revision(membership_revision)
        _identifier(member_profile_id, 'member profile')
        if role not in ('editor', 'read_only', None):
            raise StoreError('Membership role must be editor, read_only or removal')
        with self._catalog() as conn:
            row = self._access(conn, project_id, profile_id, write=True, membership_revision=membership_revision)
            if row['owner'] != profile_id:
                raise StoreError('Only the workspace creator can change membership', 403)
            if member_profile_id == row['owner']:
                raise StoreError('The workspace creator must retain editor membership')
            if role is None:
                conn.execute('DELETE FROM members WHERE project_id=? AND profile_id=?', (project_id, member_profile_id))
            else:
                conn.execute('INSERT OR REPLACE INTO members VALUES(?,?,?)', (project_id, member_profile_id, role))
            conn.execute('UPDATE projects SET revision=revision+1 WHERE id=?', (project_id,))
            return self._view(conn, self._access(conn, project_id, profile_id))

    def snapshot(self, profile_id, project_id):
        with self._catalog() as conn:
            row = self._access(conn, project_id, profile_id)
            return {'workspace': self._view(conn, row), 'state': self._store(project_id).snapshot()}

    def execute(self, profile_id, project_id, op, payload, *, membership_revision, expected_scope):
        # Membership lock spans Store lock waits and commit. A concurrent revoke
        # cannot slip between admission and effect. No raw Store escapes callers.
        self._revision(membership_revision)
        with self._catalog() as conn:
            self._access(conn, project_id, profile_id, write=op != 'search', membership_revision=membership_revision)
            store = self._store(project_id)
            store.check_scope(expected_scope)
            if op == 'bind_thread':
                raise StoreError('Use a validated exact executor source and matching native thread', 409)
            if not isinstance(payload, dict) or (op != 'search' and type(payload.get('expected_revision')) is not int):
                raise StoreError('Shared mutations require the captured Workspace revision', 409)
            return {'result': store.execute(op, payload), 'state': store.snapshot()}

    def bind_executor(self, profile_id, project_id, item_id, binding, *, membership_revision,
                      expected_scope, expected_revision, validate=None):
        self._revision(membership_revision)
        if not callable(validate):
            raise StoreError('Supported native executor/source validation is unavailable; no binding saved', 409)
        binding = validate_executor(binding)
        with self._catalog() as conn:
            self._access(conn, project_id, profile_id, write=True, membership_revision=membership_revision)
            # A selected executor is itself an explicit member; selection never
            # confers data access or bypasses a read-only role.
            self._access(conn, project_id, binding['profile_id'], write=True)
            store = self._store(project_id)
            store.check_scope(expected_scope)
            return store.remember_executor(item_id, binding, expected_revision=expected_revision, validate=validate)

    def move_private(self, profile_id, project_id, source: Store, item_id, *, confirmed,
                     membership_revision, expected_scope, source_scope, source_revision, destination_revision):
        """Explicit same-filesystem SQLite transaction; no copy-then-delete gap.

        Move the chosen hierarchy only. Cross-boundary relations, comment targets,
        shared attachments or historical run scope refuse instead of pruning or
        silently widening the move. Native workflow journals/grants never move.
        """
        if confirmed is not True:
            raise StoreError('Confirm the explicit move into this shared workspace', 409)
        self._revision(membership_revision)
        if not isinstance(source, Store):
            raise StoreError('Move source must be the authenticated private Store')
        if profile_key(source.profile_home) != profile_id:
            raise StoreError('Move source differs from the authenticated private profile', 403)
        with self._catalog() as catalog:
            self._access(catalog, project_id, profile_id, write=True, membership_revision=membership_revision)
            target = self._store(project_id)
            target.check_scope(expected_scope)
            source.check_scope(source_scope)
            if source.db_path == target.db_path or source.db_path.stat().st_dev != target.db_path.stat().st_dev:
                raise StoreError('Atomic private-to-shared move requires distinct stores on one local filesystem', 409)
            conn = source._connect()
            try:
                conn.execute('ATTACH DATABASE ? AS moved', (str(target.db_path),))
                if any(conn.execute(f'PRAGMA {schema}.journal_mode').fetchone()[0].lower() != 'delete' for schema in ('main', 'moved')):
                    raise StoreError('Atomic move requires ordinary rollback journals; no journal mode was changed', 409)
                conn.execute('PRAGMA moved.synchronous=FULL')
                conn.execute('BEGIN IMMEDIATE')
                # Re-read actual scopes after lock acquisition, not cached handles.
                for schema, scope in [('main', source_scope), ('moved', expected_scope)]:
                    if conn.execute(f"SELECT value FROM {schema}.metadata WHERE key='scope_id'").fetchone()[0] != scope:
                        raise StoreError('Workspace scope changed before move', 409)
                old, new = source._load(conn), target._load(conn, 'moved')
                if type(source_revision) is not int or type(destination_revision) is not int or old['revision'] != source_revision or new['revision'] != destination_revision:
                    raise StoreError('Workspace revision changed before move', 409)
                root = source._item(old, item_id, active=True)
                if root['kind'] == 'record':
                    raise StoreError('Move the complete database to preserve record schema and recovery', 409)
                ids = source._descendants(old, [item_id])
                source._unlocked(old, ids)
                for run in old['runs']:
                    scope = set(run['allowed_item_ids'])
                    if scope & ids and (not scope <= ids or run['status'] in ACTIVE):
                        raise StoreError('Move would split historical run scope or an active run', 409)
                for category in CATEGORIES:
                    if category == 'templates':
                        continue
                    key = 'id' if category == 'items' else 'item_id'
                    moving = [row for row in old[category] if row[key] in ids]
                    old[category] = [row for row in old[category] if row[key] not in ids]
                    if category == 'items':
                        for row in moving:
                            if row['id'] == item_id:
                                row['parent_id'] = None
                            if row['thread_id'] is not None and 'thread_owner' not in row:
                                row['thread_owner'] = {'profile_id': profile_id, 'scope_id': source_scope}
                    new[category].extend(moving)
                # Complete graph validation catches every external reference,
                # including older snapshots and attachment/formula dependencies.
                source._validate_state(old)
                target._validate_state(new)
                old['revision'] += 1
                new['revision'] += 1
                source._save(conn, old)
                target._save(conn, new, 'moved')
                conn.commit()
                return {'moved': True, 'item_ids': sorted(ids), 'workspace_id': project_id,
                        'source_revision': old['revision'], 'destination_revision': new['revision']}
            except BaseException:
                conn.rollback()
                raise
            finally:
                conn.close()
