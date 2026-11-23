"""Session-scoped social reads and aggregations. No local data fallback or cache."""
from __future__ import annotations

import pandas as pd

from zahir_dashboard.backend import DashboardError, SegmentationRepository

ASPECTS = {
    'aspect_login_auth': 'Login & akses',
    'aspect_crash_stability': 'Stabilitas',
    'aspect_pricing_subscription': 'Harga & langganan',
    'aspect_sync_cloud_data': 'Sinkronisasi & data',
    'aspect_pos_hardware_print': 'POS & pencetakan',
    'aspect_inventory_accounting': 'Inventori & akuntansi',
    'aspect_certification_exam': 'Sertifikasi & ujian',
    'aspect_attendance_face': 'Absensi & wajah',
}
LABELS = ['negative', 'neutral', 'positive']
PREDICTIONS = {'IndoBERT': 'test_pred_indobert', 'InSet Lexicon': 'test_pred_inset_lexicon',
               'TF-IDF + LR': 'test_pred_tfidf_lr'}
TABLES = {
    'reviews': ('social_playstore_reviews', ['review_id'],
        ['review_id', 'review_date', 'app_name', 'score', 'human_sentiment_label', 'has_developer_reply', *ASPECTS]),
    'posts': ('social_instagram_posts', ['post_id'],
        ['post_id', 'post_date', 'post_day_of_week', 'post_hour_wib', 'content_type', 'likes', 'comments',
         'total_interactions', 'is_collaboration', 'caption_word_count', 'hashtag_count',
         'interaction_tier', 'percentile_rank', 'is_interaction_outlier']),
    'benchmarks': ('social_sentiment_benchmarks', ['model_name'],
        ['model_name', 'accuracy', 'macro_f1', 'test_support', 'coverage_rate']),
    'predictions': ('social_sentiment_test_predictions', ['review_id'],
        ['review_id', 'test_pred_indobert', 'test_indobert_confidence', 'test_pred_inset_lexicon',
         'test_inset_score', 'test_pred_tfidf_lr', 'test_tfidf_lr_confidence']),
    'clusters': ('social_topic_clusters_k4', ['kmeans_cluster_k4'], ['kmeans_cluster_k4', 'cluster_top_terms']),
    'assignments': ('social_topic_assignments_k4', ['review_id'], ['review_id', 'kmeans_cluster_k4']),
    'diagnostics': ('social_topic_clustering_metrics', ['num_clusters_k'],
        ['num_clusters_k', 'silhouette_score', 'inertia', 'algorithm', 'random_seed', 'coherence_assessment']),
    'quality': ('social_text_quality_summary', ['metric_category', 'metric_name'],
        ['metric_category', 'metric_name', 'value', 'unit_or_percentage']),
    'readiness': ('social_topic_readiness', ['evaluation_dimension', 'dimension_item'],
        ['evaluation_dimension', 'dimension_item', 'status_or_feasibility', 'key_evidence_and_rationale',
         'dependencies_and_size', 'recommended_role']),
    'scope': ('social_topic_scope_comparison', ['scope_name'],
        ['scope_name', 'sample_size_n', 'pct_of_gold_set', 'mean_words', 'median_words', 'min_words',
         'max_words', 'reviews_le_3_words', 'pct_le_3_words', 'reviews_le_5_words', 'pct_le_5_words',
         'duplicate_text_rows', 'pct_duplicates', 'analytical_trade_off']),
}
NUMERIC = set('score post_hour_wib likes comments total_interactions caption_word_count hashtag_count '
              'percentile_rank accuracy macro_f1 test_support coverage_rate test_indobert_confidence '
              'test_inset_score test_tfidf_lr_confidence kmeans_cluster_k4 num_clusters_k silhouette_score '
              'inertia random_seed value sample_size_n pct_of_gold_set mean_words median_words min_words '
              'max_words reviews_le_3_words pct_le_3_words reviews_le_5_words pct_le_5_words '
              'duplicate_text_rows pct_duplicates'.split())
BOOLEANS = {*ASPECTS, 'has_developer_reply', 'is_collaboration', 'is_interaction_outlier'}


