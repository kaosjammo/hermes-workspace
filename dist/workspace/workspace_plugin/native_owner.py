"""Pinned default in-process owner operations; hosted/no-owner calls fail closed.

Uses the actual process-bound native authority/loop, not a reconstructed object,
epoch-only lease or hosted allow boolean. Accepted work linearises on that loop;
native retirement tracks/joins its worker through Store effect/receipt commit.
"""
import asyncio
from pathlib import Path


class NativeOwner:
    def __init__(self, profile_home):
        from gateway.session_cron import owner_for_home
        self.home = Path(profile_home).resolve()
        pair = owner_for_home(self.home)
        if pair is None or not pair[1].is_running():
            raise ValueError('Workspace finalization requires the default in-process native owner; hosted or detached API writes are unavailable')
        self.authority, self.loop = pair
        if Path(self.authority.db.db_path).resolve() != self.home / 'state.db':
            raise ValueError('Native serving owner profile does not match Workspace')

    def require_current(self):
        from gateway.session_cron import owner_for_home
        from gateway.session_authorities import require_serving
        pair = owner_for_home(self.home)
        if not pair or pair[0] is not self.authority or pair[1] is not self.loop:
            raise ValueError('Native owner was replaced or unbound')
        require_serving(self.authority)
        self.authority._require_admission_open()

    def call(self, coroutine):
        try:
            current = asyncio.get_running_loop()
        except RuntimeError:
            current = None
        if current is self.loop:
            coroutine.close()
            raise ValueError('Synchronous Workspace owner calls must run off the native owner loop')
        if not self.loop.is_running():
            coroutine.close()
            raise ValueError('Native owner loop is unavailable')
        # A timeout does not untrack a live effect worker or assert cancellation.
        try:
            return asyncio.run_coroutine_threadsafe(coroutine, self.loop).result(timeout=25)
        except TimeoutError as exc:
            raise ValueError('Native owner operation is not confirmed; no cancellation success is claimed. Await status or use explicit Recover document.') from exc

    def check_session(self, session_id, principal_id, *, epoch=None, instance_id=None):
        from gateway.owner_identity import host_owner_subject
        from gateway.session_contract import SessionActor, SessionRef
        self.require_current()
        if principal_id != host_owner_subject():
            raise ValueError('Workspace Address principal is not the authenticated host owner')
        if ((epoch is not None and epoch != self.authority.epoch)
                or (instance_id is not None and instance_id != self.authority.instance_id)):
            raise ValueError('Workspace run belongs to another native owner epoch')
        self.authority.authorize(SessionActor(principal_id, str(self.home),
            frozenset({'session:read'}), 'workspace-authenticated-server'),
            SessionRef(str(self.home), session_id), 'session:read')

    def validate_session(self, session_id, principal_id):
        async def check():
            self.check_session(session_id, principal_id)
            return {'epoch': self.authority.epoch, 'instance_id': self.authority.instance_id}
        return self.call(check())

    def execute(self, write):
        """write(accept) runs off-loop; accept(check) executes atomically on-loop.

        The caller must hold its durable journal lock through Store commit and
        call accept only from Store.authorize AFTER its writer wait. Retirement
        before acceptance refuses; retirement after acceptance joins this actual
        tracked operation. Stop cannot acknowledge past the held journal first.
        """
        from gateway.session_runtime_workers import track_mutation, mutation_tasks
        async def operation():
            self.require_current()
            task = None
            def accept(check):
                async def accepted():
                    self.require_current()
                    active = {t for t in mutation_tasks(self.authority) if not t.done()}
                    if task not in active or active != {task}:
                        raise ValueError('Native mutation is still pending; retry finalization')
                    # No await between actual owner state, fixed grant validation
                    # and acceptance. Later retirement must join task through commit.
                    return check()
                return asyncio.run_coroutine_threadsafe(accepted(), self.loop).result(timeout=10)
            task = track_mutation(self.authority, asyncio.to_thread(write, accept))
            return await asyncio.shield(task)
        return self.call(operation())
