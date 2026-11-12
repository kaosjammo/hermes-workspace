"""Exact-baseline plugin Store + two-database journal upgrade, synthetic only.

No legacy Workflow/native-owner module or private Hermes import is executed.
The baseline Store source is read at the immutable submitted commit; its format
is seeded through its normal Store methods, with the baseline journal schema.
"""
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import types
import unittest
from unittest.mock import patch
from hermes_state import SessionDB
from workspace_plugin.public_runs import PublicRuns
from workspace_plugin.identity import human_id

BASELINE='3eeb9986101a3d75c4f9cddc26bb5a3e31bcb9f5'


class LegacyUpgradeTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.home=Path(self.tmp.name)/'profiles'/'alpha';self.home.mkdir(parents=True)
        self.db=SessionDB(self.home/'state.db');self.db.create_session('legacy-thread',source='local')
        root=Path(__file__).resolve().parents[1]
        source=subprocess.run(['git','--no-optional-locks','-C',str(root),'show',BASELINE+':workspace_plugin/store.py'],
            env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'},check=True,capture_output=True).stdout
        module=types.ModuleType('workspace_plugin._baseline_upgrade_fixture');module.__package__='workspace_plugin'
        module.__file__=str(root/'workspace_plugin/store.py')
        exec(compile(source,module.__file__,'exec'),module.__dict__)
        self.old=module.Store(self.home)
        self.page=self.old.execute('create_item',{'kind':'page','title':'Legacy page','content':'<p>Before baseline run.</p>'})
        self.comments=[self.old.execute('add_comment',{'item_id':self.page['id'],'text':t}) for t in ['First request','Second request']]
        self.run=self.old.begin_run(self.page['id'],'legacy-thread')
        edits=[{'item_id':self.page['id'],'patch':{'content':'<p>Accepted baseline partial work.</p>'}}]
        replies=[{'comment_id':self.comments[0]['id'],'text':'Accepted baseline partial outcome.'}]
        digest=hashlib.sha256(json.dumps([edits,replies],sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()).hexdigest()
        self.old.apply_run(self.run['id'],edits,replies,operation_id=digest,operation_digest=digest)
        self.before=self.old.backup_snapshot()
        self.legacy=self.old.root/'workflow.sqlite3'
        with closing(sqlite3.connect(self.legacy)) as conn, conn:
            conn.execute('CREATE TABLE run_context (run_id TEXT PRIMARY KEY, body TEXT NOT NULL)')
            conn.execute('CREATE TABLE run_review (id TEXT PRIMARY KEY, body TEXT NOT NULL)')
            body={'prompt':'Synthetic exact baseline prompt','revoked':False,'outcomes':[self.comments[0]['id']],
                'admission_id':'legacy-private-address','native_epoch':'synthetic-baseline-epoch','initial_reply_ids':[], 'operations':[digest]}
            conn.execute('INSERT INTO run_context VALUES (?,?)',(self.run['id'],json.dumps(body)))
            conn.execute('INSERT INTO run_review VALUES (?,?)',('legacy-review',json.dumps({'legacy':'must not become a public grant'})))
        with closing(sqlite3.connect(self.old.db_path)) as conn:
            self.assertEqual(conn.execute("SELECT name FROM sqlite_master WHERE name IN ('run_context','run_review')").fetchall(),[])
        self.legacy_hash=hashlib.sha256(self.legacy.read_bytes()).hexdigest()

    def tearDown(self):
        self.db.close();self.tmp.cleanup()

    def assert_partial_history_retained(self, flow):
        state=flow.store.backup_snapshot()
        self.assertEqual(state['items'][0]['content'],'<p>Accepted baseline partial work.</p>')
        self.assertEqual(state['versions'],self.before['versions'])
        self.assertEqual(state['comments'][0]['replies'],self.before['comments'][0]['replies'])
        self.assertFalse(any(c['resolved'] for c in state['comments']))
        self.assertEqual(hashlib.sha256(self.legacy.read_bytes()).hexdigest(),self.legacy_hash)

    def test_status_and_explicit_recovery_unlock_baseline_pair_without_migrating_grants(self):
        flow=PublicRuns(self.home)
        status=flow.status(self.run['id'])
        self.assertEqual(status['run']['status'],'running')
        self.assertEqual(status['native_terminal'],'UNKNOWN')
        self.assertTrue(status['recovery_required'])
        self.assert_partial_history_retained(flow)
        with self.assertRaises(ValueError):flow.store.execute('update_item',{'id':self.page['id'],'patch':{'title':'Locked'}})
        self.assertEqual(flow.consume(self.run['id'],principal_id=human_id(self.home))['native_terminal'],'UNKNOWN')
        with self.assertRaises(ValueError):flow.pre(session_id='legacy-thread',task_id='legacy-task',turn_id='legacy-turn',user_message='Synthetic exact baseline prompt')
        recovered=flow.recover(self.run['id'])
        self.assertEqual(recovered['run']['status'],'error');self.assertEqual(recovered['native_terminal'],'UNKNOWN')
        self.assert_partial_history_retained(flow)
        restarted=PublicRuns(self.home)
        self.assertEqual(restarted.status(self.run['id'])['run']['status'],'error')
        self.assertFalse(restarted.status(self.run['id'])['recovery_required'])
        restarted.store.execute('update_item',{'id':self.page['id'],'patch':{'title':'Editable after recovery'}})
        before=restarted.store.backup_snapshot()
        with self.assertRaises(ValueError):restarted.end(session_id='legacy-thread',task_id='legacy-task',turn_id='legacy-turn',completed=True,failed=False,interrupted=False,turn_exit_reason='text_response(finish_reason=stop)')
        with self.assertRaises(ValueError):restarted.apply_call({'run_id':self.run['id'],'edits':[],'replies':[], '_workspace_call':'legacy-private-address'},session_id='legacy-thread',task_id='legacy-task')
        self.assertEqual(restarted.store.backup_snapshot(),before)
        restarted.store.execute('restore_version',{'id':self.run['version_ids'][0]})
        self.assertEqual(restarted.store.snapshot()['items'][0]['content'],'<p>Before baseline run.</p>')
        self.assertEqual(restarted.store.snapshot()['comments'][0]['replies'],self.before['comments'][0]['replies'])

    def test_recovery_effects_receipts_and_unlock_rollback_together_and_restart_retries(self):
        flow=PublicRuns(self.home);flow.status(self.run['id']);before=flow.store.backup_snapshot()
        with patch.object(flow.store,'finish_run',side_effect=ValueError('Synthetic retire failure')):
            with self.assertRaises(ValueError):flow.recover(self.run['id'])
        self.assertEqual(flow.store.backup_snapshot(),before)
        with self.assertRaises(ValueError):flow.store.execute('update_item',{'id':self.page['id'],'patch':{'title':'Still locked'}})
        recovered=PublicRuns(self.home).recover(self.run['id'])
        self.assertEqual(recovered['native_terminal'],'UNKNOWN');self.assertEqual(recovered['run']['status'],'error')
        self.assert_partial_history_retained(flow)

    def test_legacy_stop_has_local_recovery_without_trusting_private_cancel_address(self):
        flow=PublicRuns(self.home);stopped=flow.stop(self.run['id'])
        self.assertEqual(stopped['run']['status'],'cancelled');self.assertEqual(stopped['native_terminal'],'UNKNOWN')
        self.assertNotIn('control',stopped)
        self.assert_partial_history_retained(flow)
        flow.store.execute('update_item',{'id':self.page['id'],'patch':{'title':'Locally stopped'}})

    def test_unknown_run_still_refuses_and_never_creates_a_save_grant(self):
        flow=PublicRuns(self.home)
        with self.assertRaises(ValueError):flow.status('unknown-run')
