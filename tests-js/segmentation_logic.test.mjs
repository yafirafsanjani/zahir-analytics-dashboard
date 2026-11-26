import test from 'node:test';
import assert from 'node:assert/strict';

const TARGET_CUSTOMERS = 1456;
const TARGET_INVOICE_GROUPS = 2874;
const TARGET_MONETARY = 8225196662.39;

function computeReferenceChecks(summary, totals) {
  const customerCount = summary.reduce((sum, s) => sum + s.Pelanggan, 0);
  const monetarySum = summary.reduce((sum, s) => sum + s.Monetary, 0);
  const invoiceCount = totals?.jumlah_faktur ?? 0;
  const invoiceSum = totals?.total_nominal ?? 0;

  return [
    {
      pemeriksaan: "Jumlah label pelanggan",
      terbaca: customerCount,
      acuan: TARGET_CUSTOMERS,
      selisih: customerCount - TARGET_CUSTOMERS,
      sesuai: customerCount === TARGET_CUSTOMERS,
    },
    {
      pemeriksaan: "Total nilai segmen pelanggan",
      terbaca: monetarySum,
      acuan: TARGET_MONETARY,
      selisih: monetarySum - TARGET_MONETARY,
      sesuai: Math.abs(monetarySum - TARGET_MONETARY) < 1.0,
    },
    {
      pemeriksaan: "Jumlah faktur pada rincian",
      terbaca: invoiceCount,
      acuan: TARGET_INVOICE_GROUPS,
      selisih: invoiceCount - TARGET_INVOICE_GROUPS,
      sesuai: invoiceCount === TARGET_INVOICE_GROUPS,
    },
    {
      pemeriksaan: "Total nominal faktur pada rincian",
      terbaca: invoiceSum,
      acuan: TARGET_MONETARY,
      selisih: invoiceSum - TARGET_MONETARY,
      sesuai: Math.abs(invoiceSum - TARGET_MONETARY) < 1.0,
    },
  ];
}

test('computeReferenceChecks validates exactly with target baseline values', () => {
  const mockSummary = [
    { Segmen: 'Champions', Pelanggan: 456, Monetary: 4000000000 },
    { Segmen: 'Loyal', Pelanggan: 500, Monetary: 3000000000 },
    { Segmen: 'At Risk', Pelanggan: 300, Monetary: 1000000000 },
    { Segmen: 'Hibernating', Pelanggan: 200, Monetary: 225196662.39 },
  ];
  const mockTotals = {
    jumlah_faktur: 2874,
    total_nominal: 8225196662.39,
  };

  const checks = computeReferenceChecks(mockSummary, mockTotals);
  assert.equal(checks.length, 4);
  assert.ok(checks.every((c) => c.sesuai === true), 'All 4 reference checks should pass');
});

test('computeReferenceChecks flags differences when data diverges', () => {
  const mockSummary = [
    { Segmen: 'Champions', Pelanggan: 1000, Monetary: 5000000000 },
  ];
  const mockTotals = {
    jumlah_faktur: 2000,
    total_nominal: 5000000000,
  };

  const checks = computeReferenceChecks(mockSummary, mockTotals);
  assert.equal(checks[0].sesuai, false);
  assert.equal(checks[0].selisih, 1000 - 1456);
  assert.equal(checks[2].sesuai, false);
  assert.equal(checks[2].selisih, 2000 - 2874);
});