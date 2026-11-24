"""Dashboard Segmentasi Pelanggan Zahir - entry point."""
import streamlit as st
import pandas as pd
import numpy as np

st.set_page_config(page_title="Dashboard Segmentasi Pelanggan Zahir",
                   page_icon=":bar_chart:", layout="wide")

# Inject clean styling to prevent any chart or container clipping
st.markdown("""
<style>
/* Prevent any visualization from being cut off */
[data-testid="stPlotlyChart"], [data-testid="stVegaLiteChart"] {
    width: 100% !important;
    overflow: visible !important;
}
.js-plotly-plot, .plot-container {
    overflow: visible !important;
}
[data-testid="stMetric"] {
    background: white;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
[data-testid="stMetricValue"] {
    font-size: 1.55rem !important;
    font-weight: 700;
    white-space: normal !important;
    overflow-wrap: break-word !important;
}
[data-testid="stMetricLabel"] {
    white-space: normal !important;
    color: #64748B;
    font-size: 0.85rem !important;
}
[data-testid="stDataFrame"] {
    border: 1px solid #E2E8F0;
    border-radius: 8px;
}
</style>
""", unsafe_allow_html=True)

from utils.data_loader import (
    load_customers, load_segment_summary, load_gmm_prob,
    load_model_eval, load_model_comparison, load_audit,
    load_invoices, fmt_rp, fmt_rp_short, SCHEMA_MAP,
)
from utils.charts import (
    chart_proportion, chart_rfm_radar, chart_scatter_rfm, chart_boxplot,
    chart_timeseries, chart_rp0_breakdown, chart_eval_lines, chart_sankey,
    chart_gmm_hist, chart_funnel, chart_audit_bars,
)

# --- SIDEBAR ------------------------------------------------------------------
st.sidebar.markdown("### :bar_chart: Zahir Segmentasi")
st.sidebar.caption("Dashboard eksploratif offline")

with st.sidebar.expander("Upload file (opsional)", expanded=False):
    up_xlsx = st.file_uploader("Excel (.xlsx)", type="xlsx", key="up_xlsx")
    up_csv  = st.file_uploader("Faktur CSV", type="csv", key="up_csv")

schema_key = st.sidebar.selectbox("Skema Klaster Aktif", list(SCHEMA_MAP), index=0)
schema = SCHEMA_MAP[schema_key]

# load data
cust = load_customers(up_xlsx)
seg_sum = load_segment_summary(up_xlsx)
gmm_prob = load_gmm_prob(up_xlsx)
model_eval = load_model_eval(up_xlsx)
model_comp = load_model_comparison(up_xlsx)
audit = load_audit(up_xlsx)
invoices = load_invoices(up_csv)

# active columns
c_cluster = schema["cluster_col"]
c_segment = schema["segment_col"]
fak_cluster = schema["fak_col"]

# build segment label for display
cust["_seg_label"] = cust[c_cluster].astype(str) + " - " + cust[c_segment].astype(str)
all_segments = sorted(cust["_seg_label"].unique())

seg_filter = st.sidebar.multiselect("Filter Segmen", all_segments, default=all_segments)
toggle_rp0 = st.sidebar.toggle("Sertakan pelanggan Monetary Rp 0", value=True)

st.sidebar.divider()
st.sidebar.markdown("**Rentang Tanggal Faktur**")
min_date = invoices["tanggal_faktur"].min()
max_date = invoices["tanggal_faktur"].max()
if pd.isna(min_date):
    min_date = pd.Timestamp("2006-12-08")
if pd.isna(max_date):
    max_date = pd.Timestamp("2026-07-08")
date_range = st.sidebar.date_input("Periode", value=(min_date, max_date),
                                   min_value=min_date, max_value=max_date, key="date_range")

st.sidebar.divider()
st.sidebar.markdown("**Rentang RFM (Tab 2)**")
mon_min, mon_max = float(cust["Monetary"].min()), float(cust["Monetary"].max())
freq_min, freq_max = int(cust["Frequency"].min()), int(cust["Frequency"].max())
monetary_range = st.sidebar.slider("Monetary (Rp)", mon_min, mon_max, (mon_min, mon_max),
                                   format="Rp %,.0f", key="mon_slider")
frequency_range = st.sidebar.slider("Frequency", freq_min, freq_max, (freq_min, freq_max),
                                    key="freq_slider")

# --- APPLY FILTERS ------------------------------------------------------------
mask = cust["_seg_label"].isin(seg_filter)
if not toggle_rp0:
    mask &= cust["Monetary"] > 0
df = cust[mask].copy()

# active segment summary
ss = seg_sum[(seg_sum["model"] == schema["model"]) & (seg_sum["k"] == schema["k"])].copy()

