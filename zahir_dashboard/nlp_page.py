"""Authenticated analytics for historical NLP data and uploaded WhatsApp ZIPs."""
import altair as alt
import pandas as pd
import streamlit as st

from zahir_dashboard.backend import DashboardError
from zahir_dashboard.nlp_backend import NLPError, process_zip
from zahir_dashboard.nlp_data import FREQUENCIES, count_by, load_history, trend
from zahir_dashboard.ui import activate, data_card, page_header, panel, progress_list, reset_widgets

NLP_TABS=['Ringkasan','Detail Percakapan','Analisis Kendala','Analisis Remote',
          'Analisis Pelanggan','Tren Waktu','Tambah Data']


def review_upload():
    st.session_state['nlp_source']='Unggahan ZIP'
    st.session_state['nlp_tabs']='Detail Percakapan'


def new_upload():
    st.session_state['nlp_upload_status']='ready'
    st.session_state['nlp_file_generation']=st.session_state.get('nlp_file_generation',0)+1
    st.session_state['nlp_tabs']='Tambah Data'
    st.session_state['nlp_source']='Unggahan ZIP'


def category_name(value):
    if value == 'UNKNOWN_UNCLASSIFIED':
        return 'Belum terklasifikasi'
    return value.replace('_', ' ').title()


def bar_chart(frame, label, value):
    chart = alt.Chart(frame).mark_bar(color='#D2231C', cornerRadiusEnd=4).encode(
        x=alt.X(value, axis=alt.Axis(tickMinStep=1)),
        y=alt.Y(label, sort='-x', axis=alt.Axis(labelLimit=330)),
        tooltip=[label, value],
    )
    st.altair_chart(chart.properties(height=alt.Step(27)), width='stretch')


def render_upload():
    with st.form('nlp_upload'):
        st.subheader('Tambah Data Chat Baru')
        st.caption('Unggah ZIP ekspor WhatsApp untuk mengelompokkan kendala dan menganalisis penanganan. '
                   'Hasil analisis hanya tersedia pada sesi pengguna Anda.')
        st.caption('Pilih atau tarik file ZIP WhatsApp. File diproses langsung di Streamlit.')
        uploaded = st.file_uploader('ZIP ekspor WhatsApp', type=['zip'],
            key=f"nlp_file_{st.session_state.get('nlp_file_generation',0)}")
        submitted = st.form_submit_button('Proses', type='primary')
    status=st.session_state.get('nlp_upload_status','ready')
    if status=='success' and st.session_state.get('nlp_result'):
        result=st.session_state['nlp_result']
        st.success(f"Analisis selesai. {result['overview']['total_issues']} kendala dan {result['overview']['total_conversations']} percakapan berhasil diproses.")
        a,b=st.columns(2)
        a.button('Unggah File Lain',on_click=new_upload)
        b.button('Tinjau Data',on_click=review_upload,type='primary')
    elif status=='error':
        st.error(st.session_state.get('nlp_upload_error','Analisis gagal. Periksa file dan coba kembali.'))
    else:
        st.caption('Status: Siap · Hasil tetap terisolasi per sesi pengguna.')
    if not submitted:
        return
    if uploaded is None:
        st.error('Pilih file ZIP ekspor WhatsApp terlebih dahulu.')
        return
    try:
        with st.spinner('Memproses percakapan WhatsApp…'):
            result = process_zip(uploaded.name, uploaded.getvalue(),
                                 model_config=st.secrets.get('nlp_models', {}),
                                 role_map=st.secrets.get('nlp_roles'))
        st.session_state['nlp_result'] = result
        st.session_state['nlp_view_revision'] = st.session_state.get('nlp_view_revision', 0) + 1
        st.session_state['nlp_upload_status']='success'
        st.rerun()
    except NLPError as exc:
        st.session_state['nlp_upload_status']='error'
        st.session_state['nlp_upload_error']=str(exc)
        st.error(str(exc))
        if 'nlp_result' in st.session_state:
            st.info('Hasil terakhir yang berhasil tetap ditampilkan.')


