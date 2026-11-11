"""Authenticated final-proposal runs for the pinned default in-process host.

Hooks stage DATA; only authenticated consume joins real native terminal records
and commits under the actual serving owner, durable journal and Store receipt.
"""
import hashlib
import json
import secrets
import sqlite3
from contextlib import closing

from .finalization import ProposalJournal, parse_proposal, validate_proposal
from .native_owner import NativeOwner


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
        separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def fixed_data(state, run):
    return {'items': [i for i in state['items'] if i['id'] in run['allowed_item_ids']],
            'comments': [c for c in state['comments'] if c['id'] in run['comment_ids']]}


def arm(flow, conn, run, context, principal_id, owner):
    context.update(finalization={'capability': secrets.token_hex(24), 'principal_id': principal_id,
        'scope_id': flow.store.scope_id, 'instance_id': owner['instance_id'],
        'comment_ids': list(run['comment_ids']), 'allowed_item_ids': list(run['allowed_item_ids']),
        'version_ids': list(run['version_ids']), 'source_digest': digest(fixed_data(flow.store.snapshot(), run)),
        'binding': None, 'proposal_id': None})
    flow._save(conn, run['id'], context)


def final_prompt(prompt):
    # Exact instruction remains server-authored. No identity/capability in model DATA.
    return prompt.replace('Use workspace_apply for direct edits and one explanatory outcome reply per comment, including inability/partial outcomes.',
        'Return one final JSON object with edits and replies. It will be validated and saved directly after native completion. Include one explanatory outcome per comment, including inability/partial outcomes. Do not call workspace_apply for this run.').replace(
        'Submit edits as [{item_id,patch}], replies as [{comment_id,text}], with this run_id.',
        'Final output must be exactly {"edits":[{"item_id":"...","patch":{...}}],"replies":[{"comment_id":"...","text":"..."}]}, with no code fences, prose or identity fields.')


def _validate_grant(flow, context, run, principal_id):
    grant = context.get('finalization')
    if not isinstance(grant, dict) or not grant.get('capability') or grant['principal_id'] != principal_id:
        raise ValueError('This run has no authenticated finalization authority')
    if context['revoked'] or run['status'] not in {'running', 'stopping'}:
        raise ValueError('Workspace finalization authority was revoked')
    with closing(sqlite3.connect(f'file:{flow.store.db_path}?mode=ro', uri=True)) as conn:
        scope = conn.execute("SELECT value FROM metadata WHERE key='scope_id'").fetchone()
    if scope is None or scope[0] != grant['scope_id'] or flow.store.scope_id != grant['scope_id']:
        raise ValueError('Workspace storage scope changed')
    for key in ('comment_ids', 'allowed_item_ids', 'version_ids'):
        if run[key] != grant[key]:
            raise ValueError('Captured Workspace run scope changed')
    return grant


def capture(stage, payload):
    """Actual registered native pre/post callbacks. Failure never grants authority."""
    # Reject oversized/ambiguous model DATA before parsing or owner acquisition.
    proposal = parse_proposal(payload['assistant_response']) if stage == 'post' else None
    from pathlib import Path
    from hermes_constants import get_hermes_home
    from gateway.session_ingress import viewer_turn
    from hermes_state_runtime import get_session_admission
    from .native import native_tool_call
    from .workflow import Workflow
    home = Path(get_hermes_home()).resolve()
    owner = NativeOwner(home)  # No bound owner in the hosted child: independent refusal.
    live = viewer_turn.get()
    if live is None:
        raise ValueError('No canonical native viewer admission for finalization')
    with live.event_stream.lock:
        admission_id = live.event_stream.execution.get('admission_id')
        from .native import NativeSessions
        native = NativeSessions(home, db=owner.authority.db)
        with native.database() as db:
            row = get_session_admission(db, admission_id=admission_id) if admission_id else None
        if row is None:
            raise ValueError('No exact native admission')
        flow = Workflow(home, native=native)
        with native_tool_call(payload.get('session_id'), payload.get('task_id'), row['request_id']) as identity:
            with flow._locked() as conn:
                context = flow._context(conn, row['request_id'])
                if not context.get('finalization'):
                    return {'staged': False, 'reason': 'Run uses the independent tool path'}
                run = flow._run(row['request_id'])
                grant = _validate_grant(flow, context, run, row['principal_id'])
                if payload.get('user_message') != context['prompt']:
                    raise ValueError('Native original prompt differs from authenticated Address')
                checked = flow.native.validate_call(**identity, run_id=run['id'],
                    owner_session_id=run['session_id'], prompt=context['prompt'], expected_epoch=context['native_epoch'])
                origin = {'turn_id': payload.get('turn_id'), 'admission_id': checked['admission_id'],
                    'generation': checked['generation'], 'session_id': payload.get('session_id')}
                if not isinstance(origin['turn_id'], str) or not origin['turn_id']:
                    raise ValueError('Native local originating turn is unavailable')
                if stage == 'pre':
                    if grant['binding'] not in (None, origin):
                        raise ValueError('Run is already bound to another native origin')
                    grant['binding'] = origin
                else:
                    if grant['binding'] != origin:
                        raise ValueError('Final callback does not own the original native Address admission')
                    validate_proposal(proposal, run)
                    staged = ProposalJournal(home).stage(**{key: payload.get(key) for key in
                        ('session_id','turn_id','user_message','assistant_response','conversation_history')})
                    if grant['proposal_id'] not in (None, staged['proposal_id']):
                        raise ValueError('Run already has a different final proposal')
                    grant['proposal_id'] = staged['proposal_id']
                    with flow.native.database() as db:
                        native_session = db.get_session(run['session_id'])
                    grant['post_revision'] = native_session['runtime_revision']
                    grant['post_history'] = flow.native.history_fingerprint(run['session_id'])
                flow._save(conn, run['id'], context)
    return {'staged': stage == 'post', 'commit_authority': False}


