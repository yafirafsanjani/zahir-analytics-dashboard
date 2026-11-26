"use client";

import React, { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { PlayStoreReview, InstagramPost } from "@/lib/social/types";
import {
  ASPECTS,
  LABELS,
  SENTIMENT_LABEL_MAP,
  SENTIMENT_COLORS,
} from "@/lib/social/calculations";
import { formatNumber } from "@/lib/segmentation/formatters";

interface PlayStoreTabProps {
  reviews: PlayStoreReview[];
  posts: InstagramPost[];
  onOpenInstagram: () => void;
}

const STAR_COLORS = ["#d2231c", "#ea580c", "#f59e0b", "#0284c7", "#10b981"];

export const PlayStoreTab: React.FC<PlayStoreTabProps> = ({
  reviews,
  posts,
  onOpenInstagram,
}) => {
  const allApps = useMemo(() => {
    return Array.from(new Set(reviews.map((r) => r.app_name))).sort();
  }, [reviews]);

  const minDate = useMemo(() => {
    return reviews.reduce((min, r) => (r.review_date < min ? r.review_date : min), reviews[0]?.review_date || "");
  }, [reviews]);

  const maxDate = useMemo(() => {
    return reviews.reduce((max, r) => (r.review_date > max ? r.review_date : max), reviews[0]?.review_date || "");
  }, [reviews]);

  // Filters state
  const [startDate, setStartDate] = useState(minDate);
  const [endDate, setEndDate] = useState(maxDate);
  const [selectedApps, setSelectedApps] = useState<string[]>(allApps);
  const [selectedRatings, setSelectedRatings] = useState<number[]>([1, 2, 3, 4, 5]);
  const [selectedSentiments, setSelectedSentiments] = useState<string[]>(LABELS);
  const [trendInterval, setTrendInterval] = useState<"Bulanan" | "Harian">("Bulanan");
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [searchReviewQuery, setSearchReviewQuery] = useState("");

  const resetFilters = () => {
    setStartDate(minDate);
    setEndDate(maxDate);
    setSelectedApps(allApps);
    setSelectedRatings([1, 2, 3, 4, 5]);
    setSelectedSentiments(LABELS);
    setSearchReviewQuery("");
  };

  const toggleRating = (r: number) => {
    if (selectedRatings.includes(r)) {
      if (selectedRatings.length > 1) {
        setSelectedRatings(selectedRatings.filter((x) => x !== r));
      }
    } else {
      setSelectedRatings([...selectedRatings, r].sort());
    }
  };

  const toggleSentiment = (s: string) => {
    if (selectedSentiments.includes(s)) {
      if (selectedSentiments.length > 1) {
        setSelectedSentiments(selectedSentiments.filter((x) => x !== s));
      }
    } else {
      setSelectedSentiments([...selectedSentiments, s]);
    }
  };

  // Filtered reviews
  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (startDate && r.review_date < startDate) return false;
      if (endDate && r.review_date > endDate) return false;
      if (!selectedApps.includes(r.app_name)) return false;
      if (!selectedRatings.includes(r.score)) return false;
      if (!selectedSentiments.includes(r.human_sentiment_label)) return false;
      return true;
    });
  }, [reviews, startDate, endDate, selectedApps, selectedRatings, selectedSentiments]);

  // KPIs
  const totalReviews = filtered.length;
  const avgRating =
    totalReviews > 0
      ? (filtered.reduce((sum, r) => sum + r.score, 0) / totalReviews).toFixed(2)
      : "0.00";

  const sentimentCounts = useMemo(() => {
    const counts = { positive: 0, neutral: 0, negative: 0 };
    for (const r of filtered) {
      if (counts[r.human_sentiment_label] !== undefined) {
        counts[r.human_sentiment_label]++;
      }
    }
    return counts;
  }, [filtered]);

  const aspectsMentionedCount = useMemo(() => {
    return filtered.filter((r) =>
      Object.keys(ASPECTS).some((k) => Boolean((r as any)[k]))
    ).length;
  }, [filtered]);

  const totalAspectPairs = useMemo(() => {
    let total = 0;
    for (const r of filtered) {
      for (const k of Object.keys(ASPECTS)) {
        if ((r as any)[k]) total++;
      }
    }
    return total;
  }, [filtered]);

  const dominantSentiment = useMemo(() => {
    if (totalReviews === 0) return { label: "-", pct: "0.0" };
    const entries = Object.entries(sentimentCounts);
    entries.sort((a, b) => b[1] - a[1]);
    const top = entries[0];
    return {
      label: SENTIMENT_LABEL_MAP[top[0]] || top[0],
      pct: ((top[1] / totalReviews) * 100).toFixed(1),
    };
  }, [sentimentCounts, totalReviews]);

  // Sentiment donut data
  const sentimentDonutData = useMemo(() => {
    return [
      { name: "Positif", count: sentimentCounts.positive, color: "#059669" },
      { name: "Netral", count: sentimentCounts.neutral, color: "#64748B" },
      { name: "Negatif", count: sentimentCounts.negative, color: "#d2231c" },
    ].filter((d) => d.count > 0);
  }, [sentimentCounts]);

  // Rating breakdown (5 to 1)
  const ratingDistribution = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of filtered) {
      counts[r.score] = (counts[r.score] || 0) + 1;
    }
    return [5, 4, 3, 2, 1].map((s) => ({
      star: s,
      count: counts[s] || 0,
      pct: totalReviews > 0 ? (((counts[s] || 0) / totalReviews) * 100).toFixed(1) : "0.0",
    }));
  }, [filtered, totalReviews]);

  // Trend line/area data
  const trendData = useMemo(() => {
    const periodMap = new Map<string, { Positif: number; Netral: number; Negatif: number; total: number }>();
    for (const r of filtered) {
      const p = trendInterval === "Bulanan" ? r.review_date.substring(0, 7) : r.review_date;
      if (!periodMap.has(p)) {
        periodMap.set(p, { Positif: 0, Netral: 0, Negatif: 0, total: 0 });
      }
      const entry = periodMap.get(p)!;
      const sentLabel = SENTIMENT_LABEL_MAP[r.human_sentiment_label] as "Positif" | "Netral" | "Negatif";
      if (entry[sentLabel] !== undefined) {
        entry[sentLabel]++;
        entry.total++;
      }
    }

    const sortedPeriods = Array.from(periodMap.keys()).sort();
    return sortedPeriods.map((p) => ({
      periode: p,
      ...periodMap.get(p)!,
    }));
  }, [filtered, trendInterval]);

  // Aspect stacked data
  const aspectSentimentStackedData = useMemo(() => {
    const map = new Map<string, { Positif: number; Netral: number; Negatif: number; total: number }>();
    for (const [key, label] of Object.entries(ASPECTS)) {
      map.set(label, { Positif: 0, Netral: 0, Negatif: 0, total: 0 });
    }

    for (const r of filtered) {
      const sent = SENTIMENT_LABEL_MAP[r.human_sentiment_label] as "Positif" | "Netral" | "Negatif";
      for (const [key, label] of Object.entries(ASPECTS)) {
        if ((r as any)[key]) {
          const entry = map.get(label)!;
          entry[sent]++;
          entry.total++;
        }
      }
    }

    return Array.from(map.entries())
      .filter(([_, data]) => data.total > 0)
      .map(([label, data]) => ({
        aspek: label,
        Positif: data.Positif,
        Netral: data.Netral,
        Negatif: data.Negatif,
        PositifPct: Number(((data.Positif / data.total) * 100).toFixed(1)),
        NetralPct: Number(((data.Netral / data.total) * 100).toFixed(1)),
        NegatifPct: Number(((data.Negatif / data.total) * 100).toFixed(1)),
        total: data.total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Recent 3 reviews for feed
  const recentReviews = useMemo(() => {
    return [...filtered]
      .sort((a, b) => b.review_date.localeCompare(a.review_date))
      .slice(0, 3);
  }, [filtered]);

  // Filtered reviews for full table
  const allFilteredReviews = useMemo(() => {
    if (!searchReviewQuery.trim()) return filtered;
    const q = searchReviewQuery.toLowerCase();
    return filtered.filter(
      (r) =>
        r.app_name.toLowerCase().includes(q) ||
        r.review_id.toLowerCase().includes(q)
    );
  }, [filtered, searchReviewQuery]);

  const handleExportFiltered = () => {
    const params = new URLSearchParams({
      target: "playstore",
      startDate,
      endDate,
      app: selectedApps.join(","),
      rating: selectedRatings.join(","),
      sentiment: selectedSentiments.join(","),
    });
    window.open(`/api/medsos/export?${params.toString()}`, "_blank");
  };

  return (
    <div className="space-y-space-xl">
      {/* Sub-Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-lg">
        <div>
          <div className="flex items-center gap-space-xs text-secondary font-label-sm text-label-sm uppercase tracking-wider mb-space-xs">
            <span>Analisis Media Sosial</span>
            <span>/</span>
            <span className="text-primary font-semibold">Play Store Reviews</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
            Analisis Ulasan Play Store
          </h1>
          <p className="font-body-md text-body-md text-secondary mt-1">
            Monitoring performa rating aplikasi, kepuasan pengguna, dan topik kendala teknis.
          </p>
        </div>

        <div className="flex items-center gap-space-sm bg-surface-container-lowest px-space-md py-1.5 rounded-lg shadow-sm self-start md:self-auto border border-surface-container">
          <span className="material-symbols-outlined text-[18px] text-primary">shop_two</span>
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-secondary text-[9px] uppercase tracking-wider">
              Total Database
            </span>
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              417 Ulasan Terverifikasi
            </span>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container/60 space-y-space-md">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md items-end">
          {/* Date Selector */}
          <div className="md:col-span-5">
            <label className="block font-label-sm text-label-sm text-secondary uppercase tracking-wider mb-1.5">
              Periode Ulasan (Awal - Akhir)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 px-3 bg-surface-container-low rounded-lg font-data-mono-sm text-data-mono-sm text-on-surface border border-transparent focus:border-surface-container-high focus:outline-none"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 px-3 bg-surface-container-low rounded-lg font-data-mono-sm text-data-mono-sm text-on-surface border border-transparent focus:border-surface-container-high focus:outline-none"
              />
            </div>
          </div>

          {/* App Select */}
          <div className="md:col-span-4">
            <label className="block font-label-sm text-label-sm text-secondary uppercase tracking-wider mb-1.5">
              Aplikasi Zahir
            </label>
            <div className="relative">
              <select
                value={selectedApps.length === allApps.length ? "all" : selectedApps[0] || "all"}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "all") setSelectedApps(allApps);
                  else setSelectedApps([val]);
                }}
                className="w-full h-10 px-3 pr-8 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface appearance-none focus:outline-none cursor-pointer border border-transparent focus:border-surface-container-high"
              >
                <option value="all">Semua Aplikasi ({allApps.length})</option>
                {allApps.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary pointer-events-none text-[18px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="md:col-span-3 flex items-center justify-end gap-space-sm">
            <button
              type="button"
              onClick={resetFilters}
              className="h-10 px-space-md bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={handleExportFiltered}
              disabled={totalReviews === 0}
              className="h-10 px-space-md bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-md text-label-md flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">file_download</span>
              <span>Ekspor</span>
            </button>
          </div>
        </div>

        {/* Secondary Filter Pills: Rating Stars & Sentiment */}
        <div className="pt-space-md border-t border-surface-container flex flex-wrap items-center justify-between gap-space-md">
          {/* Star Rating Pills */}
          <div className="flex items-center gap-space-xs flex-wrap">
            <span className="font-label-sm text-label-sm text-secondary mr-1">Rating:</span>
            <button
              type="button"
              onClick={() => setSelectedRatings([1, 2, 3, 4, 5])}
              className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm transition-all cursor-pointer ${
                selectedRatings.length === 5
                  ? "bg-on-secondary-fixed text-on-secondary font-semibold"
                  : "bg-surface-container hover:bg-surface-container-high text-secondary"
              }`}
            >
              Semua (1-5?)
            </button>
            {[5, 4, 3, 2, 1].map((r) => {
              const active = selectedRatings.includes(r) && selectedRatings.length < 5;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRating(r)}
                  className={`flex items-center gap-0.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm transition-all cursor-pointer ${
                    active
                      ? "bg-primary text-on-primary font-semibold shadow-sm"
                      : "bg-surface-container hover:bg-surface-container-high text-secondary"
                  }`}
                >
                  <span>{r}</span>
                  <span className="material-symbols-outlined text-[14px]">star</span>
                </button>
              );
            })}
          </div>

          {/* Sentiment Pills */}
          <div className="flex items-center gap-space-xs flex-wrap">
            <span className="font-label-sm text-label-sm text-secondary mr-1">Sentimen:</span>
            <button
              type="button"
              onClick={() => setSelectedSentiments(LABELS)}
              className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm transition-all cursor-pointer ${
                selectedSentiments.length === 3
                  ? "bg-on-secondary-fixed text-on-secondary font-semibold"
                  : "bg-surface-container hover:bg-surface-container-high text-secondary"
              }`}
            >
              Semua
            </button>
            {LABELS.map((s) => {
              const active = selectedSentiments.includes(s) && selectedSentiments.length < 3;
              const label = SENTIMENT_LABEL_MAP[s];
              const colorClass =
                s === "positive"
                  ? "bg-emerald-600 text-white"
                  : s === "neutral"
                  ? "bg-slate-600 text-white"
                  : "bg-rose-600 text-white";
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSentiment(s)}
                  className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm transition-all cursor-pointer ${
                    active
                      ? `${colorClass} font-semibold shadow-sm`
                      : "bg-surface-container hover:bg-surface-container-high text-secondary"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 1: KPI Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
        {/* Card 1: Total Reviews */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-md text-label-md text-secondary uppercase tracking-wider">
                Total Volume Ulasan
              </span>
              <div className="flex items-baseline gap-space-sm mt-1">
                <span className="font-data-mono-lg text-headline-xl font-bold text-on-surface">
                  {formatNumber(totalReviews)}
                </span>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-label-sm text-label-sm font-semibold">
                  <span className="material-symbols-outlined text-[13px]">verified</span>
                  100% Gold Set
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">rate_review</span>
            </div>
          </div>
          <div className="mt-space-md pt-space-xs flex items-center justify-between text-secondary font-body-sm text-body-sm border-t border-surface-container">
            <span>Ulasan Beraspek</span>
            <span className="font-data-mono-sm text-data-mono-sm font-semibold text-on-surface">
              {aspectsMentionedCount} ulasan ({totalAspectPairs} pasangan)
            </span>
          </div>
        </div>

        {/* Card 2: Rating Score */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-md text-label-md text-secondary uppercase tracking-wider">
                Rating Rata-rata
              </span>
              <div className="flex items-baseline gap-space-sm mt-1">
                <span className="font-data-mono-lg text-headline-xl font-bold text-on-surface">
                  {avgRating}
                </span>
                <span className="font-body-md text-body-md text-secondary font-normal">/ 5.0</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-[22px]">star</span>
            </div>
          </div>
          <div className="mt-space-md pt-space-xs flex items-center gap-1 text-amber-500 text-[16px] border-t border-surface-container">
            {[1, 2, 3, 4, 5].map((st) => (
              <span
                key={st}
                className="material-symbols-outlined text-[18px]"
                style={{
                  color: st <= Math.round(Number(avgRating)) ? "#f59e0b" : "#cbd5e1",
                }}
              >
                star
              </span>
            ))}
            <span className="font-data-mono-sm text-data-mono-sm text-secondary ml-1">
              {Number(avgRating) >= 4.0 ? "Sangat Baik" : "Moderat"}
            </span>
          </div>
        </div>

        {/* Card 3: Dominant Sentiment */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-md text-label-md text-secondary uppercase tracking-wider">
                Sentimen Dominan
              </span>
              <div className="flex items-baseline gap-space-sm mt-1">
                <span className="font-data-mono-lg text-headline-xl font-bold text-on-surface">
                  {dominantSentiment.label}
                </span>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-label-sm text-label-sm font-semibold">
                  {dominantSentiment.pct}%
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-[22px]">sentiment_satisfied</span>
            </div>
          </div>
          <div className="mt-space-md pt-space-xs flex items-center justify-between text-secondary font-body-sm text-body-sm border-t border-surface-container">
            <span>Rasio Positif : Negatif</span>
            <span className="font-data-mono-sm text-data-mono-sm font-semibold text-on-surface">
              {sentimentCounts.positive} : {sentimentCounts.negative} ({dominantSentiment.pct}% dari {formatNumber(totalReviews)} ulasan)
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Charts (Distribution & Trend) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Chart 1A: Sentiment Donut (3 Cols) */}
        <div className="lg:col-span-3 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-space-md">
              <h2 className="font-headline-md text-headline-md text-on-surface">Distribusi Sentimen</h2>
              <span className="material-symbols-outlined text-secondary text-[18px]">pie_chart</span>
            </div>

            <div className="h-44 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentDonutData}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {sentimentDonutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} Ulasan`, ""]}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-data-mono-lg text-headline-md font-bold text-on-surface">
                  {dominantSentiment.pct}%
                </span>
                <span className="font-label-sm text-[10px] text-secondary uppercase">
                  {dominantSentiment.label}
                </span>
              </div>
            </div>
          </div>

          {/* Legend breakdown */}
          <div className="pt-space-md border-t border-surface-container space-y-1.5">
            {sentimentDonutData.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-body-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-secondary">{d.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-data-mono-sm text-data-mono-sm font-semibold text-on-surface">
                    {d.count}
                  </span>
                  <span className="text-secondary text-[11px]">
                    ({totalReviews > 0 ? (((d.count) / totalReviews) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 1B: Star Rating Distribution (3 Cols) */}
        <div className="lg:col-span-3 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-space-md">
              <h2 className="font-headline-md text-headline-md text-on-surface">Distribusi Bintang</h2>
              <span className="material-symbols-outlined text-secondary text-[18px]">equalizer</span>
            </div>

            <div className="space-y-3 my-space-md">
              {ratingDistribution.map((r, i) => (
                <div key={r.star} className="space-y-1">
                  <div className="flex items-center justify-between font-label-sm text-label-sm">
                    <div className="flex items-center gap-1 text-secondary">
                      <span className="font-semibold text-on-surface">{r.star}</span>
                      <span className="material-symbols-outlined text-[14px] text-amber-500">star</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-data-mono-sm text-data-mono-sm font-semibold text-on-surface">
                        {r.count}
                      </span>
                      <span className="text-secondary text-[11px]">({r.pct}%)</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${r.pct}%`,
                        backgroundColor: STAR_COLORS[5 - r.star],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-space-md border-t border-surface-container flex items-center justify-between text-secondary font-label-sm text-label-sm">
            <span>Ulasan Rating 4-5?</span>
            <span className="font-data-mono-sm text-data-mono-sm font-semibold text-emerald-700">
              {totalReviews > 0
                ? (
                    ((filtered.filter((r) => r.score >= 4).length) / totalReviews) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </span>
          </div>
        </div>

        {/* Chart 1C: Daily / Monthly Trend (6 Cols) */}
        <div className="lg:col-span-6 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-space-sm mb-space-md">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">Tren Ulasan Volume & Sentimen</h2>
                <p className="font-body-sm text-body-sm text-secondary">Dinamika persepsi kepuasan pengguna lintas waktu</p>
              </div>
              <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg">
                {(["Bulanan", "Harian"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTrendInterval(mode)}
                    className={`px-2.5 py-1 rounded font-label-sm text-label-sm transition-colors cursor-pointer ${
                      trendInterval === mode
                        ? "bg-surface-container-lowest text-primary font-semibold shadow-sm"
                        : "text-secondary hover:text-on-surface"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="periode"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Positif"
                    stackId="1"
                    stroke="#059669"
                    fill="#059669"
                    fillOpacity={0.2}
                  />
                  <Area
                    type="monotone"
                    dataKey="Netral"
                    stackId="1"
                    stroke="#64748b"
                    fill="#64748b"
                    fillOpacity={0.2}
                  />
                  <Area
                    type="monotone"
                    dataKey="Negatif"
                    stackId="1"
                    stroke="#d2231c"
                    fill="#d2231c"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-space-md border-t border-surface-container flex items-center justify-between text-secondary font-label-sm text-label-sm">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600" /> Positif
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-500" /> Netral
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-600" /> Negatif
              </span>
            </div>
            <span>{trendData.length} Titik Data</span>
          </div>
        </div>
      </div>

      {/* Row 3: Aspect Sentiment Deep-Dive (Stacked Horizontal Bars) */}
      <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container/60">
        <div className="flex flex-wrap items-center justify-between gap-space-md mb-space-lg">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Analisis Aspek & Topik Ulasan
            </h2>
            <p className="font-body-sm text-body-sm text-secondary">
              Proporsi sentimen pada 8 area fungsi utama Zahir Android ecosystem
            </p>
          </div>
          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-secondary">
              <span className="w-2.5 h-2.5 rounded bg-emerald-600" /> Positif
              <span className="w-2.5 h-2.5 rounded bg-slate-500 ml-2" /> Netral
              <span className="w-2.5 h-2.5 rounded bg-rose-600 ml-2" /> Negatif
            </div>
            <span className="px-2.5 py-1 rounded bg-surface-container-low text-secondary font-label-sm text-label-sm font-semibold">
              Total 8 Aspek
            </span>
          </div>
        </div>

        {/* 8 Aspect Stacked Bar Rows */}
        <div className="space-y-3.5">
          {aspectSentimentStackedData.map((item) => (
            <div key={item.aspek} className="grid grid-cols-12 items-center gap-space-md">
              <div className="col-span-12 sm:col-span-4 lg:col-span-3 flex items-center justify-between">
                <span className="font-headline-md text-body-md font-medium text-on-surface">
                  {item.aspek}
                </span>
                <span className="font-data-mono-sm text-data-mono-sm text-secondary">
                  {item.total} ulasan
                </span>
              </div>
              <div className="col-span-12 sm:col-span-8 lg:col-span-9">
                <div className="h-6 w-full bg-surface-container rounded-lg overflow-hidden flex">
                  {item.Positif > 0 && (
                    <div
                      className="bg-emerald-600 h-full flex items-center justify-center text-white text-[10px] font-bold transition-all"
                      style={{ width: `${item.PositifPct}%` }}
                      title={`Positif: ${item.Positif} (${item.PositifPct}%)`}
                    >
                      {item.PositifPct >= 10 ? `${item.PositifPct}%` : ""}
                    </div>
                  )}
                  {item.Netral > 0 && (
                    <div
                      className="bg-slate-500 h-full flex items-center justify-center text-white text-[10px] font-bold transition-all"
                      style={{ width: `${item.NetralPct}%` }}
                      title={`Netral: ${item.Netral} (${item.NetralPct}%)`}
                    >
                      {item.NetralPct >= 10 ? `${item.NetralPct}%` : ""}
                    </div>
                  )}
                  {item.Negatif > 0 && (
                    <div
                      className="bg-rose-600 h-full flex items-center justify-center text-white text-[10px] font-bold transition-all"
                      style={{ width: `${item.NegatifPct}%` }}
                      title={`Negatif: ${item.Negatif} (${item.NegatifPct}%)`}
                    >
                      {item.NegatifPct >= 10 ? `${item.NegatifPct}%` : ""}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 4: Recent Reviews Feed (3 Columns) */}
      <div className="flex flex-col gap-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Feed Ulasan Pengguna Terbaru
            </h2>
            <p className="font-body-sm text-body-sm text-secondary">
              Umpan balik kontekstual langsung dari Google Play Store Zahir Ecosystem
            </p>
          </div>
          <span className="font-label-sm text-label-sm text-secondary">
            Menampilkan 3 ulasan teranyar
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
          {recentReviews.map((rev, idx) => {
            const initials = rev.app_name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .substring(0, 2)
              .toUpperCase();

            const detectedAspects = Object.entries(ASPECTS)
              .filter(([k]) => Boolean((rev as any)[k]))
              .map(([_, label]) => label);

            const sentColor =
              rev.human_sentiment_label === "positive"
                ? "bg-emerald-50 text-emerald-800"
                : rev.human_sentiment_label === "negative"
                ? "bg-rose-50 text-rose-800"
                : "bg-slate-100 text-slate-800";

            return (
              <div
                key={rev.review_id || idx}
                className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container/60 flex flex-col justify-between"
              >
                <div>
                  {/* Header User & Sentiment */}
                  <div className="flex items-start justify-between mb-space-sm">
                    <div className="flex items-center gap-space-sm">
                      <div className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center font-bold text-label-md">
                        {initials}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-headline-md text-body-md font-semibold text-on-surface">
                          Pengguna #{rev.review_id.substring(0, 8)}
                        </span>
                        <span className="font-data-mono-sm text-label-sm text-secondary">
                          {rev.review_date} ? {rev.app_name}
                        </span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold capitalize ${sentColor}`}>
                      {SENTIMENT_LABEL_MAP[rev.human_sentiment_label]}
                    </span>
                  </div>

                  {/* Star Rating */}
                  <div className="flex items-center gap-0.5 my-space-xs text-amber-500">
                    {[1, 2, 3, 4, 5].map((st) => (
                      <span
                        key={st}
                        className="material-symbols-outlined text-[16px]"
                        style={{ color: st <= rev.score ? "#f59e0b" : "#cbd5e1" }}
                      >
                        star
                      </span>
                    ))}
                    <span className="font-data-mono-sm text-label-sm text-secondary ml-1.5">
                      ({rev.score}.0)
                    </span>
                  </div>

                  {/* Tags / Detected Aspects */}
                  <div className="flex flex-wrap gap-1 mt-space-sm">
                    {detectedAspects.length > 0 ? (
                      detectedAspects.map((asp) => (
                        <span
                          key={asp}
                          className="px-2 py-0.5 rounded bg-surface-container text-secondary font-label-sm text-[11px]"
                        >
                          {asp}
                        </span>
                      ))
                    ) : (
                      <span className="text-secondary text-[11px] italic">
                        Ulasan umum tanpa aspek spesifik
                      </span>
                    )}
                  </div>
                </div>

                {/* Developer reply indicator */}
                <div className="mt-space-md pt-space-xs border-t border-surface-container flex items-center justify-between text-secondary font-label-sm text-label-sm">
                  <div className="flex items-center gap-1">
                    <span
                      className={`material-symbols-outlined text-[15px] ${
                        rev.has_developer_reply ? "text-emerald-700" : "text-secondary/50"
                      }`}
                    >
                      {rev.has_developer_reply ? "check_circle" : "cancel"}
                    </span>
                    <span>{rev.has_developer_reply ? "Dibalas Pengembang" : "Belum Dibalas"}</span>
                  </div>
                  <span className="text-[11px] text-secondary/70">ID: {rev.review_id.substring(0, 6)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* View All Reviews Button */}
        <div className="flex justify-center mt-space-sm">
          <button
            type="button"
            onClick={() => setShowAllReviews(!showAllReviews)}
            className="px-space-xl py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">
              {showAllReviews ? "expand_less" : "list"}
            </span>
            <span>
              {showAllReviews
                ? "Sembunyikan Tabel Lengkap"
                : `Lihat Seluruh ${formatNumber(totalReviews)} Ulasan Terfilter`}
            </span>
          </button>
        </div>

        {/* Full Reviews Table Section (Collapsible) */}
        {showAllReviews && (
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container/60 p-space-lg space-y-space-md animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                  Tabel Lengkap Ulasan Terfilter ({formatNumber(allFilteredReviews.length)})
                </h3>
                <p className="font-body-sm text-body-sm text-secondary">
                  Daftar seluruh entri ulasan Google Play Store sesuai parameter pencarian.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchReviewQuery}
                  onChange={(e) => setSearchReviewQuery(e.target.value)}
                  placeholder="Cari ID atau aplikasi..."
                  className="w-full h-9 pl-9 pr-3 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface focus:outline-none border border-transparent focus:border-surface-container-high"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-surface-container rounded-lg">
              <table className="w-full text-left border-collapse font-body-sm text-body-sm">
                <thead>
                  <tr className="bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase h-10 border-b border-surface-container">
                    <th className="py-2 px-space-md font-semibold">Review ID</th>
                    <th className="py-2 px-space-md font-semibold">Tanggal</th>
                    <th className="py-2 px-space-md font-semibold">Aplikasi</th>
                    <th className="py-2 px-space-md font-semibold text-center">Rating</th>
                    <th className="py-2 px-space-md font-semibold text-center">Sentimen</th>
                    <th className="py-2 px-space-md font-semibold">Aspek Terdeteksi</th>
                    <th className="py-2 px-space-md font-semibold text-center">Dibalas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-on-surface">
                  {allFilteredReviews.slice(0, 50).map((r, i) => {
                    const detected = Object.entries(ASPECTS)
                      .filter(([k]) => Boolean((r as any)[k]))
                      .map(([_, label]) => label);
                    const sentClass =
                      r.human_sentiment_label === "positive"
                        ? "bg-emerald-50 text-emerald-800"
                        : r.human_sentiment_label === "negative"
                        ? "bg-rose-50 text-rose-800"
                        : "bg-slate-100 text-slate-800";
                    return (
                      <tr key={r.review_id || i} className="hover:bg-surface-container-low/50">
                        <td className="py-2.5 px-space-md font-data-mono-sm text-data-mono-sm text-primary font-semibold">
                          #{r.review_id.substring(0, 10)}
                        </td>
                        <td className="py-2.5 px-space-md font-data-mono-sm text-data-mono-sm text-secondary">
                          {r.review_date}
                        </td>
                        <td className="py-2.5 px-space-md font-medium text-on-surface">
                          {r.app_name}
                        </td>
                        <td className="py-2.5 px-space-md text-center font-data-mono-sm text-data-mono-sm">
                          <span className="flex items-center justify-center gap-1 text-amber-500 font-semibold">
                            {r.score}
                            <span className="material-symbols-outlined text-[14px]">star</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-space-md text-center">
                          <span className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold capitalize ${sentClass}`}>
                            {SENTIMENT_LABEL_MAP[r.human_sentiment_label]}
                          </span>
                        </td>
                        <td className="py-2.5 px-space-md">
                          <div className="flex flex-wrap gap-1">
                            {detected.length > 0 ? (
                              detected.map((d) => (
                                <span
                                  key={d}
                                  className="px-1.5 py-0.2 rounded bg-surface-container text-secondary text-[11px]"
                                >
                                  {d}
                                </span>
                              ))
                            ) : (
                              <span className="text-secondary/60 text-[11px]">?</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-space-md text-center">
                          <span
                            className={`material-symbols-outlined text-[16px] ${
                              r.has_developer_reply ? "text-emerald-700" : "text-secondary/40"
                            }`}
                          >
                            {r.has_developer_reply ? "check_circle" : "cancel"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {allFilteredReviews.length > 50 && (
              <p className="font-body-sm text-body-sm text-secondary text-center pt-2">
                Menampilkan 50 ulasan pertama dari total {allFilteredReviews.length} ulasan. Gunakan ekspor CSV untuk mengunduh seluruh baris.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
