"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { PlayStoreTab } from "@/components/medsos/PlayStoreTab";
import { InstagramTab } from "@/components/medsos/InstagramTab";
import { EvaluationTab } from "@/components/medsos/EvaluationTab";
import { SocialDataBundle, SocialSnapshotCheck } from "@/lib/social/types";
import { loadSocialData } from "@/lib/social/backend";
import { computeSocialSnapshotChecks } from "@/lib/social/calculations";
import { formatNumber } from "@/lib/segmentation/formatters";
import { createClient } from "@/lib/supabase/client";

const TABS = [
  { key: "Play Store", param: "playstore", label: "Play Store", icon: "shop_two" },
  { key: "Instagram", param: "instagram", label: "Instagram", icon: "photo_camera" },
  { key: "Evaluasi & Eksplorasi", param: "evaluasi", label: "Evaluasi & Eksplorasi", icon: "insights" },
] as const;

type SocialTabKey = (typeof TABS)[number]["key"];

function SocialContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = (searchParams.get("tab") || "").toLowerCase().trim();

  const activeTab: SocialTabKey =
    tabParam === "instagram"
      ? "Instagram"
      : tabParam === "evaluasi" || tabParam === "eksplorasi"
      ? "Evaluasi & Eksplorasi"
      : "Play Store";

  const handleTabChange = (key: SocialTabKey) => {
    const tabObj = TABS.find((t) => t.key === key);
    const param = tabObj?.param || "playstore";
    router.push(`/medsos?tab=${param}`, { scroll: false });
  };

  const [data, setData] = useState<SocialDataBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const bundle = await loadSocialData(supabase);
        if (isMounted) {
          setData(bundle);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Gagal memuat data media sosial.");
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

  const checks: SocialSnapshotCheck[] = data
    ? computeSocialSnapshotChecks(data)
    : [];
  const allMatch = checks.length > 0 && checks.every((c) => c.sesuai);

  return (
    <AppLayout
      title="Analisis Media Sosial"
      description="Pantau ulasan pengguna dan performa konten untuk memahami suara pelanggan."
      section="Analisis Media Sosial"
    >
      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 bg-surface-container-lowest rounded-xl border border-surface-container-high">
          <span className="material-symbols-outlined animate-spin text-primary-container text-[32px] mb-3">
            progress_activity
          </span>
          <p className="font-headline-md text-headline-md text-on-surface">
            Memverifikasi izin dan membaca data media sosial...
          </p>
          <p className="font-body-sm text-body-sm text-secondary mt-1">
            Mengambil data Play Store, Instagram, dan benchmark evaluasi
          </p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
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
      )}

      {/* Main Content */}
      {!loading && !error && data && (
        <div className="space-y-space-xl">
          {/* Top Section: Header & Tab Navigation Bar */}
          <div className="flex flex-col gap-space-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container/60">
              {/* Module Sub-nav Pill Switcher */}
              <div className="flex items-center gap-space-xs overflow-x-auto bg-surface-container-low p-1 rounded-xl">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => handleTabChange(tab.key)}
                      className={`flex items-center gap-space-xs px-space-md py-1.5 rounded-lg font-label-md text-label-md transition-all cursor-pointer whitespace-nowrap ${
                        isActive
                          ? "bg-surface-container-lowest text-primary font-semibold shadow-sm"
                          : "text-secondary hover:text-on-surface"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {tab.icon}
                      </span>
                      <span>{tab.label}</span>
                      {tab.key === "Play Store" && (
                        <span className="px-1.5 py-0.2 bg-surface-container rounded-full text-[11px] font-data-mono-sm">
                          {data.reviews.length}
                        </span>
                      )}
                      {tab.key === "Instagram" && (
                        <span className="px-1.5 py-0.2 bg-surface-container rounded-full text-[11px] font-data-mono-sm">
                          {data.posts.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Status Badge & Snapshot Validation Trigger */}
              <div className="flex items-center gap-space-sm shrink-0">
                <div className="flex items-center gap-space-xs px-space-sm py-1 rounded-full bg-secondary-container/40 text-on-secondary-fixed font-data-mono-sm text-data-mono-sm">
                  <span className="w-2 h-2 rounded-full bg-tertiary-container animate-pulse" />
                  <span>{formatNumber(data.reviews.length)} Ulasan ? {formatNumber(data.posts.length)} Post</span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowValidation(!showValidation)}
                  className="flex items-center gap-1 px-space-sm py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface font-label-sm text-label-sm transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-tertiary">
                    verified
                  </span>
                  <span>Validasi Snapshot</span>
                  <span
                    className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${
                      showValidation ? "rotate-180" : ""
                    }`}
                  >
                    expand_more
                  </span>
                </button>
              </div>
            </div>

            {/* Validation Drawer Panel */}
            {showValidation && (
              <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg border border-surface-container/60 space-y-space-md animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface">
                      Validasi Snapshot Data Media Sosial
                    </h3>
                    <p className="font-body-sm text-body-sm text-secondary">
                      Memverifikasi keterhubungan 417 ulasan Play Store dan 55 postingan Instagram terhadap baseline referensi.
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded font-label-sm text-label-sm font-semibold ${
                      allMatch
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {allMatch ? "Semua Baseline Sesuai" : "Terdapat Selisih"}
                  </span>
                </div>

                <div className="overflow-x-auto border border-surface-container rounded-lg">
                  <table className="w-full text-left border-collapse font-body-sm text-body-sm">
                    <thead>
                      <tr className="bg-surface-container-high text-secondary font-label-sm text-label-sm uppercase">
                        <th className="py-2.5 px-space-md">Pemeriksaan</th>
                        <th className="py-2.5 px-space-md text-right">Data Terbaca</th>
                        <th className="py-2.5 px-space-md text-right">Acuan Baseline</th>
                        <th className="py-2.5 px-space-md text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container">
                      {checks.map((c) => (
                        <tr key={c.pemeriksaan} className="hover:bg-surface-container-low/50">
                          <td className="py-2.5 px-space-md font-medium text-on-surface">
                            {c.pemeriksaan}
                          </td>
                          <td className="py-2.5 px-space-md text-right font-data-mono-sm text-data-mono-sm text-on-surface font-semibold">
                            {formatNumber(c.terbaca)}
                          </td>
                          <td className="py-2.5 px-space-md text-right font-data-mono-sm text-data-mono-sm text-secondary">
                            {formatNumber(c.acuan)}
                          </td>
                          <td className="py-2.5 px-space-md text-center">
                            <span
                              className={`px-2 py-0.5 rounded font-label-sm text-label-sm font-semibold ${
                                c.sesuai
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {c.sesuai ? "Sesuai" : "Beda"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Active Tab Content */}
          {activeTab === "Play Store" && (
            <PlayStoreTab
              reviews={data.reviews}
              posts={data.posts}
              onOpenInstagram={() => handleTabChange("Instagram")}
            />
          )}

          {activeTab === "Instagram" && <InstagramTab posts={data.posts} />}

          {activeTab === "Evaluasi & Eksplorasi" && <EvaluationTab data={data} />}
        </div>
      )}
    </AppLayout>
  );
}

export default function SocialPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-24 bg-surface-container-lowest rounded-xl border border-surface-container-high">
          <span className="material-symbols-outlined animate-spin text-primary-container text-[32px] mb-3">
            progress_activity
          </span>
          <p className="font-headline-md text-headline-md text-on-surface">
            Memuat analisis media sosial...
          </p>
        </div>
      }
    >
      <SocialContent />
    </Suspense>
  );
}
