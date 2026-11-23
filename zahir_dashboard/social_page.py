"""Three social analytics tabs, using only the authenticated Supabase session."""
import altair as alt
import pandas as pd
import streamlit as st

from zahir_dashboard.backend import DashboardError
from zahir_dashboard.social_backend import (
    ASPECTS, LABELS, PREDICTIONS, SocialRepository, aspect_sentiments, confusion_matrix,
    filter_rows, snapshot_checks, top_posts,
)


def number(value):
    return f'{int(value):,}'.replace(',', '.')


def filters(frame, date_col, category, label, key):
    a, b = st.columns(2)
    dates = a.date_input('Periode', value=(frame[date_col].min(), frame[date_col].max()),
                         key=key + '_dates', format='DD/MM/YYYY')
    choices = sorted(frame[category].unique())
    selected = b.multiselect(label, choices, default=choices, key=key + '_categories')
    if not isinstance(dates, (tuple, list)) or len(dates) != 2:
        st.info('Pilih tanggal awal dan akhir untuk menampilkan data.')
        return frame.iloc[0:0]
    result = filter_rows(frame, date_col, dates, category, selected)
    if result.empty:
        st.info('Tidak ada data yang cocok dengan filter. Ubah periode atau pilihan kategori.')
    return result


def heatmap(frame, x, y, value, x_order=None, y_order=None):
    chart = alt.Chart(frame).mark_rect().encode(
        x=alt.X(x + ':O', sort=x_order), y=alt.Y(y + ':O', sort=y_order),
        color=alt.Color(value + ':Q', scale=alt.Scale(scheme='blues')),
        tooltip=list(frame.columns),
    )
    st.altair_chart(chart, width='stretch')


def render_google(reviews):
    st.subheader('Ulasan Google Play')
    frame = filters(reviews, 'review_date', 'app_name', 'Aplikasi', 'social_gp')
    if frame.empty:
        return
    a,b,c,d = st.columns(4)
    a.metric('Jumlah ulasan', number(len(frame)))
    b.metric('Rata-rata rating', f'{frame.score.mean():.2f} / 5')
    c.metric('Sentimen positif', f'{frame.human_sentiment_label.eq("positive").mean():.1%}')
    d.metric('Pasangan ulasan–aspek', number(frame[list(ASPECTS)].sum().sum()))
    st.caption('Mengikuti filter. Sentimen berasal dari anotasi manusia, terpisah dari rating bintang. '
               f'{number(frame[list(ASPECTS)].any(axis=1).sum())} ulasan menyebut setidaknya satu aspek. '
               f'Ulasan dibalas developer: {frame.has_developer_reply.mean():.1%}.')
    left,right = st.columns(2)
    with left:
        st.subheader('Distribusi rating')
        rating = frame.score.value_counts().reindex(range(1,6), fill_value=0).rename_axis('Bintang').reset_index(name='Ulasan')
        st.bar_chart(rating, x='Bintang', y='Ulasan')
    with right:
        st.subheader('Distribusi sentimen manusia')
        sentiment = frame.human_sentiment_label.value_counts().reindex(LABELS, fill_value=0).rename_axis('Sentimen').reset_index(name='Ulasan')
        sentiment['Sentimen'] = sentiment['Sentimen'].map({
            'negative': 'Negatif', 'neutral': 'Netral', 'positive': 'Positif',
        })
        chart = alt.Chart(sentiment).mark_bar(cornerRadiusTopLeft=3, cornerRadiusTopRight=3).encode(
            x=alt.X('Sentimen:N', sort=['Negatif', 'Netral', 'Positif']),
            y=alt.Y('Ulasan:Q', axis=alt.Axis(tickMinStep=1)),
            color=alt.Color('Sentimen:N', scale=alt.Scale(
                domain=['Negatif', 'Netral', 'Positif'], range=['#D86373', '#7D888D', '#2C7A7B'],
            ), legend=None),
            tooltip=['Sentimen', 'Ulasan'],
        )
        st.altair_chart(chart, width='stretch')
    st.subheader('Tren sentimen dan volume ulasan')
    monthly = frame.assign(Bulan=pd.to_datetime(frame.review_date).dt.to_period('M').astype(str))
    trend = monthly.groupby(['Bulan', 'human_sentiment_label']).size().unstack(fill_value=0).reindex(columns=LABELS, fill_value=0)
    st.line_chart(trend.rename(columns={'negative': 'Negatif', 'neutral': 'Netral', 'positive': 'Positif'}))
    st.caption('Jumlah ulasan per sentimen menurut bulan tanggal ulasan. Bulan tanpa pengamatan tidak ditambahkan sebagai data baru.')
    st.subheader('Frekuensi aspek')
    aspects = pd.DataFrame({'Aspek': list(ASPECTS.values()), 'Jumlah ulasan': frame[list(ASPECTS)].sum().to_numpy()})
    st.bar_chart(aspects, x='Aspek', y='Jumlah ulasan', horizontal=True)
    st.subheader('Sentimen ulasan yang menyebut aspek')
    chart = alt.Chart(aspect_sentiments(frame)).mark_bar().encode(
        x=alt.X('Jumlah:Q', stack='zero'), y='Aspek:N', color='Sentimen ulasan:N',
        tooltip=['Aspek', 'Sentimen ulasan', 'Jumlah'])
    st.altair_chart(chart, width='stretch')
    st.caption('Satu ulasan dapat menyebut beberapa aspek. Warna menunjukkan sentimen seluruh ulasan, bukan sentimen tiap aspek.')


