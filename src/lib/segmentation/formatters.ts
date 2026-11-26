export function formatRupiah(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return "-";

  // Standard Indonesian Rupiah formatting: Rp8.225.196.662,39
  const parts = num.toFixed(2).split(".");
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimalPart = parts[1];
  return `Rp${integerPart},${decimalPart}`;
}

export function formatCompactRupiah(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return "-";

  const absVal = Math.abs(num);
  if (absVal >= 1_000_000_000) {
    const val = (num / 1_000_000_000).toFixed(2).replace(".", ",");
    return `Rp ${val} M`;
  }
  if (absVal >= 1_000_000) {
    const val = (num / 1_000_000).toFixed(2).replace(".", ",");
    return `Rp ${val} Jt`;
  }
  return formatRupiah(num);
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0";
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return "0";
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatDecimal(value: number | string | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return "-";
  return num.toFixed(decimals).replace(".", ",");
}

export function formatMetric(
  value: number | string | null | undefined,
  decimals = 3
): string {
  if (value === null || value === undefined || value === "") return "Belum tersedia";
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return "Belum tersedia";
  const parts = num.toFixed(decimals).split(".");
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimals > 0 ? `${integerPart},${parts[1]}` : integerPart;
}

export function sanitizeCsvValue(val: any): string {
  if (val === null || val === undefined) return "";
  let str = String(val);
  // Protect against CSV formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCsv(rows: Record<string, any>[]): string {
  if (!rows || rows.length === 0) return "\uFEFF";
  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(sanitizeCsvValue).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => sanitizeCsvValue(row[h])).join(",")
  );
  // Prepend UTF-8 BOM so Excel opens it with correct Indonesian characters
  return "\uFEFF" + [headerLine, ...dataLines].join("\r\n");
}
