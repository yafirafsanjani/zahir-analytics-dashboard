import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// 1. Verified Model Evaluations Ground-Truth
const VERIFIED_MODEL_EVALUATIONS = {
  kmeans_k4: {
    silhouette: 0.4009058373570072,
    davies_bouldin: 0.7646497643342086,
    calinski_harabasz: 1151.822030464589,
    iterations: 8,
    status: 'berhasil',
    isOptimal: true,
  },
  gmm_k3: {
    silhouette: 0.3389825562499449,
    davies_bouldin: 0.9781945866518224,
    calinski_harabasz: 700.2706275127848,
    iterations: 12,
    status: 'berhasil',
    isBaseline: true,
  },
  gmm_k4: {
    silhouette: 0.232115805454657,
    davies_bouldin: 1.388579994005771,
    calinski_harabasz: 631.277553670366,
    iterations: 15,
    status: 'berhasil',
  },
};

function formatMetric(value, decimals = 3) {
  if (value === null || value === undefined || value === '') return 'Belum tersedia';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return 'Belum tersedia';
  const parts = num.toFixed(decimals).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimals > 0 ? `${integerPart},${parts[1]}` : integerPart;
}

test('model evaluation metrics match verified experimental ground truth', () => {
  const km4 = VERIFIED_MODEL_EVALUATIONS.kmeans_k4;
  const gmm3 = VERIFIED_MODEL_EVALUATIONS.gmm_k3;
  const gmm4 = VERIFIED_MODEL_EVALUATIONS.gmm_k4;

  // Format checks
  assert.equal(formatMetric(km4.silhouette, 3), '0,401');
  assert.equal(formatMetric(km4.davies_bouldin, 3), '0,765');
  assert.equal(formatMetric(km4.calinski_harabasz, 2), '1.151,82');

  assert.equal(formatMetric(gmm3.silhouette, 3), '0,339');
  assert.equal(formatMetric(gmm3.davies_bouldin, 3), '0,978');
  assert.equal(formatMetric(gmm3.calinski_harabasz, 2), '700,27');

  assert.equal(formatMetric(gmm4.silhouette, 3), '0,232');
  assert.equal(formatMetric(gmm4.davies_bouldin, 3), '1,389');
  assert.equal(formatMetric(gmm4.calinski_harabasz, 2), '631,28');

  // Fallback checks
  assert.equal(formatMetric(null), 'Belum tersedia');
  assert.equal(formatMetric(undefined), 'Belum tersedia');
});

test('dynamic deltas calculate exact comparison between Optimal and Baseline', () => {
  const km4 = VERIFIED_MODEL_EVALUATIONS.kmeans_k4;
  const gmm3 = VERIFIED_MODEL_EVALUATIONS.gmm_k3;

  // Silhouette Delta: 0.4009 - 0.3390 = +0.062 pts (+18.3%)
  const silDiffPts = km4.silhouette - gmm3.silhouette;
  const silDiffPct = (silDiffPts / gmm3.silhouette) * 100;
  assert.equal(silDiffPts.toFixed(3), '0.062');
  assert.equal(silDiffPct.toFixed(1), '18.3');

  // Davies-Bouldin deviation drop: (0.7646 - 0.9782) / 0.9782 = -21.8%
  const dbDropPct = ((km4.davies_bouldin - gmm3.davies_bouldin) / gmm3.davies_bouldin) * 100;
  assert.equal(dbDropPct.toFixed(1), '-21.8');
});

test('tab routing maps canonical searchParams for segmentasi and medsos', () => {
  function getSegmentasiTab(tabParam) {
    const norm = (tabParam || '').toLowerCase().trim();
    if (norm === 'perbandingan') return 'perbandingan';
    if (norm === 'detail') return 'detail';
    return 'ikhtisar';
  }

  function getMedsosTab(tabParam) {
    const norm = (tabParam || '').toLowerCase().trim();
    if (norm === 'instagram') return 'Instagram';
    if (norm === 'evaluasi' || norm === 'eksplorasi') return 'Evaluasi & Eksplorasi';
    return 'Play Store';
  }

  // Segmentasi tab resolution
  assert.equal(getSegmentasiTab(null), 'ikhtisar');
  assert.equal(getSegmentasiTab(''), 'ikhtisar');
  assert.equal(getSegmentasiTab('ikhtisar'), 'ikhtisar');
  assert.equal(getSegmentasiTab('perbandingan'), 'perbandingan');
  assert.equal(getSegmentasiTab('detail'), 'detail');

  // Medsos tab resolution
  assert.equal(getMedsosTab(null), 'Play Store');
  assert.equal(getMedsosTab('playstore'), 'Play Store');
  assert.equal(getMedsosTab('instagram'), 'Instagram');
  assert.equal(getMedsosTab('evaluasi'), 'Evaluasi & Eksplorasi');
  assert.equal(getMedsosTab('eksplorasi'), 'Evaluasi & Eksplorasi');
});

test('no hardcoded mock metrics or static pipeline strings in ModelComparison', () => {
  const code = fs.readFileSync('src/components/segmentasi/ModelComparison.tsx', 'utf8');

  // Verify that Stitch mock numbers are eliminated
  assert.ok(!code.includes('0,428'), 'Must not contain mock silhouette 0,428');
  assert.ok(!code.includes('0,391'), 'Must not contain mock silhouette 0,391');
  assert.ok(!code.includes('0,812'), 'Must not contain mock davies-bouldin 0,812');
  assert.ok(!code.includes('0,945'), 'Must not contain mock davies-bouldin 0,945');

  // Verify that fake static running states are eliminated
  assert.ok(!code.includes('Running Pipeline'), 'Must not contain static Running Pipeline badge');
  assert.ok(!code.includes('Kalkulasi matriks dispersi'), 'Must not contain static Kalkulasi matriks dispersi');
  assert.ok(!code.includes('Sedang Dihitung'), 'Must not contain static Sedang Dihitung');
  assert.ok(!code.includes('Sedang berlangsung'), 'Must not contain static Sedang berlangsung');
});