def render_instagram(posts):
    st.subheader('Engagement dan performa postingan')
    frame = filters(posts, 'post_date', 'content_type', 'Format konten', 'social_ig')
    if frame.empty:
        return
    a,b,c,d = st.columns(4)
    a.metric('Jumlah postingan', number(len(frame)))
    b.metric('Likes', number(frame.likes.sum()))
    c.metric('Komentar', number(frame.comments.sum()))
    d.metric('Total interaksi', number(frame.total_interactions.sum()))
    st.caption('Mengikuti filter. Total interaksi = likes + komentar. Metrik merupakan snapshot, '
               'bukan pertambahan interaksi harian. Data pembagi audiens tidak tersedia untuk engagement rate.')
    for key, title in [('content_type', 'Perbandingan format'), ('is_collaboration', 'Perbandingan kolaborasi')]:
        st.subheader(title)
        comparison = frame.groupby(key).agg(Postingan=('post_id','size'),
            Rata_rata=('total_interactions','mean'), Median=('total_interactions','median'),
            Total_interaksi=('total_interactions','sum')).reset_index()
        if key == 'is_collaboration':
            comparison[key] = comparison[key].map({True: 'Kolaborasi', False: 'Nonkolaborasi'})
        comparison = comparison.rename(columns={
            key: 'Kelompok', 'Rata_rata': 'Rata-rata', 'Total_interaksi': 'Total interaksi',
        })
        st.bar_chart(comparison, x='Kelompok', y=['Rata-rata', 'Median'], stack=False)
        st.dataframe(comparison, hide_index=True, width='stretch',
                     column_config={'Rata-rata': st.column_config.NumberColumn(format='%.1f')})
    st.subheader('Hari dan jam posting WIB')
    days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
    time = frame.groupby(['post_day_of_week','post_hour_wib']).agg(
        Postingan=('post_id','size'), Rata_rata_interaksi=('total_interactions','mean')).reset_index()
    heatmap(time, 'post_hour_wib', 'post_day_of_week', 'Rata_rata_interaksi', list(range(24)), days)
    st.caption('Tooltip memuat ukuran sampel. Sel tanpa postingan tidak diisi nol. Perbandingan bersifat observasional.')
    st.subheader('Caption dan hashtag terhadap interaksi')
    left,right = st.columns(2)
    with left:
        st.scatter_chart(frame, x='caption_word_count', y='total_interactions')
    with right:
        st.scatter_chart(frame, x='hashtag_count', y='total_interactions')
    st.caption('Sumbu horizontal: jumlah kata caption / jumlah hashtag. Hubungan tidak menunjukkan sebab-akibat.')
    st.subheader('Top Postingan')
    ranked = top_posts(frame)[['Peringkat', 'post_id', 'post_date', 'content_type', 'likes', 'comments',
                               'total_interactions', 'interaction_tier', 'percentile_rank', 'is_interaction_outlier']]
    st.dataframe(ranked.rename(columns={
        'post_id': 'ID postingan', 'post_date': 'Tanggal', 'content_type': 'Format',
        'likes': 'Likes', 'comments': 'Komentar', 'total_interactions': 'Total interaksi',
        'interaction_tier': 'Tingkat interaksi', 'percentile_rank': 'Persentil',
        'is_interaction_outlier': 'Outlier',
    }), hide_index=True, width='stretch')
    st.caption('Peringkat dihitung ulang setelah filter, dengan post_id sebagai pemecah seri. '
               'Tier, persentil, dan penanda outlier tetap dihitung dari sampel lengkap 55 postingan.')


