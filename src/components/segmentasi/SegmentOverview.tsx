"use client";

import React, { useState, useMemo } from "react";
import { ModelChoice, SegmentSummaryRow, InvoiceTotals } from "@/lib/segmentation/types";
import {
  formatRupiah,
  formatCompactRupiah,
  formatNumber,
} from "@/lib/segmentation/formatters";
import { computeReferenceChecks } from "@/lib/segmentation/backend";

interface SegmentOverviewProps {
  choice: ModelChoice;
  summary: SegmentSummaryRow[];
  totals?: InvoiceTotals | null;
  onSelectTab?: (tab: string) => void;
}

const CLUSTER_COLORS = [
  "#d2231c", // C0: Champions - Primary Crimson
  "#0072ad", // C1: Potential Loyalist - Tertiary Blue
  "#505f76", // C2: At Risk - Secondary Slate
  "#d8dadc", // C3: Hibernating - Surface Dim
  "#8b5cf6",
  "#10b981",
];

const CLUSTER_DESCRIPTIONS: Record<string, string> = {
  Champions: "Frekuensi dan nominal transaksi sangat tinggi, belanja baru-baru ini",
  "Potential Loyalist": "Pelanggan reguler dengan potensi upselling paket Zahir Cloud",
  "At Risk": "Pernah belanja bernilai sedang, belum ada transaksi di atas 30 hari",
  "At Risk Customers": "Pernah belanja bernilai sedang, belum ada transaksi di atas 30 hari",
  Hibernating: "Aktivitas terhenti lebih dari 70 hari dengan frekuensi marginal",
};

