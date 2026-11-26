import test from 'node:test';
import assert from 'node:assert/strict';

const ASPECTS = {
  aspect_login_auth: "Login & akses",
  aspect_crash_stability: "Stabilitas",
  aspect_pricing_subscription: "Harga & langganan",
  aspect_sync_cloud_data: "Sinkronisasi & data",
  aspect_pos_hardware_print: "POS & pencetakan",
  aspect_inventory_accounting: "Inventori & akuntansi",
  aspect_certification_exam: "Sertifikasi & ujian",
  aspect_attendance_face: "Absensi & wajah",
};

const LABELS = ["negative", "neutral", "positive"];

function calculateAspectSentiments(reviews) {
  const items = [];
  for (const [colKey, label] of Object.entries(ASPECTS)) {
    for (const sent of LABELS) {
      const count = reviews.filter((r) => Boolean(r[colKey]) && r.human_sentiment_label === sent).length;
      items.push({
        aspek: label,
        sentimen: sent === 'positive' ? 'Positif' : sent === 'neutral' ? 'Netral' : 'Negatif',
        jumlah: count,
      });
    }
  }
  return items;
}

function getTopPosts(posts, limit = 10) {
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

function computeConfusionMatrix(predictions, reviews, predField) {
  const reviewMap = new Map();
  for (const r of reviews) {
    reviewMap.set(r.review_id, r.human_sentiment_label);
  }
  const matrix = {
    negative: { negative: 0, neutral: 0, positive: 0 },
    neutral: { negative: 0, neutral: 0, positive: 0 },
    positive: { negative: 0, neutral: 0, positive: 0 },
  };
  let available = 0;
  for (const p of predictions) {
    const humanLabel = reviewMap.get(p.review_id);
    const predValue = p[predField];
    if (humanLabel && predValue && LABELS.includes(predValue)) {
      if (matrix[humanLabel] && matrix[humanLabel][predValue] !== undefined) {
        matrix[humanLabel][predValue]++;
        available++;
      }
    }
  }
  return { matrix, available, total: predictions.length };
}

function computeSocialSnapshotChecks(data) {
  const { reviews, posts } = data;
  let totalAspectPairs = 0;
  for (const r of reviews) {
    for (const key of Object.keys(ASPECTS)) {
      if (r[key]) totalAspectPairs++;
    }
  }
  const totalInteractions = posts.reduce((sum, p) => sum + p.total_interactions, 0);
  return [
    { pemeriksaan: "Ulasan Google Play", terbaca: reviews.length, acuan: 417, sesuai: reviews.length === 417 },
    { pemeriksaan: "Pasangan ulasan–aspek", terbaca: totalAspectPairs, acuan: 234, sesuai: totalAspectPairs === 234 },
    { pemeriksaan: "Postingan Instagram", terbaca: posts.length, acuan: 55, sesuai: posts.length === 55 },
    { pemeriksaan: "Total interaksi Instagram", terbaca: totalInteractions, acuan: 13147, sesuai: totalInteractions === 13147 },
  ];
}

test('calculateAspectSentiments aggregates across aspects and sentiments correctly', () => {
  const sampleReviews = [
    { review_id: '1', human_sentiment_label: 'positive', aspect_login_auth: true, aspect_crash_stability: false },
    { review_id: '2', human_sentiment_label: 'negative', aspect_login_auth: true, aspect_crash_stability: true },
    { review_id: '3', human_sentiment_label: 'neutral', aspect_login_auth: false, aspect_crash_stability: true },
  ];
  const results = calculateAspectSentiments(sampleReviews);
  const loginPos = results.find(r => r.aspek === 'Login & akses' && r.sentimen === 'Positif');
  const loginNeg = results.find(r => r.aspek === 'Login & akses' && r.sentimen === 'Negatif');
  const crashNeg = results.find(r => r.aspek === 'Stabilitas' && r.sentimen === 'Negatif');
  assert.equal(loginPos.jumlah, 1);
  assert.equal(loginNeg.jumlah, 1);
  assert.equal(crashNeg.jumlah, 1);
});

test('getTopPosts correctly ranks posts and breaks ties deterministically', () => {
  const samplePosts = [
    { post_id: 'post_B', total_interactions: 500 },
    { post_id: 'post_A', total_interactions: 500 },
    { post_id: 'post_C', total_interactions: 800 },
    { post_id: 'post_D', total_interactions: 100 },
  ];
  const top = getTopPosts(samplePosts, 3);
  assert.equal(top.length, 3);
  assert.equal(top[0].post_id, 'post_C');
  assert.equal(top[0].peringkat, 1);
  assert.equal(top[1].post_id, 'post_A'); // Tie broken alphabetically
  assert.equal(top[1].peringkat, 2);
  assert.equal(top[2].post_id, 'post_B');
  assert.equal(top[2].peringkat, 3);
});

test('computeConfusionMatrix builds a 3x3 matrix accurately', () => {
  const reviews = [
    { review_id: 'r1', human_sentiment_label: 'positive' },
    { review_id: 'r2', human_sentiment_label: 'negative' },
    { review_id: 'r3', human_sentiment_label: 'neutral' },
  ];
  const predictions = [
    { review_id: 'r1', test_pred_indobert: 'positive' },
    { review_id: 'r2', test_pred_indobert: 'neutral' }, // misclassified
    { review_id: 'r3', test_pred_indobert: 'neutral' },
    { review_id: 'r4', test_pred_indobert: null }, // no prediction
  ];
  const res = computeConfusionMatrix(predictions, reviews, 'test_pred_indobert');
  assert.equal(res.available, 3);
  assert.equal(res.total, 4);
  assert.equal(res.matrix.positive.positive, 1);
  assert.equal(res.matrix.negative.neutral, 1);
  assert.equal(res.matrix.neutral.neutral, 1);
});

test('computeSocialSnapshotChecks matches target baseline when snapshot values match', () => {
  const dummyReviews = new Array(417).fill(null).map((_, i) => ({
    review_id: `rev_${i}`,
    aspect_login_auth: i < 234, // Exactly 234 pairs
  }));
  const dummyPosts = new Array(55).fill(null).map((_, i) => ({
    post_id: `post_${i}`,
    total_interactions: i === 0 ? 13147 : 0,
  }));
  const checks = computeSocialSnapshotChecks({ reviews: dummyReviews, posts: dummyPosts });
  assert.equal(checks.length, 4);
  assert.ok(checks.every(c => c.sesuai === true), 'All snapshot targets should match');
});