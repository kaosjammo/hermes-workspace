"""Workspace REST routes; Hermes supplies authentication and request profile scope.

The loader imports this file by path, so package imports are rooted at this exact
installation rather than the working directory or a process-global sys.path.
"""
from __future__ import annotations

import base64
import asyncio
import binascii
import hashlib
import importlib
import importlib.util
import json
from pathlib import Path
import re
import sys
from collections import OrderedDict
from threading import Lock
from typing import Callable

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse


_ROOT = Path(__file__).resolve().parents[1]
_PACKAGE = '_hermes_workspace_' + hashlib.sha256(str(_ROOT).encode()).hexdigest()[:16]
if _PACKAGE not in sys.modules:
    _spec = importlib.util.spec_from_file_location(
        _PACKAGE, _ROOT / 'workspace_plugin/__init__.py',
        submodule_search_locations=[str(_ROOT / 'workspace_plugin')])
    if _spec is None or _spec.loader is None:
        raise ImportError('Workspace package is incomplete.')
    _module = importlib.util.module_from_spec(_spec)
    sys.modules[_PACKAGE] = _module
    _spec.loader.exec_module(_module)


def _module(name: str):
    return importlib.import_module(_PACKAGE + '.' + name)


def _home() -> Path:
    # This lookup must happen inside the authenticated request's scoped context.
    from hermes_constants import get_hermes_home
    return Path(get_hermes_home())


def _authorize(request: Request) -> None:
    # The framework preserves admission in hosted mode without forwarding secrets.
    from hermes_cli.web_deps import late
    late('_require_token')(request)


def _authenticated_workspace_principal(request: Request) -> str:
    """Derive the single native host owner after actual framework admission.

    Identity is implementation-only. Neither JSON nor an echoed identity header
    can supply a SessionActor subject. Selected-home scope stays request-bound.
    """
    _authorize(request)
    from gateway.owner_identity import host_owner_subject
    return host_owner_subject()


async def _body(request: Request, limit: int = 48 * 1024 * 1024) -> dict:
    chunks = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > limit:
            raise HTTPException(413, 'Workspace request exceeds the supported size.')
        chunks.append(chunk)
    try:
        result = json.loads(b''.join(chunks))
    except (ValueError, UnicodeError) as exc:
        raise HTTPException(400, 'Request must be valid JSON.') from exc
    if not isinstance(result, dict):
        raise HTTPException(400, 'Request must be a JSON object.')
    return result


