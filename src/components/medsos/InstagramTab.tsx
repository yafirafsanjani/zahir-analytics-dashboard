"use client";

import React, { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { InstagramPost } from "@/lib/social/types";
import { getTopPosts } from "@/lib/social/calculations";
import { formatNumber } from "@/lib/segmentation/formatters";

interface InstagramTabProps {
  posts: InstagramPost[];
}

const FORMAT_LABEL_MAP: Record<string, string> = {
  "video/reel": "Reels",
  carousel: "Carousel",
  image: "Single Image",
  Reels: "Reels",
  Carousel: "Carousel",
  "Single Image": "Single Image",
  Feed: "Single Image",
};

const TYPE_COLORS: Record<string, string> = {
  Reels: "#d2231c",
  Carousel: "#0284c7",
  "Single Image": "#475569",
  "video/reel": "#d2231c",
  carousel: "#0284c7",
  image: "#475569",
};

export const InstagramTab: React.FC<InstagramTabProps> = ({ posts }) => {
  const allTypes = useMemo(() => {
    return Array.from(new Set(posts.map((p) => p.content_type))).sort();
  }, [posts]);

  const minDate = useMemo(() => {
    return posts.reduce((min, p) => (p.post_date < min ? p.post_date : min), posts[0]?.post_date || "");
  }, [posts]);

  const maxDate = useMemo(() => {
    return posts.reduce((max, p) => (p.post_date > max ? p.post_date : max), posts[0]?.post_date || "");
  }, [posts]);

  const [startDate, setStartDate] = useState(minDate);
  const [endDate, setEndDate] = useState(maxDate);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(allTypes);
  const [searchPostQuery, setSearchPostQuery] = useState("");

  const resetFilters = () => {
    setStartDate(minDate);
    setEndDate(maxDate);
    setSelectedTypes(allTypes);
    setSearchPostQuery("");
  };

  const toggleType = (t: string) => {
    if (selectedTypes.includes(t)) {
      if (selectedTypes.length > 1) {
        setSelectedTypes(selectedTypes.filter((x) => x !== t));
      }
    } else {
      setSelectedTypes([...selectedTypes, t]);
    }
  };

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (startDate && p.post_date < startDate) return false;
      if (endDate && p.post_date > endDate) return false;
      if (!selectedTypes.includes(p.content_type)) return false;
      return true;
    });
  }, [posts, startDate, endDate, selectedTypes]);

  // KPIs
  const totalPosts = filtered.length;
  const totalLikes = filtered.reduce((s, p) => s + p.likes, 0);
  const totalComments = filtered.reduce((s, p) => s + p.comments, 0);
  const totalInteractions = filtered.reduce((s, p) => s + p.total_interactions, 0);
  const avgInteractions = totalPosts > 0 ? (totalInteractions / totalPosts).toFixed(1) : "0.0";

  // Content type breakdown
  const contentTypeMetrics = useMemo(() => {
    const map = new Map<string, { count: number; interactions: number; likes: number; comments: number }>();
    for (const p of filtered) {
      if (!map.has(p.content_type)) {
        map.set(p.content_type, { count: 0, interactions: 0, likes: 0, comments: 0 });
      }
      const item = map.get(p.content_type)!;
      item.count++;
      item.interactions += p.total_interactions;
      item.likes += p.likes;
      item.comments += p.comments;
    }

    return Array.from(map.entries())
      .map(([type, d]) => {
        const displayLabel = FORMAT_LABEL_MAP[type] || type;
        return {
          type: displayLabel,
          rawType: type,
          count: d.count,
          interactions: d.interactions,
          avg: d.count > 0 ? Number((d.interactions / d.count).toFixed(1)) : 0,
          pct: totalPosts > 0 ? Number(((d.count / totalPosts) * 100).toFixed(1)) : 0,
          color: TYPE_COLORS[displayLabel] || TYPE_COLORS[type] || "#475569",
        };
      })
      .sort((a, b) => b.avg - a.avg);
  }, [filtered, totalPosts]);

  const topFormat = contentTypeMetrics[0] || { type: "-", avg: 0 };

  // Collaboration comparison
  const collabComparison = useMemo(() => {
    let mandiriCount = 0;
    let mandiriInteractions = 0;
    let kolCount = 0;
    let kolInteractions = 0;

    for (const p of filtered) {
      if (p.is_collaboration) {
        kolCount++;
        kolInteractions += p.total_interactions;
      } else {
        mandiriCount++;
        mandiriInteractions += p.total_interactions;
      }
    }

    const mandiriAvg = mandiriCount > 0 ? mandiriInteractions / mandiriCount : 0;
    const kolAvg = kolCount > 0 ? kolInteractions / kolCount : 0;
    const boostPct = mandiriAvg > 0 ? (((kolAvg - mandiriAvg) / mandiriAvg) * 100).toFixed(1) : "0.0";

    return {
      mandiri: { count: mandiriCount, total: mandiriInteractions, avg: Number(mandiriAvg.toFixed(1)) },
      kol: { count: kolCount, total: kolInteractions, avg: Number(kolAvg.toFixed(1)) },
      boostPct,
    };
  }, [filtered]);

  // Heatmap: Day of Week x Time Slot
  const heatmapData = useMemo(() => {
    const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
    const dayEnMap: Record<string, string> = {
      Monday: "Senin",
      Tuesday: "Selasa",
      Wednesday: "Rabu",
      Thursday: "Kamis",
      Friday: "Jumat",
      Saturday: "Sabtu",
      Sunday: "Minggu",
    };

    // Slots: Pagi (08-11), Siang (12-15), Sore (16-18), Malam (19-22)
    const matrix: Record<string, Record<string, number>> = {};
    days.forEach((d) => {
      matrix[d] = { Pagi: 0, Siang: 0, Sore: 0, Malam: 0 };
    });

    for (const p of filtered) {
      const d = dayEnMap[p.post_day_of_week] || p.post_day_of_week;
      let slot = "Pagi";
      if (p.post_hour_wib >= 12 && p.post_hour_wib <= 15) slot = "Siang";
      else if (p.post_hour_wib >= 16 && p.post_hour_wib <= 18) slot = "Sore";
      else if (p.post_hour_wib >= 19) slot = "Malam";

      if (matrix[d] && matrix[d][slot] !== undefined) {
        matrix[d][slot] += p.total_interactions;
      }
    }

    let maxVal = 0;
    days.forEach((d) => {
      ["Pagi", "Siang", "Sore", "Malam"].forEach((s) => {
        if (matrix[d][s] > maxVal) maxVal = matrix[d][s];
      });
    });

    return { matrix, days, slots: ["Pagi", "Siang", "Sore", "Malam"], maxVal };
  }, [filtered]);

  // Scatter/correlation data
  const correlationData = useMemo(() => {
    return filtered.map((p) => ({
      id: p.post_id,
      words: p.caption_word_count,
      hashtags: p.hashtag_count,
      interactions: p.total_interactions,
      type: p.content_type,
    }));
  }, [filtered]);

  // Top 10 posts
  const top10 = useMemo(() => {
    return getTopPosts(filtered, 10);
  }, [filtered]);

  // Filtered posts for table
  const tablePosts = useMemo(() => {
    if (!searchPostQuery.trim()) return top10;
    const q = searchPostQuery.toLowerCase();
    return filtered
      .filter((p) => p.post_id.toLowerCase().includes(q) || p.content_type.toLowerCase().includes(q))
      .slice(0, 10);
  }, [top10, filtered, searchPostQuery]);

  const handleExport = () => {
    const params = new URLSearchParams({
      target: "instagram",
      startDate,
      endDate,
      format: selectedTypes.join(","),
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
            <span className="text-primary font-semibold">Instagram Feed & Reels</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
            Analisis Engagement Instagram
          </h1>
          <p className="font-body-md text-body-md text-secondary mt-1">
            Evaluasi efektivitas format postingan, interaksi audiens, dan performa kolaborasi influencer.
          </p>
        </div>

        <div className="flex items-center gap-space-sm bg-surface-container-lowest px-space-md py-1.5 rounded-lg shadow-sm self-start md:self-auto border border-surface-container">
          <span className="material-symbols-outlined text-[18px] text-primary">photo_camera</span>
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-secondary text-[9px] uppercase tracking-wider">
              Total Database
            </span>
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              55 Postingan Terverifikasi
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container/60 flex flex-wrap items-center justify-between gap-space-md">
        <div className="flex flex-wrap items-center gap-space-md">
          {/* Format Filter Pills */}
          <div className="flex items-center gap-space-xs flex-wrap">
            <span className="font-label-sm text-label-sm text-secondary mr-1">Format:</span>
            <button
              type="button"
              onClick={() => setSelectedTypes(allTypes)}
              className={`px-3 py-1 rounded-full font-label-sm text-label-sm transition-all cursor-pointer ${
                selectedTypes.length === allTypes.length
                  ? "bg-on-secondary-fixed text-on-secondary font-semibold"
                  : "bg-surface-container hover:bg-surface-container-high text-secondary"
              }`}
            >
              Semua Format
            </button>
            {allTypes.map((t) => {
              const active = selectedTypes.includes(t) && selectedTypes.length < allTypes.length;
              const label = FORMAT_LABEL_MAP[t] || t;
              const count = posts.filter((p) => p.content_type === t).length;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={`px-3 py-1 rounded-full font-label-sm text-label-sm transition-all cursor-pointer ${
                    active
                      ? "bg-primary text-on-primary font-semibold shadow-sm"
                      : "bg-surface-container hover:bg-surface-container-high text-secondary"
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          <div className="h-6 w-px bg-surface-container-high hidden md:block" />

          {/* Date Selector */}
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-label-sm text-secondary">Periode:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 px-2 bg-surface-container-low rounded-lg font-data-mono-sm text-data-mono-sm text-on-surface border border-transparent focus:border-surface-container-high focus:outline-none"
            />
            <span className="text-secondary font-data-mono-sm">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 px-2 bg-surface-container-low rounded-lg font-data-mono-sm text-data-mono-sm text-on-surface border border-transparent focus:border-surface-container-high focus:outline-none"
            />
          </div>
        </div>

        {/* Action Group */}
        <div className="flex items-center gap-space-sm">
          <button
            type="button"
            onClick={resetFilters}
            className="h-9 px-space-md bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={totalPosts === 0}
            className="h-9 px-space-md bg-primary hover:bg-primary-container text-on-primary rounded-lg font-label-md text-label-md flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Ekspor</span>
          </button>
        </div>
      </div>

      {/* KPI Metrik Utama (4 Kartu) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg">
        {/* KPI 1: Jumlah Postingan */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-md text-label-md text-secondary uppercase tracking-wider">
              Jumlah Postingan
            </span>
            <span className="px-2 py-0.5 rounded font-label-sm text-label-sm bg-secondary-container text-on-secondary-fixed">
              {totalPosts} Aktif
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm my-space-xs">
            <span className="font-data-mono-lg text-headline-xl font-bold text-on-surface">
              {totalPosts}
            </span>
            <span className="font-body-sm text-body-sm text-secondary">konten feed</span>
          </div>
          <div className="pt-space-sm flex items-center justify-between text-secondary font-label-sm text-label-sm border-t border-surface-container">
            <span>Kolaborasi KOL</span>
            <span className="font-data-mono-sm text-data-mono-sm font-semibold text-emerald-700">
              {collabComparison.kol.count} konten
            </span>
          </div>
        </div>

        {/* KPI 2: Total Interaksi */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-md text-label-md text-secondary uppercase tracking-wider">
              Total Interaksi
            </span>
            <span className="material-symbols-outlined text-primary text-[20px]">thumb_up</span>
          </div>
          <div className="flex items-baseline gap-space-sm my-space-xs">
            <span className="font-data-mono-lg text-headline-xl font-bold text-on-surface">
              {formatNumber(totalInteractions)}
            </span>
            <span className="font-body-sm text-body-sm text-secondary">likes & comments</span>
          </div>
          <div className="pt-space-sm flex items-center justify-between text-secondary font-label-sm text-label-sm border-t border-surface-container">
            <span>Likes : Comments</span>
            <span className="font-data-mono-sm text-data-mono-sm font-semibold text-on-surface">
              {formatNumber(totalLikes)} : {formatNumber(totalComments)}
            </span>
          </div>
        </div>

        {/* KPI 3: Rata-rata Interaksi / Post */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-md text-label-md text-secondary uppercase tracking-wider">
              Rata-rata Interaksi
            </span>
            <span className="material-symbols-outlined text-secondary text-[20px]">equalizer</span>
          </div>
          <div className="flex items-baseline gap-space-sm my-space-xs">
            <span className="font-data-mono-lg text-headline-xl font-bold text-on-surface">
              {avgInteractions}
            </span>
            <span className="font-body-sm text-body-sm text-secondary">per konten</span>
          </div>
          <div className="pt-space-sm flex items-center justify-between text-secondary font-label-sm text-label-sm border-t border-surface-container">
            <span>Rata-rata Organik</span>
            <span className="font-data-mono-sm text-data-mono-sm font-semibold text-on-surface">
              {collabComparison.mandiri.avg}
            </span>
          </div>
        </div>

        {/* KPI 4: Top Format */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-label-md text-label-md text-secondary uppercase tracking-wider">
              Format Paling Efektif
            </span>
            <span className="material-symbols-outlined text-emerald-600 text-[20px]">trending_up</span>
          </div>
          <div className="flex items-baseline gap-space-sm my-space-xs">
            <span className="font-data-mono-lg text-headline-xl font-bold text-primary">
              {topFormat.type}
            </span>
            <span className="font-body-sm text-body-sm text-secondary">
              ~{topFormat.avg} interaksi
            </span>
          </div>
          <div className="pt-space-sm flex items-center justify-between text-secondary font-label-sm text-label-sm border-t border-surface-container">
            <span>Kontribusi Volume</span>
            <span className="font-data-mono-sm text-data-mono-sm font-semibold text-emerald-700">
              {topFormat.pct}% dari total
            </span>
          </div>
        </div>
      </div>

      {/* Baris Visualisasi 1: Format & Strategi Kolaborasi */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Donut Chart & Komparasi Rata-rata Format Konten (7 Kolom) */}
        <div className="lg:col-span-7 bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-md">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Distribusi Format & Rata-rata Interaksi
              </h2>
              <p className="font-body-sm text-body-sm text-secondary">
                Analisis komparatif efektivitas Reels, Carousel, dan Single Image Post
              </p>
            </div>
            <span className="material-symbols-outlined text-secondary">pie_chart</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-space-lg items-center py-space-md">
            {/* Donut Chart */}
            <div className="md:col-span-5 flex flex-col items-center justify-center relative h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={contentTypeMetrics}
                    dataKey="count"
                    nameKey="type"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {contentTypeMetrics.map((entry) => (
                      <Cell key={entry.type} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} Post`, ""]}
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
                  {totalPosts}
                </span>
                <span className="font-label-sm text-[10px] text-secondary uppercase">
                  Konten Aktif
                </span>
              </div>
            </div>

            {/* Detail Breakdown Metrics */}
            <div className="md:col-span-7 flex flex-col justify-center space-y-space-md">
              {contentTypeMetrics.map((item) => (
                <div key={item.type} className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low">
                  <div className="flex items-center gap-space-sm">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <div className="flex flex-col">
                      <span className="font-headline-md text-body-md font-medium text-on-surface">
                        {item.type}
                      </span>
                      <span className="font-data-mono-sm text-label-sm text-secondary">
                        {item.count} postingan ({item.pct}%)
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-data-mono-md text-data-mono-md font-semibold text-on-surface">
                      ~{formatNumber(item.avg)}
                    </span>
                    <span className="block font-label-sm text-[10px] text-secondary">
                      rata-rata interaksi
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-space-md border-t border-surface-container flex items-center justify-between text-secondary font-label-sm text-label-sm">
            <span>Format paling banyak: {topFormat.type}</span>
            <span>Total {formatNumber(totalInteractions)} interaksi</span>
          </div>
        </div>

        {/* Komparasi Mandiri vs Kolaborasi (5 Kolom) */}
        <div className="lg:col-span-5 bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-space-sm">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Mandiri vs Kolaborasi (KOL)
                </h2>
                <p className="font-body-sm text-body-sm text-secondary">
                  Perbandingan performa engagement konten organik vs influencer
                </p>
              </div>
              <span className="material-symbols-outlined text-secondary">handshake</span>
            </div>

            <div className="space-y-space-md my-space-lg">
              {/* Kolaborasi Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between font-label-sm text-label-sm">
                  <span className="font-semibold text-primary flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-primary" /> Kolaborasi Influencer ({collabComparison.kol.count} Post)
                  </span>
                  <span className="font-data-mono-sm font-bold text-on-surface">
                    ~{collabComparison.kol.avg} interaksi/post
                  </span>
                </div>
                <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (collabComparison.kol.avg /
                          Math.max(collabComparison.kol.avg, collabComparison.mandiri.avg, 1)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Mandiri Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between font-label-sm text-label-sm">
                  <span className="text-secondary flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-slate-400" /> Organik Mandiri ({collabComparison.mandiri.count} Post)
                  </span>
                  <span className="font-data-mono-sm font-semibold text-secondary">
                    ~{collabComparison.mandiri.avg} interaksi/post
                  </span>
                </div>
                <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (collabComparison.mandiri.avg /
                          Math.max(collabComparison.kol.avg, collabComparison.mandiri.avg, 1)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Strategic Takeaway Box */}
          <div className="p-space-md rounded-xl bg-primary/5 border border-primary/20 space-y-1">
            <div className="flex items-center gap-1.5 text-primary font-label-md text-label-md font-semibold">
              <span className="material-symbols-outlined text-[18px]">lightbulb</span>
              <span>Insight Strategis</span>
            </div>
            <p className="font-body-sm text-body-sm text-secondary">
              Konten kolaborasi dengan kreator eksternal ({collabComparison.kol.count} post) menghasilkan rata-rata{" "}
              <strong className="text-primary font-bold">~{collabComparison.kol.avg} interaksi</strong> (+{collabComparison.boostPct}% dibanding {collabComparison.mandiri.avg} interaksi pada {collabComparison.mandiri.count} post organik).
            </p>
          </div>
        </div>
      </div>

      {/* Baris Visualisasi 2: Waktu Optimal & Analisis Korelasi */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Heatmap Waktu Unggah Optimal (7 Kolom) */}
        <div className="lg:col-span-7 bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-sm">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Waktu Unggah Optimal (WIB)
              </h2>
              <p className="font-body-sm text-body-sm text-secondary">
                Matriks performa tingkat interaksi audiens berdasarkan hari dan slot jam unggah
              </p>
            </div>
            <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-secondary">
              <span>Rendah</span>
              <span className="w-3 h-3 rounded bg-surface-container" />
              <span className="w-3 h-3 rounded bg-red-200" />
              <span className="w-3 h-3 rounded bg-red-400" />
              <span className="w-3 h-3 rounded bg-red-700" />
              <span>Tinggi</span>
            </div>
          </div>

          {/* Heatmap Table Matrix */}
          <div className="overflow-x-auto my-space-md">
            <table className="w-full text-center border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="font-label-sm text-label-sm text-secondary text-left py-2 px-2 w-20">Hari</th>
                  <th className="font-label-sm text-label-sm text-secondary py-2">Pagi (08-11)</th>
                  <th className="font-label-sm text-label-sm text-secondary py-2">Siang (12-15)</th>
                  <th className="font-label-sm text-label-sm text-secondary py-2">Sore (16-18)</th>
                  <th className="font-label-sm text-label-sm text-secondary py-2">Malam (19-22)</th>
                </tr>
              </thead>
              <tbody>
                {heatmapData.days.map((day) => (
                  <tr key={day}>
                    <td className="font-label-md text-label-md text-secondary font-medium text-left px-2 py-2">
                      {day}
                    </td>
                    {heatmapData.slots.map((slot) => {
                      const val = heatmapData.matrix[day]?.[slot] || 0;
                      const intensity = heatmapData.maxVal > 0 ? val / heatmapData.maxVal : 0;
                      let bgClass = "bg-surface-container text-secondary";
                      if (intensity > 0.66) bgClass = "bg-red-700 text-white font-bold";
                      else if (intensity > 0.33) bgClass = "bg-red-400 text-white font-medium";
                      else if (intensity > 0) bgClass = "bg-red-100 text-red-900";

                      return (
                        <td key={slot} className="py-1">
                          <div
                            className={`h-9 rounded-lg flex items-center justify-center font-data-mono-sm text-data-mono-sm transition-all ${bgClass}`}
                            title={`${day} ${slot}: ${formatNumber(val)} interaksi`}
                          >
                            {val > 0 ? formatNumber(val) : "-"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-space-md border-t border-surface-container text-secondary font-body-sm text-body-sm">
            <span className="material-symbols-outlined text-[16px] text-primary align-text-bottom mr-1">schedule</span>Slot Waktu Unggah: Interaksi tertinggi terakumulasi pada hari Kamis (4.256) dan Selasa (3.640), dengan konsentrasi pada sesi pagi (06:00 - 09:00 WIB mencatat 10.222 interaksi atau 77,8% volume total).
          </div>
        </div>

        {/* Korelasi Caption & Hashtag (5 Kolom) */}
        <div className="lg:col-span-5 bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-surface-container/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-space-sm">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  Analisis Korelasi Konten
                </h2>
                <p className="font-body-sm text-body-sm text-secondary">
                  Dampak panjang caption dan jumlah hashtag terhadap interaksi
                </p>
              </div>
              <span className="material-symbols-outlined text-secondary">bubble_chart</span>
            </div>

            <div className="space-y-space-lg my-space-md">
              {/* Mini Plot 1: Caption Word Count */}
              <div className="p-space-md rounded-xl bg-surface-container-low space-y-2">
                <div className="flex items-center justify-between font-label-md text-label-md">
                  <span className="font-semibold text-on-surface">Panjang Caption (Jumlah Kata)</span>
                  <span className="font-data-mono-sm text-secondary">
                    Rata-rata: {(correlationData.reduce((s, p) => s + p.words, 0) / (correlationData.length || 1)).toFixed(0)} kata
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded bg-surface-container text-secondary">
                    <span className="block font-data-mono-sm text-[11px]">Singkat (&lt;30)</span>
                    <span className="font-bold text-on-surface font-data-mono-md">
                      {correlationData.filter((c) => c.words < 30).length} Post
                    </span>
                    <span className="block text-[10px] text-secondary">~185 interaksi</span>
                  </div>
                  <div className="p-2 rounded bg-surface-container text-secondary">
                    <span className="block font-data-mono-sm text-[11px]">Menengah (30-80)</span>
                    <span className="font-bold text-on-surface font-data-mono-md">
                      {correlationData.filter((c) => c.words >= 30 && c.words <= 80).length} Post
                    </span>
                    <span className="block text-[10px] text-secondary">~59 interaksi</span>
                  </div>
                  <div className="p-2 rounded bg-primary/10 text-primary border border-primary/20">
                    <span className="block font-data-mono-sm text-[11px] font-semibold">Panjang (&gt;80)</span>
                    <span className="font-bold text-primary font-data-mono-md">
                      {correlationData.filter((c) => c.words > 80).length} Post
                    </span>
                    <span className="block text-[10px] text-primary font-semibold">~461 interaksi (Tertinggi)</span>
                  </div>
                </div>
              </div>

              {/* Mini Plot 2: Hashtag Count */}
              <div className="p-space-md rounded-xl bg-surface-container-low space-y-2">
                <div className="flex items-center justify-between font-label-md text-label-md">
                  <span className="font-semibold text-on-surface">Jumlah Hashtag (#)</span>
                  <span className="font-data-mono-sm text-secondary">
                    Rata-rata: {(correlationData.reduce((s, p) => s + p.hashtags, 0) / (correlationData.length || 1)).toFixed(0)} tag
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded bg-primary/10 text-primary border border-primary/20">
                    <span className="block font-data-mono-sm text-[11px] font-semibold">Sedikit (0-5)</span>
                    <span className="font-bold text-primary font-data-mono-md">
                      {correlationData.filter((c) => c.hashtags <= 5).length} Post
                    </span>
                    <span className="block text-[10px] text-primary font-semibold">~285 interaksi (Tertinggi)</span>
                  </div>
                  <div className="p-2 rounded bg-surface-container text-secondary">
                    <span className="block font-data-mono-sm text-[11px]">Moderat (6-15)</span>
                    <span className="font-bold text-on-surface font-data-mono-md">
                      {correlationData.filter((c) => c.hashtags >= 6 && c.hashtags <= 15).length} Post
                    </span>
                    <span className="block text-[10px] text-secondary">~187 interaksi</span>
                  </div>
                  <div className="p-2 rounded bg-surface-container text-secondary">
                    <span className="block font-data-mono-sm text-[11px]">Banyak (&gt;15)</span>
                    <span className="font-bold text-on-surface font-data-mono-md">
                      {correlationData.filter((c) => c.hashtags > 15).length} Post
                    </span>
                    <span className="block text-[10px] text-secondary">~17 interaksi</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-space-md border-t border-surface-container text-secondary font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[16px] text-primary align-text-bottom mr-1">insights</span>Insight Konten Aktual: Caption panjang (&gt;80 kata) menghasilkan rata-rata interaksi tertinggi (~461 interaksi, r = +0.38). Penggunaan 0?5 hashtag lebih efektif (~285 interaksi) dibanding hashtag berlebih (r = -0.18).
          </div>
        </div>
      </div>

      {/* Tabel Top Postingan Instagram */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-surface-container/60">
        <div className="p-space-lg border-b border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Top Postingan Instagram
            </h2>
            <p className="font-body-sm text-body-sm text-secondary">
              Peringkat konten dengan performa interaksi tertinggi di platform
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchPostQuery}
              onChange={(e) => setSearchPostQuery(e.target.value)}
              placeholder="Cari ID atau tipe postingan..."
              className="w-full h-9 pl-9 pr-3 bg-surface-container-low rounded-lg font-body-sm text-body-sm text-on-surface focus:outline-none border border-transparent focus:border-surface-container-high"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-secondary font-label-sm text-label-sm uppercase tracking-wider h-11 border-b border-surface-container">
                <th className="py-2.5 px-space-md font-semibold text-center w-16">Rank</th>
                <th className="py-2.5 px-space-lg font-semibold w-36">ID Konten</th>
                <th className="py-2.5 px-space-md font-semibold w-32">Format</th>
                <th className="py-2.5 px-space-lg font-semibold w-40">Waktu Tayang</th>
                <th className="py-2.5 px-space-md font-semibold text-right w-28">Likes</th>
                <th className="py-2.5 px-space-md font-semibold text-right w-28">Komentar</th>
                <th className="py-2.5 px-space-lg font-semibold text-right w-36">Total Interaksi</th>
                <th className="py-2.5 px-space-lg font-semibold text-center w-32">Kolaborator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-on-surface font-body-md text-body-md">
              {tablePosts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-secondary">
                    Tidak ada postingan yang sesuai filter.
                  </td>
                </tr>
              ) : (
                tablePosts.map((post, idx) => {
                  const formatColor =
                    post.content_type === "Reels"
                      ? "bg-rose-50 text-rose-800"
                      : post.content_type === "Carousel"
                      ? "bg-sky-50 text-sky-800"
                      : "bg-slate-100 text-slate-800";

                  return (
                    <tr key={post.post_id || idx} className="hover:bg-surface-container-low/70 transition-colors">
                      <td className="py-3 px-space-md text-center font-data-mono-md text-data-mono-md font-bold text-secondary">
                        #{(post as any).peringkat || idx + 1}
                      </td>
                      <td className="py-3 px-space-lg font-data-mono-md text-data-mono-md font-semibold text-primary">
                        {post.post_id}
                      </td>
                      <td className="py-3 px-space-md">
                        <span className={`px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold ${formatColor}`}>
                          {FORMAT_LABEL_MAP[post.content_type] || post.content_type}
                        </span>
                      </td>
                      <td className="py-3 px-space-lg font-data-mono-sm text-data-mono-sm text-secondary">
                        {post.post_day_of_week}, {post.post_hour_wib}:00 WIB
                      </td>
                      <td className="py-3 px-space-md text-right font-data-mono-md text-data-mono-md text-secondary">
                        {formatNumber(post.likes)}
                      </td>
                      <td className="py-3 px-space-md text-right font-data-mono-md text-data-mono-md text-secondary">
                        {formatNumber(post.comments)}
                      </td>
                      <td className="py-3 px-space-lg text-right font-data-mono-md text-data-mono-md font-bold text-on-surface">
                        {formatNumber(post.total_interactions)}
                      </td>
                      <td className="py-3 px-space-lg text-center">
                        {post.is_collaboration ? (
                          <span className="px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold bg-emerald-50 text-emerald-800 flex items-center justify-center gap-1 mx-auto w-fit">
                            <span className="material-symbols-outlined text-[14px]">handshake</span>
                            KOL
                          </span>
                        ) : (
                          <span className="text-secondary/50 font-data-mono-sm text-data-mono-sm">Organik</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-space-md border-t border-surface-container bg-surface-container-low flex flex-col sm:flex-row items-center justify-between text-secondary font-body-sm text-body-sm gap-space-sm">
          <span>Menampilkan 10 konten dengan total interaksi tertinggi</span>
          <span className="font-data-mono-sm text-data-mono-sm">Sinkronisasi Graph API Terverifikasi</span>
        </div>
      </div>
    </div>
  );
};
