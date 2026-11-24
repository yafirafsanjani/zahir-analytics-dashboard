import textwrap
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
import numpy as np

# Palette
SEG_COLORS = ["#D2231C", "#2563EB", "#F59E0B", "#10B981", "#8B5CF6",
              "#EC4899", "#6366F1", "#14B8A6"]

def _color_map(segments):
    return {s: SEG_COLORS[i % len(SEG_COLORS)] for i, s in enumerate(sorted(segments))}


def _rp_hover(val):
    v = float(val)
    if abs(v) >= 1e9:
        return f"Rp {v/1e9:,.2f} M".replace(",", "X").replace(".", ",").replace("X", ".")
    if abs(v) >= 1e6:
        return f"Rp {v/1e6:,.1f} Jt".replace(",", "X").replace(".", ",").replace("X", ".")
    return "Rp " + f"{v:,.0f}".replace(",", ".")


_LAYOUT = dict(
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    font=dict(family="Inter, sans-serif", size=12, color="#1E293B"),
    margin=dict(l=60, r=40, t=55, b=60),
    legend=dict(
        orientation="h",
        yanchor="bottom",
        y=1.02,
        xanchor="right",
        x=1.0,
        bgcolor="rgba(255,255,255,0.75)",
        font=dict(size=11),
    ),
)


def _base(fig, **kw):
    layout = dict(_LAYOUT)
    layout.update(kw)
    fig.update_layout(**layout)
    fig.update_xaxes(gridcolor="#E5EEFF", zeroline=False, automargin=True, tickfont=dict(size=11))
    fig.update_yaxes(gridcolor="#E5EEFF", zeroline=False, automargin=True, tickfont=dict(size=11))
    return fig


# --- Tab 1 charts -------------------------------------------------------------
def chart_proportion(summary, seg_col, cluster_col):
    """Grouped bar: % pelanggan vs % monetary per segment with safe margins."""
    df = summary.copy()
    total_cust = df["jumlah_label"].sum()
    total_mon = df["total_Monetary_Rp"].sum()
    df["% Pelanggan"] = df["jumlah_label"] / total_cust * 100 if total_cust else 0
    df["% Monetary"] = df["total_Monetary_Rp"] / total_mon * 100 if total_mon else 0
    df["Segmen"] = df[cluster_col].astype(str) + " - " + df[seg_col].astype(str)
    # Wrap long segment names across lines so x-axis is never cut off
    df["Segmen_display"] = df["Segmen"].apply(
        lambda s: "<br>".join(textwrap.wrap(str(s), width=22))
    )
    melted = df.melt(id_vars="Segmen_display", value_vars=["% Pelanggan", "% Monetary"],
                     var_name="Metrik", value_name="Persen")
    max_pct = melted["Persen"].max() if not melted.empty else 100
    fig = px.bar(melted, x="Segmen_display", y="Persen", color="Metrik", barmode="group",
                 color_discrete_sequence=["#2563EB", "#D2231C"],
                 text=melted["Persen"].map(lambda v: f"{v:.1f}%"),
                 labels={"Segmen_display": "Segmen", "Persen": "Persentase (%)"})
    fig.update_traces(textposition="outside", textfont_size=10, cliponaxis=False)
    # Extra headroom for outside text labels
    fig.update_yaxes(range=[0, max(max_pct * 1.2, 10)], automargin=True)
    fig.update_xaxes(automargin=True, tickangle=0)
    return _base(fig, title="Proporsi Pelanggan vs Kontribusi Monetary (%)",
                 yaxis_title="%", margin=dict(l=55, r=30, t=65, b=85))


