import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  checkSegmentationAccess,
  discoverModels,
  fetchSegmentSummary,
  fetchAllInvoicesForExport,
  fetchInvoiceDetailPage,
} from "@/lib/segmentation/backend";
import { generateCsv } from "@/lib/segmentation/formatters";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sesi tidak tersedia." }, { status: 401 });
    }

    const hasAccess = await checkSegmentationAccess(supabase);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Akun belum mendapat izin baca Segmentasi Pelanggan." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const modelKey = searchParams.get("model") || "kmeans_k4";
    const query = searchParams.get("query") || "";
    const cluster = searchParams.get("cluster") || undefined;
    const exportAll = searchParams.get("all") === "true";
    const page = parseInt(searchParams.get("page") || "0", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "25", 10);

    const models = await discoverModels(supabase);
    const choice = models.find((m) => m.key === modelKey) || models[0];

    const summary = await fetchSegmentSummary(supabase, choice);
    const clusterNames: Record<string, string> = {};
    for (const r of summary) {
      clusterNames[r.cluster] = r.name;
    }

    let rows: Record<string, any>[] = [];

    if (exportAll) {
      rows = await fetchAllInvoicesForExport(
        supabase,
        choice,
        clusterNames,
        query,
        cluster
      );
    } else {
      const pageResult = await fetchInvoiceDetailPage(
        supabase,
        choice,
        clusterNames,
        query,
        page,
        pageSize,
        cluster
      );
      rows = pageResult.rows.map((r) => ({
        "ID kelompok faktur": r.id,
        "Tanggal faktur": r.date,
        "Nama perusahaan": r.company,
        "Grand total (Rp)": r.amount,
        "Klaster": r.cluster,
        "Segmen": r.segment,
      }));
    }

    const csvContent = generateCsv(rows);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="faktur_${choice.key}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Gagal memproses ekspor faktur." },
      { status: 500 }
    );
  }
}
