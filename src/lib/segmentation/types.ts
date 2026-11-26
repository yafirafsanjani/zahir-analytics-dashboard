export interface ModelChoice {
  key: "kmeans_k4" | "gmm_k3" | "gmm_k4" | string;
  family?: string;
  raw_model: string;
  k: number;
  title: string;
}

export interface SegmentSummaryRow {
  cluster: string;
  name: string;
  customers: number;
  monetary: number;
  contribution_pct?: number;
  avg_per_customer?: number;
  recency?: number;
  frequency?: number;
  rfm_monetary?: number;
  silhouette?: number;
  davies_bouldin?: number;
  calinski_harabasz?: number;
  start?: string;
  end?: string;
  reference?: string;
  status?: string;
}

export interface InvoiceTotals {
  invoices: number;
  customers: number;
  unique_invoices: number;
  monetary: number;
}

export interface InvoiceRow {
  id: string; // id_kelompok_faktur
  date: string; // tanggal_faktur
  company: string; // nama_klien
  amount: number; // grand_total_rp
  cluster: string; // kmeans_k4_cluster / gmm_k3_cluster / gmm_k4_cluster
  segment: string; // nama segmen from summary
}

export interface DetailPageResult {
  rows: InvoiceRow[];
  count: number;
  page: number;
  pageSize: number;
}

export interface ReferenceCheck {
  pemeriksaan: string;
  terbaca: string;
  acuan: string;
  sesuai: boolean;
}

export interface ModelComparisonRow {
  key: string;
  model: string;
  k: number;
  customers: number;
  monetary: string;
  silhouette?: string;
  davies_bouldin?: string;
  calinski_harabasz?: string;
  silhouetteNum?: number;
  daviesBouldinNum?: number;
  calinskiHarabaszNum?: number;
  iterations?: number;
  status?: string;
  isOptimal?: boolean;
  isBaseline?: boolean;
}
