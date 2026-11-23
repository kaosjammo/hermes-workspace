"""Bounded child environment plus real local PDF conversion, synthetic data."""
import io
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from pypdf import PdfReader
from workspace_plugin import interchange


class PDFWorkerEnvironment(unittest.TestCase):
    def test_child_drops_provider_and_python_injection_environment(self):
        with patch.dict(os.environ, {'SYNTHETIC_PROVIDER_TOKEN': 'not-a-real-secret',
                                     'PYTHONPATH': '/synthetic/untrusted-import', 'PYTHONSTARTUP': '/synthetic/startup'}):
            with patch.object(interchange.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout=b'fixture', stderr=b'')) as run:
                self.assertEqual(interchange._pdf_in_worker('export', b'{}'), b'fixture')
        args, kwargs = run.call_args
        self.assertEqual(args[0][0], sys.executable)
        self.assertIn('env', kwargs, 'PDF child must receive an explicit bounded environment')
        env = kwargs['env']
        self.assertNotIn('SYNTHETIC_PROVIDER_TOKEN', env)
        self.assertNotIn('PYTHONSTARTUP', env)
        self.assertNotIn('HERMES_HOME', env)
        self.assertEqual(env['PYTHONPATH'], str(Path(interchange.__file__).resolve().parent.parent))
        self.assertEqual(env['PATH'], os.defpath)
        self.assertEqual(env['PYTHONDONTWRITEBYTECODE'], '1')
        self.assertEqual(env['HOME'], os.environ['HOME'])
        self.assertEqual(env['TMPDIR'], os.environ['TMPDIR'])
        self.assertEqual(kwargs['timeout'], 20)
        self.assertEqual(kwargs['input'], b'{}')

    def test_real_pdf_export_import_preserves_readable_synthetic_text(self):
        output = interchange.export_document({'title': 'Synthetic PDF environment',
            'content': '<h1>Field notes</h1><p>Private synthetic fixture only.</p>'}, 'pdf')
        reader = PdfReader(io.BytesIO(output))
        self.assertIn('Field notes', '\n'.join(page.extract_text() for page in reader.pages))
        restored = interchange.import_file('synthetic.pdf', output)
        self.assertIn('Private synthetic fixture only.', restored['content'])