def chart_rfm_radar(summary, seg_col, cluster_col):
    """Radar chart normalized across metrics with real Indonesian formatted tooltips."""
    df = summary.copy()
    df["Segmen"] = df[cluster_col].astype(str) + " - " + df[seg_col].astype(str)
    cats = ["Recency (hari)", "Frequency", "Monetary (Rp)", "Keragaman Produk"]
    
    # Calculate maximums for normalization so all dimensions scale 0-100% nicely
    max_r = max(df["median_Recency_hari"].max(), 1.0)
    max_f = max(df["median_Frequency"].max(), 1.0)
    max_m = max(df["median_Monetary_Rp"].max(), 1.0)
    max_k = max(df["median_keragaman_produk"].max(), 1.0)
    
    fig = go.Figure()
    for i, (_, row) in enumerate(df.iterrows()):
        r_real = row["median_Recency_hari"]
        f_real = row["median_Frequency"]
        m_real = row["median_Monetary_Rp"]
        k_real = row["median_keragaman_produk"]
        
        # Normalized values (0-100)
        r_norm = (r_real / max_r) * 100
        f_norm = (f_real / max_f) * 100
        m_norm = (m_real / max_m) * 100
        k_norm = (k_real / max_k) * 100
        
        vals_norm = [r_norm, f_norm, m_norm, k_norm]
        vals_text = [
            f"{r_real:,.0f} hari".replace(",", "."),
            f"{f_real:,.0f}x".replace(",", "."),
            _rp_hover(m_real),
            f"{k_real:,.0f} produk".replace(",", "."),
        ]
        
        fig.add_trace(go.Scatterpolar(
            r=vals_norm + [vals_norm[0]],
            theta=cats + [cats[0]],
            name=row["Segmen"],
            line=dict(color=SEG_COLORS[i % len(SEG_COLORS)], width=2),
            fill="toself",
            opacity=0.25,
            customdata=vals_text + [vals_text[0]],
            hovertemplate="<b>%{theta}</b><br>Nilai aktual: %{customdata}<br>Skala relatif: %{r:.1f}%<extra>%{fullData.name}</extra>",
        ))
        
    return _base(fig, title="Profil Median RFM & Keragaman Produk (Skala Relatif)",
                 margin=dict(l=80, r=80, t=65, b=65),
                 polar=dict(
                     radialaxis=dict(visible=True, range=[0, 105], ticksuffix="%",
                                     gridcolor="#E5EEFF", tickfont=dict(size=9)),
                     angularaxis=dict(gridcolor="#E5EEFF", rotation=90, direction="clockwise",
                                      tickfont=dict(size=11, family="Inter, sans-serif")),
                 ))


# --- Tab 2 charts -------------------------------------------------------------
def chart_scatter_rfm(customers, seg_col, log_monetary=False):
    df = customers.copy()
    df["Segmen"] = df[seg_col].astype(str)
    df["Monetary_display"] = df["Monetary"].clip(lower=0.01) if log_monetary else df["Monetary"]
    df["Monetary_hover"] = df["Monetary"].map(_rp_hover)
    cmap = _color_map(df["Segmen"].unique())
    fig = px.scatter(
        df, x="Recency", y="Monetary_display", color="Segmen",
        size="Frequency", size_max=24,
        color_discrete_map=cmap,
        hover_data={"id_samaran": True, "Recency": True, "Frequency": True,
                    "Monetary_hover": True, "keragaman_nama_produk": True,
                    "Monetary_display": False, "Segmen": False},
        log_y=log_monetary,
        labels={"Monetary_display": "Monetary (Rp)", "Recency": "Recency (hari)"},
    )
    fig.update_traces(marker=dict(opacity=0.72, line=dict(width=0.5, color="white")), cliponaxis=False)
    fig.update_xaxes(automargin=True)
    fig.update_yaxes(automargin=True)
    return _base(fig, title="Recency vs Monetary (Ukuran bubble = Frequency)",
                 margin=dict(l=75, r=40, t=60, b=60))


def chart_boxplot(customers, seg_col, metric):
    df = customers.copy()
    df["Segmen"] = df[seg_col].astype(str)
    # Wrap segment labels
    df["Segmen_display"] = df["Segmen"].apply(
        lambda s: "<br>".join(textwrap.wrap(str(s), width=18))
    )
    cmap = _color_map(df["Segmen_display"].unique())
    fig = px.box(df, x="Segmen_display", y=metric, color="Segmen_display",
                 color_discrete_map=cmap, points="outliers",
                 labels={"Segmen_display": "Segmen", metric: metric.replace("_", " ").title()})
    fig.update_traces(marker=dict(opacity=0.45, size=3))
    fig.update_xaxes(automargin=True, tickangle=0)
    fig.update_yaxes(automargin=True)
    return _base(fig, title=f"Distribusi {metric.replace('_', ' ').title()} per Segmen",
                 showlegend=False, margin=dict(l=65, r=30, t=55, b=75))


