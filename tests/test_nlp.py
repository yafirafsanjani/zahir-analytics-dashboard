"""NLP API contract, transactional state and authenticated page regression tests."""
import io
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch

import httpx
from streamlit.testing.v1 import AppTest

from test_dashboard import FakeClient
from zahir_dashboard.nlp_backend import NLPError, api_url, process_zip

ROOT = Path(__file__).resolve().parents[1]


def result():
    return dict(session_id='s1', api_url='http://example.test', filename='chat.zip',
                overview=dict(session_id='s1', dataset={'session_id': 's1'}, total_issues=1,
                              total_conversations=1, remote_cases=0, non_remote_cases=1,
                              unknown_remote_cases=0, remote_rate=0),
                issues=dict(session_id='s1', dataset={'session_id': 's1'}, total_issues=1,
                            categories=[dict(category='DATABASE_SYSTEM_ERROR', total_cases=1,
                                             percentage_of_total=100)]))


class APIContractTests(unittest.TestCase):
    def test_contract_and_failures(self):
        for failure in (None, 'upload', 'analysis', 'empty', 'issues', 'session', 'json', 'connection', 'timeout'):
            calls = []
            def handler(req):
                calls.append(req)
                path = req.url.path
                if failure == 'connection':
                    raise httpx.ConnectError('private details', request=req)
                if failure == 'timeout':
                    raise httpx.ReadTimeout('private details', request=req)
                if failure == 'upload':
                    return httpx.Response(400, json={'detail': 'ZIP tidak valid'})
                if failure == 'json':
                    return httpx.Response(200, text='invalid')
                if path == '/api/upload':
                    self.assertIn(b'name="file"', req.content)
                    return httpx.Response(200, json={'success': True, 'session_id': 's1'})
                if path == '/api/analyze':
                    self.assertEqual(json.loads(req.content), {'session_id': 's1'})
                    return httpx.Response(200, json={'success': failure != 'analysis', 'status': 'failed' if failure == 'analysis' else 'completed', 'session_id': 's1'})
                self.assertEqual(req.url.params['session_id'], 's1')
                payload = result()['overview' if path == '/api/overview' else 'issues']
                if failure == 'issues' and path == '/api/issues':
                    return httpx.Response(503)
                if failure == 'empty':
                    payload['total_issues'] = 0
                    if 'categories' in payload: payload['categories'] = []
                if failure == 'session': payload['session_id'] = 'wrong'
                return httpx.Response(200, json=payload)
            factory = httpx.Client
            with patch('zahir_dashboard.nlp_backend.httpx.Client', side_effect=lambda **kw: factory(transport=httpx.MockTransport(handler), **kw)):
                if failure:
                    with self.assertRaises(NLPError): process_zip('http://example.test', 'chat.zip', b'zip')
                else:
                    self.assertEqual(process_zip('http://example.test', 'chat.zip', b'zip')['session_id'], 's1')
                    self.assertEqual([r.method for r in calls], ['POST','POST','GET','GET'])
            self.assertEqual(sum(r.url.path == '/api/upload' for r in calls), 1)

    def test_config_and_local_validation(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(api_url({}), 'http://127.0.0.1:8000')
            self.assertEqual(api_url({'nlp': {'api_base_url': 'http://localhost:8011/'}}), 'http://localhost:8011')
            with self.assertRaises(NLPError): api_url({'nlp': {'api_base_url': 'invalid'}})
        with patch.dict(os.environ, {'NLP_API_BASE_URL': 'http://localhost:8012'}):
            self.assertEqual(api_url({}), 'http://localhost:8012')
        with self.assertRaises(NLPError): process_zip('http://example.test', 'chat.txt', b'bad')


class NLPPageTests(unittest.TestCase):
    def app(self, signed_in=True):
        app = AppTest.from_file(str(ROOT/'app.py'), default_timeout=30)
        app.secrets['supabase'] = dict(url='https://example.supabase.co', publishable_key='sb_publishable_test')
        app.session_state['_supabase_client'] = FakeClient(signed_in=signed_in)
        app.session_state['analytics_page'] = 'NLP WhatsApp'
        return app

    def test_submit_rerun_failure_and_logout(self):
        uploaded = io.BytesIO(b'zip'); uploaded.name = 'chat.zip'
        app = self.app()
        with patch('zahir_dashboard.nlp_page.st.file_uploader', return_value=uploaded), patch('zahir_dashboard.nlp_page.process_zip', return_value=result()) as process:
            app.run()
            process.assert_not_called()
            next(b for b in app.button if b.label == 'Proses').click().run()
            self.assertEqual(len(app.exception), 0)
            self.assertEqual(app.metric[0].value, '1')
            self.assertEqual(app.session_state['nlp_result']['session_id'], 's1')
            self.assertTrue(len(app.get('vega_lite_chart')))
            app.run()
            self.assertEqual(process.call_count, 1)
            process.side_effect = NLPError('API tidak dapat dijangkau')
            next(b for b in app.button if b.label == 'Proses').click().run()
            self.assertTrue(app.error)
            self.assertEqual(app.metric[0].value, '1')
            self.assertEqual(app.session_state['nlp_result']['session_id'], 's1')
            app.radio(key='analytics_page').set_value('Segmentasi Pelanggan').run()
            self.assertEqual(app.metric[0].value, '1.456')
            app.radio(key='analytics_page').set_value('NLP WhatsApp').run()
            self.assertEqual(process.call_count, 2)
            next(b for b in app.button if b.label == 'Keluar').click().run()
            self.assertNotIn('nlp_result', app.session_state)
            self.assertEqual(len(app.metric), 0)

    def test_login_and_missing_file(self):
        app = self.app(False).run()
        self.assertEqual(len(app.get('file_uploader')), 0)
        self.assertEqual(len(app.metric), 0)
        app = self.app().run()
        next(b for b in app.button if b.label == 'Proses').click().run()
        self.assertTrue(any('Pilih file' in e.value for e in app.error))


@unittest.skipUnless(os.getenv('NLP_INTEGRATION_URL'), 'Set NLP_INTEGRATION_URL to an isolated backend')
class LiveIntegrationTests(unittest.TestCase):
    app = NLPPageTests.app
    def test_real_upload_to_display_and_rejection(self):
        root = ROOT/'tests/fixtures'
        uploaded = io.BytesIO((root/'WhatsApp_Uji_Sintetis_Zahir.zip').read_bytes())
        uploaded.name = 'WhatsApp_Uji_Sintetis_Zahir.zip'
        app = self.app()
        app.secrets['nlp'] = {'api_base_url': os.environ['NLP_INTEGRATION_URL']}
        with patch.dict(os.environ, {'NLP_API_BASE_URL': os.environ['NLP_INTEGRATION_URL']}), patch('zahir_dashboard.nlp_page.st.file_uploader', return_value=uploaded):
            app.run()
            next(b for b in app.button if b.label == 'Proses').click().run(timeout=180)
            self.assertFalse(app.exception)
            self.assertFalse(app.error)
            self.assertEqual(app.metric[0].value, '3')
            self.assertTrue(len(app.get('vega_lite_chart')))
            saved = app.session_state['nlp_result']
            self.assertEqual(len(app.dataframe[0].value), 3)
            uploaded.seek(0); uploaded.truncate(); uploaded.write(b'invalid zip')
            next(b for b in app.button if b.label == 'Proses').click().run()
            self.assertTrue(app.error)
            self.assertEqual(app.session_state['nlp_result'], saved)
            with patch.dict(os.environ, {'NLP_API_BASE_URL': 'http://127.0.0.1:1'}):
                next(b for b in app.button if b.label == 'Proses').click().run()
            self.assertTrue(any('tidak dapat dijangkau' in e.value for e in app.error))
            self.assertEqual(app.session_state['nlp_result'], saved)


if __name__ == '__main__': unittest.main()


