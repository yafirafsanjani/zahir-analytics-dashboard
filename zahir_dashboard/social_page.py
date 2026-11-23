"""Three social analytics tabs, using only the authenticated Supabase session."""
import altair as alt
import pandas as pd
import streamlit as st

from zahir_dashboard.backend import DashboardError
from zahir_dashboard.ui import activate, data_card, page_header, panel, progress_list, reset_widgets, SENTIMENT_COLORS
from zahir_dashboard.social_backend import (
    ASPECTS, LABELS, PREDICTIONS, SocialRepository, aspect_sentiments, confusion_matrix,
    filter_rows, snapshot_checks, top_posts,
)


def number(value):
    return f'{int(value):,}'.replace(',', '.')


def filters(frame, date_col, category, label, key):
    with panel():
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


def render_google(reviews, posts):
    with st.container(key='playstore-filters'), panel():
        dates_col,apps_col,rating_col,sentiment_col,reset_col=st.columns([1.5,1.4,1,1,.8])
        with dates_col.popover('Periode',icon=':material/calendar_today:',width='stretch'):
            dates=st.date_input('Periode ulasan',value=(reviews.review_date.min(),reviews.review_date.max()),
                               key='social_gp_dates',format='DD/MM/YYYY')
        apps=sorted(reviews.app_name.unique())
        with apps_col.popover('Aplikasi',icon=':material/apps:',width='stretch'):
            selected=st.multiselect('Aplikasi',apps,default=apps,key='social_gp_categories')
        with rating_col.popover('Rating',icon=':material/star:',width='stretch'):
            ratings=st.multiselect('Rating',[1,2,3,4,5],default=[1,2,3,4,5],key='social_gp_rating')
        with sentiment_col.popover('Sentimen',icon=':material/mood:',width='stretch'):
            sentiments=st.multiselect('Sentimen',LABELS,default=LABELS,key='social_gp_sentiment',
                                format_func=lambda x:{'positive':'Positif','neutral':'Netral','negative':'Negatif'}[x])
        reset_col.button('Reset Filter',key='social_gp_reset',on_click=reset_widgets,
                 args=(['social_gp_dates','social_gp_categories','social_gp_rating','social_gp_sentiment'],))
    if not isinstance(dates,(tuple,list)) or len(dates)!=2:
        st.info('Pilih tanggal awal dan akhir untuk menampilkan data.')
        return
    frame=filter_rows(reviews,'review_date',dates,'app_name',selected)
    st.caption(f'Periode: {dates[0]:%d %b %Y} – {dates[1]:%d %b %Y} · {len(selected)} aplikasi · '
               f'{len(ratings)} pilihan rating · {len(sentiments)} sentimen. Geser baris filter pada layar sempit.')
    frame=frame[frame.score.isin(ratings) & frame.human_sentiment_label.isin(sentiments)]
    if frame.empty:
        st.info('Tidak ada data yang cocok dengan filter rating dan sentimen.')
        return
    with st.container(key='social-kpis'):
        a,b,c=st.columns(3)
        a.metric('Jumlah Ulasan',number(len(frame)))
        b.metric('Rating Rata-rata',f'{frame.score.mean():.2f} / 5')
        counts=frame.human_sentiment_label.value_counts()
        dominant=counts.index[0]
        c.metric('Sentimen Dominan',{'positive':'Positif','neutral':'Netral','negative':'Negatif'}[dominant]+f' ({counts.iloc[0]/len(frame):.1%})')
    st.caption('Mengikuti filter. Sentimen berasal dari anotasi manusia, terpisah dari rating bintang. '
               f'{number(frame[list(ASPECTS)].any(axis=1).sum())} ulasan menyebut setidaknya satu aspek. '
               f'Ulasan dibalas developer: {frame.has_developer_reply.mean():.1%}.')
    st.caption(f"{number(frame[list(ASPECTS)].sum().sum())} pasangan ulasan–aspek dalam cakupan filter.")
    with panel('Tren Ulasan','Distribusi volume ulasan berdasarkan sentimen.'):
        frequency=st.selectbox('Interval tren',['Bulanan','Harian'],key='social_trend_interval')
        dates=pd.to_datetime(frame.review_date)
        series=frame.assign(Periode=dates.dt.to_period('M').dt.start_time if frequency=='Bulanan' else dates)
        trend=series.groupby(['Periode','human_sentiment_label']).size().reset_index(name='Ulasan')
        trend['Sentimen']=trend.human_sentiment_label.map({'positive':'Positif','neutral':'Netral','negative':'Negatif'})
        color=alt.Color('Sentimen:N',scale=alt.Scale(domain=['Positif','Netral','Negatif'],range=SENTIMENT_COLORS))
        line=alt.Chart(trend).mark_line(point=True).encode(x='Periode:T',y=alt.Y('Ulasan:Q',title='Jumlah ulasan'),
                color=color,tooltip=[alt.Tooltip('Periode:T',format='%d %b %Y'),'Sentimen','Ulasan'])
        st.altair_chart(line.properties(height=240),width='stretch')
    left, right = st.columns(2)
    with left, panel('Aspek Sering Disebut','Frekuensi aspek dalam ulasan yang sesuai filter.'):
        aspects = pd.DataFrame({'Aspek': list(ASPECTS.values()), 'Jumlah ulasan': frame[list(ASPECTS)].sum().to_numpy()})
        aspects=aspects.sort_values('Jumlah ulasan',ascending=False)
        progress_list(list(aspects.itertuples(index=False,name=None)),len(frame),'ulasan')
    with right, panel('Sentimen per Aspek','Sentimen ulasan yang menyebut aspek, bukan sentimen tiap aspek.'):
        aspect_frame=aspect_sentiments(frame)
        aspect_frame['Urutan']=aspect_frame['Sentimen ulasan'].map({'positive':0,'neutral':1,'negative':2})
        aspect_frame['Sentimen ulasan']=aspect_frame['Sentimen ulasan'].map({'positive':'Positif','neutral':'Netral','negative':'Negatif'})
        chart = alt.Chart(aspect_frame).mark_bar().encode(
            x=alt.X('Jumlah:Q', stack='normalize',axis=alt.Axis(format='%'),title='Proporsi ulasan'), y='Aspek:N', color=alt.Color('Sentimen ulasan:N',
                scale=alt.Scale(domain=['Positif','Netral','Negatif'], range=SENTIMENT_COLORS)),order='Urutan:Q',
            tooltip=['Aspek', 'Sentimen ulasan', 'Jumlah'])
        st.altair_chart(chart, width='stretch')
        st.caption('Satu ulasan dapat menyebut beberapa aspek. Warna menunjukkan sentimen seluruh ulasan, bukan sentimen tiap aspek.')
    with st.expander('Distribusi rating dan sentimen'):
        a,b=st.columns(2)
        a.bar_chart(frame.score.value_counts().rename_axis('Rating').reset_index(name='Ulasan'),x='Rating',y='Ulasan')
        b.bar_chart(frame.human_sentiment_label.value_counts().rename_axis('Sentimen').reset_index(name='Ulasan'),x='Sentimen',y='Ulasan')
    with panel('Ulasan Terkini','3 terbaru · Sesuai filter aktif.'):
        st.button('Lihat Semua',key='social_all_reviews',on_click=activate,args=('social_reviews_all',True))
        recent=frame.sort_values(['review_date','review_id'],ascending=[False,True]).head(3)
        for _,row in recent.iterrows():
            aspects=[label for col,label in ASPECTS.items() if row[col]]
            data_card(f"{row.review_date:%d %b %Y} · {'★'*int(row.score)}",row.app_name,
                [{'positive':'Positif','neutral':'Netral','negative':'Negatif'}[row.human_sentiment_label],*aspects],
                'Versi aplikasi dan teks ulasan belum tersedia pada tabel dashboard.')
        if st.session_state.get('social_reviews_all'):
            st.dataframe(frame.rename(columns={'review_date':'Tanggal','app_name':'Aplikasi','score':'Rating',
                'human_sentiment_label':'Sentimen'}).drop(columns=['review_id']),hide_index=True,width='stretch')
            st.download_button('Ekspor ulasan terfilter',frame.to_csv(index=False).encode('utf-8-sig'),
                               'ulasan_terfilter.csv','text/csv')
            st.button('Tutup daftar',on_click=activate,args=('social_reviews_all',False))
    with panel('Ringkasan Instagram','Seluruh postingan yang dapat dibaca pada sumber Instagram.'):
        st.button('Buka Tab',on_click=activate,args=('social_tab','Instagram'),icon=':material/arrow_forward:')
        a,b,c=st.columns(3)
        a.metric('Postingan',number(len(posts)))
        b.metric('Interaksi',number(posts.total_interactions.sum()))
        c.metric('Rata-rata/Post',f'{posts.total_interactions.mean():.1f}')


