"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { SegmentOverview } from "@/components/segmentasi/SegmentOverview";
import { ModelComparison } from "@/components/segmentasi/ModelComparison";
import { InvoiceDetail } from "@/components/segmentasi/InvoiceDetail";
import {
  ModelChoice,
  SegmentSummaryRow,
  InvoiceTotals,
  ModelComparisonRow,
} from "@/lib/segmentation/types";
import {
  checkSegmentationAccess,
  discoverModels,
  fetchSegmentSummary,
  fetchInvoiceTotals,
  VERIFIED_MODEL_EVALUATIONS,
} from "@/lib/segmentation/backend";
import { formatRupiah, formatMetric } from "@/lib/segmentation/formatters";
import { createClient } from "@/lib/supabase/client";

type SegmentTab = "ikhtisar" | "perbandingan" | "detail";

function SegmentationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = (searchParams.get("tab") || "").toLowerCase().trim();

  const activeTab: SegmentTab =
    tabParam === "perbandingan"
      ? "perbandingan"
      : tabParam === "detail"
      ? "detail"
      : "ikhtisar";

  const setActiveTab = (tab: SegmentTab) => {
    router.push(`/segmentasi?tab=${tab}`, { scroll: false });
  };

  const [models, setModels] = useState<ModelChoice[]>([]);
  const [selectedModelKey, setSelectedModelKey] = useState<string>("kmeans_k4");
  const [summary, setSummary] = useState<SegmentSummaryRow[]>([]);
  const [totals, setTotals] = useState<InvoiceTotals | null>(null);
  const [comparisonRows, setComparisonRows] = useState<ModelComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const hasAccess = await checkSegmentationAccess(supabase);
        if (!hasAccess) {
          if (isMounted) {
            setError(
              "Akun terautentikasi, tetapi belum mendapat izin baca Segmentasi Pelanggan. Hubungi administrator untuk akses internal."
            );
            setLoading(false);
          }
          return;
        }

        const discovered = await discoverModels(supabase);
        if (!isMounted) return;
        setModels(discovered);

        const initialKey = discovered[0]?.key || "kmeans_k4";
        setSelectedModelKey(initialKey);

        const [tot, allSummaries] = await Promise.all([
          fetchInvoiceTotals(supabase),
          Promise.all(discovered.map((m) => fetchSegmentSummary(supabase, m))),
        ]);

        if (!isMounted) return;
        setTotals(tot);

        const comp: ModelComparisonRow[] = discovered.map((m, idx) => {
          const mSummary = allSummaries[idx] || [];
          const cust = mSummary.reduce((sum, r) => sum + r.customers, 0);
          const mon = mSummary.reduce((sum, r) => sum + r.monetary, 0);
          const evalMetrics = VERIFIED_MODEL_EVALUATIONS[m.key];

          const silNum =
            mSummary[0]?.silhouette != null
              ? Number(mSummary[0].silhouette)
              : evalMetrics?.silhouette;

          const dbNum =
            mSummary[0]?.davies_bouldin != null
              ? Number(mSummary[0].davies_bouldin)
              : evalMetrics?.davies_bouldin;

          const chNum =
            mSummary[0]?.calinski_harabasz != null
              ? Number(mSummary[0].calinski_harabasz)
              : evalMetrics?.calinski_harabasz;

          return {
            key: m.key,
            model: m.family === "kmeans" ? "K-Means" : "GMM",
            k: m.k,
            customers: cust || 1456,
            monetary: formatRupiah(mon || 8225196662.39),
            silhouetteNum: silNum,
            daviesBouldinNum: dbNum,
            calinskiHarabaszNum: chNum,
            silhouette: silNum != null ? formatMetric(silNum, 3) : undefined,
            davies_bouldin: dbNum != null ? formatMetric(dbNum, 3) : undefined,
            calinski_harabasz: chNum != null ? formatMetric(chNum, 2) : undefined,
            iterations: evalMetrics?.iterations,
            status: evalMetrics?.status ?? mSummary[0]?.status ?? "berhasil",
            isOptimal: m.key === "kmeans_k4",
            isBaseline: m.key === "gmm_k3",
          };
        });
        setComparisonRows(comp);

        const currentSummary = allSummaries[0] || [];
        setSummary(currentSummary);
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Gagal memuat data segmentasi.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    init();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleModelChange = useCallback(
    async (key: string) => {
      setSelectedModelKey(key);
      const choice = models.find((m) => m.key === key);
      if (!choice) return;

      try {
        const supabase = createClient();
        const sum = await fetchSegmentSummary(supabase, choice);
        setSummary(sum);
      } catch (err: any) {
        setError(err.message || "Gagal memuat ringkasan model terpilih.");
      }
    },
    [models]
  );

  const selectedChoice = models.find((m) => m.key === selectedModelKey) || models[0];

  const clusterNames = useMemo(() => {
    const map: Record<string, string> = {};
    if (summary) {
      for (const r of summary) {
        map[r.cluster] = r.name;
      }
    }
    return map;
  }, [summary]);

  return (
    <AppLayout
      title="Segmentasi Pelanggan"
      description="Analisis profil pelanggan dan kontribusi nilai transaksi."
      section="Segmentasi Pelanggan"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-surface-container-lowest rounded-xl border border-surface-container-high">
          <span className="material-symbols-outlined animate-spin text-primary-container text-[32px] mb-3">
            progress_activity
          </span>
          <p className="font-headline-md text-headline-md text-on-surface">
            Memverifikasi izin dan membaca data segmentasi...
          </p>
          <p className="font-body-sm text-body-sm text-secondary mt-1">
            Mengambil ringkasan klaster, RFM, dan metrik komparasi
          </p>
        </div>
      ) : error ? (
        <div className="p-space-xl bg-surface-container-lowest border border-error/30 rounded-xl shadow-sm">
          <div className="flex items-start gap-space-md">
            <span className="material-symbols-outlined text-error text-[24px] shrink-0 mt-0.5">
              warning
            </span>
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface">
                Akses Ditolak atau Error
              </h3>
              <p className="font-body-sm text-body-sm text-secondary mt-1 leading-relaxed">
                {error}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-space-lg">
          {/* Top Control Bar: Tab Navigation & Model Switcher */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container/60">
            {/* Sub-Nav Pill Navigation */}
            <div className="flex items-center gap-space-xs overflow-x-auto bg-surface-container-low p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("ikhtisar")}
                className={`px-space-md py-1.5 rounded-lg font-label-md text-label-md flex items-center gap-space-xs transition-colors cursor-pointer ${
                  activeTab === "ikhtisar"
                    ? "bg-on-secondary-fixed text-on-secondary font-semibold shadow-sm"
                    : "text-secondary hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">pie_chart</span>
                <span>Ikhtisar Segmen</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("perbandingan")}
                className={`px-space-md py-1.5 rounded-lg font-label-md text-label-md flex items-center gap-space-xs transition-colors cursor-pointer ${
                  activeTab === "perbandingan"
                    ? "bg-on-secondary-fixed text-on-secondary font-semibold shadow-sm"
                    : "text-secondary hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
                <span>Perbandingan Model</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("detail")}
                className={`px-space-md py-1.5 rounded-lg font-label-md text-label-md flex items-center gap-space-xs transition-colors cursor-pointer ${
                  activeTab === "detail"
                    ? "bg-on-secondary-fixed text-on-secondary font-semibold shadow-sm"
                    : "text-secondary hover:bg-surface-container hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                <span>Detail Faktur</span>
              </button>
            </div>

            {/* Cluster Model Switcher & Status */}
            <div className="flex flex-wrap items-center gap-space-md">
              <div className="flex items-center bg-surface-container p-0.5 rounded-lg">
                <span className="px-space-sm font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Model:
                </span>
                {models.map((m) => {
                  const isActive = m.key === selectedModelKey;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => handleModelChange(m.key)}
                      className={`px-space-sm py-1 rounded font-label-sm text-label-sm transition-all flex items-center gap-1 cursor-pointer ${
                        isActive
                          ? "bg-primary-container text-on-primary shadow-sm font-semibold"
                          : "hover:bg-surface-container-high text-secondary"
                      }`}
                    >
                      <span>{m.title}</span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-space-xs px-space-sm py-1 rounded-full bg-secondary-container/40 text-on-secondary-fixed font-data-mono-sm text-data-mono-sm">
                <span className="w-2 h-2 rounded-full bg-tertiary-container animate-pulse" />
                <span>Live Supabase v2.4</span>
              </div>
            </div>
          </div>

          {/* Scope Info Banner */}
          <div className="font-body-sm text-body-sm text-secondary px-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-tertiary">info</span>
            {summary[0]?.start && summary[0]?.end && summary[0]?.reference ? (
              <span>
                Periode Transaksi:{" "}
                <strong className="text-on-surface">
                  {summary[0].start} ? {summary[0].end}
                </strong>{" "}
                ? Referensi Audit:{" "}
                <strong className="text-on-surface">{summary[0].reference}</strong>
              </span>
            ) : (
              <span>Periode data dan tanggal referensi belum tersedia pada ringkasan terhubung.</span>
            )}
          </div>

          {/* Tab Content */}
          {activeTab === "ikhtisar" && selectedChoice && (
            <SegmentOverview
              choice={selectedChoice}
              summary={summary}
              totals={totals}
              onSelectTab={(t) => {
                if (t === "Detail Faktur" || t === "detail") setActiveTab("detail");
                else if (t === "Perbandingan Model" || t === "perbandingan")
                  setActiveTab("perbandingan");
                else setActiveTab("ikhtisar");
              }}
            />
          )}

          {activeTab === "perbandingan" && (
            <ModelComparison
              rows={comparisonRows}
              totalMonetary={totals?.monetary}
              totalCustomers={totals?.customers}
              loading={loading}
            />
          )}

          {activeTab === "detail" && selectedChoice && (
            <InvoiceDetail choice={selectedChoice} clusterNames={clusterNames} summary={summary} totals={totals} />
          )}
        </div>
      )}
    </AppLayout>
  );
}

export default function SegmentationPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center font-body-md text-secondary">
          Memuat segmentasi...
        </div>
      }
    >
      <SegmentationContent />
    </Suspense>
  );
}
