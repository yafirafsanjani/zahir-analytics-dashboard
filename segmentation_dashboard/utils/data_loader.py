"""Data loading utilities - cached, offline-first."""
import streamlit as st
import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

# --- format helpers -----------------------------------------------------------
def fmt_rp(value):
    """Format number to 'Rp 1.234.567' (no decimals for integers)."""
    if pd.isna(value):
        return "-"
    v = float(value)
    if v == int(v):
        return "Rp " + f"{int(v):,}".replace(",", ".")
    return "Rp " + f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def fmt_rp_short(value):
    """Compact Rp: M for miliar, Jt for juta."""
    v = float(value)
    if abs(v) >= 1_000_000_000:
        return f"Rp {v/1_000_000_000:,.2f} M".replace(",", ".")
    if abs(v) >= 1_000_000:
        return f"Rp {v/1_000_000:,.1f} Jt".replace(",", ".")
    return fmt_rp(v)


# --- cluster schema mapping ---------------------------------------------------
SCHEMA_MAP = {
    "K-Means (k=4)": {"cluster_col": "kmeans_k4_cluster", "segment_col": "kmeans_k4_segment",
                       "model": "K-Means", "k": 4, "fak_col": "kmeans_k4_cluster"},
    "GMM (k=3)":     {"cluster_col": "gmm_k3_cluster",   "segment_col": "gmm_k3_segment",
                       "model": "GMM",     "k": 3, "fak_col": "gmm_k3_cluster"},
    "GMM (k=4)":     {"cluster_col": "gmm_k4_cluster",   "segment_col": "gmm_k4_segment",
                       "model": "GMM",     "k": 4, "fak_col": "gmm_k4_cluster"},
}


# --- data loaders -------------------------------------------------------------
@st.cache_data(show_spinner="Memuat data pelanggan...")
def load_customers(uploaded_xlsx=None):
    src = uploaded_xlsx or (DATA_DIR / "Hasil_Segmentasi_Pelanggan_Zahir.xlsx")
    return pd.read_excel(src, sheet_name="customer_segments")


@st.cache_data(show_spinner="Memuat ringkasan segmen...")
def load_segment_summary(uploaded_xlsx=None):
    src = uploaded_xlsx or (DATA_DIR / "Hasil_Segmentasi_Pelanggan_Zahir.xlsx")
    df = pd.read_excel(src, sheet_name="segment_summary")
    csv_path = DATA_DIR / "segment_summary.csv"
    if csv_path.exists() and uploaded_xlsx is None:
        df_csv = pd.read_csv(csv_path)
        if len(df_csv) >= len(df):
            return df_csv
    return df


@st.cache_data(show_spinner="Memuat probabilitas GMM...")
def load_gmm_prob(uploaded_xlsx=None):
    src = uploaded_xlsx or (DATA_DIR / "Hasil_Segmentasi_Pelanggan_Zahir.xlsx")
    return pd.read_excel(src, sheet_name="gmm_probability")


@st.cache_data(show_spinner="Memuat evaluasi model...")
def load_model_eval(uploaded_xlsx=None):
    src = uploaded_xlsx or (DATA_DIR / "Hasil_Segmentasi_Pelanggan_Zahir.xlsx")
    return pd.read_excel(src, sheet_name="model_evaluation")


@st.cache_data(show_spinner="Memuat perbandingan model...")
def load_model_comparison(uploaded_xlsx=None):
    src = uploaded_xlsx or (DATA_DIR / "Hasil_Segmentasi_Pelanggan_Zahir.xlsx")
    df = pd.read_excel(src, sheet_name="model_comparison")
    csv_path = DATA_DIR / "model_comparison.csv"
    if csv_path.exists() and uploaded_xlsx is None:
        df_csv = pd.read_csv(csv_path)
        if len(df_csv) >= len(df):
            return df_csv
    return df


@st.cache_data(show_spinner="Memuat audit faktur...")
def load_audit(uploaded_xlsx=None):
    src = uploaded_xlsx or (DATA_DIR / "Hasil_Segmentasi_Pelanggan_Zahir.xlsx")
    return pd.read_excel(src, sheet_name="invoice_audit_summary")


@st.cache_data(show_spinner="Memuat faktur lolos...")
def load_invoices(uploaded_csv=None):
    src = uploaded_csv or (DATA_DIR / "faktur_lolos_dengan_klaster.csv")
    df = pd.read_csv(src)
    df["tanggal_faktur"] = pd.to_datetime(df["tanggal_faktur"], errors="coerce")
    return df