def _binary(body: dict, limit: int) -> bytes:
    encoded = body.get('data_base64')
    if not isinstance(encoded, str) or len(encoded) > ((limit + 2) // 3) * 4:
        raise HTTPException(413, 'File exceeds the supported size.')
    try:
        data = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(400, 'File encoding is invalid.') from exc
    if len(data) > limit:
        raise HTTPException(413, 'File exceeds the supported size.')
    return data


def _error(exc: Exception) -> HTTPException:
    # Store errors are deliberately user-facing, without host paths or tracebacks.
    code = getattr(exc, 'status_code', None) or getattr(exc, 'status', None)
    if code not in (400, 403, 404, 409, 413, 422):
        code = 409 if any(word in str(exc).lower() for word in ('revision', 'locked', 'active run', 'conflict')) else 400
    return HTTPException(code, str(exc))


def _scope(store, body: dict) -> None:
    scope_id = store.scope_id
    if not scope_id or body.get('expected_scope') != scope_id:
        raise HTTPException(409, 'Workspace profile changed. Reopen Workspace and retry.')


def _download(name: str, media_type: str, data: bytes) -> dict:
    return {'name': name, 'media_type': media_type,
            'data_base64': base64.b64encode(data).decode('ascii')}


def create_router(owner_home: Callable[[], Path] = _home,
                  authorize: Callable = _authorize, *, shared_root: Path | None = None) -> APIRouter:
    """Construct routes; an injected resolver is only for isolated fixture tests."""
    routes = APIRouter(dependencies=[Depends(authorize)])
    # Completion readback only: bounded, process-local receipts contain no backup
    # bytes. Missing receipts after restart mean unknown, never permission to retry.
    restore_receipts = OrderedDict()
    receipt_lock = Lock()

    def restore_identity(value):
        if not isinstance(value, str) or re.fullmatch(r'[0-9a-f]{32}', value) is None:
            raise HTTPException(400, 'Restore identity must be 32 lowercase hexadecimal characters.')
        return value

    def receipt_view(entry):
        with receipt_lock:
            return dict(entry['view'])

    def reserve_restore(key, digest):
        with receipt_lock:
            existing = restore_receipts.get(key)
            if existing is not None:
                if existing['digest'] != digest:
                    raise HTTPException(409, 'This restore identity already belongs to a different backup.')
                return existing, False
            if len(restore_receipts) >= 64:
                removable = next((k for k, row in restore_receipts.items()
                                  if row['view']['status'] != 'running'), None)
                if removable is None:
                    raise HTTPException(503, 'Too many restores are already processing. Check their status first.')
                del restore_receipts[removable]
            entry = {'digest': digest, 'view': {'restore_id': key[-1], 'status': 'running'}}
            restore_receipts[key] = entry
            return entry, True

    def record_restore(entry, status, **fields):
        with receipt_lock:
            entry['view'] = {'restore_id': entry['view']['restore_id'], 'status': status, **fields}

    def perform_recorded_restore(interchange, store, body, data, entry):
        # This worker owns the receipt transition, so loss/cancellation of the
        # HTTP response cannot erase a completed replacement or repeat its effect.
        try:
            _scope(store, body)
            result = interchange.restore_into_store(store, data, expected_revision=body.get('expected_revision'))
            if not isinstance(result, dict) or result.get('restored') is not True:
                raise RuntimeError('Restore returned no commit result')
        except (ValueError, HTTPException) as exc:
            detail = str(exc.detail if isinstance(exc, HTTPException) else exc)[:1000]
            record_restore(entry, 'refused', detail=detail)
            raise
        except BaseException:
            record_restore(entry, 'unknown', detail='Restore outcome could not be confirmed. Check Workspace before another replacement.')
            raise
        record_restore(entry, 'committed', result=result)
        return result

    def selected():
        # No global Store/connection: capture the admitted owner once per request.
        home = Path(owner_home())
        return home, _module('store').Store(home)

    def shared_selected():
        # Composition-only input, never a body/environment fallback or another
        # profile's home. Production stays closed until a public local data-root
        # contract is established; fixture callers may supply a synthetic root.
        if shared_root is None:
            raise HTTPException(503, 'Shared Workspace requires a supported local application-data-root contract. No shared store was opened.')
        home, private = selected()
        shared = _module('shared_workspaces')
        return shared.SharedWorkspaces(shared_root), shared.profile_key(home), private

    @routes.get('/workspace-capabilities')
    def workspace_capabilities():
        return {'shared_storage_configured': shared_root is not None,
                'native_shared_executor': False, 'local_profile_backend_default': False,
                'blockers': ([ 'Shared application-data-root composition is not established by the public host contract.' ] if shared_root is None else []) + [
                    'No supported plugin lifecycle contract was established for automatic backend installation/enablement in current and future local profiles.',
                    'Shared data owner and exact native executor source/thread lack a qualified public authenticated execution/Stop binding.']}

    @routes.get('/workspaces')
    def workspaces():
        service, profile_id, private = shared_selected()
        return {'profile_id': profile_id, 'private_scope_id': private.scope_id,
                'workspaces': service.list(profile_id)}

    @routes.post('/workspaces')
    async def create_workspace(request: Request):
        body = await _body(request, 65536)
        service, profile_id, private = shared_selected()
        _scope(private, body)
        try:
            _module('store')._keys(body, {'name', 'members', 'expected_scope'}, {'name', 'expected_scope'})
            return service.create(profile_id, body['name'], body.get('members', []))
        except ValueError as exc:
            raise _error(exc) from exc

    @routes.get('/workspaces/{workspace_id}/state')
    def shared_state(workspace_id: str):
        service, profile_id, _ = shared_selected()
        try:
            return service.snapshot(profile_id, workspace_id)
        except ValueError as exc:
            raise _error(exc) from exc

    @routes.post('/workspaces/{workspace_id}/command')
    async def shared_command(request: Request, workspace_id: str):
        body = await _body(request, 16 * 1024 * 1024)
        service, profile_id, _ = shared_selected()
        allowed = {'create_item', 'update_item', 'open_item', 'reorder_item', 'trash', 'restore', 'purge',
                   'add_comment', 'reply_comment', 'resolve_comment', 'delete_comment', 'set_username', 'set_columns',
                   'search', 'save_template', 'apply_template', 'add_attachment', 'restore_version',
                   'preview_section_revert', 'revert_section'}
        try:
            _module('store')._keys(body, {'op', 'payload', 'membership_revision', 'expected_scope'},
                                 {'op', 'payload', 'membership_revision', 'expected_scope'})
            if body['op'] not in allowed:
                raise HTTPException(400, 'Unknown shared Workspace operation.')
            return await asyncio.to_thread(service.execute, profile_id, workspace_id, body['op'], body['payload'],
                membership_revision=body['membership_revision'], expected_scope=body['expected_scope'])
        except ValueError as exc:
            raise _error(exc) from exc

    @routes.post('/workspaces/{workspace_id}/members')
    async def shared_member(request: Request, workspace_id: str):
        body = await _body(request, 65536)
        service, profile_id, _ = shared_selected()
        try:
            _module('store')._keys(body, {'profile_id', 'role', 'membership_revision', 'expected_scope'},
                                 {'profile_id', 'membership_revision', 'expected_scope'})
            state = service.snapshot(profile_id, workspace_id)['state']
            if state['scope_id'] != body['expected_scope']:
                raise HTTPException(409, 'Shared Workspace scope changed; reopen before continuing.')
            return await asyncio.to_thread(service.set_member, profile_id, workspace_id, body['profile_id'],
                role=body.get('role', 'editor'), membership_revision=body['membership_revision'])
        except ValueError as exc:
            raise _error(exc) from exc

    @routes.post('/workspaces/{workspace_id}/move-private')
    async def move_private(request: Request, workspace_id: str):
        body = await _body(request, 65536)
        service, profile_id, private = shared_selected()
        try:
            fields = {'item_id', 'confirmed', 'membership_revision', 'expected_scope', 'source_scope', 'source_revision', 'destination_revision'}
            _module('store')._keys(body, fields, fields)
            return await asyncio.to_thread(service.move_private, profile_id, workspace_id, private, **body)
        except ValueError as exc:
            raise _error(exc) from exc

    @routes.get('/state')
    def state():
        _, store = selected()
        return store.snapshot(include_identity=True)

    @routes.get('/catalog')
    def catalog(expected_scope: str | None = None, expected_revision: int | None = None):
        _,store = selected()
        try:
            return store.catalog(expected_scope=expected_scope,expected_revision=expected_revision)
        except ValueError as exc:
            raise _error(exc) from exc

    @routes.get('/document/{item_id}')
    def document(item_id: str, expected_scope: str, expected_revision: int | None = None):
        _,store = selected()
        try:
            return store.document(item_id,expected_scope=expected_scope,expected_revision=expected_revision)
        except ValueError as exc:
            raise _error(exc) from exc

    @routes.get('/document/{item_id}/history')
    def history(item_id: str, expected_scope: str, expected_revision: int):
        _,store = selected()
        try:
            return store.document(item_id,history=True,expected_scope=expected_scope,expected_revision=expected_revision)
        except ValueError as exc:
            raise _error(exc) from exc

    @routes.post('/command')
    async def command(request: Request):
        body = await _body(request, 16 * 1024 * 1024)
        _, store = selected()
        _scope(store, body)
        allowed = {'create_item', 'update_item', 'open_item', 'reorder_item', 'trash', 'restore', 'purge',
                   'add_comment', 'reply_comment', 'resolve_comment', 'delete_comment', 'set_username', 'set_columns',
                   'search', 'search_page', 'save_template', 'apply_template', 'add_attachment', 'restore_version',
                   'preview_section_revert','revert_section'}
        if body.get('op') not in allowed or not isinstance(body.get('payload'), dict):
            raise HTTPException(400, 'Unknown Workspace action or invalid payload.')
        include_state = body.get('include_state', True)
        if type(include_state) is not bool or not include_state and body['op'] not in {'search','search_page'}:
            raise HTTPException(400, 'Only read-only search may omit the full state response.')
        try:
            result = await asyncio.to_thread(store.execute, body['op'], body['payload'])
        except ValueError as exc:
            raise _error(exc) from exc
        if not include_state:
            return {'result': result}
        state = store.snapshot(include_identity=True)
        identity = state.pop('identity')
        return {'result':result, 'state':state, 'identity':identity}

    @routes.post('/import')
    async def import_file(request: Request):
        body = await _body(request, 12 * 1024 * 1024)
        _, store = selected()
        _scope(store, body)
        if not isinstance(body.get('name'), str):
            raise HTTPException(400, 'Choose a named file to import.')
        try:
            result = await asyncio.to_thread(_module('interchange').import_into_store,
                store, body['name'], _binary(body, 8 * 1024 * 1024),
                parent_id=body.get('parent_id'), expected_revision=body.get('expected_revision'))
        except ValueError as exc:
            raise _error(exc) from exc
        return {'result': result, 'state': store.snapshot(include_identity=True)}

    @routes.get('/export/{item_id}')
    def export_file(item_id: str, format: str = 'md'):
        _, store = selected()
        snapshot = store.snapshot(include_identity=True)
        item = next((row for row in snapshot['items'] if row['id'] == item_id and not row['deleted_at']), None)
        if item is None:
            raise HTTPException(404, 'Workspace item was not found.')
        formats = {'md': ('text/markdown', 'md'), 'csv': ('text/csv', 'csv'),
                   'docx': ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'),
                   'pdf': ('application/pdf', 'pdf')}
        if format not in formats:
            raise HTTPException(400, 'Unsupported export format.')
        interchange = _module('interchange')
        try:
            if format == 'csv':
                if item['kind'] != 'database':
                    raise ValueError('CSV export requires a database.')
                data = interchange.export_csv(item, [row for row in snapshot['items']
                    if row.get('database_id') == item_id and not row['deleted_at']])
            else:
                document = {**item, 'attachments': [row for row in snapshot['attachments']
                    if row['item_id'] == item_id]}
                data = interchange.export_document(document, format)
        except ValueError as exc:
            raise _error(exc) from exc
        safe_name = re.sub(r'[^\w .-]', '_', item['title'])[:100] or 'Workspace'
        return _download(safe_name + '.' + formats[format][1], formats[format][0], data)

    @routes.get('/backup')
    def backup():
        _, store = selected()
        try:
            data = _module('interchange').backup(store.backup_snapshot())
        except ValueError as exc:
            raise _error(exc) from exc
        return _download('workspace-backup.zip', 'application/zip', data)

    @routes.post('/restore-backup')
    async def restore_backup(request: Request):
        interchange = _module('interchange')
        body = await _body(request, interchange.MAX_BACKUP_REQUEST)
        home, store = selected()
        _scope(store, body)
        include_state = body.get('include_state', True)
        if type(include_state) is not bool:
            raise HTTPException(400, 'include_state must be true or false.')
        if not include_state and (type(body.get('expected_revision')) is not int or body['expected_revision'] < 0):
            raise HTTPException(400, 'Compact restore requires the captured nonnegative Workspace revision.')
        restore_id = body.get('restore_id')
        if restore_id is not None:
            restore_id = restore_identity(restore_id)
        elif not include_state:
            raise HTTPException(400, 'A restore identity is required for compact completion readback.')
        data = _binary(body, interchange.MAX_BACKUP_ARCHIVE)
        entry = None
        if restore_id is not None:
            key = (str(home.resolve()), store.scope_id, restore_id)
            entry, fresh = reserve_restore(key, hashlib.sha256(data).hexdigest())
            if not fresh:
                view = receipt_view(entry)
                if view['status'] == 'running':
                    return JSONResponse(view, status_code=202)
                if view['status'] == 'refused':
                    raise HTTPException(400, view['detail'])
                if view['status'] != 'committed':
                    raise HTTPException(503, view['detail'])
                return {**view, **({'state': store.snapshot(include_identity=True)} if include_state else {})}
        try:
            if entry is None:
                result = await asyncio.to_thread(interchange.restore_into_store,
                    store, data, expected_revision=body.get('expected_revision'))
            else:
                result = await asyncio.to_thread(perform_recorded_restore, interchange, store, body, data, entry)
        except ValueError as exc:
            raise _error(exc) from exc
        response = {'result': result} if entry is None else receipt_view(entry)
        if include_state:
            response['state'] = store.snapshot(include_identity=True)
        return response

    @routes.get('/restore-status/{restore_id}')
    def restore_status(restore_id: str, expected_scope: str):
        home, store = selected()
        _scope(store, {'expected_scope': expected_scope})
        key = (str(home.resolve()), store.scope_id, restore_identity(restore_id))
        with receipt_lock:
            entry = restore_receipts.get(key)
        if entry is None:
            raise HTTPException(404, 'Restore result is unavailable. Check Workspace; do not automatically repeat replacement.')
        return receipt_view(entry)

    def workflow_call(home, store, action, body, principal_id=None):
        workflow = _module('workflow').Workflow(home, store=store)
        if action == 'review-scope':
            return workflow.review_scope(body['item_id'],body['selected_item_ids'],
                expected_revision=body['expected_revision'],principal_id=principal_id)
        if action == 'bind':
            return workflow.bind_thread(body['item_id'], body['thread_id'])
        if action == 'prepare':
            return workflow.prepare(body['item_id'], body['session_id'], body.get('explicit_item_ids', []),
                                    principal_id=principal_id, **({'review_id':body['review_id']} if 'review_id' in body else {}))
        if action == 'consume':
            return workflow.consume(body['run_id'], principal_id=principal_id)
        if action == 'status':
            return workflow.status(body['run_id'])
        if action == 'recover':
            return workflow.recover(body['run_id'])
        return workflow.stop(body['run_id'])

    @routes.post('/workflow/{action}')
    async def workflow(request: Request, action: str):
        if action not in ('bind', 'review-scope', 'prepare', 'consume', 'status', 'stop', 'recover'):
            raise HTTPException(404, 'Unknown Workspace workflow action.')
        body = await _body(request, 65536)
        home, store = selected()
        _scope(store, body)
        principal_id = None
        if action in ('review-scope', 'prepare', 'consume'):
            allowed = ({'item_id','selected_item_ids','expected_revision','expected_scope'} if action=='review-scope' else
                       {'item_id', 'session_id', 'explicit_item_ids', 'expected_scope', 'review_id'}
                       if action == 'prepare' else {'run_id', 'expected_scope'})
            if set(body) - allowed:
                raise HTTPException(400, 'Unexpected Workspace workflow fields. Native identity is server-owned.')
            principal_id = _authenticated_workspace_principal(request)
        try:
            return await asyncio.to_thread(workflow_call, home, store, action, body, principal_id)
        except KeyError as exc:
            raise HTTPException(400, 'Workflow request is missing a required field.') from exc
        except ValueError as exc:
            raise _error(exc) from exc

    return routes


router = create_router()