def historical_data(authorize):
    config = st.secrets.get('nlp_history')
    if not config:
        st.info('Data historis belum disambungkan oleh administrator.')
        return None
    try:
        authorize()
        identity = (str(config.get('asset_id')), str(config.get('sha256')))
        cached = st.session_state.get('nlp_history_records')
        if cached is None or cached[0] != identity:
            with st.spinner('Membaca data historis…'):
                cached = (identity, load_history(config, st.secrets.get('nlp_models', {})))
                st.session_state['nlp_history_records'] = cached
        return cached[1]
    except (DashboardError, ValueError) as exc:
        st.session_state.pop('nlp_history_records', None)
        st.error(str(exc))
        return None


def filter_records(frame, key):
    category_options=sorted(frame['Kategori'].unique())
    with panel():
        with st.container(key='nlp-filter-heading'):
            title,reset=st.columns([2,1])
            title.markdown('**Filter Cepat NLP**')
            reset.button('Reset Filter',key=key+'_reset',on_click=reset_widgets,type='tertiary',
                          args=([key+'_dates',key+'_category',key+'_handling'],))
        with st.container(key='nlp-filter-controls'):
            dates, categories, handling = st.columns([1.3, 1.3, 1])
    dated = frame['Mulai'].dropna()
    if not dated.empty:
        first, last = dated.min().date(), dated.max().date()
        selected = dates.date_input('Periode mulai', value=(first, last), min_value=first,
                                    max_value=last, format='DD/MM/YYYY', key=key + '_dates')
        if len(selected) != 2:
            st.info('Pilih tanggal awal dan akhir.')
            return frame.iloc[:0]
        if selected != (first, last):
            timestamps = frame['Mulai'].dt.normalize()
            frame = frame[timestamps.between(pd.Timestamp(selected[0]), pd.Timestamp(selected[1]))]
    options = categories.multiselect('Kategori', category_options,
                                     format_func=category_name, key=key + '_category')
    statuses = handling.multiselect('Penanganan', ['Remote', 'Non-remote', 'Belum diketahui'],
                                    key=key + '_handling')
    if options:
        frame = frame[frame['Kategori'].isin(options)]
    if statuses:
        frame = frame[frame['Penanganan'].isin(statuses)]
    return frame


def metrics(total, conversations, remote, non_remote, unknown):
    a, b, c, d = st.columns(4)
    a.metric('Total kendala', total)
    b.metric('Total percakapan', conversations)
    c.metric('Kasus remote', remote)
    known = remote + non_remote
    d.metric('Persentase remote', f'{remote / known:.1%}' if known else '—',
             help='Kasus remote dibagi jumlah kendala yang status penanganannya diketahui.')
    st.caption(f'Non-remote: {non_remote} · Penanganan belum diketahui: {unknown}')


def render_overview(frame):
    total = len(frame)
    a, b = st.columns([1.35, 1])
    with a, panel('Kategori Kendala Terbanyak','Berdasarkan klasifikasi NLP pada data aktif.'):
        categories = count_by(frame, 'Kategori')
        categories['Kategori'] = categories['Kategori'].map(category_name)
        progress_list(list(categories.head(12).itertuples(index=False,name=None)),total,'kasus')
        categories['Persentase (%)'] = (categories['Jumlah kendala'] / total * 100).round(1)
        st.dataframe(categories, hide_index=True, width='stretch')
    with b:
        with panel('Respons Klien'):
            responses = count_by(frame, 'Respons klien')
            donut = alt.Chart(responses).mark_arc(innerRadius=62, outerRadius=92).encode(
                theta='Jumlah kendala:Q', color=alt.Color('Respons klien:N',
                    scale=alt.Scale(domain=['Merespons','Tidak merespons','Belum diketahui'],
                                    range=['#D2231C','#545F73','#BCC7DE'])),
                tooltip=['Respons klien','Jumlah kendala'])
            st.altair_chart(donut.properties(height=240), width='stretch')
            st.caption('Respons klien, bukan ukuran kepuasan. Unit perhitungan adalah satu subpercakapan.')
    with panel('Remote vs Non-Remote','Metode penanganan per kategori kendala.'):
        remote_chart(frame)


def remote_chart(frame):
    grouped=frame.groupby(['Kategori','Penanganan']).size().reset_index(name='Kendala')
    grouped['Kategori']=grouped['Kategori'].map(category_name)
    chart=alt.Chart(grouped).mark_bar().encode(x=alt.X('Kendala:Q',stack='normalize',axis=alt.Axis(format='%'),title='Proporsi kendala'),
        y='Kategori:N',color=alt.Color('Penanganan:N',scale=alt.Scale(domain=['Remote','Non-remote','Belum diketahui'],
            range=['#D2231C','#BCC7DE','#E0E3E5'])),tooltip=['Kategori','Penanganan','Kendala'])
    st.altair_chart(chart.properties(height=alt.Step(32)),width='stretch')
    st.caption('Status belum diketahui ditampilkan terpisah. Remote tidak mengidentifikasi aplikasi remote tertentu.')