def render_instagram(posts):
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
    for column, key, title in zip(st.columns(2), ['content_type', 'is_collaboration'],
                                  ['Perbandingan Format', 'Perbandingan Kolaborasi']):
      with column, panel(title):
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
    page_header('Analisis Media Sosial',
                'Pantau ulasan pengguna dan performa konten untuk memahami suara pelanggan.',
                'Analisis Media Sosial')
    try:
        with st.spinner('Memverifikasi izin dan membaca data media sosial…'):
            data = SocialRepository(client).load()
    except DashboardError as exc:
        st.error(str(exc))
        return
    checks = snapshot_checks(data)
    st.caption(f"Data terhubung · {number(len(data['reviews']))} ulasan Play Store · {number(len(data['posts']))} postingan Instagram")
    if not checks.Sesuai.all():
        st.warning('Cakupan data terbaca berbeda dari snapshot acuan. Periksa isi tabel dan izin baris.')
    gp,ig,evaluation = st.tabs(['Play Store', 'Instagram', 'Evaluasi & Eksplorasi'],key='social_tab',on_change='rerun')
    with gp:
        render_google(data['reviews'],data['posts'])
    with ig:
        render_instagram(data['posts'])
    with evaluation:
        render_evaluation(data)
    with st.expander('Validasi snapshot tanpa filter'):
        st.dataframe(checks, hide_index=True, width='stretch')