# invoice filter
inv = invoices.copy()
inv["_seg"] = inv[fak_cluster].astype(str)
# map cluster -> segment label
cluster_to_label = dict(zip(cust[c_cluster], cust["_seg_label"]))
inv["_seg_label"] = inv["_seg"].map(cluster_to_label).fillna(inv["_seg"])
inv_mask = inv["_seg_label"].isin(seg_filter)
if isinstance(date_range, (tuple, list)) and len(date_range) == 2:
    inv_mask &= inv["tanggal_faktur"] >= pd.Timestamp(date_range[0])
    inv_mask &= inv["tanggal_faktur"] <= pd.Timestamp(date_range[1])
inv_filtered = inv[inv_mask]

# --- BANNER -------------------------------------------------------------------
st.info("**Status:** Eksploratif; label sementara; cleaning awal Rp 0,01. "
        "Total Monetary merepresentasikan subset faktur lolos audit, bukan total penjualan seluruh workbook.",
        icon=":material/info:")

# --- TABS ---------------------------------------------------------------------
tab1, tab2, tab3, tab4, tab5 = st.tabs([
    ":clipboard: Ringkasan Eksekutif",
    ":mag: Eksplorasi RFM",
    ":chart_with_upwards_trend: Tren Transaksi",
    ":test_tube: Evaluasi Model",
    ":shield: Audit Data",
])

# --- TAB 1: RINGKASAN EKSEKUTIF & PROFIL SEGMEN -------------------------------
with tab1:
    st.subheader("Ringkasan Eksekutif")
    k1, k2, k3, k4, k5 = st.columns(5)
    total_cust = len(df)
    total_inv = len(inv_filtered)
    total_mon = df["Monetary"].sum()
    median_mon = df["Monetary"].median()
    cust_rp0 = int((df["Monetary"] == 0).sum())
    k1.metric("Pelanggan Terfilter", f"{total_cust:,}".replace(",", "."))
    k2.metric("Faktur Lolos", f"{total_inv:,}".replace(",", "."))
    k3.metric("Total Monetary", fmt_rp_short(total_mon))
    k4.metric("Median Monetary", fmt_rp_short(median_mon), help=fmt_rp(median_mon))
    k5.metric("Pelanggan Rp 0", str(cust_rp0))

    if not ss.empty:
        col_a, col_b = st.columns(2)
        with col_a:
            st.plotly_chart(chart_proportion(ss, "nama_segmen", "cluster_code"),
                            use_container_width=True)
        with col_b:
            st.plotly_chart(chart_rfm_radar(ss, "nama_segmen", "cluster_code"),
                            use_container_width=True)

        st.caption("Tabel Ringkasan Segmen")
        display_cols = ["cluster_code", "nama_segmen", "jumlah_label", "persen_label",
                        "median_Recency_hari", "median_Frequency", "median_Monetary_Rp",
                        "total_Monetary_Rp", "median_keragaman_produk", "label_Monetary_nol"]
        ss_display = ss[[c for c in display_cols if c in ss.columns]].copy()
        st.dataframe(
            ss_display, use_container_width=True, hide_index=True,
            column_config={
                "median_Monetary_Rp": st.column_config.NumberColumn("Median Monetary", format="localized"),
                "total_Monetary_Rp": st.column_config.NumberColumn("Total Monetary", format="localized"),
                "persen_label": st.column_config.NumberColumn("% Label", format="%.1f%%"),
            },
        )
    else:
        st.warning("Ringkasan segmen tidak tersedia untuk model ini.")