def recent_conversations(frame):
    with panel('Detail Percakapan Terkini'):
        st.button('Lihat Semua',key='nlp_all_conversations',on_click=activate,args=('nlp_tabs','Detail Percakapan'))
        recent=frame.sort_values('Mulai',ascending=False,na_position='last').head(3)
        for _,row in recent.iterrows():
            duration='Durasi belum tersedia'
            if pd.notna(row['Mulai']) and pd.notna(row['Selesai']) and row['Selesai']>=row['Mulai']:
                duration=f"Durasi: {(row['Selesai']-row['Mulai']).total_seconds()/60:.0f} menit"
            timestamp=row['Mulai'].strftime('%d %b %Y %H:%M') if pd.notna(row['Mulai']) else 'Tanggal belum tersedia'
            data_card(f"{row['Percakapan']} · {timestamp}",f"{row['Pelanggan']} · {category_name(row['Kategori'])}",
                      [row['Penanganan'],f"Respons: {row['Respons klien']}"],duration)


def render_handling(frame):
    st.subheader('Penanganan per kategori')
    data = (frame.groupby(['Kategori', 'Penanganan']).size()
            .unstack(fill_value=0).reindex(columns=['Remote', 'Non-remote', 'Belum diketahui'], fill_value=0))
    data['Total'] = data.sum(axis=1)
    known = (data['Remote'] + data['Non-remote']).replace(0, float('nan'))
    data['Remote (%)'] = (data['Remote'] / known * 100).round(1)
    data = data.reset_index().sort_values(['Total', 'Kategori'], ascending=[False, True])
    data['Kategori'] = data['Kategori'].map(category_name)
    st.dataframe(data, hide_index=True, width='stretch')


def render_customers(frame):
    st.subheader('Kendala per pelanggan')
    data = count_by(frame, 'Pelanggan')
    bar_chart(data.head(12), 'Pelanggan', 'Jumlah kendala')
    counts = pd.crosstab(frame['Pelanggan'], frame['Penanganan']).reindex(
        columns=['Remote', 'Non-remote', 'Belum diketahui'], fill_value=0)
    st.dataframe(data.join(counts, on='Pelanggan'), hide_index=True, width='stretch')
    st.caption('Kode pelanggan berlaku dalam sumber data yang dipilih.')


def render_trend(frame, key):
    period = st.radio('Interval', list(FREQUENCIES), index=2, horizontal=True, key=key + '_interval')
    data = trend(frame, period)
    if data.empty:
        st.info('Tanggal percakapan belum tersedia.')
        return
    chart = alt.Chart(data).mark_line(color='#D2231C', point=True).encode(
        x=alt.X('Periode:T', axis=alt.Axis(format='%d %b %Y' if period in ('Harian', 'Mingguan')
                                          else '%b %Y' if period == 'Bulanan' else '%Y')),
        y=alt.Y('Jumlah kendala:Q', axis=alt.Axis(tickMinStep=1)),
        tooltip=[alt.Tooltip('Periode:T', format='%d %b %Y'), 'Jumlah kendala:Q'],
    )
    st.altair_chart(chart, width='stretch')
    undated = int(frame['Mulai'].isna().sum())
    if undated:
        st.caption(f'{undated} kendala tidak memiliki tanggal yang dapat dibaca.')


def render_detail(frame, key):
    search = st.text_input('Cari kode, kategori, atau pelanggan', key=key + '_search').strip()
    table = frame.sort_values('Mulai', ascending=False).copy()
    for column in ('Kategori', 'Kategori aturan'):
        table[column] = table[column].map(category_name)
    if search:
        columns = ['Kendala', 'Percakapan', 'Pelanggan', 'Kategori']
        matches = table[columns].apply(lambda column: column.str.contains(search, case=False, regex=False))
        table = table[matches.any(axis=1)]
    st.caption(f'{len(table):,} baris subpercakapan')
    st.dataframe(table, hide_index=True, width='stretch', column_config={
        'Mulai': st.column_config.DatetimeColumn(format='DD MMM YYYY HH:mm'),
        'Selesai': st.column_config.DatetimeColumn(format='DD MMM YYYY HH:mm'),
        'Skor model': st.column_config.NumberColumn(format='%.1f%%'),
    })


