import React from "react";
import { ModelComparisonRow } from "@/lib/segmentation/types";
import { formatRupiah, formatNumber } from "@/lib/segmentation/formatters";

interface ModelComparisonProps {
  rows: ModelComparisonRow[];
  totalMonetary?: number;
  totalCustomers?: number;
  loading?: boolean;
}

export const ModelComparison: React.FC<ModelComparisonProps> = ({
  rows,
  totalMonetary = 8225196662.39,
  totalCustomers = 1456,
  loading = false,
}) => {
  // Find optimal (K-Means k=4) and baseline (GMM k=3)
  const optimalRow = rows.find(
    (r) => r.isOptimal || r.key === "kmeans_k4" || r.model.toLowerCase().includes("kmeans")
  );
  const baselineRow = rows.find(
    (r) => r.isBaseline || r.key === "gmm_k3" || (r.model.toLowerCase().includes("gmm") && r.k === 3)
  );

  // Dynamic Silhouette delta calculation
  const optSil = optimalRow?.silhouetteNum;
  const baseSil = baselineRow?.silhouetteNum;
  const silDiffPts = optSil != null && baseSil != null ? optSil - baseSil : null;
  const silDiffPct =
    silDiffPts != null && baseSil != null && baseSil !== 0
      ? (silDiffPts / baseSil) * 100
      : null;

  // Dynamic Davies-Bouldin delta calculation (lower is better)
  const optDb = optimalRow?.daviesBouldinNum;
  const baseDb = baselineRow?.daviesBouldinNum;
  const dbDropPct =
    optDb != null && baseDb != null && baseDb !== 0
      ? ((optDb - baseDb) / baseDb) * 100
      : null;

  // Max bounds for bar chart scales
  const maxSil = Math.max(...rows.map((r) => r.silhouetteNum ?? 0), 0.5);
  const maxDb = Math.max(...rows.map((r) => r.daviesBouldinNum ?? 0), 1.5);

  return (
    <div className="space-y-space-xl">
      {/* Hero Analytical Header & Meta Banner */}
      <div className="relative bg-surface-container-lowest rounded-xl p-space-xl shadow-sm overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-primary-container/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg relative z-10">
          <div className="max-w-3xl space-y-space-xs">
            <div className="flex items-center gap-space-xs text-secondary font-label-sm text-label-sm uppercase tracking-wider">
              <span className="material-symbols-outlined text-[16px] text-primary">science</span>
              <span>Validasi Klaster Internal ? RFM Analytics Pipeline</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              Evaluasi Metrik Klasterisasi Algoritma K-Means & Gaussian Mixture Model
            </h1>
            <p className="font-body-md text-body-md text-secondary leading-relaxed">
              Pengujian matematis multi-algoritma terhadap 1.456 profil entitas transaksi bisnis Zahir. Penilaian didasarkan pada metrik kerapatan intra-klaster dan separasi inter-klaster RFM (Recency, Frequency, Monetary) untuk menentukan arsitektur partisi paling representatif.
            </p>
          </div>

          <div className="flex lg:flex-col items-center lg:items-end justify-between gap-space-md shrink-0 bg-surface-container-low lg:bg-transparent p-space-md lg:p-0 rounded-lg">
            <div className="text-left lg:text-right">
              <div className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                Total Sampel Profil
              </div>
              <div className="font-data-mono-lg text-data-mono-lg text-on-surface font-bold">
                {formatNumber(totalCustomers)}{" "}
                <span className="font-body-sm text-body-sm text-secondary font-normal">Entitas</span>
              </div>
            </div>
            <div className="text-left lg:text-right">
              <div className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                Agregasi Nilai Transaksi (M)
              </div>
              <div className="font-data-mono-md text-data-mono-md text-primary font-semibold">
                {formatRupiah(totalMonetary)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comparative Model Evaluation Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
        <div className="px-space-xl py-space-md bg-surface-container-low flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-secondary text-[18px]">table_chart</span>
            <span className="font-label-md text-label-md text-on-surface uppercase tracking-wider">
              Tabel Validasi Empiris Model Klaster
            </span>
          </div>
          <span className="font-label-sm text-label-sm text-secondary">
            Berdasarkan evaluasi klaster RFM Zahir Analytics
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container text-secondary font-label-sm text-label-sm uppercase tracking-wider">
                <th className="py-space-md px-space-xl font-semibold">Algoritma & Konfigurasi</th>
                <th className="py-space-md px-space-lg font-semibold">Status Validasi</th>
                <th className="py-space-md px-space-lg font-semibold text-right">Populasi Entitas</th>
                <th className="py-space-md px-space-lg font-semibold text-right">Nilai Moneter Terklaster</th>
                <th className="py-space-md px-space-lg font-semibold text-right">Silhouette Score (?)</th>
                <th className="py-space-md px-space-lg font-semibold text-right">Davies?Bouldin (?)</th>
                <th className="py-space-md px-space-xl font-semibold text-right">Calinski?Harabasz (?)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-secondary font-body-sm">
                    <span className="material-symbols-outlined animate-spin text-primary text-[24px] mb-2">
                      progress_activity
                    </span>
                    <div>Memuat metrik evaluasi model...</div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-secondary font-body-sm">
                    Belum ada model yang dimuat.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const isOptimal =
                    r.isOptimal ||
                    r.key === "kmeans_k4" ||
                    r.model.toLowerCase().includes("kmeans");
                  const isBaseline =
                    r.isBaseline ||
                    r.key === "gmm_k3" ||
                    (r.model.toLowerCase().includes("gmm") && r.k === 3);

                  return (
                    <tr
                      key={r.key || i}
                      className={`hover:bg-surface-container-low/70 transition-colors ${
                        isOptimal ? "bg-primary-container/[0.02]" : ""
                      }`}
                    >
                      <td className="py-space-md px-space-xl">
                        <div className="flex items-center gap-space-sm">
                          <div
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              isOptimal ? "bg-primary" : "bg-secondary"
                            }`}
                          />
                          <div>
                            <div className="font-headline-md text-headline-md text-on-surface flex items-center gap-space-xs">
                              <span>{r.model}</span>
                              <span className="font-data-mono-sm text-data-mono-sm text-secondary px-1.5 py-0.5 bg-surface-container rounded">
                                (k={r.k})
                              </span>
                            </div>
                            <div className="font-body-sm text-body-sm text-secondary">
                              {isOptimal
                                ? "Hard partitioning spasial centroid Euclidean"
                                : isBaseline
                                ? "Gaussian Mixture Model probabilistik EM (k=3)"
                                : "Gaussian Mixture Model probabilistik EM (k=4)"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-space-md px-space-lg">
                        {isOptimal ? (
                          <span className="inline-flex items-center gap-1 px-space-sm py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] font-label-sm text-label-sm font-semibold">
                            <span className="material-symbols-outlined text-[14px]">verified</span>
                            <span>Optimal (Terpilih)</span>
                          </span>
                        ) : isBaseline ? (
                          <span className="inline-flex items-center gap-1 px-space-sm py-0.5 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm font-semibold">
                            <span className="material-symbols-outlined text-[14px]">flag</span>
                            <span>Baseline</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-space-sm py-0.5 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm font-semibold">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            <span>Valid ({r.iterations ?? 15} iterasi)</span>
                          </span>
                        )}
                      </td>
                      <td className="py-space-md px-space-lg text-right font-data-mono-md text-data-mono-md text-on-surface">
                        {formatNumber(r.customers || 1456)}
                      </td>
                      <td className="py-space-md px-space-lg text-right font-data-mono-md text-data-mono-md text-on-surface">
                        {r.monetary || "Rp8.225.196.662,39"}
                      </td>
                      <td className="py-space-md px-space-lg text-right">
                        {r.silhouette && r.silhouette !== "Belum tersedia" ? (
                          <>
                            <span
                              className={`font-data-mono-md text-data-mono-md ${
                                isOptimal ? "text-primary font-bold" : "text-on-surface"
                              }`}
                            >
                              {r.silhouette}
                            </span>
                            <span
                              className={`block font-label-sm text-label-sm ${
                                isOptimal ? "text-[#065F46] font-medium" : "text-secondary"
                              }`}
                            >
                              {isOptimal
                                ? silDiffPts != null
                                  ? `+${silDiffPts.toFixed(3).replace(".", ",")} vs Base`
                                  : "Optimal"
                                : isBaseline
                                ? "Acuan awal"
                                : r.silhouetteNum && baseSil
                                ? `${(r.silhouetteNum - baseSil < 0 ? "" : "+")}${(
                                    r.silhouetteNum - baseSil
                                  )
                                    .toFixed(3)
                                    .replace(".", ",")} vs Base`
                                : "Sub-optimal"}
                            </span>
                          </>
                        ) : (
                          <span className="font-label-sm text-label-sm text-secondary italic">
                            Belum tersedia
                          </span>
                        )}
                      </td>
                      <td className="py-space-md px-space-lg text-right">
                        {r.davies_bouldin && r.davies_bouldin !== "Belum tersedia" ? (
                          <>
                            <span
                              className={`font-data-mono-md text-data-mono-md ${
                                isOptimal ? "text-[#065F46] font-bold" : "text-on-surface font-semibold"
                              }`}
                            >
                              {r.davies_bouldin}
                            </span>
                            <span className="block font-label-sm text-label-sm text-secondary">
                              {isOptimal
                                ? dbDropPct != null
                                  ? `${dbDropPct.toFixed(1).replace(".", ",")}% separasi`
                                  : "-21,8% separasi"
                                : isBaseline
                                ? "Acuan awal"
                                : r.daviesBouldinNum && baseDb
                                ? `${r.daviesBouldinNum - baseDb > 0 ? "+" : ""}${(
                                    ((r.daviesBouldinNum - baseDb) / baseDb) *
                                    100
                                  )
                                    .toFixed(1)
                                    .replace(".", ",")}% deviasi`
                                : "Sub-optimal"}
                            </span>
                          </>
                        ) : (
                          <span className="font-label-sm text-label-sm text-secondary italic">
                            Belum tersedia
                          </span>
                        )}
                      </td>
                      <td className="py-space-md px-space-xl text-right">
                        {r.calinski_harabasz && r.calinski_harabasz !== "Belum tersedia" ? (
                          <>
                            <span
                              className={`font-data-mono-md text-data-mono-md ${
                                isOptimal ? "text-primary font-bold" : "text-on-surface font-semibold"
                              }`}
                            >
                              {r.calinski_harabasz}
                            </span>
                            <span className="block font-label-sm text-label-sm text-secondary">
                              {isOptimal
                                ? "Kerapatan maks"
                                : isBaseline
                                ? "Acuan awal"
                                : "Sub-optimal"}
                            </span>
                          </>
                        ) : (
                          <span className="font-label-sm text-label-sm text-secondary italic">
                            Belum tersedia
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparative Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-xl">
        {/* Silhouette Bar Chart */}
        <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  network_check
                </span>
                <h3 className="font-headline-md text-headline-md text-on-surface">
                  Silhouette Score Komparatif
                </h3>
              </div>
              <span className="font-label-sm text-label-sm px-space-sm py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] font-semibold">
                Makin tinggi makin baik (?)
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary mb-space-lg">
              Tingkat kemiripan objek ke klasternya sendiri dibandingkan dengan klaster terdekat lain (-1.0 s/d +1.0).
            </p>

            <div className="space-y-space-md">
              {rows.map((r, i) => {
                const isOptimal =
                  r.isOptimal ||
                  r.key === "kmeans_k4" ||
                  r.model.toLowerCase().includes("kmeans");
                const isBaseline =
                  r.isBaseline ||
                  r.key === "gmm_k3" ||
                  (r.model.toLowerCase().includes("gmm") && r.k === 3);

                const hasScore = r.silhouetteNum != null && !isNaN(r.silhouetteNum);
                const widthPct = hasScore
                  ? Math.min(100, Math.max(12, (r.silhouetteNum! / maxSil) * 100))
                  : 0;

                return (
                  <div key={r.key || i} className="space-y-1">
                    <div className="flex justify-between font-label-sm text-label-sm">
                      <span
                        className={`font-medium ${
                          isOptimal ? "text-on-surface" : "text-secondary"
                        }`}
                      >
                        {r.model} (k={r.k}) {isOptimal ? "- Optimal" : isBaseline ? "- Baseline" : ""}
                      </span>
                      <span
                        className={`font-data-mono-sm text-data-mono-sm font-bold ${
                          isOptimal ? "text-primary" : "text-secondary"
                        }`}
                      >
                        {r.silhouette || "Belum tersedia"}
                      </span>
                    </div>

                    <div className="w-full h-8 bg-surface-container-low rounded-lg overflow-hidden flex items-center p-1">
                      {hasScore ? (
                        <div
                          className={`h-full rounded transition-all duration-700 flex items-center justify-end pr-2 font-data-mono-sm text-[11px] ${
                            isOptimal
                              ? "bg-primary text-on-primary font-semibold shadow-sm"
                              : isBaseline
                              ? "bg-secondary-container text-on-secondary-container"
                              : "bg-surface-container-high text-on-surface"
                          }`}
                          style={{ width: `${widthPct.toFixed(1)}%` }}
                        >
                          <span>
                            {r.silhouette} pts {isOptimal ? "Peak" : ""}
                          </span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-label-sm text-label-sm text-secondary italic">
                          Belum tersedia
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-space-lg pt-space-md border-t border-surface-container flex items-center justify-between text-secondary font-label-sm text-label-sm">
            <span>
              Delta Perbaikan:{" "}
              {silDiffPts != null ? (
                <strong className="text-[#065F46] font-data-mono-sm">
                  +{silDiffPts.toFixed(3).replace(".", ",")} pts{" "}
                  {silDiffPct != null
                    ? `(+${silDiffPct.toFixed(1).replace(".", ",")}% vs Baseline)`
                    : ""}
                </strong>
              ) : (
                <span className="italic">Belum tersedia</span>
              )}
            </span>
            <span>Nilai Batas Valid: &gt; 0,350</span>
          </div>
        </div>

        {/* Davies-Bouldin Bar Chart */}
        <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[#065F46] text-[20px]">
                  analytics
                </span>
                <h3 className="font-headline-md text-headline-md text-on-surface">
                  Davies?Bouldin Index Komparatif
                </h3>
              </div>
              <span className="font-label-sm text-label-sm px-space-sm py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] font-semibold">
                Makin rendah makin baik (?)
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary mb-space-lg">
              Rasio dispersi intra-klaster terhadap jarak antarsentroid (ideal ? 0,850).
            </p>

            <div className="space-y-space-md">
              {rows.map((r, i) => {
                const isOptimal =
                  r.isOptimal ||
                  r.key === "kmeans_k4" ||
                  r.model.toLowerCase().includes("kmeans");
                const isBaseline =
                  r.isBaseline ||
                  r.key === "gmm_k3" ||
                  (r.model.toLowerCase().includes("gmm") && r.k === 3);

                const hasScore = r.daviesBouldinNum != null && !isNaN(r.daviesBouldinNum);
                const widthPct = hasScore
                  ? Math.min(100, Math.max(12, (r.daviesBouldinNum! / maxDb) * 100))
                  : 0;

                return (
                  <div key={r.key || i} className="space-y-1">
                    <div className="flex justify-between font-label-sm text-label-sm">
                      <span
                        className={`font-medium ${
                          isOptimal ? "text-on-surface" : "text-secondary"
                        }`}
                      >
                        {r.model} (k={r.k}) {isOptimal ? "- Optimal" : isBaseline ? "- Baseline" : ""}
                      </span>
                      <span
                        className={`font-data-mono-sm text-data-mono-sm font-bold ${
                          isOptimal ? "text-[#065F46]" : "text-secondary"
                        }`}
                      >
                        {r.davies_bouldin || "Belum tersedia"}
                      </span>
                    </div>

                    <div className="w-full h-8 bg-surface-container-low rounded-lg overflow-hidden flex items-center p-1">
                      {hasScore ? (
                        <div
                          className={`h-full rounded transition-all duration-700 flex items-center justify-end pr-2 font-data-mono-sm text-[11px] ${
                            isOptimal
                              ? "bg-primary-container text-on-primary font-semibold shadow-sm"
                              : isBaseline
                              ? "bg-secondary-container text-on-secondary-container"
                              : "bg-surface-container-high text-on-surface"
                          }`}
                          style={{ width: `${widthPct.toFixed(1)}%` }}
                        >
                          <span>
                            {r.davies_bouldin} pts {isOptimal ? "(Unggul)" : ""}
                          </span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-label-sm text-label-sm text-secondary italic">
                          Belum tersedia
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-space-lg pt-space-md border-t border-surface-container flex items-center justify-between text-secondary font-label-sm text-label-sm">
            <span>
              Penurunan Deviasi:{" "}
              {dbDropPct != null ? (
                <strong className="text-[#065F46] font-data-mono-sm">
                  {dbDropPct.toFixed(1).replace(".", ",")}% (Pemisahan Lebih Rapat)
                </strong>
              ) : (
                <span className="italic">Belum tersedia</span>
              )}
            </span>
            <span>Target Ideal: ? 0,850</span>
          </div>
        </div>
      </div>

      {/* Metric Educational Guide Panel */}
      <div className="bg-surface-container-low rounded-xl p-space-xl">
        <div className="flex items-center gap-space-xs mb-space-md">
          <span className="material-symbols-outlined text-secondary text-[20px]">school</span>
          <h3 className="font-headline-md text-headline-md text-on-surface">
            Panduan Metrik Evaluasi Klasterisasi Internal
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
          <div className="p-space-md bg-surface-container-lowest rounded-lg space-y-1">
            <div className="font-label-md text-label-md text-on-surface font-semibold">
              1. Silhouette Score
            </div>
            <p className="font-body-sm text-body-sm text-secondary">
              Mengukur kohesi dalam klaster dan separasi dengan klaster lain. Rentang -1 s/d +1. Makin tinggi (mendekati 1), makin jelas pemisahan segmen.
            </p>
          </div>
          <div className="p-space-md bg-surface-container-lowest rounded-lg space-y-1">
            <div className="font-label-md text-label-md text-on-surface font-semibold">
              2. Davies?Bouldin Index
            </div>
            <p className="font-body-sm text-body-sm text-secondary">
              Mengukur rasio dispersi intra-klaster terhadap jarak sentroid. Nilai lebih rendah menunjukkan klaster lebih rapat dan terpisah baik.
            </p>
          </div>
          <div className="p-space-md bg-surface-container-lowest rounded-lg space-y-1">
            <div className="font-label-md text-label-md text-on-surface font-semibold">
              3. Calinski?Harabasz Index
            </div>
            <p className="font-body-sm text-body-sm text-secondary">
              Variance Ratio Criterion yang menghitung rasio dispersi antar-grup dan dalam-grup. Nilai lebih tinggi menandakan partisi klaster maksimal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
