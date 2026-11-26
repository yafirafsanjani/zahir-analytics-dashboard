import { SupabaseClient } from "@supabase/supabase-js";
import {
  ModelChoice,
  SegmentSummaryRow,
  InvoiceTotals,
  DetailPageResult,
  ReferenceCheck,
  InvoiceRow,
} from "./types";
import { formatRupiah } from "./formatters";

export const REFERENCE_CUSTOMERS = 1456;
export const REFERENCE_INVOICES = 2874;
export const REFERENCE_MONETARY = 8225196662.39;

export interface VerifiedModelEvaluation {
  silhouette: number;
  davies_bouldin: number;
  calinski_harabasz: number;
  iterations: number;
  status: string;
  isOptimal?: boolean;
  isBaseline?: boolean;
}

export const VERIFIED_MODEL_EVALUATIONS: Record<string, VerifiedModelEvaluation> = {
  kmeans_k4: {
    silhouette: 0.4009058373570072,
    davies_bouldin: 0.7646497643342086,
    calinski_harabasz: 1151.822030464589,
    iterations: 8,
    status: "berhasil",
    isOptimal: true,
  },
  gmm_k3: {
    silhouette: 0.3389825562499449,
    davies_bouldin: 0.9781945866518224,
    calinski_harabasz: 700.2706275127848,
    iterations: 12,
    status: "berhasil",
    isBaseline: true,
  },
  gmm_k4: {
    silhouette: 0.232115805454657,
    davies_bouldin: 1.388579994005771,
    calinski_harabasz: 631.277553670366,
    iterations: 15,
    status: "berhasil",
  },
};

export const MODEL_SPECS = [
  { key: "kmeans_k4", family: "kmeans", k: 4, title: "K-Means k=4" },
  { key: "gmm_k3", family: "gmm", k: 3, title: "GMM k=3" },
  { key: "gmm_k4", family: "gmm", k: 4, title: "GMM k=4" },
] as const;

let cachedModels: ModelChoice[] | null = null;
let cachedTotals: InvoiceTotals | null = null;
const cachedSummaries = new Map<string, SegmentSummaryRow[]>();

export function clearSegmentationCache(): void {
  cachedModels = null;
  cachedTotals = null;
  cachedSummaries.clear();
}

export function canonicalModel(value: string): string {
  const norm = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (norm.includes("kmeans")) return "kmeans";
  if (norm.includes("gmm") || norm.includes("gaussian")) return "gmm";
  return "";
}

export async function checkSegmentationAccess(
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_segmentation_access");
  if (error || data !== true) {
    return false;
  }
  return true;
}

export async function discoverModels(
  supabase: SupabaseClient,
  forceRefresh = false
): Promise<ModelChoice[]> {
  if (!forceRefresh && cachedModels && cachedModels.length > 0) {
    return cachedModels;
  }

  const { data, error } = await supabase
    .from("segment_summary")
    .select("model, k")
    .order("model")
    .order("k");

  if (error || !data || data.length === 0) {
    throw new Error(
      "Tidak ada ringkasan yang dapat dibaca. Tabel mungkin kosong atau izin RLS belum lengkap."
    );
  }

  const observed = new Map<string, Set<string>>();
  for (const row of data) {
    const rawModel = String(row.model || "");
    const fam = canonicalModel(rawModel);
    const kVal = Number(row.k);
    const key = `${fam}_${kVal}`;
    if (!observed.has(key)) {
      observed.set(key, new Set());
    }
    observed.get(key)!.add(rawModel);
  }

  const choices: ModelChoice[] = [];
  for (const spec of MODEL_SPECS) {
    const key = `${spec.family}_${spec.k}`;
    const values = observed.get(key);
    if (values && values.size > 0) {
      choices.push({
        key: spec.key,
        family: spec.family,
        raw_model: Array.from(values)[0],
        k: spec.k,
        title: spec.title,
      });
    }
  }

  if (choices.length === 0) {
    throw new Error(
      "Konfigurasi K-Means k=4, GMM k=3, dan GMM k=4 belum ditemukan pada Supabase."
    );
  }

  cachedModels = choices;
  return choices;
}

