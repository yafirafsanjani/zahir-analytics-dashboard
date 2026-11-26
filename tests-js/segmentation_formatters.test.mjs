import test from 'node:test';
import assert from 'node:assert/strict';

function formatRupiah(value) {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '-';
  const parts = num.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimalPart = parts[1];
  return 'Rp' + integerPart + ',' + decimalPart;
}

function formatCompactRupiah(value) {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '-';
  const absVal = Math.abs(num);
  if (absVal >= 1000000000) {
    const val = (num / 1000000000).toFixed(2).replace('.', ',');
    return 'Rp ' + val + ' M';
  }
  if (absVal >= 1000000) {
    const val = (num / 1000000).toFixed(2).replace('.', ',');
    return 'Rp ' + val + ' Jt';
  }
  return formatRupiah(num);
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatMetric(value, decimals = 3) {
  if (value === null || value === undefined || value === '') return 'Belum tersedia';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return 'Belum tersedia';
  const parts = num.toFixed(decimals).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimals > 0 ? `${integerPart},${parts[1]}` : integerPart;
}

function sanitizeCsvValue(val) {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function generateCsv(rows) {
  if (!rows || rows.length === 0) return '\uFEFF';
  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(sanitizeCsvValue).join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => sanitizeCsvValue(row[h])).join(',')
  );
  return '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
}

test('formatRupiah formats Indonesian currency with 2 decimals and dots', () => {
  assert.equal(formatRupiah(8225196662.39), 'Rp8.225.196.662,39');
  assert.equal(formatRupiah(0), 'Rp0,00');
  assert.equal(formatRupiah(1500000), 'Rp1.500.000,00');
  assert.equal(formatRupiah(null), '-');
});

test('formatCompactRupiah shortens billions and millions correctly', () => {
  assert.equal(formatCompactRupiah(8225196662.39), 'Rp 8,23 M');
  assert.equal(formatCompactRupiah(15000000), 'Rp 15,00 Jt');
  assert.equal(formatCompactRupiah(500000), 'Rp500.000,00');
});

test('formatNumber formats integer counts with thousands separators', () => {
  assert.equal(formatNumber(1456), '1.456');
  assert.equal(formatNumber(2874), '2.874');
  assert.equal(formatNumber(417), '417');
  assert.equal(formatNumber(55), '55');
  assert.equal(formatNumber(13147), '13.147');
});

test('formatMetric formats Indonesian precision metrics with comma and fallback', () => {
  assert.equal(formatMetric(0.4009058, 3), '0,401');
  assert.equal(formatMetric(0.7646497, 3), '0,765');
  assert.equal(formatMetric(1151.822, 2), '1.151,82');
  assert.equal(formatMetric(700.2706, 2), '700,27');
  assert.equal(formatMetric(631.2775, 2), '631,28');
  assert.equal(formatMetric(null), 'Belum tersedia');
  assert.equal(formatMetric(undefined), 'Belum tersedia');
  assert.equal(formatMetric(''), 'Belum tersedia');
});

test('sanitizeCsvValue escapes dangerous spreadsheet formulas', () => {
  assert.equal(sanitizeCsvValue('=CMD|calc!A1'), "'=CMD|calc!A1");
  assert.equal(sanitizeCsvValue('+SUM(A1:A10)'), "'+SUM(A1:A10)");
  assert.equal(sanitizeCsvValue('-100'), "'-100");
  assert.equal(sanitizeCsvValue('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(sanitizeCsvValue('Standard Text'), 'Standard Text');
  assert.equal(sanitizeCsvValue('PT. Zahir, Internasional'), '"PT. Zahir, Internasional"');
  assert.equal(sanitizeCsvValue('Text with "quotes"'), '"Text with ""quotes"""');
});

test('generateCsv prepends UTF-8 BOM and produces valid CSV text', () => {
  const rows = [
    { No_Faktur: 'INV/001', Pelanggan: 'PT Abadi', Total: 5000000 },
    { No_Faktur: 'INV/002', Pelanggan: '=HYPERLINK("http://evil.com")', Total: 1200000 },
  ];
  const csv = generateCsv(rows);
  assert.ok(csv.startsWith('\uFEFF'), 'Must include UTF-8 BOM');
  assert.ok(csv.includes("No_Faktur,Pelanggan,Total"));
  assert.ok(csv.includes("=HYPERLINK"));
});
