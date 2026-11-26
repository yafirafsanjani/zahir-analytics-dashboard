import {
  PlayStoreReview,
  InstagramPost,
  SentimentPrediction,
  SocialDataBundle,
  SocialSnapshotCheck,
} from "./types";

export const ASPECTS: Record<string, string> = {
  aspect_login_auth: "Login & akses",
  aspect_crash_stability: "Stabilitas",
  aspect_pricing_subscription: "Harga & langganan",
  aspect_sync_cloud_data: "Sinkronisasi & data",
  aspect_pos_hardware_print: "POS & pencetakan",
  aspect_inventory_accounting: "Inventori & akuntansi",
  aspect_certification_exam: "Sertifikasi & ujian",
  aspect_attendance_face: "Absensi & wajah",
};

export const LABELS: ("negative" | "neutral" | "positive")[] = [
  "negative",
  "neutral",
  "positive",
];

export const SENTIMENT_LABEL_MAP: Record<string, string> = {
  positive: "Positif",
  neutral: "Netral",
  negative: "Negatif",
};

export const SENTIMENT_COLORS: Record<string, string> = {
  Positif: "#15803D",
  Netral: "#64748B",
  Negatif: "#D2231C",
};

export const PREDICTION_MODELS: Record<string, string> = {
  IndoBERT: "test_pred_indobert",
  "InSet Lexicon": "test_pred_inset_lexicon",
  "TF-IDF + LR": "test_pred_tfidf_lr",
};

export interface AspectSentimentItem {
  aspek: string;
  sentimen: "Positif" | "Netral" | "Negatif";
  jumlah: number;
}

export function calculateAspectSentiments(
  reviews: PlayStoreReview[]
): AspectSentimentItem[] {
  const items: AspectSentimentItem[] = [];

  for (const [colKey, label] of Object.entries(ASPECTS)) {
    for (const sent of LABELS) {
      const count = reviews.filter((r) => {
        const hasAspect = Boolean((r as any)[colKey]);
        return hasAspect && r.human_sentiment_label === sent;
      }).length;

      items.push({
        aspek: label,
        sentimen: SENTIMENT_LABEL_MAP[sent] as any,
        jumlah: count,
      });
    }
  }

  return items;
}

export function getTopPosts(posts: InstagramPost[], limit = 10) {
  const sorted = [...posts].sort((a, b) => {
    if (b.total_interactions !== a.total_interactions) {
      return b.total_interactions - a.total_interactions;
    }
    return a.post_id.localeCompare(b.post_id);
  });

  return sorted.slice(0, limit).map((p, idx) => ({
    peringkat: idx + 1,
    ...p,
  }));
}

export interface ConfusionMatrixResult {
  matrix: Record<string, Record<string, number>>;
  available: number;
  total: number;
}

export function computeConfusionMatrix(
  predictions: SentimentPrediction[],
  reviews: PlayStoreReview[],
  predField: string
): ConfusionMatrixResult {
  const reviewMap = new Map<string, string>();
  for (const r of reviews) {
    reviewMap.set(r.review_id, r.human_sentiment_label);
  }

  const matrix: Record<string, Record<string, number>> = {
    negative: { negative: 0, neutral: 0, positive: 0 },
    neutral: { negative: 0, neutral: 0, positive: 0 },
    positive: { negative: 0, neutral: 0, positive: 0 },
  };

  let available = 0;
  for (const p of predictions) {
    const humanLabel = reviewMap.get(p.review_id);
    const predValue = (p as any)[predField];
    if (humanLabel && predValue && LABELS.includes(predValue)) {
      if (matrix[humanLabel] && matrix[humanLabel][predValue] !== undefined) {
        matrix[humanLabel][predValue]++;
        available++;
      }
    }
  }

  return {
    matrix,
    available,
    total: predictions.length,
  };
}

export function computeSocialSnapshotChecks(
  data: SocialDataBundle
): SocialSnapshotCheck[] {
  const { reviews, posts } = data;

  let totalAspectPairs = 0;
  for (const r of reviews) {
    for (const key of Object.keys(ASPECTS)) {
      if ((r as any)[key]) {
        totalAspectPairs++;
      }
    }
  }

  const totalInteractions = posts.reduce((sum, p) => sum + p.total_interactions, 0);

  return [
    {
      pemeriksaan: "Ulasan Google Play",
      terbaca: reviews.length,
      acuan: 417,
      sesuai: reviews.length === 417,
    },
    {
      pemeriksaan: "Pasangan ulasan–aspek",
      terbaca: totalAspectPairs,
      acuan: 234,
      sesuai: totalAspectPairs === 234,
    },
    {
      pemeriksaan: "Postingan Instagram",
      terbaca: posts.length,
      acuan: 55,
      sesuai: posts.length === 55,
    },
    {
      pemeriksaan: "Total interaksi Instagram",
      terbaca: totalInteractions,
      acuan: 13147,
      sesuai: totalInteractions === 13147,
    },
  ];
}
