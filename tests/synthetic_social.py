"""Invented fixtures only. Never read the private social handoff exports."""
from zahir_dashboard.social_backend import ASPECTS, BOOLEANS, NUMERIC, TABLES


def synthetic_tables():
    tables = {}
    for key, (table, _, columns) in TABLES.items():
        tables[table] = [{col: False if col in BOOLEANS else 1 if col in NUMERIC else 'Synthetic demo'
                          for col in columns}]
    reviews = []
    for i in range(205):
        reviews.append(dict(review_id=f'synthetic-review-{i:03}', review_date='2026-01-15',
                            app_name=f'Demo App {i % 2 + 1}', score=i % 5 + 1,
                            human_sentiment_label=['negative', 'neutral', 'positive'][i % 3],
                            has_developer_reply=i % 2 == 0,
                            **{col: (i % 2 == 0 if j == 0 else i % 3 == 0 if j == 1 else False)
                               for j, col in enumerate(ASPECTS)}))
    tables[TABLES['reviews'][0]] = reviews
    posts = []
    for i, total in enumerate([8, 5, 4, 12, 10, 6, 9, 7, 3]):
        posts.append(dict(post_id=f'synthetic-post-{i}', post_date='2026-01-15',
                          post_day_of_week='Thursday', post_hour_wib=9+i,
                          content_type=['image', 'reel', 'carousel'][i // 3],
                          likes=total-1, comments=1, total_interactions=total,
                          is_collaboration=i % 2 == 0, caption_word_count=10+i,
                          hashtag_count=i % 3, interaction_tier='Demo',
                          percentile_rank=10*i, is_interaction_outlier=False))
    tables[TABLES['posts'][0]] = posts
    tables[TABLES['predictions'][0]] = [
        dict(review_id=reviews[i]['review_id'], test_pred_indobert=reviews[i]['human_sentiment_label'],
             test_indobert_confidence=0.8, test_pred_inset_lexicon='neutral', test_inset_score=0,
             test_pred_tfidf_lr='positive', test_tfidf_lr_confidence=0.6) for i in range(12)]
    tables[TABLES['benchmarks'][0]] = [dict(model_name=name, accuracy=0.5, macro_f1=0.4,
                                          test_support=12, coverage_rate=1.0)
                                     for name in ['IndoBERT', 'InSet Lexicon', 'TF-IDF + LR', 'Majority']]
    tables[TABLES['clusters'][0]] = [dict(kmeans_cluster_k4=i, cluster_top_terms=f'synthetic topic {i}')
                                   for i in range(4)]
    tables[TABLES['assignments'][0]] = [dict(review_id=reviews[i]['review_id'], kmeans_cluster_k4=i % 4)
                                      for i in range(16)]
    tables[TABLES['diagnostics'][0]] = [dict(num_clusters_k=i, silhouette_score=0.1,
                                          inertia=100/i, algorithm='KMeans', random_seed=42,
                                          coherence_assessment='Synthetic') for i in range(3, 7)]
    return tables
