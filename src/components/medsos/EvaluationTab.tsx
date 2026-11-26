"use client";

import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SocialDataBundle } from "@/lib/social/types";
import {
  PREDICTION_MODELS,
  LABELS,
  SENTIMENT_LABEL_MAP,
  computeConfusionMatrix,
} from "@/lib/social/calculations";
import { formatNumber } from "@/lib/segmentation/formatters";

interface EvaluationTabProps {
  data: SocialDataBundle;
}

export const EvaluationTab: React.FC<EvaluationTabProps> = ({ data }) => {
  const [selectedModel, setSelectedModel] = useState<string>("IndoBERT");
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    quality: true,
    readiness: false,
    scope: false,
  });

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Benchmarks chart data
  const benchmarkChartData = useMemo(() => {
    return data.benchmarks.map((b) => ({
      model: b.model_name.replace(" + Logistic Regression", " + LR").replace(" Fine-Tuned", ""),
      fullName: b.model_name,
      Akurasi: Number((b.accuracy * 100).toFixed(1)),
      "Macro-F1": Number((b.macro_f1 * 100).toFixed(1)),
      support: b.test_support,
    }));
  }, [data.benchmarks]);

  // Best model and best diagnostic calculations
  const bestModel = useMemo(() => {
    if (!data.benchmarks || data.benchmarks.length === 0) return null;
    return [...data.benchmarks].sort((a, b) => b.macro_f1 - a.macro_f1)[0];
  }, [data.benchmarks]);

  const bestDiagnostic = useMemo(() => {
    if (!data.diagnostics || data.diagnostics.length === 0) return null;
    return [...data.diagnostics].sort((a, b) => b.silhouette_score - a.silhouette_score)[0];
  }, [data.diagnostics]);

  // Confusion matrix calculation
  const cmResult = useMemo(() => {
    const field = PREDICTION_MODELS[selectedModel] || "test_pred_indobert";
    return computeConfusionMatrix(data.predictions, data.reviews, field);
  }, [data.predictions, data.reviews, selectedModel]);

  const maxCmVal = useMemo(() => {
    let max = 0;
    for (const h of LABELS) {
      for (const p of LABELS) {
        const val = cmResult.matrix[h]?.[p] || 0;
        if (val > max) max = val;
      }
    }
    return Math.max(max, 1);
  }, [cmResult]);

  // Topic clustering k=4 data
  const assignedWithReviews = useMemo(() => {
    const reviewMap = new Map(data.reviews.map((r) => [r.review_id, r]));
    return data.assignments.map((a) => {
      const review = reviewMap.get(a.review_id);
      return {
        ...a,
        app_name: review?.app_name || "Lainnya",
        human_sentiment_label: review?.human_sentiment_label || "neutral",
      };
    });
  }, [data.assignments, data.reviews]);

  // Cluster sizes & top terms
  const clusterSizeData = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const c of data.clusters) {
      counts[c.kmeans_cluster_k4] = 0;
    }
    for (const a of assignedWithReviews) {
      counts[a.kmeans_cluster_k4] = (counts[a.kmeans_cluster_k4] || 0) + 1;
    }
    const total = assignedWithReviews.length || 1;
    return data.clusters.map((c) => ({
      clusterId: c.kmeans_cluster_k4,
      name: `Klaster ${c.kmeans_cluster_k4}`,
      count: counts[c.kmeans_cluster_k4] || 0,
      pct: (((counts[c.kmeans_cluster_k4] || 0) / total) * 100).toFixed(1),
      topTerms: c.cluster_top_terms,
    }));
  }, [data.clusters, assignedWithReviews]);

  // Diagnostic line chart data
  const diagnosticChartData = useMemo(() => {
    return [...data.diagnostics]
      .sort((a, b) => a.num_clusters_k - b.num_clusters_k)
      .map((d) => ({
        k: `k=${d.num_clusters_k}`,
        kNum: d.num_clusters_k,
        silhouette: Number(d.silhouette_score.toFixed(3)),
        inertia: Number(d.inertia.toFixed(2)),
        assessment: d.coherence_assessment,
      }));
  }, [data.diagnostics]);

  return (
    <div className="space-y-space-xl">
      {/* Sub-Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-lg">
        <div>
          <div className="flex items-center gap-space-xs text-secondary font-label-sm text-label-sm uppercase tracking-wider mb-space-xs">
            <span>Analisis Media Sosial</span>
            <span>/</span>
            <span className="text-primary font-semibold">Evaluasi Model & Topik</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
            Evaluasi Model NLP & Eksplorasi Topik
          </h1>
          <p className="font-body-md text-body-md text-secondary mt-1">
            Validasi performa klasifikasi sentimen, matriks konfusi, dan klasterisasi topik kendala pengguna.
          </p>
        </div>

        <div className="flex items-center gap-space-sm bg-surface-container-lowest px-space-md py-1.5 rounded-lg shadow-sm self-start md:self-auto border border-surface-container">
          <span className="material-symbols-outlined text-[18px] text-primary">insights</span>
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-secondary text-[9px] uppercase tracking-wider">
              Snapshot Uji Held-Out
            </span>
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              84 Ulasan Uji (Gold Set)
            </span>
          </div>
        </div>
      </div>

      {/* Row 1: Perbandingan 4 Model Sentimen (Grouped Bar Chart & Metric Table) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Chart Column (7 Kolom) */}
        <div className="lg:col-span-7 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-space-sm mb-space-md">
              <div>
                <span className="font-label-md text-label-md text-secondary uppercase tracking-wider block">
                  Benchmarking Multi-Model
                </span>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Perbandingan Evaluasi 4 Model NLP Sentimen
                </h2>
              </div>
              <div className="flex items-center gap-space-sm">
                <span className="flex items-center gap-1 font-label-sm text-label-sm text-secondary">
                  <span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Akurasi
                </span>
                <span className="flex items-center gap-1 font-label-sm text-label-sm text-secondary">
                  <span className="w-2.5 h-2.5 rounded-sm bg-tertiary-container" /> Macro-F1
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={benchmarkChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="model"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    unit="%"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(val: any) => [`${val}%`, ""]}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="Akurasi" fill="#d2231c" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Macro-F1" fill="#0072ad" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-space-md border-t border-surface-container flex items-center justify-between text-secondary font-label-sm text-label-sm">
            <span>
              Model Terbaik: {bestModel?.model_name || "IndoBERT Pretrained (SmSA)"} (Akurasi{" "}
              {bestModel ? (bestModel.accuracy * 100).toFixed(1) : "77.4"}%, F1{" "}
              {bestModel ? (bestModel.macro_f1 * 100).toFixed(1) : "71.0"}%)
            </span>
            <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              Tervalidasi
            </span>
          </div>
        </div>

        {/* Table Column (5 Kolom) */}
        <div className="lg:col-span-5 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-space-md">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Metrik Detail Validasi
              </h2>
              <span className="material-symbols-outlined text-secondary">table_chart</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-body-sm text-body-sm">
                <thead>
                  <tr className="bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase h-9 border-b border-surface-container">
                    <th className="py-2 px-space-sm font-semibold">Model</th>
                    <th className="py-2 px-space-sm font-semibold text-right">Akurasi</th>
                    <th className="py-2 px-space-sm font-semibold text-right">Macro-F1</th>
                    <th className="py-2 px-space-sm font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-on-surface">
                  {data.benchmarks.map((b) => {
                    const isOptimal = bestModel ? b.model_name === bestModel.model_name : b.model_name.includes("IndoBERT");
                    return (
                      <tr
                        key={b.model_name}
                        className={isOptimal ? "bg-primary/5 font-medium" : "hover:bg-surface-container-low/50"}
                      >
                        <td className="py-2.5 px-space-sm">
                          <div className="flex items-center gap-1.5">
                            {isOptimal && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            )}
                            <span className="truncate max-w-[130px]">{b.model_name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-space-sm text-right font-data-mono-sm font-semibold">
                          {(b.accuracy * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-space-sm text-right font-data-mono-sm font-semibold text-secondary">
                          {(b.macro_f1 * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-space-sm text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-label-sm font-semibold ${
                              isOptimal
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-surface-container text-secondary"
                            }`}
                          >
                            {isOptimal ? "Optimal" : "Baseline"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-space-md border-t border-surface-container text-secondary font-body-sm text-body-sm">
            <span className="material-symbols-outlined text-[16px] text-primary align-text-bottom mr-1">verified</span>Evaluasi pada data uji held-out yang sama menjamin perbandingan adil tanpa data leakage.
          </div>
        </div>
      </div>

      {/* Row 2: Confusion Matrix 3x3 Heatmap (Interactive Model Switcher) */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container/60 flex flex-col gap-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
          <div>
            <span className="font-label-md text-label-md text-secondary uppercase tracking-wider block">
              Error Diagnosis Matrix
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Confusion Matrix 3x3 Sentimen Klasifikasi (N = {cmResult.total})
            </h2>
          </div>

          {/* Model Selector Tabs */}
          <div className="inline-flex p-1 bg-surface-container-low rounded-lg self-start sm:self-auto border border-surface-container">
            {Object.keys(PREDICTION_MODELS).map((modelName) => {
              const active = selectedModel === modelName;
              return (
                <button
                  key={modelName}
                  type="button"
                  onClick={() => setSelectedModel(modelName)}
                  className={`px-space-md py-1 rounded font-label-md text-label-md transition-all cursor-pointer ${
                    active
                      ? "bg-surface-container-lowest text-primary font-semibold shadow-sm"
                      : "text-secondary hover:text-on-surface"
                  }`}
                >
                  {modelName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Matrix Visualization Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-center pt-space-sm">
          <div className="lg:col-span-8 overflow-x-auto">
            <div className="min-w-[420px]">
              {/* Prediction Column Headers */}
              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3" />
                <div className="col-span-9 grid grid-cols-3 gap-2 text-center font-label-md text-label-md text-secondary uppercase">
                  <span>Prediksi Positif</span>
                  <span>Prediksi Netral</span>
                  <span>Prediksi Negatif</span>
                </div>
              </div>

              {/* Matrix Rows (Aktual Positif, Netral, Negatif) */}
              {LABELS.map((humanLabel) => {
                const labelText = SENTIMENT_LABEL_MAP[humanLabel];
                return (
                  <div key={humanLabel} className="grid grid-cols-12 gap-2 mb-2 items-center">
                    <div className="col-span-3 text-right pr-2">
                      <span className="font-label-md text-label-md text-secondary uppercase block">
                        Aktual {labelText}
                      </span>
                    </div>
                    <div className="col-span-9 grid grid-cols-3 gap-2">
                      {LABELS.map((predLabel) => {
                        const val = cmResult.matrix[humanLabel]?.[predLabel] || 0;
                        const isDiagonal = humanLabel === predLabel;
                        const intensity = maxCmVal > 0 ? val / maxCmVal : 0;

                        let bgStyle: React.CSSProperties = {};
                        if (isDiagonal) {
                          bgStyle = {
                            backgroundColor: `rgba(21, 128, 61, ${Math.max(0.12, intensity)})`,
                            color: intensity > 0.4 ? "#ffffff" : "#14532d",
                          };
                        } else if (val > 0) {
                          bgStyle = {
                            backgroundColor: `rgba(210, 35, 28, ${Math.max(0.08, intensity * 0.7)})`,
                            color: "#7f1d1d",
                          };
                        } else {
                          bgStyle = {
                            backgroundColor: "#f8fafc",
                            color: "#94a3b8",
                          };
                        }

                        return (
                          <div
                            key={predLabel}
                            className="h-16 rounded-xl flex flex-col items-center justify-center font-data-mono-lg text-headline-md font-bold transition-all shadow-xs"
                            style={bgStyle}
                          >
                            <span>{val}</span>
                            <span className="font-label-sm text-[10px] opacity-75 font-normal">
                              {cmResult.available > 0
                                ? `${((val / cmResult.available) * 100).toFixed(1)}%`
                                : "0%"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Matrix Diagnostics Sidebar (4 Kolom) */}
          <div className="lg:col-span-4 bg-surface-container-low p-space-lg rounded-xl flex flex-col justify-between space-y-space-md border border-surface-container">
            <div>
              <span className="font-label-md text-label-md text-secondary uppercase tracking-wider block mb-1">
                Diagnostik Model
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                {selectedModel}
              </h3>
              <p className="font-body-sm text-body-sm text-secondary mt-1">
                {cmResult.available} dari {cmResult.total} prediksi tervalidasi pada gold set.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded bg-surface-container font-body-sm text-body-sm">
                <span className="text-secondary">True Positives (Diagonal)</span>
                <span className="font-data-mono-sm font-bold text-emerald-700">
                  {LABELS.reduce((sum, l) => sum + (cmResult.matrix[l]?.[l] || 0), 0)} ulasan
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-surface-container font-body-sm text-body-sm">
                <span className="text-secondary">False Predictions (Off-Diag)</span>
                <span className="font-data-mono-sm font-bold text-rose-700">
                  {cmResult.available -
                    LABELS.reduce((sum, l) => sum + (cmResult.matrix[l]?.[l] || 0), 0)}{" "}
                  ulasan
                </span>
              </div>
            </div>

            <div className="text-[11px] text-secondary">
              Diagonal hijau menunjukkan prediksi tepat (akurasi). Sel merah mengindikasikan misklasifikasi antar kelas sentimen.
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Pemodelan Topik K-Means (k=4) & Diagnostik Silhouette */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Left: 4 Clusters K-Means Detail (8 Kolom) */}
        <div className="lg:col-span-8 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-space-md">
              <div>
                <span className="font-label-md text-label-md text-secondary uppercase tracking-wider block">
                  Unsupervised Topic Clustering
                </span>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  4 Klaster Topik Masalah Pelanggan (K-Means, k=4)
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded bg-surface-container text-secondary font-label-sm text-label-sm font-semibold">
                k = 4 Klaster
              </span>
            </div>

            {/* Clusters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md my-space-sm">
              {clusterSizeData.map((c) => (
                <div
                  key={c.clusterId}
                  className="p-space-md rounded-xl bg-surface-container-low border border-surface-container space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-label-md text-label-md font-semibold text-primary">
                        Klaster {c.clusterId}
                      </span>
                      <span className="font-data-mono-sm text-data-mono-sm font-semibold text-on-surface">
                        {c.count} ulasan ({c.pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden my-1.5">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>

                  <div>
                    <span className="block font-label-sm text-[11px] text-secondary uppercase tracking-wider mb-1">
                      Kata Kunci Dominan:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {c.topTerms
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .slice(0, 5)
                        .map((term) => (
                          <span
                            key={term}
                            className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-data-mono-sm text-[11px]"
                          >
                            {term}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-space-md border-t border-surface-container text-secondary font-body-sm text-body-sm">
            <span className="material-symbols-outlined text-[16px] text-primary align-text-bottom mr-1">analytics</span>Ekstraksi representasi kata kunci utama per klaster menggunakan bobot TF-IDF unigram &amp; bigram.
          </div>
        </div>

        {/* Right: Silhouette Diagnostic Plot (4 Kolom) */}
        <div className="lg:col-span-4 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-space-sm">
              <div>
                <span className="font-label-md text-label-md text-secondary uppercase tracking-wider block">
                  Cluster Validation
                </span>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Silhouette Score vs Nilai K
                </h2>
              </div>
              <span className="material-symbols-outlined text-secondary">show_chart</span>
            </div>

            <p className="font-body-sm text-body-sm text-secondary mb-space-md">
              Evaluasi kohesi klaster untuk mengecek separasi topik teks pendek.
            </p>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={diagnosticChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="k"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 0.03]}
                    tickFormatter={(v: number) => v.toFixed(3)}
                  />
                  <Tooltip
                    formatter={(val: any) => [typeof val === "number" ? val.toFixed(4) : val, "Silhouette"]}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="silhouette"
                    stroke="#d2231c"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#d2231c" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-space-md border-t border-surface-container text-secondary font-label-sm text-label-sm flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span>
              Skor Tertinggi: k = {bestDiagnostic?.num_clusters_k ?? 3} (Skor{" "}
              {bestDiagnostic?.silhouette_score.toFixed(3) ?? "0.023"}) | Kohesi Difus (&lt; 0.05)
            </span>
            <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-semibold w-fit">
              Eksploratif (k=4 Baseline)
            </span>
          </div>
        </div>
      </div>

      {/* Row 4: Accordion Audit Data & Kesiapan Model (Collapsible) */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container/60 flex flex-col gap-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
          <div>
            <span className="font-label-md text-label-md text-secondary uppercase tracking-wider block">
              Governance & Pipeline Assurance
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Audit Kualitas Data & Kesiapan Produksi Model
            </h2>
          </div>
          <span className="px-space-sm py-1 bg-emerald-50 text-emerald-800 rounded-full font-label-sm text-label-sm font-semibold flex items-center gap-1 self-start sm:self-auto">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            Taksonomi Aspek: Terverifikasi Produksi | Topik: Eksploratif
          </span>
        </div>

        {/* Accordion Items */}
        <div className="space-y-space-sm">
          {/* Accordion 1: Audit Kualitas Data */}
          <div className="rounded-xl bg-surface-container-low border border-surface-container overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAccordion("quality")}
              className="w-full px-space-md py-3 text-left flex items-center justify-between hover:bg-surface-container/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  verified_user
                </span>
                <span className="font-headline-md text-body-md font-medium text-on-surface">
                  1. Audit Kebersihan & Kualitas Teks
                </span>
              </div>
              <span
                className={`material-symbols-outlined text-[20px] text-secondary transition-transform duration-200 ${
                  openAccordions.quality ? "rotate-180" : ""
                }`}
              >
                expand_more
              </span>
            </button>
            {openAccordions.quality && (
              <div className="p-space-md border-t border-surface-container bg-surface-container-lowest overflow-x-auto">
                <table className="w-full text-left border-collapse font-body-sm text-body-sm">
                  <thead>
                    <tr className="text-secondary font-label-sm text-label-sm uppercase h-8 border-b border-surface-container">
                      <th className="py-1 px-2 font-semibold">Kategori</th>
                      <th className="py-1 px-2 font-semibold">Nama Metrik</th>
                      <th className="py-1 px-2 font-semibold text-right">Nilai</th>
                      <th className="py-1 px-2 font-semibold">Satuan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container text-on-surface">
                    {data.quality.map((q, idx) => (
                      <tr key={idx} className="hover:bg-surface-container-low/40">
                        <td className="py-2 px-2 text-secondary">{q.metric_category}</td>
                        <td className="py-2 px-2 font-medium">{q.metric_name}</td>
                        <td className="py-2 px-2 text-right font-data-mono-sm font-semibold">
                          {formatNumber(q.value)}
                        </td>
                        <td className="py-2 px-2 text-secondary">{q.unit_or_percentage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Accordion 2: Kesiapan Pemodelan Topik */}
          <div className="rounded-xl bg-surface-container-low border border-surface-container overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAccordion("readiness")}
              className="w-full px-space-md py-3 text-left flex items-center justify-between hover:bg-surface-container/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  psychology
                </span>
                <span className="font-headline-md text-body-md font-medium text-on-surface">
                  2. Kesiapan Pemodelan Topik & Evaluasi Dimensi
                </span>
              </div>
              <span
                className={`material-symbols-outlined text-[20px] text-secondary transition-transform duration-200 ${
                  openAccordions.readiness ? "rotate-180" : ""
                }`}
              >
                expand_more
              </span>
            </button>
            {openAccordions.readiness && (
              <div className="p-space-md border-t border-surface-container bg-surface-container-lowest overflow-x-auto">
                <table className="w-full text-left border-collapse font-body-sm text-body-sm">
                  <thead>
                    <tr className="text-secondary font-label-sm text-label-sm uppercase h-8 border-b border-surface-container">
                      <th className="py-1 px-2 font-semibold">Dimensi</th>
                      <th className="py-1 px-2 font-semibold">Item</th>
                      <th className="py-1 px-2 font-semibold">Status / Kelayakan</th>
                      <th className="py-1 px-2 font-semibold">Rasional</th>
                      <th className="py-1 px-2 font-semibold">Peran Rekomendasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container text-on-surface">
                    {data.readiness.map((r, idx) => (
                      <tr key={idx} className="hover:bg-surface-container-low/40">
                        <td className="py-2 px-2 text-secondary">{r.evaluation_dimension}</td>
                        <td className="py-2 px-2 font-medium">{r.dimension_item}</td>
                        <td className="py-2 px-2">
                          <span className="px-2 py-0.5 rounded font-label-sm text-[11px] font-semibold bg-emerald-50 text-emerald-800">
                            {r.status_or_feasibility}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-secondary text-[12px]">{r.key_evidence_and_rationale}</td>
                        <td className="py-2 px-2 font-medium text-primary text-[12px]">{r.recommended_role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Accordion 3: Cakupan Analisis & Hak Akses */}
          <div className="rounded-xl bg-surface-container-low border border-surface-container overflow-hidden">
            <button
              type="button"
              onClick={() => toggleAccordion("scope")}
              className="w-full px-space-md py-3 text-left flex items-center justify-between hover:bg-surface-container/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  domain_verification
                </span>
                <span className="font-headline-md text-body-md font-medium text-on-surface">
                  3. Cakupan Analisis & Sampel Gold Set
                </span>
              </div>
              <span
                className={`material-symbols-outlined text-[20px] text-secondary transition-transform duration-200 ${
                  openAccordions.scope ? "rotate-180" : ""
                }`}
              >
                expand_more
              </span>
            </button>
            {openAccordions.scope && (
              <div className="p-space-md border-t border-surface-container bg-surface-container-lowest overflow-x-auto">
                <table className="w-full text-left border-collapse font-body-sm text-body-sm">
                  <thead>
                    <tr className="text-secondary font-label-sm text-label-sm uppercase h-8 border-b border-surface-container">
                      <th className="py-1 px-2 font-semibold">Nama Cakupan</th>
                      <th className="py-1 px-2 font-semibold text-right">Ukuran (N)</th>
                      <th className="py-1 px-2 font-semibold text-right">% Gold Set</th>
                      <th className="py-1 px-2 font-semibold text-right">Rata-rata Kata</th>
                      <th className="py-1 px-2 font-semibold text-right">Median Kata</th>
                      <th className="py-1 px-2 font-semibold">Trade-off Analitis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container text-on-surface">
                    {data.scope.map((s, idx) => (
                      <tr key={idx} className="hover:bg-surface-container-low/40">
                        <td className="py-2 px-2 font-medium text-on-surface">{s.scope_name}</td>
                        <td className="py-2 px-2 text-right font-data-mono-sm font-semibold">{s.sample_size_n}</td>
                        <td className="py-2 px-2 text-right font-data-mono-sm text-secondary">{s.pct_of_gold_set}%</td>
                        <td className="py-2 px-2 text-right font-data-mono-sm text-secondary">{s.mean_words}</td>
                        <td className="py-2 px-2 text-right font-data-mono-sm text-secondary">{s.median_words}</td>
                        <td className="py-2 px-2 text-secondary text-[12px]">{s.analytical_trade_off}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
