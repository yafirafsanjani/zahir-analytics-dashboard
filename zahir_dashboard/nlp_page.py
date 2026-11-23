"""Authenticated analytics for historical NLP data and uploaded WhatsApp ZIPs."""
import altair as alt
import pandas as pd
import streamlit as st

from zahir_dashboard.backend import DashboardError
from zahir_dashboard.nlp_backend import NLPError, process_zip
from zahir_dashboard.nlp_data import FREQUENCIES, count_by, load_history, trend


def category_name(value):
    if value == 'UNKNOWN_UNCLASSIFIED':
        return 'Belum terklasifikasi'
    return value.replace('_', ' ').title()


def bar_chart(frame, label, value):
    chart = alt.Chart(frame).mark_bar(color='#2C7A7B', cornerRadiusEnd=3).encode(
        x=alt.X(value, axis=alt.Axis(tickMinStep=1)),
        y=alt.Y(label, sort='-x', axis=alt.Axis(labelLimit=330)),
        tooltip=[label, value],
    )
    st.altair_chart(chart.properties(height=alt.Step(27)), width='stretch')


def render_upload():
    with st.form('nlp_upload'):
        uploaded = st.file_uploader('ZIP ekspor WhatsApp', type=['zip'], key='nlp_file')
        submitted = st.form_submit_button('Proses', type='primary')
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
        st.success('Analisis selesai.')
    except NLPError as exc:
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
    options = categories.multiselect('Kategori', sorted(frame['Kategori'].unique()),
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
    with a:
        st.subheader('Kategori kendala')
        categories = count_by(frame, 'Kategori')
        categories['Kategori'] = categories['Kategori'].map(category_name)
        bar_chart(categories.head(12), 'Kategori', 'Jumlah kendala')
        categories['Persentase (%)'] = (categories['Jumlah kendala'] / total * 100).round(1)
        st.dataframe(categories, hide_index=True, width='stretch')
    with b:
        st.subheader('Respons klien')
        bar_chart(count_by(frame, 'Respons klien'), 'Respons klien', 'Jumlah kendala')
        st.caption('Unit perhitungan adalah satu subpercakapan.')


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
    chart = alt.Chart(data).mark_line(color='#2C7A7B', point=True).encode(
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
    if frame.empty:
        st.info('Tidak ada data NLP pada sumber ini.')
        return
    frame = filter_records(frame, key)
    if frame.empty:
        st.info('Tidak ada kendala yang cocok dengan filter.')
        return
    counts = frame['Penanganan'].value_counts()
    metrics(len(frame), frame['Percakapan'].nunique(), counts.get('Remote', 0),
            counts.get('Non-remote', 0), counts.get('Belum diketahui', 0))
    overview, handling, customers, timeline, detail = st.tabs(
        ['Ringkasan', 'Penanganan', 'Pelanggan', 'Tren waktu', 'Detail percakapan']
    )
    with overview:
        render_overview(frame)
    with handling:
        render_handling(frame)
    with customers:
        render_customers(frame)
    with timeline:
        render_trend(frame, key)
    with detail:
        render_detail(frame, key)


def render_nlp(authorize):
    st.header('NLP WhatsApp')
    source = st.radio('Sumber data', ['Unggahan ZIP', 'Data historis'],
                      index=int(bool(st.secrets.get('nlp_history'))), horizontal=True, key='nlp_source')
    if source == 'Data historis':
        frame = historical_data(authorize)
        if frame is not None:
            render_result(frame, 'nlp_history')
        return
    render_upload()
    result = st.session_state.get('nlp_result')
    if result is None:
        st.info('Pilih ZIP ekspor WhatsApp untuk memulai analisis.')
        return
    st.caption(f"Hasil unggahan · {result['filename']}")
    if 'records' in result:
        render_result(pd.DataFrame(result['records']), f"nlp_upload_{st.session_state.get('nlp_view_revision', 0)}")
        return
    # Support results created before detailed records were retained.
    overview = result['overview']
    metrics(overview['total_issues'], overview['total_conversations'], overview['remote_cases'],
            overview['non_remote_cases'], overview['unknown_remote_cases'])
    categories = pd.DataFrame(result['issues']['categories']).rename(
        columns={'category': 'Kategori', 'total_cases': 'Jumlah kendala'})
    categories['Kategori'] = categories['Kategori'].map(category_name)
    bar_chart(categories, 'Kategori', 'Jumlah kendala')