# --- Tab 3 charts -------------------------------------------------------------
def chart_timeseries(invoices, seg_col, agg, value_col, title):
    df = invoices.copy().dropna(subset=["tanggal_faktur"])
    df["Segmen"] = df[seg_col].astype(str)
    freq = "YS" if agg == "Tahunan" else "QS"
    df["Periode"] = df["tanggal_faktur"].dt.to_period("Y" if agg == "Tahunan" else "Q").dt.start_time
    if value_col == "count":
        grouped = df.groupby(["Periode", "Segmen"]).size().reset_index(name="Jumlah")
        y_col, y_title = "Jumlah", "Jumlah Faktur"
    else:
        grouped = df.groupby(["Periode", "Segmen"])[value_col].sum().reset_index()
        y_col, y_title = value_col, "Total Nilai (Rp)"
    cmap = _color_map(grouped["Segmen"].unique())
    fig = px.line(grouped, x="Periode", y=y_col, color="Segmen",
                  color_discrete_map=cmap, markers=True, labels={y_col: y_title})
    if agg == "Tahunan":
        date_fmt = "%{x|%Y}"
    else:
        date_fmt = "%{x|%Y-Q%q}"
    if value_col == "count":
        fig.update_traces(hovertemplate=f"{date_fmt}<br>Jumlah: %{{y:,.0f}}")
    else:
        fig.update_traces(hovertemplate=f"{date_fmt}<br>Nilai: Rp %{{y:,.0f}}")
    fig.update_xaxes(automargin=True)
    fig.update_yaxes(automargin=True)
    return _base(fig, title=title, margin=dict(l=80, r=40, t=60, b=60))


def chart_rp0_breakdown(invoices, seg_col, agg):
    df = invoices[invoices["grand_total_rp"] == 0].copy().dropna(subset=["tanggal_faktur"])
    if df.empty:
        return None
    df["Segmen"] = df[seg_col].astype(str)
    df["Periode"] = df["tanggal_faktur"].dt.to_period("Y" if agg == "Tahunan" else "Q").astype(str)
    grouped = df.groupby(["Periode", "Segmen"]).size().reset_index(name="Faktur Rp0")
    cmap = _color_map(grouped["Segmen"].unique())
    fig = px.bar(grouped, x="Periode", y="Faktur Rp0", color="Segmen",
                 color_discrete_map=cmap, text_auto=True,
                 labels={"Periode": "Periode", "Faktur Rp0": "Jumlah Faktur Rp 0"})
    fig.update_traces(textposition="inside", textfont_size=10, insidetextanchor="middle")
    fig.update_xaxes(automargin=True, tickangle=-20)
    fig.update_yaxes(automargin=True)
    return _base(fig, title="Faktur Rp 0 per Periode & Segmen", barmode="stack",
                 margin=dict(l=60, r=30, t=60, b=70))


# --- Tab 4 charts -------------------------------------------------------------
def chart_eval_lines(model_eval, metric):
    df = model_eval[model_eval[metric].notna()].copy()
    cmap = _color_map(df["model"].unique())
    fig = px.line(df, x="k", y=metric, color="model", markers=True,
                  color_discrete_map=cmap,
                  labels={"k": "Jumlah Klaster (k)", metric: metric.replace("_", " ").title()})
    best = df[(df["model"] == "K-Means") & (df["k"] == 4)]
    if not best.empty:
        val = best[metric].values[0]
        # Position marker text safely so it is never cut off
        is_top = val >= df[metric].max() * 0.95
        fig.add_trace(go.Scatter(
            x=[4], y=[val], mode="markers+text",
            marker=dict(size=14, color="#D2231C", symbol="star"),
            text=["K-Means k=4"],
            textposition="bottom right" if is_top else "top center",
            textfont=dict(size=11, color="#D2231C", family="Inter, sans-serif"),
            showlegend=False, hoverinfo="skip", cliponaxis=False,
        ))
    fig.update_xaxes(automargin=True, dtick=1)
    fig.update_yaxes(automargin=True)
    return _base(fig, title=f"{metric.replace('_',' ').title()} per k",
                 margin=dict(l=60, r=40, t=60, b=55))


