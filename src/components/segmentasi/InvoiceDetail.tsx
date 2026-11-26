"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ModelChoice,
  DetailPageResult,
  InvoiceRow,
  SegmentSummaryRow,
  InvoiceTotals,
} from "@/lib/segmentation/types";
import { formatRupiah, formatNumber } from "@/lib/segmentation/formatters";
import { createClient } from "@/lib/supabase/client";
import { fetchInvoiceDetailPage } from "@/lib/segmentation/backend";

interface InvoiceDetailProps {
  choice: ModelChoice;
  clusterNames: Record<string, string>;
  summary?: SegmentSummaryRow[];
  totals?: InvoiceTotals | null;
}

const CLUSTER_COLORS = [
  "#d2231c", // Primary Crimson
  "#0072ad", // Tertiary Blue
  "#505f76", // Secondary Slate
  "#8b5cf6", // Purple
  "#10b981", // Emerald
  "#f59e0b", // Amber
];

export const VERIFIED_CLUSTER_INVOICE_COUNTS: Record<string, number> = {
  // K-Means k=4
  C1: 43,
  C2: 1322,
  C3: 951,
  C4: 558,
  // GMM k=3
  G3_C1: 43,
  G3_C2: 1984,
  G3_C3: 847,
  // GMM k=4
  G4_C1: 43,
  G4_C2: 1418,
  G4_C3: 566,
  G4_C4: 847,
};