# --- TAB 2: EKSPLORASI RFM & DETAIL PELANGGAN ----------------------------------
with tab2:
    st.subheader("Eksplorasi RFM & Detail Pelanggan")
    df2 = df[(df["Monetary"] >= monetary_range[0]) & (df["Monetary"] <= monetary_range[1]) &
             (df["Frequency"] >= frequency_range[0]) & (df["Frequency"] <= frequency_range[1])].copy()
    st.caption(f"{len(df2):,} pelanggan setelah filter RFM")

    log_mon = st.checkbox("Skala Log untuk Monetary", value=False, key="log_monetary")
    st.plotly_chart(chart_scatter_rfm(df2, c_segment, log_mon), use_container_width=True)

    metric_choice = st.radio("Metrik boxplot", ["Recency", "Frequency", "Monetary", "keragaman_nama_produk"],
                             horizontal=True, key="boxplot_metric")
    st.plotly_chart(chart_boxplot(df2, c_segment, metric_choice), use_container_width=True)

    st.divider()
    st.subheader("Pencarian & Drill-Down Klien")
    search = st.text_input("Cari id_samaran atau nama_klien", key="search_client")
    result = df2.copy()
    if search:
        mask_id = result["id_samaran"].str.contains(search, case=False, na=False)
        matched_ids = invoices[invoices["nama_klien"].str.contains(search, case=False, na=False)]["id_samaran"].unique()
        mask_name = result["id_samaran"].isin(matched_ids)
        result = result[mask_id | mask_name]

    result["Status Nominal"] = result["status_nominal_terakhir"].apply(
        lambda x: ":warning:" if "Belum dapat ditetapkan" in str(x) else ":white_check_mark:")
    display_cust_cols = ["id_samaran", "Recency", "Frequency", "Monetary",
                         c_cluster, c_segment, "keragaman_nama_produk",
                         "nominal_faktur_terakhir_Rp", "Status Nominal"]
    st.dataframe(
        result[[c for c in display_cust_cols if c in result.columns]],
        use_container_width=True, hide_index=True,
        column_config={
            "Monetary": st.column_config.NumberColumn(format="localized"),
            "nominal_faktur_terakhir_Rp": st.column_config.NumberColumn("Nominal Terakhir", format="localized"),
        },
    )
    st.caption(f"19 kasus 'Belum dapat ditetapkan: urutan tidak diketahui' ditandai :warning:")

    csv_cust = result.to_csv(index=False).encode("utf-8-sig")
    st.download_button(":arrow_down: Unduh CSV pelanggan", csv_cust, "pelanggan_terfilter.csv", "text/csv")

    st.divider()
    ids_available = sorted(result["id_samaran"].unique())
    if ids_available:
        selected_id = st.selectbox("Pilih id_samaran untuk profil detail", ids_available, key="select_id")
        profile = cust[cust["id_samaran"] == selected_id].iloc[0]

        pc1, pc2, pc3, pc4 = st.columns(4)
        pc1.metric("Recency (hari)", f"{profile['Recency']:,}".replace(",", "."))
        pc2.metric("Frequency", str(profile["Frequency"]))
        pc3.metric("Monetary", fmt_rp(profile["Monetary"]))
        pc4.metric("Keragaman Produk", str(profile["keragaman_nama_produk"]))

        # GMM probability
        gmm_row = gmm_prob[gmm_prob["id_samaran"] == selected_id]
        if not gmm_row.empty:
            gr = gmm_row.iloc[0]
            with st.expander("Probabilitas GMM", expanded=True):
                prob_cols = [c for c in gmm_row.columns if c.startswith("prob_")]
                prob_data = {c.replace("prob_", ""): f"{gr[c]:.6f}" for c in prob_cols}
                st.json(prob_data)
                st.caption(f"Klaster terpilih: **{gr['cluster_terpilih']}** | "
                           f"Prob tertinggi: {gr['probabilitas_tertinggi']:.6f} | "
                           f"Selisih: {gr['selisih_dua_teratas']:.6f}")

        # invoice history
        client_inv = invoices[invoices["id_samaran"] == selected_id].sort_values("tanggal_faktur", ascending=False)
        if not client_inv.empty:
            st.caption(f"Riwayat faktur: {len(client_inv)} kelompok faktur")
            st.dataframe(
                client_inv[["id_kelompok_faktur", "tanggal_faktur", "grand_total_rp",
                            "nama_klien", fak_cluster]],
                use_container_width=True, hide_index=True,
                column_config={
                    "grand_total_rp": st.column_config.NumberColumn("Grand Total (Rp)", format="localized"),
                    "tanggal_faktur": st.column_config.DateColumn("Tanggal", format="DD MMM YYYY"),
                },
            )
        else:
            st.info("Tidak ada faktur untuk pelanggan ini.")

# --- TAB 3: TREN TRANSAKSI FAKTUR ----------------------------------------------
with tab3:
    st.subheader("Tren Transaksi Faktur")
    agg_choice = st.radio("Agregasi", ["Tahunan", "Kuartalan"], horizontal=True, key="agg_choice")

    inv_chart = inv_filtered.copy()
    inv_chart["_seg_display"] = inv_chart["_seg_label"]

    col_t1, col_t2 = st.columns(2)
    with col_t1:
        st.plotly_chart(
            chart_timeseries(inv_chart, "_seg_display", agg_choice, "grand_total_rp",
                             "Total Nilai Faktur per Periode"),
            use_container_width=True)
    with col_t2:
        st.plotly_chart(
            chart_timeseries(inv_chart, "_seg_display", agg_choice, "count",
                             "Jumlah Faktur per Periode"),
            use_container_width=True)

    st.divider()
    st.subheader("Faktur Rp 0")
    rp0_fig = chart_rp0_breakdown(inv_chart, "_seg_display", agg_choice)
    if rp0_fig:
        st.plotly_chart(rp0_fig, use_container_width=True)
        rp0_count = int((inv_chart["grand_total_rp"] == 0).sum())
        st.caption(f"{rp0_count} faktur bernilai Rp 0 dalam rentang yang dipilih.")
    else:
        st.info("Tidak ada faktur Rp 0 pada filter aktif.")

    csv_inv = inv_filtered.drop(columns=["_seg", "_seg_label"], errors="ignore").to_csv(index=False).encode("utf-8-sig")
    st.download_button(":arrow_down: Unduh CSV faktur", csv_inv, "faktur_terfilter.csv", "text/csv")