class SocialRepository:
    def __init__(self, client):
        self.client = client
        self._authorized = False

    def authorize(self):
        self._authorized = False
        result = SegmentationRepository._execute(self.client.rpc('has_social_analytics_access'))
        if result.data is not True:
            raise DashboardError('Akun ini belum mendapat izin baca Analisis Media Sosial. Hubungi administrator.', 'access')
        self._authorized = True

    def read(self, key):
        if not self._authorized:
            raise DashboardError('Izin Analisis Media Sosial harus diverifikasi sebelum membaca data.', 'access')
        table, pk, columns = TABLES[key]
        rows, offset, expected = [], 0, None
        while True:
            query = self.client.schema('public').table(table).select(','.join(columns), count='exact')
            for col in pk:
                query = query.order(col)
            result = SegmentationRepository._execute(query.range(offset, offset + 199))
            if result.count is None or (expected is not None and result.count != expected):
                raise DashboardError('Cakupan data media sosial berubah saat dibaca. Silakan muat ulang.')
            expected = result.count
            batch = result.data or []
            rows.extend(batch)
            if len(rows) >= expected:
                break
            if not batch or len(rows) >= 50000:
                raise DashboardError('Data media sosial belum terbaca lengkap. Periksa cakupan dan izin database.')
            offset += len(batch)
        frame = pd.DataFrame(rows, columns=columns)
        if len(rows) != expected or any(set(row) != set(columns) for row in rows):
            raise DashboardError(f'Skema atau cakupan {table} tidak sesuai.', 'schema')
        if frame.empty:
            raise DashboardError(f'Tidak ada data yang dapat dibaca dari {table}. Periksa isi tabel dan izin baris.', 'access')
        if frame[pk].isna().any().any() or frame.duplicated(pk).any():
            raise DashboardError(f'Kunci {table} kosong atau berulang.', 'schema')
        for col in columns:
            nullable = key == 'predictions' and col != 'review_id'
            if not nullable and frame[col].isna().any():
                raise DashboardError(f'Kolom {col} pada {table} belum lengkap.', 'schema')
            if col in NUMERIC:
                try:
                    values = pd.to_numeric(frame[col], errors='raise')
                    if values.dropna().map(lambda n: not float('-inf') < float(n) < float('inf')).any():
                        raise ValueError()
                    frame[col] = values
                except (ValueError, TypeError):
                    raise DashboardError(f'Kolom angka {col} pada {table} tidak valid.', 'schema') from None
            elif col in BOOLEANS:
                if not frame[col].map(lambda value: isinstance(value, bool)).all():
                    raise DashboardError(f'Kolom boolean {col} pada {table} tidak valid.', 'schema')
            elif col in ('review_date', 'post_date'):
                try:
                    frame[col] = pd.to_datetime(frame[col], format='%Y-%m-%d', errors='raise').dt.date
                except (TypeError, ValueError):
                    raise DashboardError(f'Tanggal {col} pada {table} tidak valid.', 'schema') from None
        for col in ['human_sentiment_label', *PREDICTIONS.values()]:
            if col in frame and not frame[col].dropna().isin(LABELS).all():
                raise DashboardError(f'Label sentimen {col} tidak valid.', 'schema')
        if key == 'posts' and not (frame.likes + frame.comments).eq(frame.total_interactions).all():
            raise DashboardError('Total interaksi Instagram tidak sama dengan likes + komentar.', 'schema')
        return frame

    def load(self):
        self.authorize()
        data = {key: self.read(key) for key in TABLES}
        for child in ['predictions', 'assignments']:
            if not data[child].review_id.isin(data['reviews'].review_id).all():
                raise DashboardError('Relasi ulasan media sosial belum lengkap dalam cakupan izin pengguna.', 'access')
        if not data['assignments'].kmeans_cluster_k4.isin(data['clusters'].kmeans_cluster_k4).all():
            raise DashboardError('Relasi klaster eksploratif belum lengkap.', 'schema')
        return data


def filter_rows(frame, date_col, dates, category_col, selected):
    if len(dates) != 2:
        return frame.iloc[0:0].copy()
    return frame.loc[frame[date_col].between(*dates) & frame[category_col].isin(selected)].copy()


def aspect_sentiments(reviews):
    return pd.DataFrame([
        {'Aspek': label, 'Sentimen ulasan': sentiment,
         'Jumlah': int((reviews[col] & reviews.human_sentiment_label.eq(sentiment)).sum())}
        for col, label in ASPECTS.items() for sentiment in LABELS
    ])


def top_posts(posts, limit=10):
    result = posts.sort_values(['total_interactions', 'post_id'], ascending=[False, True]).head(limit).copy()
    result.insert(0, 'Peringkat', range(1, len(result) + 1))
    return result


def confusion_matrix(predictions, reviews, prediction_col):
    joined = predictions.merge(reviews[['review_id', 'human_sentiment_label']], on='review_id', validate='one_to_one')
    matrix = pd.crosstab(joined.human_sentiment_label, joined[prediction_col]).reindex(
        index=LABELS, columns=LABELS, fill_value=0)
    matrix.index.name, matrix.columns.name = 'Label manusia', 'Prediksi'
    return matrix, int(joined[prediction_col].notna().sum()), len(joined)


def snapshot_checks(data):
    reviews, posts = data['reviews'], data['posts']
    actual = [len(reviews), int(reviews[list(ASPECTS)].sum().sum()), len(posts), int(posts.total_interactions.sum())]
    return pd.DataFrame({'Pemeriksaan': ['Ulasan Google Play', 'Pasangan ulasan–aspek',
                                         'Postingan Instagram', 'Total interaksi Instagram'],
                         'Terbaca': actual, 'Acuan snapshot': [417, 234, 55, 13147],
                         'Sesuai': [v == e for v,e in zip(actual, [417, 234, 55, 13147])]})