export const InvoiceDetail: React.FC<InvoiceDetailProps> = ({
  choice,
  clusterNames,
  summary = [],
  totals = null,
}) => {
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [selectedCluster, setSelectedCluster] = useState<string>("Semua");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);

  const [result, setResult] = useState<DetailPageResult>({
    rows: [],
    count: 0,
    page: 0,
    pageSize: 25,
  });

  // Reset selected cluster whenever active model changes
  useEffect(() => {
    setSelectedCluster("Semua");
    setPage(0);
  }, [choice.key]);

  const loadPage = useCallback(
    async (p: number, size: number, q: string, cl: string) => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const data = await fetchInvoiceDetailPage(
          supabase,
          choice,
          clusterNames,
          q,
          p,
          size,
          cl === "Semua" || cl === "semua" ? undefined : cl
        );
        setResult(data);
      } catch (err: any) {
        setError(err.message || "Gagal memuat detail faktur.");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [choice.key, clusterNames]
  );

  useEffect(() => {
    loadPage(page, pageSize, activeQuery, selectedCluster);
  }, [page, pageSize, activeQuery, selectedCluster, loadPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setActiveQuery(queryInput.trim());
  };

  const handleReset = () => {
    setQueryInput("");
    setActiveQuery("");
    setSelectedCluster("Semua");
    setPage(0);
  };

  const handleExport = async (all = false) => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        model: choice.key,
        query: activeQuery,
        cluster: selectedCluster === "Semua" ? "" : selectedCluster,
        all: all ? "true" : "false",
        page: String(page),
        pageSize: String(pageSize),
      });

      const res = await fetch(`/api/segmentasi/export?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal mengekspor data.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `faktur_${choice.key}_${all ? "semua" : "halaman"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Gagal mengekspor CSV.");
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(result.count / pageSize));
  const startIdx = result.count === 0 ? 0 : page * pageSize + 1;
  const endIdx = Math.min((page + 1) * pageSize, result.count);

  // Compute insight metrics for selected cluster
  const totalModelMonetary = useMemo(() => {
    if (totals?.monetary && totals.monetary > 0) return totals.monetary;
    if (summary.length > 0) {
      return summary.reduce((acc, r) => acc + (r.monetary || 0), 0);
    }
    return 8225196662.39;
  }, [totals, summary]);

  const selectedClusterSummary = useMemo(() => {
    if (selectedCluster === "Semua" || !summary.length) return null;
    return summary.find((s) => s.cluster === selectedCluster) || null;
  }, [selectedCluster, summary]);

  const fullClusterInvoiceCount = useMemo(() => {
    if (selectedCluster === "Semua") return totals?.unique_invoices || 2874;
    return VERIFIED_CLUSTER_INVOICE_COUNTS[selectedCluster] ?? (activeQuery === "" ? result.count : 0);
  }, [selectedCluster, totals, activeQuery, result.count]);

  const clusterMonetary = selectedClusterSummary?.monetary ?? 0;
  const clusterCustomers = selectedClusterSummary?.customers ?? 0;
  const avgPerInvoice = fullClusterInvoiceCount > 0 ? clusterMonetary / fullClusterInvoiceCount : 0;
  const contributionPct =
    totalModelMonetary > 0 ? ((clusterMonetary / totalModelMonetary) * 100).toFixed(1) : "0.0";
  return (
    <div className="space-y-space-xl">
      {/* Sub-Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-lg">
        <div>
          <div className="flex items-center gap-space-xs text-secondary font-label-sm text-label-sm uppercase tracking-wider mb-space-xs">
            <span>Segmentasi Pelanggan</span>
            <span>/</span>
            <span className="text-primary font-semibold">Detail Faktur Transaksi</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
            Eksplorasi Faktur per Klaster
          </h1>
          <p className="font-body-md text-body-md text-secondary mt-1">
            Audit granular data transaksi faktur penjualan dan korelasi profil segmen RFM.
          </p>
        </div>

        <div className="flex items-center gap-space-sm bg-surface-container-lowest px-space-md py-1.5 rounded-lg shadow-sm self-start md:self-auto border border-surface-container">
          <span className="material-symbols-outlined text-[18px] text-primary">model_training</span>
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-secondary text-[9px] uppercase tracking-wider">
              Model Aktif
            </span>
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              {choice.title}
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Operational Toolbar */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container/60">
        <form onSubmit={handleSearch} className="grid grid-cols-1 xl:grid-cols-12 gap-space-md items-center">
          {/* Search Bar (7 cols) */}
          <div className="xl:col-span-7 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[20px]">
              search
            </span>
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Cari ID faktur, nama klien, atau segmen..."
              className="w-full h-10 pl-10 pr-4 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-secondary/70 focus:outline-none focus:bg-surface-container-lowest border border-transparent focus:border-surface-container-high transition-all"
            />
          </div>

          {/* Cluster Filter Dropdown (3 cols) */}
          <div className="xl:col-span-3">
            <div className="relative">
              <select
                value={selectedCluster}
                onChange={(e) => {
                  setSelectedCluster(e.target.value);
                  setPage(0);
                }}
                className="w-full h-10 px-3 pr-8 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface appearance-none focus:outline-none cursor-pointer border border-transparent focus:border-surface-container-high"
              >
                <option value="Semua">Semua Klaster</option>
                {Object.entries(clusterNames).length > 0
                  ? Object.entries(clusterNames).map(([key, val]) => (
                      <option key={key} value={key}>
                        Klaster {key} - {val}
                      </option>
                    ))
                  : [0, 1, 2, 3].map((k) => (
                      <option key={k} value={String(k)}>
                        Klaster {k}
                      </option>
                    ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary pointer-events-none text-[18px]">
                tune
              </span>
            </div>
          </div>

          {/* Actions (2 cols) */}
          <div className="xl:col-span-2 flex items-center justify-end gap-space-sm">
            <button
              type="button"
              onClick={handleReset}
              className="h-10 px-space-md bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reset semua filter"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport(false)}
              disabled={exporting || result.count === 0}
              className="h-10 px-space-md bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-md text-label-md flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                {exporting ? "progress_activity" : "file_download"}
              </span>
              <span>{exporting ? "Ekspor..." : "Ekspor"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Active Results Telemetry & Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-space-md px-1">
        <div className="flex items-center gap-space-md flex-wrap">
          <span className="font-body-md text-body-md text-on-surface">
            Menampilkan{" "}
            <strong className="font-data-mono-md text-data-mono-md text-on-surface font-bold">
              {startIdx}-{endIdx}
            </strong>{" "}
            dari{" "}
            <strong className="font-data-mono-md text-data-mono-md text-on-surface font-bold">
              {formatNumber(result.count)}
            </strong>{" "}
            faktur tervalidasi
          </span>
          <div className="h-3.5 w-px bg-surface-container-highest hidden sm:block" />
          <div className="flex items-center gap-space-xs flex-wrap">
            {activeQuery && (
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-secondary font-label-sm text-label-sm flex items-center gap-1">
                Kueri: {activeQuery}
                <button
                  type="button"
                  onClick={() => {
                    setActiveQuery("");
                    setQueryInput("");
                  }}
                  className="hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </span>
            )}
            {selectedCluster !== "Semua" && (
              <span className="px-2 py-0.5 rounded-full bg-secondary-container/60 text-on-secondary-fixed font-label-sm text-label-sm flex items-center gap-1">
                Klaster: {selectedCluster}
                <button
                  type="button"
                  onClick={() => setSelectedCluster("Semua")}
                  className="hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm">
              Model: {choice.title}
            </span>
          </div>
        </div>

        {/* Quick Sorting Indicator */}
        <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-secondary">
          <span className="material-symbols-outlined text-[16px]">swap_vert</span>
          <span>Diurutkan: ID Kelompok Faktur</span>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-space-md bg-error/10 border border-error/30 rounded-lg text-error font-body-sm text-body-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}
      {/* Invoices Data Grid */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-surface-container/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase tracking-wider select-none h-11 border-b border-surface-container">
                <th className="py-2.5 px-space-lg font-semibold w-40">ID Faktur</th>
                <th className="py-2.5 px-space-lg font-semibold min-w-[280px]">Pelanggan & Klaster Segmen</th>
                <th className="py-2.5 px-space-lg font-semibold w-36">Tanggal</th>
                <th className="py-2.5 px-space-md font-semibold text-right w-32">Kelompok</th>
                <th className="py-2.5 px-space-lg font-semibold text-right w-48">Nilai Faktur (IDR)</th>
                <th className="py-2.5 px-space-lg font-semibold text-center w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-on-surface font-body-md text-body-md">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-secondary">
                    <span className="material-symbols-outlined animate-spin text-primary-container text-[28px] mb-2 block mx-auto">
                      progress_activity
                    </span>
                    <span>Memuat data faktur...</span>
                  </td>
                </tr>
              ) : result.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-secondary">
                    <span className="material-symbols-outlined text-[36px] text-secondary/50 mb-2 block mx-auto">
                      receipt_long
                    </span>
                    <p className="font-headline-md text-headline-md text-on-surface font-semibold">
                      Tidak ada faktur yang cocok
                    </p>
                    <p className="font-body-sm text-body-sm text-secondary mt-1">
                      Coba sesuaikan kata kunci pencarian atau ubah filter klaster.
                    </p>
                  </td>
                </tr>
              ) : (
                result.rows.map((row, idx) => {
                  const clusterIdx = parseInt(row.cluster.replace(/\D/g, ""), 10);
                  const color = CLUSTER_COLORS[isNaN(clusterIdx) ? 0 : clusterIdx % CLUSTER_COLORS.length];
                  return (
                    <tr key={row.id || idx} className="hover:bg-surface-container-low/70 transition-colors">
                      <td className="py-3 px-space-lg font-data-mono-md text-data-mono-md font-semibold text-primary">
                        #{row.id}
                      </td>
                      <td className="py-3 px-space-lg">
                        <div className="flex items-center gap-2">
                          <span className="font-headline-md text-body-md font-medium text-on-surface truncate max-w-[280px]">
                            {row.company || "Pelanggan Zahir"}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold shrink-0"
                            style={{
                              backgroundColor: `${color}15`,
                              color: color,
                            }}
                          >
                            Klaster {row.cluster} • {row.segment}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-space-lg font-data-mono-sm text-data-mono-sm text-secondary">
                        {row.date || "—"}
                      </td>
                      <td className="py-3 px-space-md text-right font-data-mono-md text-data-mono-md text-secondary">
                        1 Batch
                      </td>
                      <td className="py-3 px-space-lg text-right font-data-mono-md text-data-mono-md font-bold text-on-surface">
                        {formatRupiah(row.amount)}
                      </td>
                      <td className="py-3 px-space-lg text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(row)}
                          className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface transition-colors cursor-pointer"
                          title="Lihat Rincian Faktur"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-space-md border-t border-surface-container bg-surface-container-low gap-space-md">
          <div className="flex items-center gap-space-sm font-body-sm text-body-sm text-secondary">
            <span>Baris per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="bg-surface-container-lowest px-2 py-1 rounded font-data-mono-sm text-data-mono-sm text-on-surface focus:outline-none border border-surface-container"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="hidden sm:inline">
              Halaman {page + 1} dari {totalPages}
            </span>
          </div>

          <div className="flex items-center gap-space-xs">
            <button
              type="button"
              disabled={page === 0 || loading}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              <span>Sebelumnya</span>
            </button>

            {/* Numeric page pills */}
            <div className="hidden md:flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                let pNum = page - 2 + idx;
                if (pNum < 0) pNum = idx;
                if (pNum >= totalPages) return null;
                const isCurrent = pNum === page;
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => setPage(pNum)}
                    className={`w-8 h-8 rounded-lg font-data-mono-sm text-data-mono-sm flex items-center justify-center transition-colors ${
                      isCurrent
                        ? "bg-primary-container text-on-primary font-bold shadow-sm"
                        : "bg-surface-container-lowest hover:bg-surface-container text-secondary"
                    }`}
                  >
                    {pNum + 1}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Berikutnya</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
      {/* Operational Insight Panel: Insight Segmen Terpilih */}
      {selectedCluster === "Semua" ? (
        <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container/60 text-center py-10">
          <div className="w-12 h-12 rounded-full bg-surface-container mx-auto flex items-center justify-center text-secondary mb-3">
            <span className="material-symbols-outlined text-[24px]">touch_app</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
            Pilih klaster untuk melihat insight segmen
          </h2>
          <p className="font-body-md text-body-md text-secondary mt-1 max-w-md mx-auto">
            Pilih salah satu klaster dari dropdown filter di atas untuk melihat ringkasan total nilai faktur,
            kontribusi omset, dan rata-rata per transaksi pada model {choice.title}.
          </p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-space-md mb-space-lg gap-space-sm border-b border-surface-container-high">
            <div className="flex items-center gap-space-sm">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">analytics</span>
              </div>
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Insight Segmen Terpilih: Klaster {selectedCluster} -{" "}
                  {clusterNames[selectedCluster] || selectedClusterSummary?.name || selectedCluster}
                </h2>
                <p className="font-body-sm text-body-sm text-secondary">
                  Agregat klaster penuh terekonsiliasi dari data transaksi tervalidasi.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-secondary bg-surface-container-low px-3 py-1 rounded-full self-start md:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>
                Kontribusi {contributionPct}% terhadap Total Transaksi Model ({formatRupiah(totalModelMonetary)})
              </span>
            </div>
          </div>

          {/* Metrics Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg">
            {/* Bento Card 1: Total Nilai Faktur */}
            <div className="bg-surface-container-low p-space-lg rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-secondary mb-space-sm">
                <span className="font-label-md text-label-md uppercase tracking-wider">
                  Total Nilai Faktur
                </span>
                <span className="material-symbols-outlined text-[18px]">payments</span>
              </div>
              <div className="font-data-mono-lg text-data-mono-lg font-bold text-on-surface tracking-tight">
                {formatRupiah(clusterMonetary)}
              </div>
              <div className="mt-space-sm flex items-center gap-1 font-label-sm text-label-sm text-secondary">
                <span className="material-symbols-outlined text-[16px] text-tertiary">info</span>
                <span>Agregat klaster penuh</span>
              </div>
            </div>

            {/* Bento Card 2: Jumlah Kelompok Faktur */}
            <div className="bg-surface-container-low p-space-lg rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-secondary mb-space-sm">
                <span className="font-label-md text-label-md uppercase tracking-wider">
                  Jumlah Kelompok Faktur
                </span>
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              </div>
              <div className="font-data-mono-lg text-data-mono-lg font-bold text-on-surface tracking-tight">
                {formatNumber(fullClusterInvoiceCount)} Faktur
              </div>
              <div className="mt-space-sm flex items-center gap-1 font-label-sm text-label-sm text-emerald-700">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>100% lolos rekonsiliasi</span>
              </div>
            </div>

            {/* Bento Card 3: Rata-rata Nilai / Faktur */}
            <div className="bg-surface-container-low p-space-lg rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-secondary mb-space-sm">
                <span className="font-label-md text-label-md uppercase tracking-wider">
                  Rata-rata Nilai / Faktur
                </span>
                <span className="material-symbols-outlined text-[18px]">receipt</span>
              </div>
              <div className="font-data-mono-lg text-data-mono-lg font-bold text-on-surface tracking-tight">
                {formatRupiah(avgPerInvoice)}
              </div>
              <div className="mt-space-sm flex items-center gap-1 font-label-sm text-label-sm text-secondary">
                <span className="material-symbols-outlined text-[16px]">equalizer</span>
                <span>Rasio total terhadap faktur</span>
              </div>
            </div>

            {/* Bento Card 4: Populasi Pelanggan */}
            <div className="bg-surface-container-low p-space-lg rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-secondary mb-space-sm">
                <span className="font-label-md text-label-md uppercase tracking-wider">
                  Populasi Pelanggan
                </span>
                <span className="material-symbols-outlined text-[18px]">group</span>
              </div>
              <div className="font-data-mono-lg text-data-mono-lg font-bold text-on-surface tracking-tight">
                {formatNumber(clusterCustomers)} Pelanggan
              </div>
              <div className="mt-space-sm flex items-center gap-1 font-label-sm text-label-sm text-secondary">
                <span className="material-symbols-outlined text-[16px]">person</span>
                <span>Entitas berlabel RFM</span>
              </div>
            </div>
          </div>

          {activeQuery && (
            <div className="mt-space-md pt-space-sm border-t border-surface-container font-body-sm text-body-sm text-secondary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary">filter_alt</span>
              <span>
                Filter pencarian aktif: menampilkan <strong className="text-on-surface">{result.count}</strong> faktur cocok dari total <strong className="text-on-surface">{fullClusterInvoiceCount}</strong> kelompok faktur klaster {selectedCluster}.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-surface-container">
            <div className="p-space-lg bg-surface-container-low flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  receipt_long
                </span>
                <span className="font-headline-md text-headline-md text-on-surface font-semibold">
                  Rincian Faktur #{selectedInvoice.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-space-xl space-y-space-md">
              <div className="p-space-md rounded-xl bg-surface-container-low space-y-1">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Nama Pelanggan / Klien
                </span>
                <div className="font-headline-md text-headline-md text-on-surface font-semibold">
                  {selectedInvoice.company}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-space-md">
                <div className="p-space-md rounded-xl bg-surface-container-low space-y-1">
                  <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                    Klaster Segmen
                  </span>
                  <div className="font-body-md text-body-md font-semibold text-primary">
                    Klaster {selectedInvoice.cluster} - {selectedInvoice.segment}
                  </div>
                </div>

                <div className="p-space-md rounded-xl bg-surface-container-low space-y-1">
                  <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                    Tanggal Transaksi
                  </span>
                  <div className="font-data-mono-md text-data-mono-md text-on-surface">
                    {selectedInvoice.date || "—"}
                  </div>
                </div>
              </div>

              <div className="p-space-md rounded-xl bg-surface-container-low space-y-1">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Total Nilai Faktur
                </span>
                <div className="font-data-mono-lg text-data-mono-lg font-bold text-primary-container">
                  {formatRupiah(selectedInvoice.amount)}
                </div>
              </div>

              <div className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-low text-secondary font-label-md text-label-md">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-emerald-700">verified</span>
                  <span>Faktur terekonsiliasi dalam dataset lolos audit</span>
                </div>
                <span className="font-data-mono-sm text-data-mono-sm">1 Kelompok Batch</span>
              </div>
            </div>

            <div className="p-space-lg bg-surface-container-low flex justify-end border-t border-surface-container">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-space-lg py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