# --- TAB 4: EVALUASI & PERBANDINGAN MODEL --------------------------------------
with tab4:
    st.subheader("Evaluasi Model Klaster")
    available_metrics = ["silhouette", "davies_bouldin", "calinski_harabasz", "BIC", "rata_rank"]
    eval_metric = st.selectbox("Metrik evaluasi", available_metrics, key="eval_metric")
    st.plotly_chart(chart_eval_lines(model_eval, eval_metric), use_container_width=True)
    st.caption("**K-Means k=4** meraih rata_rank terbaik (**2,00**) di antara 28 konfigurasi yang diuji.")

    st.divider()
    st.subheader("Perbandingan Antar-Model (Sankey)")
    comp_choice = st.selectbox("Pasangan perbandingan",
                               ["K-Means k=4 vs GMM k=3", "K-Means k=4 vs GMM k=4"], key="comp_choice")
    if "k=3" in comp_choice:
        mc_filtered = model_comp[(model_comp["left_k"] == 4) & (model_comp["right_k"] == 3)]
    else:
        mc_filtered = model_comp[(model_comp["left_k"] == 4) & (model_comp["right_k"] == 4)]
    if not mc_filtered.empty:
        st.plotly_chart(chart_sankey(mc_filtered, "K-Means k=4",
                                    "GMM k=3" if "k=3" in comp_choice else "GMM k=4"),
                        use_container_width=True)
    else:
        st.info("Data perbandingan tidak tersedia.")

    st.divider()
    st.subheader("Kepastian Klaster GMM (k=3)")
    col_g1, col_g2 = st.columns(2)
    with col_g1:
        st.plotly_chart(chart_gmm_hist(gmm_prob, "probabilitas_tertinggi",
                                       "Distribusi Probabilitas Tertinggi"),
                        use_container_width=True)
    with col_g2:
        st.plotly_chart(chart_gmm_hist(gmm_prob, "selisih_dua_teratas",
                                       "Distribusi Selisih Dua Teratas"),
                        use_container_width=True)
    st.caption("Seluruh 1.456 pelanggan memiliki **probabilitas tertinggi >= 0,99** "
               "dengan selisih minimum **0,9996**, sehingga batas klaster GMM sangat tegas.")

# --- TAB 5: AUDIT & KUALITAS DATA ---------------------------------------------
with tab5:
    st.subheader("Audit & Kualitas Data")

    col_f1, col_f2 = st.columns(2)
    with col_f1:
        st.plotly_chart(chart_funnel(
            [("Total baris item", 22086), ("Kelompok dapat direkonsiliasi", 6338),
             ("Baris item lolos", 6083)],
            "Penyaringan Baris Item"), use_container_width=True)
    with col_f2:
        st.plotly_chart(chart_funnel(
            [("Total kelompok faktur", 6665), ("Sesuai batas nominal", 3214),
             ("Kelompok lolos", 2874)],
            "Penyaringan Kelompok Faktur"), use_container_width=True)

    st.divider()
    st.subheader("Penyebab Penahanan Kelompok Faktur")
    st.plotly_chart(chart_audit_bars(
        [("Selisih nominal > Rp 0,01 saja", 2630),
         ("Selisih nominal + alasan lain", 494),
         ("Alasan lain tanpa selisih nominal", 667)],
        "Distribusi Penyebab Penahanan (3.791 kelompok)"), use_container_width=True)

    st.divider()
    st.subheader("Temuan Audit Utama")
    st.plotly_chart(chart_audit_bars(
        [("Duplikat identik", 2253), ("Faktur multi-baris", 3656),
         ("Tanggal kosong", 1969), ("Konflik klien", 349),
         ("Konflik grand_total", 301), ("Konflik tanggal", 221),
         ("Subtotal negatif", 170), ("Variasi nama produk", 61)],
        "Ringkasan Temuan Audit"), use_container_width=True)

    st.divider()
    st.caption("Tabel Audit Lengkap")
    display_audit = audit[["cakupan", "pemeriksaan", "jumlah_kasus", "unit", "dampak_RFM"]].copy()
    st.dataframe(display_audit, use_container_width=True, hide_index=True,
                 column_config={
                     "jumlah_kasus": st.column_config.NumberColumn("Jumlah", format="localized"),
                 })