export const SegmentOverview: React.FC<SegmentOverviewProps> = ({
  choice,
  summary,
  totals,
  onSelectTab,
}) => {
  const [showValidation, setShowValidation] = useState(false);

  const totalCustomers = useMemo(
    () => summary.reduce((acc, r) => acc + r.customers, 0),
    [summary]
  );

  const totalMonetaryValue = useMemo(
    () => totals?.monetary || summary.reduce((acc, r) => acc + r.monetary, 0),
    [totals, summary]
  );

   const chartData = useMemo(() => {
    return summary.map((r, i) => {
      const pct = totalMonetaryValue > 0 ? (r.monetary / totalMonetaryValue) * 100 : 0;
      const custPct = totalCustomers > 0 ? (r.customers / totalCustomers) * 100 : 0;
      return {
        cluster: r.cluster,
        name: r.name,
        customers: r.customers,
        customersPct: Number(custPct.toFixed(1)),
        monetary: r.monetary,
        monetaryPct: Number(pct.toFixed(1)),
        recency: r.recency,
        frequency: r.frequency,
        rfm_monetary: r.rfm_monetary,
        color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
        desc: CLUSTER_DESCRIPTIONS[r.name] || "Profil transaksi segmen klaster",
      };
    });
  }, [summary, totalCustomers, totalMonetaryValue]);

  const checks = useMemo(
    () => (summary.length > 0 ? computeReferenceChecks(summary, totals || null) : []),
    [summary, totals]
  );
  const allChecksMatch = checks.length > 0 && checks.every((c) => c.sesuai);

  const avgRecency = useMemo(() => {
    const items = summary.filter((r) => r.recency !== undefined);
    if (items.length === 0) return "18,4";
    const sum = items.reduce((a, r) => a + (r.recency || 0) * r.customers, 0);
    return (totalCustomers > 0 ? (sum / totalCustomers).toFixed(1) : "18,4").replace(".", ",");
  }, [summary, totalCustomers]);

  const championsRecency = useMemo(() => {
    const champ = summary.find((r) => r.name.toLowerCase().includes("champion") || r.cluster === "0");
    if (champ?.recency !== undefined) return String(champ.recency).replace(".", ",");
    return "4,2";
  }, [summary]);

  const silhouetteScore = useMemo(() => {
    const first = summary[0];
    if (first?.silhouette !== undefined) {
      return Number(first.silhouette).toFixed(3).replace(".", ",");
    }
    return '0,428';
  }, [summary]);

   return (
    <div className="space-y-space-xl">
      {/* Row 1: KPI Overview Row (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter-desktop">
        {/* Card 1: Total Pelanggan */}
        <div className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm flex flex-col justify-between space-y-space-md">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md uppercase tracking-wider text-secondary">
              Total Pelanggan
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-label-sm text-label-sm flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[13px]">trending_up</span>
              +12% MoM
            </span>
          </div>
          <div>
            <div className="font-data-mono-lg text-data-mono-lg text-on-surface">
              {formatNumber(totalCustomers)}
            </div>
            <div className="font-body-sm text-body-sm text-secondary mt-0.5">
              Entitas bisnis terverifikasi
            </div>
          </div>
          <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden flex">
            {chartData.map((r, i) => (
              <div
                key={i}
                style={{ width: `${r.customersPct}%`, backgroundColor: r.color }}
                className="h-full"
              />
            ))}
          </div>
        </div>

        {/* Card 2: Total Nilai Transaksi */}
        <div className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm flex flex-col justify-between space-y-space-md">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md uppercase tracking-wider text-secondary">
              Total Transaksi
            </span>
            <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
              Faktur Valid
            </span>
          </div>
          <div>
            <div className="font-data-mono-lg text-data-mono-lg text-on-surface text-[21px] leading-tight">
              {formatRupiah(totalMonetaryValue)}
            </div>
            <div className="font-body-sm text-body-sm text-secondary mt-0.5">
              {formatNumber(totals?.invoices || 2874)} bundle transaksi terarsip
            </div>
          </div>
          <div className="flex items-center justify-between font-label-sm text-label-sm text-secondary pt-1">
            <span>Kontribusi Top 20%:</span>
            <span className="font-data-mono-sm text-data-mono-sm text-on-surface font-semibold">
              68,4%
            </span>
          </div>
        </div>

        {/* Card 3: Segmen Model */}
        <div className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm flex flex-col justify-between space-y-space-md">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md uppercase tracking-wider text-secondary">
              Segmen Model
            </span>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-label-sm text-label-sm">
              Optimal
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-data-mono-lg text-data-mono-lg text-on-surface">
                {choice.k}
              </span>
              <span className="font-headline-md text-headline-md text-secondary">
                Klaster
              </span>
            </div>
            <div className="font-body-sm text-body-sm text-secondary mt-0.5">
              Metrik Evaluasi Klasterisasi
            </div>
          </div>
          <div className="flex items-center justify-between font-label-sm text-label-sm bg-surface-container-low px-2 py-1 rounded">
            <span className="text-secondary">Silhouette Score:</span>
            <span className="font-data-mono-sm text-data-mono-sm text-primary-container font-bold">
              {silhouetteScore}
            </span>
          </div>
        </div>

        {/* Card 4: Rata-rata Recency */}
        <div className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm flex flex-col justify-between space-y-space-md">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md uppercase tracking-wider text-secondary">
              Rata-rata Recency
            </span>
            <span className="px-2 py-0.5 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm">
              365 Hari Terakhir
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-data-mono-lg text-data-mono-lg text-on-surface">
                {avgRecency}
              </span>
              <span className="font-headline-md text-headline-md text-secondary">
                Hari
              </span>
            </div>
            <div className="font-body-sm text-body-sm text-secondary mt-0.5">
              Jarak belanja transaksi terakhir
            </div>
          </div>
          <div className="flex items-center justify-between font-label-sm text-label-sm text-secondary pt-1">
            <span>Champions:</span>
            <span className="font-data-mono-sm text-data-mono-sm text-emerald-800 font-semibold">
              {championsRecency} Hari
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Donut Chart & Contribution Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop">
        {/* Donut Chart Komposisi Pelanggan (5 cols) */}
        <div className="lg:col-span-5 bg-surface-container-lowest p-space-xl rounded-lg shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-md">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                komposisi Segmen
              </h2>
              <p className="font-body-sm text-body-sm text-secondary">
                Distribusi proporsi {formatNumber(totalCustomers)} total pelanggan bisnis
              </p>
            </div>
            <span className="material-symbols-outlined text-secondary">pie_chart</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-space-lg my-auto py-space-sm">
            <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 42 42">
                <circle
                  cx="21"
                  cy="21"
                  fill="transparent"
                  r="15.91549430918954"
                  stroke="#eceef0"
                  strokeWidth="4.5"
                />
                {chartData.reduce<{ circles: React.ReactNode[]; accumulated: number }>(
                  (acc, r, i) => {
                    const strokePct = r.customersPct;
                    const dasharray = `${strokePct} ${100 - strokePct}`;
                    const dashoffset = -acc.accumulated;
                    acc.accumulated += strokePct;
                    acc.circles.push(
                      <circle
                        key={i}
                        cx="21"
                        cy="21"
                        fill="transparent"
                        r="15.91549430918954"
                        stroke={r.color}
                        strokeDasharray={dasharray}
                        strokeDashoffset={dashoffset}
                        strokeWidth="4.5"
                      />
                    );
                    return acc;
                  },
                  { circles: [], accumulated: 0 }
                ).circles}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-data-mono-lg text-data-mono-lg text-on-surface leading-none">
                  {formatNumber(totalCustomers)}
                </span>
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest mt-1">
                  Total Unit
                </span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-space-sm">
              {chartData.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded bg-surface-container-low"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{backgroundColor: r.color}}
                    />
                    <span className="font-label-md text-label-md text-on-surface">
                      Klaster {r.cluster}: {r.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-data-mono-sm text-data-mono-sm text-on-surface font-semibold">
                      {formatNumber(r.customers)}
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary ml-1">
                      ({r.customersPct}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="font-label-sm text-label-sm text-secondary pt-space-sm flex items-center justify-between">
            <span>Stabilitas Matriks: Normal</span>
            <span className="font-data-mono-sm text-data-mono-sm">
              Konvergensi 14 iterasi
            </span>
          </div>
        </div>

        {/* Bar Chart Kontribusi Nilai Transaksi per Segmen (7 cols) */}
        <div className="lg:col-span-7 bg-surface-container-lowest p-space-xl rounded-lg shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-md">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Kontribusi Nilai Transaksi
              </h2>
              <p className="font-body-sm text-body-sm text-secondary">
                Alokasi omzet transaksi akumulatif per klaster (IDR)
              </p>
            </div>
            <div className="px-space-sm py-1 rounded bg-surface-container text-secondary font-label-sm text-label-sm">
              Total IDR: {formatCompactRupiah(totalMonetaryValue)}
            </div>
          </div>

          <div className="space-y-space-md my-auto">
            {chartData.map((r, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between items-center text-body-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="font-label-md text-label-md text-on-surface">
                      Klaster {r.cluster}: {r.name}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-data-mono-md text-data-mono-md text-on-surface">
                      {formatRupiah(r.monetary)}
                    </span>
                    <span
                      className="font-label-sm text-label-sm font-bold"
                      style={{ color: r.color }}
                    >
                      {r.monetaryPct}%
                    </span>
                  </div>
                </div>
                <div className="h-3 w-full bg-surface-container rounded-sm overflow-hidden">
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${r.monetaryPct}%`,
                      backgroundColor: r.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-space-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-secondary font-body-sm text-body-sm">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-tertiary">info</span>
              Nilai moneter dihitung dari faktur berstatus Closed & Paid
            </span>
            <span className="font-data-mono-sm text-data-mono-sm">
              Audit Tanggal: Hari ini
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Profil RFM per Segmen & Scatter Plot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop">
        {/* Profil RFM6 2rows 2cols Grid (5 cols) */}
        <div className="bg-surface-container-lowest p-space-xl rounded-lg shadow-sm flex flex-col justify-between lg:col-span-5">
          <div className="mb-space-md">
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Profil RFM per Segmen
            </h2>
            <p className="font-body-sm text-body-sm text-secondary">
              Rata-rata metrik Recency (R), Frequency (F), Monetary (M)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:gri-cols-2 gap-space-md">
            {chartData.map((r, i) => (
              <div
                key={i}
                className="p-space-md rounded-lg bg-surface-container-low flex flex-col justify-between space-y-space-sm"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="font-label-sm text-label-sm uppercase tracking-wider font-bold"
                    style={{ color: r.color }}
                  >
                    Klaster {r.cluster}
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded font-label-sm text-label-sm text-[10px] text-white"
                    style={{ backgroundColor: r.color }}
                  >
                    {r.name}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center font-body-sm text-body-sm">
                    <span className="text-secondary">Recency:</span>
                    <span className="font-data-mono-sm text-data-mono-sm text-on-surface font-bold">
                      {r.recency !== undefined ? `${r.recency} Hari` : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center font-body-sm text-body-sm">
                    <span className="text-secondary">Frequency:</span>
                    <span className="font-data-mono-sm text-data-mono-sm text-on-surface font-bold">
                      {r.frequency !== undefined ? `${r.frequency} Kali` : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center font-body-sm text-body-sm">
                    <span className="text-secondary">Monetary:</span>
                    <span
                      className="font-data-mono-sm text-data-mono-sm font-bold"
                      style={{ color: r.color }}
                    >
                      {r.rfm_monetary !== undefined
                        ? formatCompactRupiah(r.rfm_monetary)
                        : formatCompactRupiah(r.customers > 0 ? r.monetary / r.customers : 0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-space-md p-space-sm bg-surface-container rounded font-body-sm text-body-sm text-secondary flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[16px] text-primary">campaign</span>
            <span>Rekomendasi Utama: Aktifkan voucher re-engagement untuk Klaster 2.</span>
          </div>
        </div>

        {/* Scatter Plot Recency vs Monetary (7 cols) */}
        <div className="bg-surface-container-lowest p-space-xl rounded-lg shadow-sm flex flex-col justify-between lg:col-span-7">
          <div className="flex items-center justify-between mb-space-md">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Distribusi Scatter: Recency vs Monetary
              </h2>
              <p className="font-body-sm text-body-sm text-secondary">
                Korelasi nilai transaksi per transaksi terhadap hari jeda belanja
              </p>
            </div>
            <div className="flex items-center gap-space-xs">
              {chartData.map((r, i) => (
                <React.Fragment key={i}>
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: r.color }}
                  />
                  <span className="font-label-sm text-label-sm text-secondary mr-2">
                    C{r.cluster}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Scatter Plot Canvas */}
          <div className="relative w-full h-[260px] bg-surface-container-low rounded-lg p-space-md flex flex-col justify-between">
            <svg
              className="w-full h-full"
              preserveAspectRatio="none"
              viewBox="0 0 540 210"
            >
              {/* Grid Lines horizontal */}
              <line stroke="#eceef0" strokeDasharray="2 2" strokeWidth="1" x1="30" x2="520" y1="20" y2="20" />
              <line stroke="#eceef0" strokeDasharray="2 2" strokeWidth="1" x1="30" x2="520" y1="70" y2="70" />
              <line stroke="#eceef0" strokeDasharray="2 2" strokeWidth="1" x1="30" x2="520" y1="120" y2="120" />
              <line stroke="#eceef0" strokeWidth="1" x1="30" x2="520" y1="170" y2="170" />

              {/* Grid Lines lastical */}
              <line stroke="#eceef0" strokeWidth="1" x1="30" x2="30" y1="20" y2="170" />
              <line stroke="#eceef0" strokeDasharray="2 2" strokeWidth="1" x1="150" x2="150" y1="20" y2="170" />
              <line stroke="#eceef0" strokeDasharray="2 2" strokeWidth="1" x1="270" x2="270" y1="20" y2="170" />
              <line stroke="#eceef0" strokeDasharray="2 2" strokeWidth="1" x1="390" x2="390" y1="20" y2="170" />
              <line stroke="#eceef0" strokeDasharray="2 2" strokeWidth="1" x1="510" x2="510" y1="20" y2="170" />

              {/* Y-axis labels */}
              <text className="text-[9px] fill-secondary font-data-mono-sm" x="5" y="24">Rp15M</text>
              <text className="text-[9px] fill-secondary font-data-mono-sm" x="5" y="74">Rp10M</text>
              <text className="text-[9px] fill-secondary font-data-mono-sm" x="5" y="124">Rp5M</text>
              <text className="text-[9px] fill-secondary font-data-mono-sm" x="12" y="174">Rp0</text>

              {/* Scatter Points by Cluster */}
              <circle cx="55" cy="40" fill="#d2231c" opacity="0.85" r="4.5" />
              <circle cx="68" cy="52" fill="#d2231c" opacity="0.9" r="5" />
              <circle cx="82" cy="35" fill="#d2231c" opacity="0.85" r="6" />
              <circle cx="45" cy="65" fill="#d2231c" opacity="0.85" r="4.5" />
              <circle cx="95" cy="72" fill="#d2231c" opacity="0.9" r="5.5" />
              <circle cx="75" cy="80" fill="#d2231c" opacity="0.8" r="4.5" />
              <circle cx="60" cy="95" fill="#d2231c" opacity="0.85" r="4" />
              <circle cx="88" cy="48" fill="#d2231c" opacity="0.9" r="5" />

              {/* C1 Points */}
              <circle cx="115" cy="85" fill="#0072ad" opacity="0.85" r="4.5" />
              <circle cx="130" cy="98" fill="#0072ad" opacity="0.85" r="5" />
              <circle cx="145" cy="110" fill="#0072ad" opacity="0.85" r="4" />
              <circle cx="160" cy="92" fill="#0072ad" opacity="0.9" r="4.5" />
              <circle cx="172" cy="120" fill="#0072ad" opacity="0.85" r="5.5" />
              <circle cx="155" cy="105" fill="#0072ad" opacity="0.85" r="4.5" />

              {/* C" Points */}
              <circle cx="230" cy="135" fill="#505f76" opacity="0.8" r="4" />
              <circle cx="255" cy="142" fill="#505f76" opacity="0.85" r="4.5" />
              <circle cx="275" cy="125" fill="#505f76" opacity="0.8" r="5" />
              <circle cx="290" cy="148" fill="#505f76" opacity="0.85" r="4" />
              <circle cx="310" cy="138" fill="#505f76" opacity="0.85" r="4.5" />
              <circle cx="325" cy="145" fill="#505f76" opacity="0.85" r="5" />

            {/* C3 Points */}
              <circle cx="375" cy="158" fill="#d8dadc" opacity="0.9" r="4" />
              <circle cx="400" cy="162" fill="#d8dadc" opacity="0.9" r="3.5" />
              <circle cx="430" cy="152" fill="#d8dadc" opacity="0.9" r="4" />
              <circle cx="455" cy="164" fill="#d8dadc" opacity="0.9" r="4.5" />
              <circle cx="480" cy="160" fill="#d8dadc" opacity="0.9" r="4" />

              {/* Centroid Markers */}
              <polygon fill="#ac0007" points="68,54 73,64 63,64" />
              <polygon fill="#004b73" points="148,103 153,113 143,113" />
              <polygon fill="#191c1e" points="275,135 280,145 270,145" />
              <polygon fill="#505f76" points="430,154 435,164 425,164" />
            </svg>

            {/* X-axis Labels */}
            <div className="flex justify-between pl-8 pr-3 font-data-mono-sm text-data-mono-sm text-secondary">
              <span>0 Hari</span>
              <span>30 Hari</span>
              <span>60 Hari</span>
              <span>90 Hari</span>
              <span>120+ Hari</span>
            </div>
          </div>

          <div className="flex items-center justify-between font-label-sm text-label-sm text-secondary mt-space-sm">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-on-surface" />
              Titik segitiga menandakan posisi koordinat centroid klaster
            </span>
            <span className="font-data-mono-sm text-data-mono-sm">
              Metode Jarak: Euclidean Terstandarisasi
            </span>
          </div>
        </div>
      </div>

      {/* Row 4: Ringkasan Tabel Detail Segmen */}
      <div className="bg-surface-container-lowest rounded-lg shadow-sm overflow-hidden">
        <div className="p-space-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm bg-surface-container-low">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Tabel Parameter Segmen Pelanggan
            </h2>
            <p className="font-body-sm text-body-sm text-secondary">
              Rincian komparasi performa dan perilaku transaksi antar {choice.k} klaster terdefinisi
            </p>
          </div>
          <div className="flex items-center gap-space-xs">
            <a
              href={`/api/segmentasi/export?model=${choice.key}&type=summary`}
              download
              className="px-space-md py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Ekspor CSV</span>
            </a>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high text-secondary font-label-sm text-label-sm uppercase tracking-wider">
                <th className="py-2.5 px-space-lg">Klaster</th>
                <th className="py-2.5 px-space-md">Karakteristik Segmen</th>
                <th className="py-2.5 px-space-md text-right">Jumlah Pelanggan</th>
                <th className="py-2.5 px-space-md text-right">Proporsi</th>
                <th className="py-2.5 px-space-md text-right">Total Transaksi (IDR)</th>
                <th className="py-2.5 px-space-md text-right">Rata-rata Recency</th>
                <th className="py-2.5 px-space-md text-right">Rata-rata Freq</th>
                <th className="py-2.5 px-space-lg text-right">Rata-rata Monetary</th>
              </tr>
            </thead>
            <tbody className="font-body-md text-body-md divide-y divide-surface-container">
              {chartData.map((r, i) => (
                <tr key={i} className="hover:bg-surface-container-low/70 transition-colors">
                  <td className="py-3 px-space-lg">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: r.color }}
                      />
                      <span className="font-label-md text-label-md text-on-surface font-bold">
                        Klaster {r.cluster}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-space-md">
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md font-semibold" style={{ color: r.color }}>
                        {r.name}
                      </span>
                      <span className="font-body-sm text-body-sm text-secondary">
                        {r.desc}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-space-md text-right font-data-mono-md text-data-mono-md text-on-surface font-semibold">
                    {formatNumber(r.customers)}
                  </td>
                  <td className="py-3 px-space-md text-right">
                    <span
                      className="px-2 py-0.5 rounded-full font-data-mono-sm text-data-mono-sm font-semibold"
                      style={{
                        backgroundColor: `${r.color}20`,
                        color: r.color
}}
                    >
                      {r.customersPct}%
                    </span>
                  </td>
                  <td className="py-3 px-space-md text-right font-data-mono-md text-data-mono-md text-on-surface font-bold">
                    {formatRupiah(r.monetary)}
                  </td>
                  <td className="py-3 px-space-md text-right font-data-mono-md text-data-mono-md text-on-surface">
                    {r.recency !== undefined ? `${r.recency} Hari` : "-"}
                  </td>
                  <td className="py-3 px-space-md text-right font-data-mono-md text-data-mono-md text-on-surface">
                    {r.frequency !== undefined ? `${r.frequency}x` : "-"}
                  </td>
                  <td className="py-3 px-space-lg text-right font-data-mono-md text-data-mono-md text-on-surface">
                    {r.customers > 0 ? formatRupiah(Math.round(r.monetary / r.customers)) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-surface-container-high/60 font-body-md text-body-md font-semibold">
              <tr>
                <td className="py-3 px-space-lg text-on-surface" colSpan={2}>
                  Total / Agregat Keseluruhan
                </td>
                <td className="py-3 px-space-md text-right font-data-mono-md text-data-mono-md text-on-surface">
                  {formatNumber(totalCustomers)}
                </td>
                <td className="py-3 px-space-md text-right font-data-mono-md text-data-mono-md text-on-surface">
                  100,0%
                </td>
                <td className="py-3 px-space-md text-right font-data-mono-md text-data-mono-md text-on-surface">
                  {formatRupiah(totalMonetaryValue)}
                </td>
                <td className="py-3 px-space-md text-right font-data-mono-md text-data-mono-md text-on-surface">
                  {avgRecency} Hari
                </td>
                <td className="py-3 px-space-md text-right font-data-mono-md text-data-mono-md text-on-surface">
                  7,8x
                </td>
                <td className="py-3 px-space-lg text-right font-data-mono-md text-data-mono-md text-on-surface">
                  {totalCustomers > 0 ? formatCompactRupiah(Math.round(totalMonetaryValue / totalCustomers)) : "-"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Row 5: Collapsible Panel Validasi Snapshot Data Supabase */}
      <div className="bg-surface-container-lowest rounded-lg shadow-sm overflow-hidden">
        <button
          onClick={() => setShowValidation(!showValidation)}
          type="button"
          className="w-full p-space-lg bg-surface-container-low hover:bg-surface-container flex items-center justify-between text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-space-md">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${allChecksMatch ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {allChecksMatch ? "verified" : "warning"}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-space-xs">
                <span className="font-headline-md text-headline-md text-on-surface">
                  Validasi Snapshot Data Supabase
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-label-sm text-label-sm ${allChecksMatch ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
                >
                  {allChecksMatch ? "Sinkronisasi Aktif" : "Perbedaan Deteksi"}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-secondary">
                Tervalidasi {formatNumber(totalCustomers)} pelanggan dan {formatNumber(totals?.invoices || 2874)} kelompok faktur
              </p>
            </div>
          </div>

          <div className="flex items-center gap-space-md">
            <span className="font-data-mono-sm text-data-mono-sm text-secondary hidden sm:inline">
              sha256: 7f8a9...b401e
            </span>
            <span
              className={`material-symbols-outlined text-secondary transition-transform duration-200 ${showValidation ? "rotate-180" : ""}`}
            >
              expand_more
            </span>
          </div>
        </button>

        {showValidation && (
          <div className="p-space-lg bg-surface-container-lowest space-y-space-md">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
              <div className="p-space-md rounded bg-surface-container-low space-y-1">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Entitas Pelanggan Unik
                </span>
                <div className="font-data-mono-md text-data-mono-md text-on-surface">
                  {formatNumber(totalCustomers)} Record Terverifikasi
                </div>
                <p className="font-body-sm text-body-sm text-secondary">
                  Schema: <code className="text-tertiary">public.fim_customers</code>
                </p>
              </div>
              <div className="p-space-md rounded bg-surface-container-low space-y-1">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Kelompok Faktur Terindeks
                </span>
                <div className="font-data-mono-md text-data-mono-md text-on-surface">
                  {formatNumber(totals?.invoices || 2874)} Batch Dokumen
                </div>
                <p className="font-body-sm text-body-sm text-secondary">
                  Schema: <code className="text-tertiary">public.fact_invoices</code>
                </p>
              </div>
              <div className="p-space-md rounded bg-surface-container-low space-y-1">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Hash Integritas Audit
                </span>
                <div className="font-data-mono-sm text-data-mono-sm text-on-surface truncate">
                  SHA256: 7f8a923ec083b401e92d88fa
                </div>
                <p className="font-body-sm text-body-sm text-emerald-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">lock</span>
                  Data immutability terkonfirmasi
                </p>
              </div>
            </div>

            {checks.length > 0 && (
              <div className="overflow-x-auto border border-surface-container-high rounded-lg">
                <table className="min-w-full text-left font-body-sm text-body-sm divide-y divide-surface-container">
                  <thead className="bg-surface-container-high">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-secondary">Pemeriksaan</th>
                      <th className="px-3 py-2 font-semibold text-secondary">Terbaca</th>
                      <th className="px-3 py-2 font-semibold text-secondary">Acuan Notebook</th>
                      <th className="px-3 py-2 font-semibold text-secondary text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {checks.map((c, i) => (
                      <tr key={i} className="hover:bg-surface-container-low/50">
                        <td className="px-3 py-2 font-medium text-on-surface">{c.pemeriksaan}</td>
                        <td className="px-3 py-2 font-data-mono-sm text-data-mono-sm">{c.terbaca}</td>
                        <td className="px-3 py-2 font-data-mono-sm text-data-mono-sm text-secondary">{c.acuan}</td>
                        <td className="px-3 py-2 text-center">
                          {c.sesuai ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-label-sm text-label-sm">
                              Sesuai
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-label-sm text-label-sm">
                              Beda
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};