import { SupabaseClient } from "@supabase/supabase-js";
import { SocialDataBundle } from "./types";

let cachedSocialBundle: SocialDataBundle | null = null;
let loadSocialPromise: Promise<SocialDataBundle> | null = null;

export function clearSocialCache(): void {
  cachedSocialBundle = null;
  loadSocialPromise = null;
}

export async function checkSocialAccess(
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_social_analytics_access");
  if (error || data !== true) {
    return false;
  }
  return true;
}

async function fetchAllRows<T>(
  supabase: SupabaseClient,
  table: string,
  orderBy?: string
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (offset < 50000) {
    let q = supabase.from(table).select("*", { count: "exact" });
    if (orderBy) {
      q = q.order(orderBy, { ascending: true });
    }
    q = q.range(offset, offset + pageSize - 1);

    const { data, count, error } = await q;
    if (error || !data) {
      throw new Error(`Gagal membaca data dari tabel ${table}: ${error?.message || ""}`);
    }

    rows.push(...(data as T[]));
    if (count !== null && rows.length >= count) break;
    if (data.length < pageSize) break;
    offset += data.length;
  }

  return rows;
}

export async function loadSocialData(
  supabase: SupabaseClient,
  forceRefresh = false
): Promise<SocialDataBundle> {
  if (!forceRefresh && cachedSocialBundle) {
    return cachedSocialBundle;
  }
  if (loadSocialPromise) {
    return loadSocialPromise;
  }

  loadSocialPromise = (async () => {
    try {
      const hasAccess = await checkSocialAccess(supabase);
      if (!hasAccess) {
        throw new Error(
          "Akun ini belum mendapat izin baca Analisis Media Sosial. Hubungi administrator."
        );
      }

      const [
        reviews,
        posts,
        benchmarks,
        predictions,
        clusters,
        assignments,
        diagnostics,
        quality,
        readiness,
        scope,
      ] = await Promise.all([
        fetchAllRows<any>(supabase, "social_playstore_reviews", "review_id"),
        fetchAllRows<any>(supabase, "social_instagram_posts", "post_id"),
        fetchAllRows<any>(supabase, "social_sentiment_benchmarks", "model_name"),
        fetchAllRows<any>(supabase, "social_sentiment_test_predictions", "review_id"),
        fetchAllRows<any>(supabase, "social_topic_clusters_k4", "kmeans_cluster_k4"),
        fetchAllRows<any>(supabase, "social_topic_assignments_k4", "review_id"),
        fetchAllRows<any>(supabase, "social_topic_clustering_metrics", "num_clusters_k"),
        fetchAllRows<any>(supabase, "social_text_quality_summary"),
        fetchAllRows<any>(supabase, "social_topic_readiness"),
        fetchAllRows<any>(supabase, "social_topic_scope_comparison", "scope_name"),
      ]);

      const bundle: SocialDataBundle = {
        reviews,
        posts,
        benchmarks,
        predictions,
        clusters,
        assignments,
        diagnostics,
        quality,
        readiness,
        scope,
      };

      cachedSocialBundle = bundle;
      return bundle;
    } finally {
      loadSocialPromise = null;
    }
  })();

  return loadSocialPromise;
}