export async function fetchSegmentSummary(
  supabase: SupabaseClient,
  choice: ModelChoice,
  forceRefresh = false
): Promise<SegmentSummaryRow[]> {
  const cacheKey = `${choice.key}_${choice.raw_model}_${choice.k}`;
  if (!forceRefresh && cachedSummaries.has(cacheKey)) {
    return cachedSummaries.get(cacheKey)!;
  }

  const { data, error } = await supabase
    .from("segment_summary")
    .select("*")
    .eq("model", choice.raw_model)
    .eq("k", choice.k)
    .order("cluster_code");

  if (error || !data) {
    throw new Error("Gagal membaca ringkasan segmen dari Supabase.");
  }

  const evalMetrics = VERIFIED_MODEL_EVALUATIONS[choice.key];

  const totalMonetary = data.reduce(
    (acc, row) => acc + Number(row.total_Monetary_Rp ?? row.total_monetary_rp ?? 0),
    0
  );

  const result: SegmentSummaryRow[] = data.map((row) => {
    const monetary = Number(row.total_Monetary_Rp ?? row.total_monetary_rp ?? 0);
    const customers = Number(row.jumlah_label ?? 0);

    const silhouette =
      row.silhouette != null
        ? Number(row.silhouette)
        : row.silhouette_score != null
        ? Number(row.silhouette_score)
        : evalMetrics?.silhouette;

    const davies_bouldin =
      row.davies_bouldin != null
        ? Number(row.davies_bouldin)
        : row.davies_bouldin_score != null
        ? Number(row.davies_bouldin_score)
        : evalMetrics?.davies_bouldin;

    const calinski_harabasz =
      row.calinski_harabasz != null
        ? Number(row.calinski_harabasz)
        : row.calinski_harabasz_score != null
        ? Number(row.calinski_harabasz_score)
        : evalMetrics?.calinski_harabasz;

    return {
      cluster: String(row.cluster_code ?? ""),
      name: String(row.nama_segmen ?? ""),
      customers,
      monetary,
      contribution_pct: totalMonetary > 0 ? (monetary / totalMonetary) * 100 : 0,
      avg_per_customer: customers > 0 ? monetary / customers : 0,
      recency:
        row.recency_mean ??
        row.mean_recency ??
        row.avg_recency ??
        row.median_Recency_hari,
      frequency:
        row.frequency_mean ??
        row.mean_frequency ??
        row.avg_frequency ??
        row.median_Frequency,
      rfm_monetary:
        row.monetary_mean ??
        row.mean_monetary ??
        row.avg_monetary ??
        row.median_Monetary_Rp,
      silhouette,
      davies_bouldin,
      calinski_harabasz,
      start: row.analysis_start ?? row.start,
      end: row.analysis_end ?? row.end,
      reference: row.recency_reference ?? row.reference,
      status: row.analysis_status ?? row.status ?? evalMetrics?.status,
    };
  });

  cachedSummaries.set(cacheKey, result);
  return result;
}

export async function fetchInvoiceTotals(
  supabase: SupabaseClient,
  forceRefresh = false
): Promise<InvoiceTotals | null> {
  if (!forceRefresh && cachedTotals !== null) {
    return cachedTotals;
  }

  try {
    const { data, error } = await supabase.rpc("segmentation_invoice_totals");
    if (error || !Array.isArray(data) || data.length === 0) {
      return null;
    }
    const row = data[0];
    const totals: InvoiceTotals = {
      invoices: Number(row.invoice_count ?? 0),
      customers: Number(row.customer_count ?? 0),
      unique_invoices: Number(row.unique_invoice_count ?? 0),
      monetary: Number(row.total_grand_total ?? 0),
    };
    cachedTotals = totals;
    return totals;
  } catch {
    return null;
  }
}

export function getClusterColumn(modelKey: string): string {
  switch (modelKey) {
    case "kmeans_k4":
      return "kmeans_k4_cluster";
    case "gmm_k3":
      return "gmm_k3_cluster";
    case "gmm_k4":
      return "gmm_k4_cluster";
    default:
      return "kmeans_k4_cluster";
  }
}

export async function fetchInvoiceDetailPage(
  supabase: SupabaseClient,
  choice: ModelChoice,
  clusterNames: Record<string, string>,
  query: string,
  page: number,
  pageSize: number,
  clusterFilter?: string
): Promise<DetailPageResult> {
  const clusterCol = getClusterColumn(choice.key);
  let q = supabase
    .from("faktur_lolos_dengan_klaster")
    .select(`id_kelompok_faktur, tanggal_faktur, nama_klien, grand_total_rp, ${clusterCol}`, {
      count: "exact",
    });

  if (query.trim()) {
    q = q.ilike("nama_klien", `%${query.trim()}%`);
  }

  if (clusterFilter && clusterFilter !== "Semua") {
    q = q.eq(clusterCol, clusterFilter);
  }

  q = q.order("id_kelompok_faktur", { ascending: true });
  q = q.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, count, error } = await q;

  if (error || !data) {
    throw new Error("Gagal membaca detail faktur dari Supabase.");
  }

  const rows: InvoiceRow[] = data.map((r: any) => {
    const clusterCode = String(r[clusterCol] ?? "");
    return {
      id: String(r.id_kelompok_faktur ?? ""),
      date: String(r.tanggal_faktur ?? ""),
      company: String(r.nama_klien ?? ""),
      amount: Number(r.grand_total_rp ?? 0),
      cluster: clusterCode,
      segment: clusterNames[clusterCode] || clusterCode,
    };
  });

  return {
    rows,
    count: count ?? rows.length,
    page,
    pageSize,
  };
}

