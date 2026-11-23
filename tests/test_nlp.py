"""Local NLP integration, browser-session isolation and login regressions."""
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
import threading
import zipfile

import pandas as pd
from streamlit.testing.v1 import AppTest
from test_dashboard import FakeClient
from zahir_dashboard.nlp_backend import NLPError, process_zip
from zahir_dashboard import nlp_assets
from zahir_dashboard.nlp_data import load_history, records_from_master

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / 'tests/fixtures/WhatsApp_Uji_Sintetis_Zahir.zip'


def result():
    return dict(session_id='s1', processing='local', filename='chat.zip',
                overview=dict(session_id='s1', dataset={'session_id': 's1'}, total_issues=1,
                              total_conversations=1, remote_cases=0, non_remote_cases=1,
                              unknown_remote_cases=0, remote_rate=0),
                issues=dict(session_id='s1', dataset={'session_id': 's1'}, total_issues=1,
                            categories=[dict(category='DATABASE_SYSTEM_ERROR', total_cases=1,
                                             percentage_of_total=100)]))


class LocalContractTests(unittest.TestCase):
    def test_input_and_missing_models_fail_clearly(self):
        for name, data in [('chat.txt', b'bad'), ('chat.zip', b'')]:
            with self.assertRaises(NLPError): process_zip(name, data)
        with tempfile.TemporaryDirectory() as folder, patch.object(nlp_assets, 'MODEL_ROOT', Path(folder)), patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(NLPError, 'nlp_models'):
                process_zip(FIXTURE.name, FIXTURE.read_bytes())


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
            process.side_effect = NLPError('Analisis lokal gagal')
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

    def test_upload_pipeline_populates_detail_and_filters_with_synthetic_fixture(self):
        uploaded = io.BytesIO(FIXTURE.read_bytes())
        uploaded.name = FIXTURE.name
        app = self.app()
        prediction = dict(predicted_category='DATABASE_SYSTEM_ERROR', confidence=91.0)
        with (
            patch('zahir_dashboard.nlp_assets.ensure_models'),
            patch('zahir_dashboard.nlp_core.inference_pipeline.load_inference_artifacts'),
            patch('zahir_dashboard.nlp_core.consolidation.predict_single_text', return_value=prediction),
            patch('zahir_dashboard.nlp_page.st.file_uploader', return_value=uploaded),
        ):
            app.run()
            next(b for b in app.button if b.label == 'Proses').click().run()
            self.assertFalse(app.exception)
            self.assertFalse(app.error)
            self.assertEqual([m.value for m in app.metric[:2]], ['3', '3'])
            self.assertEqual([t.label for t in app.tabs],
                             ['Ringkasan', 'Detail Percakapan', 'Analisis Kendala', 'Analisis Remote',
                              'Analisis Pelanggan', 'Tren Waktu', 'Tambah Data'])
            records = app.session_state['nlp_result']['records']
            self.assertEqual(len(records), 3)
            self.assertEqual(len({row['Pelanggan'] for row in records}), 3)
            self.assertNotIn('full_conversation', records[0])
            self.assertNotIn('source_file', records[0])
            self.assertTrue(app.session_state['nlp_result']['filename'].endswith('.zip'))
            next(item for item in app.multiselect if item.label == 'Penanganan').set_value(['Remote']).run()
            self.assertTrue(any('Tidak ada kendala' in element.value for element in app.info))
            next(b for b in app.button if b.label == 'Reset Filter').click().run()
            self.assertEqual([m.value for m in app.metric[:2]],['3','3'])
            next(b for b in app.button if b.label == 'Tinjau Data').click().run()
            self.assertEqual(app.session_state['nlp_tabs'],'Detail Percakapan')
            self.assertTrue(any(e.label=='Cari kode, kategori, atau pelanggan' for e in app.text_input))
            app.session_state['nlp_tabs']='Tambah Data'
            app.run()
            next(b for b in app.button if b.label=='Unggah File Lain').click().run()
            self.assertEqual(app.session_state['nlp_upload_status'],'ready')
            self.assertIn('nlp_result',app.session_state)

    def test_history_uses_internal_access_before_loading(self):
        frame = pd.DataFrame([dict(
            Kendala='K-0001', Percakapan='P-0001', Pelanggan='C-0001',
            Mulai=pd.Timestamp('2026-08-01'), Selesai=pd.Timestamp('2026-08-01'),
            Kategori='DATABASE_SYSTEM_ERROR', Penanganan='Remote', Kecocokan='Sesuai',
            **{'Respons klien': 'Merespons', 'Jumlah pesan': 4, 'Pesan klien': 2, 'Pesan admin': 2,
               'Ada media': 'Tidak', 'Indikasi kredensial': 'Tidak',
               'Kategori aturan': 'DATABASE_SYSTEM_ERROR', 'Skor model': 90.0},
        )])
        for allowed in (True, False):
            with self.subTest(allowed=allowed):
                app = self.app()
                app.session_state['_supabase_client'] = FakeClient(allowed=allowed)
                app.secrets['nlp_history'] = {'asset_id': '1234', 'sha256': '0' * 64}
                with patch('zahir_dashboard.nlp_page.load_history', return_value=frame) as load:
                    app.run()
                    self.assertFalse(app.exception)
                    if allowed:
                        self.assertFalse(app.error)
                        self.assertEqual(app.metric[0].value, '1')
                        self.assertEqual(app.radio(key='nlp_source').value, 'Data historis')
                        app.run()
                        load.assert_called_once()
                    else:
                        load.assert_not_called()
                        self.assertTrue(any('izin baca' in item.value for item in app.error))
                        self.assertNotIn('nlp_history_records', app.session_state)

    def test_private_snapshot_round_trip_keeps_only_dashboard_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            master = Path(directory) / 'master.csv'
            pd.DataFrame([dict(
                sub_conversation_id='sub-1', conversation_id='conv-1', source_file='Private customer.txt',
                start_time='01/08/26 12.00', penanganan_remote='REMOTE',
                kategori_kendala_ml_predicted='DATABASE_SYSTEM_ERROR',
                full_conversation='PRIVATE MESSAGE', client_response='RESPONS',
            )]).to_csv(master, index=False)
            exported = records_from_master(master)
            def download(client, repository, asset_id, token, destination, digest):
                exported.to_csv(destination, index=False)
            with patch('zahir_dashboard.nlp_data.download_asset', side_effect=download):
                frame = load_history({'asset_id': '1234', 'sha256': '0' * 64},
                                     {'repository': 'owner/models', 'read_token': 'test'})
            self.assertEqual(str(frame.iloc[0]['Mulai']), '2026-08-01 12:00:00')
            self.assertEqual(frame.iloc[0]['Pelanggan'], 'C-0001')
            self.assertNotIn('PRIVATE MESSAGE', frame.to_csv(index=False))
            self.assertNotIn('Private customer', frame.to_csv(index=False))

    def test_login_and_missing_file(self):
        app = self.app(False).run()
        self.assertEqual(len(app.get('file_uploader')), 0)
        self.assertEqual(len(app.metric), 0)
        app = self.app().run()
        next(b for b in app.button if b.label == 'Proses').click().run()
        self.assertTrue(any('Pilih file' in e.value for e in app.error))



