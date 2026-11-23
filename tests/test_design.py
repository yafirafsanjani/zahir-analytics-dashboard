"""Optional-source metrics and native filter regressions for the shared UI."""
import unittest

from streamlit.testing.v1 import AppTest
from pathlib import Path
from test_dashboard import FakeClient
from zahir_dashboard.backend import SegmentationRepository
from zahir_dashboard.backend import DashboardError
from zahir_dashboard.segmentation_page import csv_bytes
from test_social import SocialClient


class OptionalMetricsTests(unittest.TestCase):
    def test_rfm_and_evaluation_only_when_available(self):
        client = FakeClient()
        repo = SegmentationRepository(client)
        choice = repo.discover_models()[0]
        self.assertNotIn('silhouette', repo.summary(choice)[0])
        for row in client.tables['segment_summary']:
            row.update(recency_mean=30, frequency_mean=3, monetary_mean=2000,
                       silhouette_score=0.5, davies_bouldin_score=0.7,
                       calinski_harabasz_score=100)
        repo = SegmentationRepository(client)
        choice = repo.discover_models()[0]
        summary = repo.summary(choice)
        self.assertEqual(summary[0]['recency'], 30)
        self.assertEqual(summary[0]['silhouette'], 0.5)
        app = AppTest.from_file(str(Path(__file__).resolve().parents[1] / 'app.py'), default_timeout=30)
        app.secrets['supabase'] = dict(url='https://example.supabase.co', publishable_key='sb_publishable_test')
        app.session_state['_supabase_client'] = client
        app.run()
        self.assertFalse(app.exception)
        tables = [element.value for element in app.dataframe]
        self.assertTrue(any('Recency' in frame for frame in tables))
        self.assertTrue(any('Davies–Bouldin' in frame for frame in tables))


class StitchInteractionTests(unittest.TestCase):
    def app(self, client=None, page='Segmentasi Pelanggan'):
        app=AppTest.from_file(str(Path(__file__).resolve().parents[1]/'app.py'),default_timeout=30)
        app.secrets['supabase']=dict(url='https://example.supabase.co',publishable_key='sb_publishable_test')
        app.session_state['_supabase_client']=client or SocialClient()
        app.session_state['analytics_page']=page
        return app.run()

    def test_segmentation_actions_configuration_and_export(self):
        app=self.app()
        self.assertFalse(app.exception)
        self.assertEqual([t.label for t in app.tabs],['Ikhtisar Segmen','Perbandingan Model','Detail Faktur'])
        next(b for b in app.button if b.label=='Bandingkan dengan Gaussian Mixture Model').click().run()
        self.assertEqual(app.session_state['segment_tab'],'Perbandingan Model')
        next(b for b in app.button if b.label=='Lihat Detail Faktur').click().run()
        self.assertEqual(app.session_state['segment_tab'],'Detail Faktur')
        app.selectbox(key='model_key').select('gmm_k3').run()
        self.assertEqual(app.session_state['algorithm_picker'],'gmm_k3')
        self.assertEqual(next(m.value for m in app.metric if m.label=='Klaster'),'3')
        app.checkbox(key='invoice_export_all').check().run()
        self.assertFalse(app.exception)
        self.assertTrue(app.get('download_button'))

    def test_export_matches_authorized_search_and_cluster(self):
        client=FakeClient();repo=SegmentationRepository(client)
        choice=repo.discover_models()[0];repo.discover_detail(choice)
        rows=repo.export_detail(choice,'Uji 000','C1')
        self.assertEqual(len(rows),10)
        self.assertTrue(all('Uji 000' in r['Nama perusahaan'] and r['Klaster']=='C1' for r in rows))
        self.assertEqual(len(repo.export_detail(choice,'')),60)
        self.assertTrue(csv_bytes([{'Nama':'=1+1'}]).decode('utf-8-sig').startswith("Nama\n'=1+1"))
        client.allowed=False;client.queries.clear()
        with self.assertRaises(DashboardError):repo.export_detail(choice,'')
        self.assertFalse(client.queries)

    def test_social_filters_reset_all_reviews_and_instagram_action(self):
        app=self.app(page='Analisis Media Sosial')
        app.multiselect(key='social_gp_rating').set_value([1]).run()
        self.assertEqual(next(m.value for m in app.metric if m.label=='Jumlah Ulasan'),'41')
        app.button(key='social_gp_reset').click().run()
        self.assertEqual(next(m.value for m in app.metric if m.label=='Jumlah Ulasan'),'205')
        app.button(key='social_all_reviews').click().run()
        self.assertTrue(app.session_state['social_reviews_all'])
        next(b for b in app.button if b.label=='Buka Tab').click().run()
        self.assertEqual(app.session_state['social_tab'],'Instagram')
        self.assertFalse(app.exception)

    def test_mobile_navigation_updates_real_page(self):
        app=self.app()
        app.radio(key='mobile_navigation').set_value('Analisis Media Sosial').run()
        self.assertEqual(app.session_state['analytics_page'],'Analisis Media Sosial')
        self.assertTrue(any(t.label=='Instagram' for t in app.tabs))
        self.assertFalse(app.exception)


if __name__ == '__main__':
    unittest.main()
