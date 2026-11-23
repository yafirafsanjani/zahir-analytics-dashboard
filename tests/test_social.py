"""Synthetic social regression and session/authorization UI tests; no Supabase writes."""
from datetime import date
from pathlib import Path
from types import SimpleNamespace as NS
import unittest

import pandas as pd
from streamlit.testing.v1 import AppTest

from test_dashboard import FakeClient
from synthetic_social import synthetic_tables
from zahir_dashboard.backend import DashboardError
from zahir_dashboard.social_backend import (
    ASPECTS, PREDICTIONS, TABLES, SocialRepository, aspect_sentiments,
    confusion_matrix, filter_rows, snapshot_checks, top_posts,
)

ROOT = Path(__file__).resolve().parents[1]


class SocialClient(FakeClient):
    def __init__(self, social_allowed=True, segmentation_allowed=True, signed_in=True):
        super().__init__(allowed=segmentation_allowed, signed_in=signed_in)
        self.social_allowed = social_allowed
        self.rpc_calls = []
        self.tables.update(synthetic_tables())

    def rpc(self, name):
        self.rpc_calls.append(name)
        if name == 'has_social_analytics_access':
            return NS(execute=lambda: NS(data=self.social_allowed))
        return super().rpc(name)


class SocialBackendTests(unittest.TestCase):
    def test_snapshot_totals_aspects_and_pagination(self):
        client = SocialClient()
        data = SocialRepository(client).load()
        self.assertEqual(snapshot_checks(data).Terbaca.tolist(), [205, 172, 9, 64])
        self.assertFalse(snapshot_checks(data).Sesuai.any())
        self.assertEqual(data['reviews'].human_sentiment_label.value_counts().to_dict(),
                         {'negative':69,'neutral':68,'positive':68})
        self.assertEqual(int(data['reviews'][list(ASPECTS)].any(axis=1).sum()),137)
        self.assertEqual(data['posts'][['likes','comments','total_interactions']].sum().tolist(), [55,9,64])
        self.assertEqual(int(aspect_sentiments(data['reviews']).Jumlah.sum()),172)
        self.assertEqual(len(data['assignments']),16)
        pages = [q for q in client.queries if q.table_name=='social_playstore_reviews']
        self.assertEqual([q.start for q in pages],[0,200])
        self.assertTrue(all(q.orders==['review_id'] for q in pages))

    def test_authorization_before_reads_and_revocation(self):
        client = SocialClient(social_allowed=False)
        repo = SocialRepository(client)
        with self.assertRaises(DashboardError): repo.read('reviews')
        with self.assertRaises(DashboardError): repo.load()
        self.assertEqual(client.queries,[])
        client.social_allowed=True
        repo.load()
        client.queries.clear()
        client.social_allowed=False
        with self.assertRaises(DashboardError): repo.load()
        self.assertEqual(client.queries,[])

    def test_empty_rls_bad_schema_and_orphan_fail_closed(self):
        for mutate in [
            lambda c: c.tables.update(social_playstore_reviews=[]),
            lambda c: c.tables['social_instagram_posts'][0].update(total_interactions=0),
            lambda c: c.tables['social_topic_assignments_k4'][0].update(review_id='orphan'),
        ]:
            client=SocialClient(); mutate(client)
            with self.assertRaises(DashboardError): SocialRepository(client).load()

    def test_confusion_nullable_coverage_and_no_majority(self):
        client=SocialClient()
        client.tables['social_sentiment_test_predictions'][0]['test_pred_indobert']=None
        data=SocialRepository(client).load()
        matrix,available,total=confusion_matrix(data['predictions'],data['reviews'],PREDICTIONS['IndoBERT'])
        self.assertEqual((available,total,int(matrix.to_numpy().sum())),(11,12,11))
        for model,col in PREDICTIONS.items():
            matrix,_,total=confusion_matrix(data['predictions'],data['reviews'],col)
            self.assertEqual(matrix.shape,(3,3));self.assertEqual(total,12)
        self.assertEqual(len(PREDICTIONS),3)

    def test_filter_and_top_rank_recomputed(self):
        data=SocialRepository(SocialClient()).load()
        posts=data['posts']
        image=filter_rows(posts,'post_date',(date(2024,1,1),date(2027,1,1)),'content_type',['image'])
        top=top_posts(image)
        self.assertEqual(len(top),3)
        self.assertEqual(top.Peringkat.tolist(),[1,2,3])
        self.assertEqual(top.total_interactions.tolist(),[8,5,4])
        self.assertTrue(filter_rows(posts,'post_date',(date(2000,1,1),date(2000,1,2)),
                                    'content_type',list(posts.content_type.unique())).empty)
        self.assertTrue(filter_rows(posts,'post_date',(date(2024,1,1),date(2027,1,1)),
                                    'content_type',[]).empty)