@unittest.skipUnless((nlp_assets.MODEL_ROOT / 'best_model.pkl').exists(), 'Provision private model pair to .cache/nlp_models')
class LocalIntegrationTests(unittest.TestCase):
    app = NLPPageTests.app

    def test_real_processing_and_ui_without_any_http(self):
        file = io.BytesIO(FIXTURE.read_bytes()); file.name = FIXTURE.name
        app = self.app()
        # Model is provisioned, so even asset HTTP is forbidden during this test.
        with patch('httpx.Client', side_effect=AssertionError('No HTTP permitted')), patch('zahir_dashboard.nlp_page.st.file_uploader', return_value=file):
            app.run()
            next(b for b in app.button if b.label == 'Proses').click().run(timeout=120)
            self.assertFalse(app.exception)
            self.assertFalse(app.error)
            self.assertEqual(app.metric[0].value, '3')
            self.assertTrue(len(app.get('vega_lite_chart')))
            saved = app.session_state['nlp_result']
            self.assertEqual(saved['overview']['total_conversations'], 3)
            self.assertEqual(saved['issues']['total_issues'], 3)
            self.assertEqual(saved['overview']['session_id'], saved['session_id'])
            expected = json.loads((ROOT/'tests/fixtures/expected_nlp_summary.json').read_text())
            for key in ('overview', 'issues'):
                actual = {k:v for k,v in saved[key].items() if k not in ('session_id','dataset')}
                self.assertEqual(actual, expected[key])
            app.radio(key='analytics_page').set_value('Segmentasi Pelanggan').run()
            app.radio(key='analytics_page').set_value('NLP WhatsApp').run()
            self.assertEqual(app.session_state['nlp_result'], saved)
            file.seek(0); file.truncate(); file.write(b'invalid zip')
            next(b for b in app.button if b.label == 'Proses').click().run()
            self.assertTrue(app.error)
            self.assertEqual(app.session_state['nlp_result'], saved)
            other = self.app().run()
            self.assertEqual(len(other.metric), 0)
            self.assertNotIn('nlp_result', other.session_state)
            next(b for b in app.button if b.label == 'Keluar').click().run()
            self.assertNotIn('nlp_result', app.session_state)

    def test_parallel_submissions_are_isolated_and_temporary_files_removed(self):
        from zahir_dashboard.nlp_core import inference_pipeline
        original = inference_pipeline.analyze_uploaded_conversations
        barrier = threading.Barrier(2)
        workspaces = []
        def analyze(**kwargs):
            workspaces.append(kwargs['run_dir'])
            barrier.wait(timeout=30)
            return original(**kwargs)
        one = io.BytesIO()
        with zipfile.ZipFile(FIXTURE) as source, zipfile.ZipFile(one, 'w') as target:
            first = next(n for n in source.namelist() if n.endswith('.txt'))
            target.writestr(first, source.read(first))
        with patch.object(inference_pipeline, 'analyze_uploaded_conversations', side_effect=analyze), patch('httpx.Client', side_effect=AssertionError('No HTTP permitted')), patch('sklearn.feature_extraction.text.TfidfVectorizer.fit', side_effect=AssertionError('No fit')), patch('sklearn.feature_extraction.text.TfidfVectorizer.fit_transform', side_effect=AssertionError('No fit')), patch('sklearn.svm.LinearSVC.fit', side_effect=AssertionError('No training')):
            with ThreadPoolExecutor(max_workers=2) as pool:
                jobs = [pool.submit(process_zip, FIXTURE.name, FIXTURE.read_bytes()), pool.submit(process_zip, 'one.zip', one.getvalue())]
                a, b = [job.result() for job in jobs]
        self.assertEqual((a['overview']['total_conversations'], a['issues']['total_issues']), (3, 3))
        self.assertEqual((b['overview']['total_conversations'], b['issues']['total_issues']), (1, 1))
        self.assertNotEqual(a['session_id'], b['session_id'])
        self.assertEqual(len(set(workspaces)), 2)
        self.assertTrue(all(not path.exists() for path in workspaces))

    def test_failed_processing_cleans_workspace_and_does_not_modify_models(self):
        from zahir_dashboard.nlp_core import inference_pipeline
        import hashlib
        before = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in nlp_assets.MODEL_ROOT.glob('*.pkl')}
        workspaces = []
        def fail(**kwargs):
            workspaces.append(kwargs['run_dir'])
            raise RuntimeError('failure details should not leak')
        with patch.object(inference_pipeline, 'analyze_uploaded_conversations', side_effect=fail):
            with self.assertRaisesRegex(NLPError, 'Analisis NLP lokal gagal'):
                process_zip(FIXTURE.name, FIXTURE.read_bytes())
        self.assertTrue(all(not p.exists() for p in workspaces))
        self.assertEqual(before, {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in nlp_assets.MODEL_ROOT.glob('*.pkl')})


if __name__ == '__main__': unittest.main()