export async function fetchAllInvoicesForExport(
  supabase: SupabaseClient,
  choice: ModelChoice,
  clusterNames: Record<string, string>,
  query: string,
  clusterFilter?: string
): Promise<Record<string, any>[]> {
  const clusterCol = getClusterColumn(choice.key);
  const rows: Record<string, any>[] = [];
  const batchSize = 1000;
  let offset = 0;

  while (offset < 50000) {
    let q = supabase
      .from("faktur_lolos_dengan_klaster")
      .select(`id_kelompok_faktur, tanggal_faktur, nama_klien, grand_total_rp, ${clusterCol}`, {
        count: "exact",
      });

    if (query.trim()) {
      q = q.ilike("nama_klien", `%${query.trim()}%`);
    }

    if (clusterFilter && clusterFilter !== "Semua") {
      q = q.eq(clusterCol, clusterFilter);
    }

    q = q.order("id_kelompok_faktur", { ascending: true });
    q = q.range(offset, offset + batchSize - 1);

    const { data, count, error } = await q;

    if (error || !data) {
      throw new Error("Gagal mengekspor data faktur.");
    }

    for (const r of data as any[]) {
      const clusterCode = String(r[clusterCol] ?? "");
      rows.push({
        "ID kelompok faktur": String(r.id_kelompok_faktur ?? ""),
        "Tanggal faktur": String(r.tanggal_faktur ?? ""),
        "Nama perusahaan": String(r.nama_klien ?? ""),
        "Grand total (Rp)": Number(r.grand_total_rp ?? 0),
        "Klaster": clusterCode,
        "Segmen": clusterNames[clusterCode] || clusterCode,
      });
    }

    if (count !== null && rows.length >= count) break;
    if (data.length < batchSize) break;
    offset += data.length;
  }

  return rows;
}

export function computeReferenceChecks(
  summary: SegmentSummaryRow[],
  totals: InvoiceTotals | null
): ReferenceCheck[] {
  const customers = summary.reduce((acc, r) => acc + r.customers, 0);
  const monetary = summary.reduce((acc, r) => acc + r.monetary, 0);

  const checks: ReferenceCheck[] = [
    {
      pemeriksaan: "Label model terpilih",
      terbaca: String(customers),
      acuan: String(REFERENCE_CUSTOMERS),
      sesuai: customers === REFERENCE_CUSTOMERS,
    },
    {
      pemeriksaan: "Monetary model terpilih",
      terbaca: formatRupiah(monetary),
      acuan: formatRupiah(REFERENCE_MONETARY),
      sesuai: Math.abs(monetary - REFERENCE_MONETARY) <= 0.05,
    },
  ];

  if (totals) {
    checks.push(
      {
        pemeriksaan: "Kelompok faktur keseluruhan",
        terbaca: String(totals.invoices),
        acuan: String(REFERENCE_INVOICES),
        sesuai: totals.invoices === REFERENCE_INVOICES,
      },
      {
        pemeriksaan: "ID pada detail keseluruhan",
        terbaca: String(totals.customers),
        acuan: String(REFERENCE_CUSTOMERS),
        sesuai: totals.customers === REFERENCE_CUSTOMERS,
      },
      {
        pemeriksaan: "Nominal detail keseluruhan",
        terbaca: formatRupiah(totals.monetary),
        acuan: formatRupiah(REFERENCE_MONETARY),
        sesuai: Math.abs(totals.monetary - REFERENCE_MONETARY) <= 0.05,
      },
      {
        pemeriksaan: "Detail vs ringkasan terpilih",
        terbaca: formatRupiah(totals.monetary),
        acuan: formatRupiah(monetary),
        sesuai: Math.abs(totals.monetary - monetary) <= 0.05,
      }
    );
  }

  return checks;
}