def render_result(frame, key):
    st.tabs(NLP_TABS,key='nlp_tabs',on_change='rerun')
    active=st.session_state.get('nlp_tabs','Ringkasan')
    if active=='Tambah Data':
        render_upload()
        return
    if frame.empty:
        st.info('Tidak ada data NLP pada sumber ini.')
        if active=='Ringkasan':
            render_upload()
        return
    frame = filter_records(frame, key)
    if frame.empty:
        st.info('Tidak ada kendala yang cocok dengan filter.')
        return
    counts = frame['Penanganan'].value_counts()
    metrics(len(frame), frame['Percakapan'].nunique(), counts.get('Remote', 0),
            counts.get('Non-remote', 0), counts.get('Belum diketahui', 0))
    if active=='Ringkasan':
        render_overview(frame)
        recent_conversations(frame)
        render_upload()
    elif active=='Analisis Remote':
        remote_chart(frame)
        render_handling(frame)
    elif active=='Analisis Pelanggan':
        render_customers(frame)
    elif active=='Tren Waktu':
        render_trend(frame, key)
    elif active=='Detail Percakapan':
        render_detail(frame, key)
        st.download_button('Ekspor metadata terfilter',frame.to_csv(index=False).encode('utf-8-sig'),
                           'metadata_percakapan.csv','text/csv')
    elif active=='Analisis Kendala':
        st.subheader('Analisis Kendala')
        categories=count_by(frame,'Kategori')
        categories['Kategori']=categories.Kategori.map(category_name)
        bar_chart(categories,'Kategori','Jumlah kendala')
        st.dataframe(categories,hide_index=True,width='stretch')
    elif active=='Tambah Data':
        render_upload()


def render_nlp(authorize):
    page_header('NLP WhatsApp',
                'Ubah percakapan menjadi insight untuk memahami kendala dan penanganan pelanggan.',
                'NLP WhatsApp')
    source = st.radio('Sumber data', ['Data historis', 'Unggahan ZIP'],
                      index=0 if st.secrets.get('nlp_history') else 1, horizontal=True, key='nlp_source',
                      format_func=lambda x:'Data Historis (Cloud)' if x=='Data historis' else x)
    if source == 'Data historis':
        frame = historical_data(authorize)
        if frame is not None:
            render_result(frame, 'nlp_history')
        else:
            st.tabs(NLP_TABS,key='nlp_tabs',on_change='rerun')
            if st.session_state.get('nlp_tabs')=='Tambah Data':
                render_upload()
            else:
                with panel('Data Historis (Cloud)'):
                    st.info('Data historis belum dapat ditampilkan. Periksa akses atau pilih sumber Unggahan ZIP.')
        return
    result = st.session_state.get('nlp_result')
    if result is None:
        st.tabs(NLP_TABS,key='nlp_tabs',on_change='rerun')
        render_upload()
        st.info('Pilih ZIP ekspor WhatsApp untuk memulai analisis.')
        return
    st.caption(f"Hasil unggahan · {result['filename']}")
    if 'records' in result:
        render_result(pd.DataFrame(result['records']), f"nlp_upload_{st.session_state.get('nlp_view_revision', 0)}")
        return
    # Support results created before detailed records were retained.
    overview = result['overview']
    st.tabs(NLP_TABS,key='nlp_tabs',on_change='rerun')
    active=st.session_state.get('nlp_tabs','Ringkasan')
    if active=='Tambah Data':
        render_upload()
        return
    metrics(overview['total_issues'], overview['total_conversations'], overview['remote_cases'],
            overview['non_remote_cases'], overview['unknown_remote_cases'])
    if active!='Ringkasan':
        st.info('Hasil lama belum menyimpan metadata detail. Proses ulang ZIP untuk mengaktifkan tab ini.')
        return
    categories = pd.DataFrame(result['issues']['categories']).rename(
        columns={'category': 'Kategori', 'total_cases': 'Jumlah kendala'})
    categories['Kategori'] = categories['Kategori'].map(category_name)
    bar_chart(categories, 'Kategori', 'Jumlah kendala')
    render_upload()