class SocialUITests(unittest.TestCase):
    def app(self,client):
        app=AppTest.from_file(str(ROOT/'app.py'),default_timeout=30)
        app.secrets['supabase']=dict(url='https://example.supabase.co',publishable_key='sb_publishable_test')
        app.session_state['_supabase_client']=client
        app.session_state['analytics_page']='Analisis Media Sosial'
        return app

    def test_full_page_and_three_models(self):
        client=SocialClient(segmentation_allowed=False)
        app=self.app(client).run()
        self.assertEqual(len(app.exception),0)
        self.assertEqual([t.label for t in app.tabs],['Play Store','Instagram','Evaluasi & Eksplorasi'])
        values={m.label:m.value for m in app.metric}
        self.assertEqual(values['Jumlah Ulasan'],'205')
        self.assertEqual(values['Sentimen Dominan'],'Negatif (33.7%)')
        self.assertEqual(values['Jumlah postingan'],'9')
        self.assertEqual(values['Total interaksi'],'64')
        self.assertNotIn('has_segmentation_access',client.rpc_calls)
        for model in ['InSet Lexicon','TF-IDF + LR']:
            app.selectbox(key='social_cm_model').select(model).run()
            self.assertEqual(len(app.exception),0)
        app.radio(key='analytics_page').set_value('Segmentasi Pelanggan').run()
        self.assertTrue(any('izin' in x.value for x in app.error))

    def test_ui_empty_filter_and_filtered_ranking(self):
        app=self.app(SocialClient()).run()
        app.multiselect(key='social_ig_categories').set_value(['image']).run()
        self.assertEqual(len(app.exception),0)
        self.assertEqual(next(m.value for m in app.metric if m.label=='Jumlah postingan'),'3')
        app.multiselect(key='social_gp_categories').set_value([]).run()
        self.assertTrue(any('Tidak ada data yang cocok' in x.value for x in app.info))
        self.assertEqual(len(app.exception),0)

    def test_denial_connection_and_no_session(self):
        client=SocialClient(social_allowed=False)
        app=self.app(client).run()
        self.assertEqual(len(app.exception),0)
        self.assertEqual(client.queries,[])
        self.assertTrue(any('izin baca Analisis Media Sosial' in x.value for x in app.error))
        client=SocialClient()
        def fail(name):
            return NS(execute=lambda: (_ for _ in ()).throw(RuntimeError('secret must not leak')))
        client.rpc=fail
        app=self.app(client).run()
        self.assertEqual(len(app.exception),0)
        self.assertTrue(any('belum dapat dihubungi' in x.value for x in app.error))
        self.assertFalse(any('secret must not leak' in x.value for x in app.error))
        client=SocialClient(signed_in=False)
        app=self.app(client).run()
        self.assertEqual(client.queries,[])
        self.assertEqual(len(app.metric),0)

    def test_switch_preserves_segmentation_and_logout(self):
        client=SocialClient()
        app=self.app(client).run()
        app.radio(key='analytics_page').set_value('Segmentasi Pelanggan').run()
        self.assertEqual(len(app.exception),0)
        self.assertEqual(app.metric[0].value,'1.456')
        app.radio(key='analytics_page').set_value('Analisis Media Sosial').run()
        next(b for b in app.button if b.label=='Keluar').click().run()
        self.assertEqual(len(app.metric),0)
        self.assertFalse(client.signed_in)


if __name__=='__main__':
    unittest.main()