def chart_sankey(comparison, left_label, right_label):
    df = comparison[comparison["jumlah_anggota_bersama"] > 0].copy()
    left_nodes = sorted(df["left_cluster_code"].unique())
    right_nodes = sorted(df["right_cluster_code"].unique())
    all_nodes = left_nodes + right_nodes
    node_idx = {n: i for i, n in enumerate(all_nodes)}
    colors_link = []
    src, tgt, val, cust = [], [], [], []
    for _, row in df.iterrows():
        s = node_idx[row["left_cluster_code"]]
        t = node_idx[row["right_cluster_code"]]
        src.append(s); tgt.append(t); val.append(row["jumlah_anggota_bersama"])
        cust.append(f"{row['jumlah_anggota_bersama']:,} ({row['persentase_terhadap_baris']:.1f}%)")
        colors_link.append(SEG_COLORS[s % len(SEG_COLORS)])
    node_colors = [SEG_COLORS[i % len(SEG_COLORS)] for i in range(len(all_nodes))]
    fig = go.Figure(go.Sankey(
        arrangement="snap",
        node=dict(label=all_nodes, color=node_colors, pad=20, thickness=22,
                  line=dict(color="white", width=1)),
        link=dict(source=src, target=tgt, value=val, color=[c + "66" for c in colors_link],
                  customdata=cust, hovertemplate="%{source.label} -> %{target.label}<br>%{customdata}<extra></extra>"),
    ))
    return _base(fig, title=f"Perpindahan Anggota: {left_label} -> {right_label}",
                 height=450, margin=dict(l=60, r=60, t=65, b=45))


def chart_gmm_hist(gmm_prob, col, title):
    fig = px.histogram(gmm_prob, x=col, nbins=50,
                       color_discrete_sequence=["#2563EB"],
                       labels={col: title})
    fig.update_traces(marker_line_color="white", marker_line_width=0.5)
    fig.update_xaxes(automargin=True)
    fig.update_yaxes(automargin=True)
    return _base(fig, title=title, margin=dict(l=60, r=30, t=55, b=55))


# --- Tab 5 charts -------------------------------------------------------------
def chart_funnel(stages, title):
    """Funnel chart with ample left margin for stage descriptions."""
    fig = go.Figure(go.Funnel(
        y=[s[0] for s in stages], x=[s[1] for s in stages],
        textinfo="value+percent initial",
        textposition="inside",
        textfont=dict(size=11, color="white"),
        marker=dict(color=SEG_COLORS[:len(stages)]),
        connector=dict(line=dict(color="#E5EEFF")),
    ))
    fig.update_yaxes(automargin=True, tickfont=dict(size=11))
    fig.update_xaxes(automargin=True)
    # Generous left margin ensures stage names (up to 30 chars) are never cut off
    return _base(fig, title=title, margin=dict(l=220, r=40, t=60, b=45))


def chart_audit_bars(data, title):
    """Horizontal audit bar with ample left margin and right headroom."""
    df = pd.DataFrame(data, columns=["Penyebab", "Jumlah"])
    df = df.sort_values("Jumlah")
    max_val = df["Jumlah"].max() if not df.empty else 100
    fig = px.bar(df, y="Penyebab", x="Jumlah", orientation="h",
                 text="Jumlah", color_discrete_sequence=["#D2231C"])
    fig.update_traces(textposition="outside", textfont_size=10, cliponaxis=False)
    # Headroom on x-axis ensures the outside number label is never cut off on the right
    fig.update_xaxes(range=[0, max_val * 1.2], automargin=True)
    fig.update_yaxes(automargin=True, tickfont=dict(size=11))
    calc_height = max(260, len(df) * 38 + 90)
    # Generous left margin (250px) ensures cause labels (up to 35 chars) are never cut off
    return _base(fig, title=title, height=calc_height, margin=dict(l=250, r=60, t=60, b=45))