def pre_hook(**payload):
    try:
        capture('pre', payload)
    except (ValueError, TypeError, KeyError):
        # Hooks are fail-open upstream. The independently checked consume path
        # will reject a missing/failed binding; it never treats hook success as a grant.
        return None


def post_hook(**payload):
    try:
        return capture('post', payload)
    except (ValueError, TypeError, KeyError):
        return {'staged': False, 'commit_authority': False}


def _proposal(flow, context, run, grant):
    bound = grant['binding']
    if not isinstance(bound, dict) or not grant['proposal_id']:
        raise ValueError('Native final proposal is missing or its hook did not retain the original admission; use Recover document')
    joined = ProposalJournal(flow.profile_home).inspect_join(flow.native,
        session_id=run['session_id'], request_id=run['id'], principal_id=grant['principal_id'],
        prompt=context['prompt'], expected_epoch=context['native_epoch'])
    staged = joined['proposal']
    row = joined['native_record']['admission']
    if (staged['proposal_id'] != grant['proposal_id'] or staged['turn_id'] != bound['turn_id']
            or row['admission_id'] != bound['admission_id'] or row['generation'] != bound['generation']):
        raise ValueError('Canonical result does not join the exact armed local native origin')
    flow.native.require_success(joined['native_record'], expected_revision=grant.get('post_revision', -2) + 1,
        expected_history=grant.get('post_history'))
    return validate_proposal(staged['proposal'], run)


def consume(flow, run_id, *, principal_id):
    owner = NativeOwner(flow.profile_home)
    from .native import NativeSessions
    flow.native = NativeSessions(flow.profile_home, db=owner.authority.db)
    def write(accept):
        with flow._locked() as conn:
            context = flow._context(conn, run_id)
            run = flow._run(run_id)
            if run['status'] in {'completed','cancelled','error'}:
                if context.get('finalization', {}).get('principal_id') != principal_id:
                    raise ValueError('This run does not belong to the authenticated principal')
                return {'run': run, 'native_terminal': context.get('native_terminal','UNKNOWN')}
            grant = _validate_grant(flow, context, run, principal_id)
            row = flow.native.receipt(run['session_id'], run['id'])
            if row is None or row['status'] in {'queued','started'}:
                return {'run': run, 'native_terminal': 'UNKNOWN'}
            if row['status'] != 'terminal':
                raise ValueError('Native outcome UNKNOWN; use explicit Recover document')
            proposal = _proposal(flow, context, run, grant)
            def authorize():
                def check():
                    owner.check_session(run['session_id'], principal_id, epoch=context['native_epoch'], instance_id=grant['instance_id'])
                    if (owner.authority.delivered_stops.get(run['session_id']) == grant['binding']['generation']
                            or owner.authority.pending_stops.get(run['session_id']) == grant['binding']['generation']):
                        raise ValueError('Native Stop was delivered to this originating execution')
                    _validate_grant(flow, context, run, principal_id)
                    if digest(fixed_data(flow.store.snapshot(), run)) != grant['source_digest']:
                        # An identical committed receipt retry is allowed; it cannot
                        # reapply patches even if its cache/journal failed afterwards.
                        fingerprint = digest([proposal['edits'], proposal['replies']])
                        if not any(r['operation_id'] == fingerprint for r in flow._run(run_id).get('operation_receipts', [])):
                            raise ValueError('Captured Workspace source revisions changed')
                    if _proposal(flow, context, run, grant) != proposal:
                        raise ValueError('Native final proposal changed while waiting for the Store writer')
                accept(check)
            fingerprint = digest([proposal['edits'], proposal['replies']])
            try:
                result = flow.store.apply_run(run_id, **proposal, authorize=authorize,
                    operation_id=fingerprint, operation_digest=fingerprint)
            except ValueError as exc:
                from .targeted_edits import TargetedEditConflict
                if not isinstance(exc.__cause__, TargetedEditConflict):
                    raise
                # Store rolled back this exact-preimage conflict atomically.
                # The joined native turn is terminal; retrying the immutable
                # proposal cannot succeed. Revoke it and release document locks
                # without inventing saved edits or successful comment replies.
                context.update(revoked=True, native_terminal=row['outcome'])
                message = 'The native turn ended, but its proposed edits were not saved: ' + str(exc)
                flow.store.finish_run(run_id, 'error', message)
                flow._save(conn, run_id, context)
                return {'run': flow._run(run_id), 'native_terminal': row['outcome']}
            context['outcomes'] = sorted({cid for r in result['operation_receipts'] for cid in r['comment_ids']})
            context['operations'] = [r['operation_id'] for r in result['operation_receipts']]
            context['admission_id'] = row['admission_id']
            context['native_terminal'] = row['outcome']
            flow._save(conn, run_id, context)
            run = flow._finish(conn, run, context, 'completed')
            return {'run': run, 'native_terminal': row['outcome']}
    return owner.execute(write)
