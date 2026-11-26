import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkSocialAccess, loadSocialData } from "@/lib/social/backend";
import { generateCsv } from "@/lib/segmentation/formatters";
import { SENTIMENT_LABEL_MAP } from "@/lib/social/calculations";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sesi tidak tersedia." }, { status: 401 });
    }

    const hasAccess = await checkSocialAccess(supabase);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Akun belum mendapat izin baca Analisis Media Sosial." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const target = searchParams.get("target") || "playstore";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const data = await loadSocialData(supabase);

    if (target === "instagram") {
      const formatFilter = searchParams.get("format"); // comma-separated or null
      let posts = data.posts;

      if (startDate && endDate) {
        posts = posts.filter(
          (p) => p.post_date >= startDate && p.post_date <= endDate
        );
      }

      if (formatFilter) {
        const allowedFormats = formatFilter.split(",").map((s) => s.trim().toLowerCase());
        posts = posts.filter((p) => {
          const typeNorm = p.content_type.toLowerCase();
          return (
            allowedFormats.includes(typeNorm) ||
            (typeNorm === "video/reel" && allowedFormats.includes("reels")) ||
            (typeNorm === "image" && (allowedFormats.includes("single image") || allowedFormats.includes("feed")))
          );
        });
      }

      // Sort by total interactions desc
      const sortedPosts = [...posts].sort((a, b) => b.total_interactions - a.total_interactions);

      const rows = sortedPosts.map((p, idx) => ({
        Peringkat: idx + 1,
        "ID Konten": p.post_id,
        "Tanggal Post": p.post_date,
        "Hari Tayang": p.post_day_of_week,
        "Jam Tayang (WIB)": `${p.post_hour_wib}:00`,
        "Tipe Konten": p.content_type,
        Likes: p.likes,
        Komentar: p.comments,
        "Total Interaksi": p.total_interactions,
        "Kolaborasi KOL": p.is_collaboration ? "Ya" : "Tidak",
        "Jumlah Kata Caption": p.caption_word_count,
        "Jumlah Hashtag": p.hashtag_count,
      }));

      const csvContent = generateCsv(rows);
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="instagram_postingan_terfilter.csv"`,
        },
      });
    }

    // Default: Play Store reviews
    const appFilter = searchParams.get("app");
    const ratingFilter = searchParams.get("rating");
    const sentimentFilter = searchParams.get("sentiment");

    let reviews = data.reviews;

    if (startDate && endDate) {
      reviews = reviews.filter(
        (r) => r.review_date >= startDate && r.review_date <= endDate
      );
    }

    if (appFilter) {
      const allowedApps = appFilter.split(",").map((s) => s.trim());
      reviews = reviews.filter((r) => allowedApps.includes(r.app_name));
    }

    if (ratingFilter) {
      const allowedRatings = ratingFilter.split(",").map((s) => parseInt(s.trim(), 10));
      reviews = reviews.filter((r) => allowedRatings.includes(r.score));
    }

    if (sentimentFilter) {
      const allowedSentiments = sentimentFilter.split(",").map((s) => s.trim());
      reviews = reviews.filter((r) => allowedSentiments.includes(r.human_sentiment_label));
    }

    const rows = reviews.map((r) => ({
      "Review ID": r.review_id,
      Tanggal: r.review_date,
      Aplikasi: r.app_name,
      Rating: r.score,
      Sentimen: SENTIMENT_LABEL_MAP[r.human_sentiment_label] || r.human_sentiment_label,
      "Dibalas Developer": r.has_developer_reply ? "Ya" : "Tidak",
      "Login & Akses": r.aspect_login_auth ? "Ya" : "Tidak",
      Stabilitas: r.aspect_crash_stability ? "Ya" : "Tidak",
      "Harga & Langganan": r.aspect_pricing_subscription ? "Ya" : "Tidak",
      "Sinkronisasi Data": r.aspect_sync_cloud_data ? "Ya" : "Tidak",
      "POS & Cetak": r.aspect_pos_hardware_print ? "Ya" : "Tidak",
      "Inventori & Akuntansi": r.aspect_inventory_accounting ? "Ya" : "Tidak",
      "Sertifikasi & Ujian": r.aspect_certification_exam ? "Ya" : "Tidak",
      "Absensi & Wajah": r.aspect_attendance_face ? "Ya" : "Tidak",
    }));

    const csvContent = generateCsv(rows);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="playstore_ulasan_terfilter.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Gagal memproses ekspor ulasan." },
      { status: 500 }
    );
  }
}