def render_evaluation(data):
    st.subheader('Evaluasi model sentimen')
    st.caption('Snapshot benchmark: 84 ulasan uji held-out, terpisah dari 333 ulasan development. '
               'Empat model dibandingkan pada data uji yang sama. Angka benchmark tidak mengikuti filter tab lain.')
    bench = data['benchmarks']
    st.bar_chart(bench, x='model_name', y=['accuracy','macro_f1'], stack=False)
    st.dataframe(bench.rename(columns={'accuracy':'Akurasi','macro_f1':'Macro-F1'}), hide_index=True, width='stretch')
    model = st.selectbox('Model confusion matrix', list(PREDICTIONS), key='social_cm_model')
    matrix, available, total = confusion_matrix(data['predictions'], data['reviews'], PREDICTIONS[model])
    st.subheader('Confusion matrix — data uji')
    st.caption(f'Prediksi tersedia: {available}/{total}. Prediksi kosong tetap dihitung dalam cakupan, '
               'tetapi tidak dimasukkan ke sel matriks. Majority baseline tidak memiliki prediksi pada tabel impor ini.')
    cells = matrix.rename_axis('Label manusia').reset_index().melt(id_vars='Label manusia', var_name='Prediksi', value_name='Jumlah')
    heatmap(cells, 'Prediksi', 'Label manusia', 'Jumlah', LABELS, LABELS)
    st.dataframe(matrix, width='stretch')
    st.subheader('Topik Eksploratif — K-Means k=4')
    st.caption('185 penugasan ulasan negatif/netral pada snapshot penuh. Keanggotaan dan kata kunci tidak dilatih ulang. '
               'Silhouette rendah; klaster belum merupakan kategori topik yang tervalidasi.')
    assigned = data['assignments'].merge(data['reviews'][['review_id','app_name','human_sentiment_label']],
        on='review_id', validate='one_to_one')
    sizes = assigned.groupby('kmeans_cluster_k4').size().reindex(data['clusters'].kmeans_cluster_k4, fill_value=0).reset_index(name='Ulasan')
    st.bar_chart(sizes, x='kmeans_cluster_k4', y='Ulasan')
    st.dataframe(data['clusters'].merge(sizes, on='kmeans_cluster_k4', validate='one_to_one'), hide_index=True, width='stretch')
    for col,title in [('app_name','Komposisi aplikasi'), ('human_sentiment_label','Komposisi sentimen ulasan')]:
        st.subheader(title)
        grouped = assigned.groupby(['kmeans_cluster_k4',col]).size().reset_index(name='Ulasan')
        st.altair_chart(alt.Chart(grouped).mark_bar().encode(
            x='kmeans_cluster_k4:O', y='Ulasan:Q', color=col+':N', tooltip=list(grouped.columns)), width='stretch')
    st.subheader('Diagnostik silhouette k=3–6')
    diag = data['diagnostics'].sort_values('num_clusters_k')
    st.line_chart(diag, x='num_clusters_k', y='silhouette_score')
    st.dataframe(diag, hide_index=True, width='stretch')
    st.subheader('Metodologi & Kualitas Data — snapshot penuh')
    st.caption('Audit historis korpus 417 ulasan, tidak mengikuti filter. Nilai ditampilkan bersama unit/catatannya. '
               'Scope analisis saling tumpang tindih; jumlahnya tidak boleh dijumlahkan sebagai populasi baru.')
    st.dataframe(data['quality'], hide_index=True, width='stretch')
    st.subheader('Kesiapan analisis topik')
    st.dataframe(data['readiness'], hide_index=True, width='stretch')
    st.subheader('Perbandingan cakupan analisis')
    st.dataframe(data['scope'], hide_index=True, width='stretch')


def render_social(client):
    st.header('Analisis Media Sosial')
    try:
        with st.spinner('Memverifikasi izin dan membaca data media sosial…'):
            data = SocialRepository(client).load()
    except DashboardError as exc:
        st.error(str(exc))
        return
    checks = snapshot_checks(data)
    with st.expander('Validasi snapshot tanpa filter'):
        st.dataframe(checks, hide_index=True, width='stretch')
    if not checks.Sesuai.all():
        st.warning('Cakupan data terbaca berbeda dari snapshot acuan. Periksa isi tabel dan izin baris.')
    gp,ig,evaluation = st.tabs(['Google Play', 'Instagram', 'Evaluasi & Eksplorasi'])
    with gp:
        render_google(data['reviews'])
    with ig:
        render_instagram(data['posts'])
    with evaluation:
        render_evaluation(data)
