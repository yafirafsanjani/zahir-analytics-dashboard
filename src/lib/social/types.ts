export interface PlayStoreReview {
  review_id: string;
  review_date: string;
  app_name: string;
  score: number;
  human_sentiment_label: "positive" | "neutral" | "negative";
  has_developer_reply: boolean;
  aspect_login_auth: boolean;
  aspect_crash_stability: boolean;
  aspect_pricing_subscription: boolean;
  aspect_sync_cloud_data: boolean;
  aspect_pos_hardware_print: boolean;
  aspect_inventory_accounting: boolean;
  aspect_certification_exam: boolean;
  aspect_attendance_face: boolean;
}

export interface InstagramPost {
  post_id: string;
  post_date: string;
  post_day_of_week: string;
  post_hour_wib: number;
  content_type: string;
  likes: number;
  comments: number;
  total_interactions: number;
  is_collaboration: boolean;
  caption_word_count: number;
  hashtag_count: number;
  interaction_tier: string;
  percentile_rank: number;
  is_interaction_outlier: boolean;
}

export interface SentimentBenchmark {
  model_name: string;
  accuracy: number;
  macro_f1: number;
  test_support: number;
  coverage_rate: number;
}

export interface SentimentPrediction {
  review_id: string;
  test_pred_indobert?: string;
  test_indobert_confidence?: number;
  test_pred_inset_lexicon?: string;
  test_inset_score?: number;
  test_pred_tfidf_lr?: string;
  test_tfidf_lr_confidence?: number;
}

export interface TopicCluster {
  kmeans_cluster_k4: number;
  cluster_top_terms: string;
}

export interface TopicAssignment {
  review_id: string;
  kmeans_cluster_k4: number;
}

export interface TopicDiagnostic {
  num_clusters_k: number;
  silhouette_score: number;
  inertia: number;
  algorithm: string;
  random_seed: number;
  coherence_assessment: string;
}

export interface TextQualitySummary {
  metric_category: string;
  metric_name: string;
  value: number;
  unit_or_percentage: string;
}

export interface TopicReadiness {
  evaluation_dimension: string;
  dimension_item: string;
  status_or_feasibility: string;
  key_evidence_and_rationale: string;
  dependencies_and_size: string;
  recommended_role: string;
}

export interface ScopeComparison {
  scope_name: string;
  sample_size_n: number;
  pct_of_gold_set: number;
  mean_words: number;
  median_words: number;
  min_words: number;
  max_words: number;
  reviews_le_3_words: number;
  pct_le_3_words: number;
  reviews_le_5_words: number;
  pct_le_5_words: number;
  duplicate_text_rows: number;
  pct_duplicates: number;
  analytical_trade_off: string;
}

export interface SocialDataBundle {
  reviews: PlayStoreReview[];
  posts: InstagramPost[];
  benchmarks: SentimentBenchmark[];
  predictions: SentimentPrediction[];
  clusters: TopicCluster[];
  assignments: TopicAssignment[];
  diagnostics: TopicDiagnostic[];
  quality: TextQualitySummary[];
  readiness: TopicReadiness[];
  scope: ScopeComparison[];
}

export interface SocialSnapshotCheck {
  pemeriksaan: string;
  terbaca: number;
  acuan: number;
  sesuai: boolean;
}
