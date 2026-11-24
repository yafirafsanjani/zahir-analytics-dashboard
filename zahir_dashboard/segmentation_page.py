"""Stitch segmentation overview, comparison and authorized invoice actions."""
from decimal import Decimal
from html import escape
import altair as alt
import pandas as pd
import streamlit as st

from zahir_dashboard.backend import DashboardError, reference_checks, rupiah
from zahir_dashboard.ui import activate, badge, data_card, page_header, panel, PALETTE, progress_list

TABS = ['Ikhtisar Segmen', 'Perbandingan Model', 'Detail Faktur']


def compact_rupiah(value):
    if abs(value)>=Decimal('1000000000'):
        return 'Rp ' + f"{value/Decimal('1000000000'):.2f}".replace('.',',')+' M'
    if abs(value)>=Decimal('1000000'):
        return 'Rp ' + f"{value/Decimal('1000000'):.2f}".replace('.',',')+' Jt'
    return rupiah(value)


def model_metric(records,key):
    values={str(r[key]) for r in records if r.get(key) is not None}
    if len(values)==1:
        return next(iter(values))
    return 'Berbeda per klaster' if values else '—'


def reset_page():
    st.session_state['invoice_page'] = 0


def select_model_from_config():
    st.session_state['algorithm_picker']=st.session_state['model_key']
    reset_page()


def change_page(delta):
    st.session_state['invoice_page'] = max(0, st.session_state.get('invoice_page', 0) + delta)


def csv_bytes(rows):
    frame = pd.DataFrame(rows)
    for col in frame.select_dtypes(include=['object','str']).columns:
        frame[col] = frame[col].map(lambda v: "'" + v if isinstance(v,str) and v.startswith(('=','+','-','@','\t','\r')) else v)
    return frame.to_csv(index=False,lineterminator='\n').encode('utf-8-sig')


def render_detail(repo, choice, cluster_names):
    st.subheader('Detail Faktur')
    st.caption('Satu baris mewakili satu kelompok faktur lolos. Klaster mengikuti model terpilih.')
    try:
        totals = repo.invoice_totals()
        if totals['invoices'] != repo.discover_detail(choice):
            raise DashboardError('Cakupan detail berubah saat dibaca. Muat ulang data.')
    except DashboardError as exc:
        st.warning('Akses atau kesiapan detail belum lengkap. ' + str(exc))
        return None
    st.session_state.setdefault('invoice_page', 0)
    st.session_state.setdefault('company_query', '')
    with st.form('company_search'):
        draft = st.text_input('Cari nama perusahaan', value=st.session_state['company_query'],
                              max_chars=120, placeholder='Ketik sebagian nama perusahaan')
        searched = st.form_submit_button('Cari perusahaan')
    if searched:
        st.session_state['company_query'] = draft.strip()
        reset_page()
    a,b = st.columns(2)
    size = a.selectbox('Baris per halaman', [25,50,100], key='page_size', on_change=reset_page)
    cluster = b.selectbox('Klaster', ['Semua', *cluster_names], key='invoice_cluster_' + choice.key, on_change=reset_page)
    try:
        result = repo.detail_page(choice, st.session_state['company_query'], st.session_state['invoice_page'],
                                  size, None if cluster == 'Semua' else cluster)
        last = max(0, (result.count - 1)//size)
        if result.page > last:
            st.session_state['invoice_page'] = last
            st.rerun()
        display = []
        for row in result.rows:
            if row['Klaster'] not in cluster_names:
                raise DashboardError('Klaster faktur tidak tersedia pada ringkasan model.')
            display.append({**row, 'Grand total (Rp)':float(row['Grand total (Rp)']), 'Segmen':cluster_names[row['Klaster']]})
        if display:
            st.dataframe(pd.DataFrame(display), hide_index=True, width='stretch',
                         column_config={'Grand total (Rp)':st.column_config.NumberColumn(format='localized')})
            st.caption(f'Menampilkan {result.page*size+1:,}–{min((result.page+1)*size,result.count):,} dari {result.count:,} kelompok faktur hasil pencarian.')
        else:
            st.info('Tidak ada faktur yang cocok dengan pencarian nama perusahaan dan klaster.')
        st.caption(f'Halaman {result.page+1} dari {last+1} · Urutan tetap: ID kelompok faktur.')
        prev,nxt = st.columns(2)
        prev.button('Sebelumnya', key='previous_page', disabled=result.page==0, on_click=change_page, args=(-1,))
        nxt.button('Berikutnya', key='next_page', disabled=result.page>=last, on_click=change_page, args=(1,))
        entire = st.checkbox('Ekspor seluruh hasil pencarian', key='invoice_export_all')
        export = repo.export_detail(choice, st.session_state['company_query'], None if cluster=='Semua' else cluster) if entire else result.rows
        st.download_button('Ekspor CSV', data=csv_bytes(export), file_name=f'faktur_{choice.key}.csv',
                           mime='text/csv', disabled=not export, icon=':material/download:')
        st.caption('Cakupan ekspor: seluruh hasil pencarian dan filter klaster.' if entire else 'Cakupan ekspor: halaman yang sedang ditampilkan.')
        return totals
    except DashboardError as exc:
        st.error(str(exc))
        return None


def overview(summary, choice, rfm):
    summary = [{**rfm.get(row['cluster'], {}), **row} for row in summary]
    customers = sum(row['customers'] for row in summary)
    monetary = sum((row['monetary'] for row in summary), Decimal(0))
    st.subheader('Ringkasan Metrik')
    with st.container(key='segment-kpis'):
        a,b,c = st.columns(3)
        a.metric('Total Pelanggan Terklaster', f'{customers:,}'.replace(',','.'))
        b.metric('Klaster', choice.k)
        c.metric('Total Nilai', compact_rupiah(monetary),help='M = miliar, Jt = juta. Nilai tepat: '+rupiah(monetary))
    st.caption(f'{choice.title} - Label pelanggan sementara; setiap kelompok faktur dihitung sekali.')
    frame = pd.DataFrame([{'Klaster':r['cluster'],'Segmen':r['name'],'Pelanggan':r['customers'],
                           'Nilai transaksi':float(r['monetary']),
                           'Kontribusi (%)':float(r['monetary']/monetary*100) if monetary else 0,
                           'Rata-rata per pelanggan':float(r['monetary']/r['customers']) if r['customers'] else 0} for r in summary])
    scale=1000000000 if frame['Nilai transaksi'].max()>=1000000000 else 1000000 if frame['Nilai transaksi'].max()>=1000000 else 1
    unit='Rp miliar' if scale==1000000000 else 'Rp juta' if scale==1000000 else 'Rp'
    a,b = st.columns(2)
    with a, panel('Distribusi Pelanggan', 'Proporsi pelanggan pada setiap klaster.'):
        donut = alt.Chart(frame).mark_arc(innerRadius=52, outerRadius=84, stroke='white', strokeWidth=2).encode(
            theta=alt.Theta('Pelanggan:Q'),
            color=alt.Color('Klaster:N', scale=alt.Scale(range=PALETTE), legend=alt.Legend(orient='bottom', columns=2)),
            tooltip=['Klaster','Segmen','Pelanggan',alt.Tooltip('Kontribusi (%):Q',format='.1f')])
        st.altair_chart(donut.properties(height=250), width='stretch')
    with b, panel('Nilai Transaksi per Klaster', 'Total nilai dan kontribusi tiap segmen.'):
        bar = alt.Chart(frame).mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4).encode(
            x=alt.X('Klaster:N', sort=None, axis=alt.Axis(labelAngle=0)),
            y=alt.Y('Nilai transaksi:Q', axis=alt.Axis(labelExpr=f"format(datum.value/{scale}, '.1f')",title=f'Nilai transaksi ({unit})')),
            color=alt.Color('Klaster:N', scale=alt.Scale(range=PALETTE), legend=None),
            tooltip=['Klaster','Segmen',alt.Tooltip('Nilai transaksi:Q',format=',.2f'),alt.Tooltip('Kontribusi (%):Q',format='.1f')])
        st.altair_chart(bar.properties(height=250), width='stretch')
    a,b = st.columns(2)
    with a, panel('Rata-rata Nilai per Pelanggan', 'Perbandingan daya beli rata-rata tiap klaster.'):
        avg_bar = alt.Chart(frame).mark_bar(cornerRadiusEnd=4).encode(
            y=alt.Y('Klaster:N', sort='-x'),
            x=alt.X('Rata-rata per pelanggan:Q', axis=alt.Axis(labelExpr=f"format(datum.value/{scale}, '.1f')",title=f'Rata-rata ({unit})')),
            color=alt.Color('Klaster:N', scale=alt.Scale(range=PALETTE), legend=None),
            tooltip=['Klaster','Segmen','Pelanggan',alt.Tooltip('Rata-rata per pelanggan:Q',format=',.2f')])
        st.altair_chart(avg_bar.properties(height=210), width='stretch')
    with b, panel('Pelanggan vs Nilai', 'Posisi menunjukkan ukuran segmen; ukuran titik menunjukkan rata-rata per pelanggan.'):
        scatter = alt.Chart(frame).mark_circle(opacity=.82, stroke='white', strokeWidth=1.5).encode(
            x=alt.X('Pelanggan:Q'),
            y=alt.Y('Nilai transaksi:Q', axis=alt.Axis(labelExpr=f"format(datum.value/{scale}, '.1f')",title=f'Nilai transaksi ({unit})')),
            size=alt.Size('Rata-rata per pelanggan:Q', scale=alt.Scale(range=[280, 1500]), legend=None),
            color=alt.Color('Klaster:N', scale=alt.Scale(range=PALETTE), legend=None),
            tooltip=['Klaster','Segmen','Pelanggan',alt.Tooltip('Nilai transaksi:Q',format=',.2f'),
                     alt.Tooltip('Rata-rata per pelanggan:Q',format=',.2f')])
        st.altair_chart(scatter.interactive().properties(height=260), width='stretch')
    with st.expander('Tabel ringkasan segmen'):
        st.dataframe(frame, hide_index=True, width='stretch',
                     column_config={'Nilai transaksi':st.column_config.NumberColumn(format='localized'),
                                    'Rata-rata per pelanggan':st.column_config.NumberColumn(format='localized'),
                                    'Kontribusi (%)':st.column_config.NumberColumn(format='%.1f')})
    has_rfm = all(all(row.get(key) is not None for key in ('recency', 'frequency', 'rfm_monetary')) for row in summary)
    if has_rfm:
        with panel('Profil Segmen RFM', 'R: hari sejak transaksi terakhir - F: frekuensi transaksi - M: nilai belanja pelanggan.'):
            for row in summary:
                with st.container(border=True):
                    st.html('<div class="record-top"><strong>' + escape(f"{row['cluster']} - {row['name']}") +
                            '</strong>' + badge(f"{row['customers']:,} ({100*row['customers']/customers if customers else 0:.1f}%)") + '</div>')
                    cells=[]
                    for key,label in [('recency','Recency'),('frequency','Frequency'),('rfm_monetary','Monetary')]:
                        value=row[key]
                        text=compact_rupiah(Decimal(str(value))) if key == 'rfm_monetary' else str(value)
                        cells.append(f'<div><small>{label}</small><strong>{escape(text)}</strong></div>')
                    st.html('<div class="rfm-grid">'+''.join(cells)+'</div>')
            rfm_frame = pd.DataFrame([{'Klaster':r['cluster'], 'Segmen':r['name'], 'Pelanggan':r['customers'],
                'Recency':float(r['recency']), 'Frequency':float(r['frequency']),
                'Monetary':float(r['rfm_monetary'])} for r in summary])
            a, b = st.columns(2)
            with a:
                rfm_long = rfm_frame.melt(id_vars=['Klaster','Segmen'], value_vars=['Recency','Frequency'],
                                          var_name='Dimensi', value_name='Nilai')
                rfm_bars = alt.Chart(rfm_long).mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4).encode(
                    x=alt.X('Klaster:N', axis=alt.Axis(labelAngle=0)),
                    xOffset='Dimensi:N',
                    y=alt.Y('Nilai:Q'),
                    color=alt.Color('Dimensi:N', scale=alt.Scale(range=['#D2231C','#94A3B8'])),
                    tooltip=['Klaster','Segmen','Dimensi',alt.Tooltip('Nilai:Q',format='.1f')])
                st.altair_chart(rfm_bars.properties(height=240), width='stretch')
                st.caption('Recency = hari sejak transaksi terakhir, Frequency = rata-rata jumlah transaksi.')
            with b:
                rfm_scatter = alt.Chart(rfm_frame).mark_circle(opacity=.82, stroke='white', strokeWidth=1.5).encode(
                    x=alt.X('Frequency:Q'),
                    y=alt.Y('Monetary:Q', title='Monetary (Rp)'),
                    size=alt.Size('Pelanggan:Q', scale=alt.Scale(range=[280, 1400]), legend=None),
                    color=alt.Color('Recency:Q', scale=alt.Scale(scheme='orangered'), title='Recency'),
                    tooltip=['Klaster','Segmen','Pelanggan',alt.Tooltip('Recency:Q',format='.1f'),
                             alt.Tooltip('Frequency:Q',format='.1f'),alt.Tooltip('Monetary:Q',format=',.2f')])
                st.altair_chart(rfm_scatter.interactive().properties(height=240), width='stretch')
                st.caption('Warna menunjukkan recency; ukuran menunjukkan jumlah pelanggan.')
            with st.expander('Tabel detail RFM'):
                st.dataframe(rfm_frame, hide_index=True, width='stretch')
    metrics = {'silhouette':'Silhouette','davies_bouldin':'Davies–Bouldin','calinski_harabasz':'Calinski–Harabasz'}
    has_evaluation = any(any(row.get(key) is not None for key in metrics) for row in summary)
    if has_evaluation:
        with panel('Evaluasi Ketepatan Model', 'Metrik menggunakan fitur dan preprocessing yang sama dengan eksperimen sumber.'):
            st.html('<div class="evaluation-strip">'+''.join(f'<div><small>{label}</small><strong>{escape(model_metric(summary,key))}</strong></div>'
                for key,label in metrics.items())+'</div>')
            with st.expander('Detail skor model'):
                st.dataframe(pd.DataFrame([{'Klaster':r['cluster'], **{label:r.get(key)
                    for key,label in metrics.items()}} for r in summary]),hide_index=True,width='stretch')
    else:
        coverage = pd.DataFrame([{
            'Klaster': row['cluster'],
            'Perusahaan pada faktur': rfm.get(row['cluster'], {}).get('companies'),
            'Kelompok faktur': rfm.get(row['cluster'], {}).get('invoices'),
        } for row in summary])
        if not coverage['Kelompok faktur'].notna().all():
            coverage = pd.DataFrame([{
                'Klaster': row['cluster'],
                'Pelanggan berlabel': row['customers'],
                'Nilai transaksi': float(row['monetary']),
            } for row in summary])
        with panel('Cakupan Data Segmentasi', 'Ringkasan kualitas data yang benar-benar tersedia untuk model aktif.'):
            st.dataframe(coverage, hide_index=True, width='stretch')
            st.caption('Skor Silhouette, Davies-Bouldin, dan Calinski-Harabasz belum tersedia pada sumber eksperimen; panel ini menampilkan cakupan data faktur dan klaster yang digunakan dashboard.')
    st.button('Lihat Detail Faktur', type='primary', icon=':material/receipt_long:',
              on_click=activate, args=('segment_tab','Detail Faktur'))
    st.button('Bandingkan dengan Gaussian Mixture Model', icon=':material/compare_arrows:',
              on_click=activate, args=('segment_tab','Perbandingan Model'))

def render_segmentation(repo):
    page_header('Segmentasi Pelanggan','Analisis profil pelanggan dan kontribusi nilai transaksi.','Segmentasi Pelanggan')
    try:
        repo.authorize()
        choices = repo.discover_models()
        by_key = {c.key:c for c in choices}
        if st.session_state.get('model_key') not in by_key:
            st.session_state['model_key'] = next(iter(by_key))
        with panel():
          with st.container(key='segment-controls-header'):
            title,config = st.columns([3,1])
            title.caption('Algoritma Aktif · Data terhubung')
            with config.popover('Konfigurasi', icon=':material/tune:'):
                st.caption('Pilihan yang didukung mengikuti model yang tersedia di Supabase.')
                st.selectbox('Model segmentasi', list(by_key),format_func=lambda k:by_key[k].title,
                             key='model_key',on_change=select_model_from_config)
          if st.session_state.get('algorithm_picker') not in by_key:
              st.session_state['algorithm_picker']=st.session_state['model_key']
          st.segmented_control('Algoritma',list(by_key),
                format_func=lambda k:f"{'K-Means' if k.startswith('kmeans') else 'GMM'} (k={by_key[k].k})", required=True, key='algorithm_picker',
                on_change=lambda:(activate('model_key',st.session_state['algorithm_picker']),reset_page()),
                width='stretch',label_visibility='collapsed',wrap=False)
        choice = by_key[st.session_state['model_key']]
        summary = repo.summary(choice)
        try:
            rfm = repo.rfm_summary(choice)
        except DashboardError:
            rfm = {}
        scopes = {(r.get('start'),r.get('end'),r.get('reference')) for r in summary}
        if len(scopes)==1 and all(next(iter(scopes))):
            start,end,ref=next(iter(scopes));st.caption(f'▣ {start} – {end} · Referensi: {ref}')
        else:
            st.caption('Periode data dan tanggal referensi belum tersedia atau belum konsisten pada ringkasan terhubung.')
        overview_tab,compare_tab,detail_tab=st.tabs(TABS,key='segment_tab',on_change='rerun')
        with overview_tab:
            overview(summary,choice,rfm)
        with compare_tab:
            with panel('Perbandingan Model','Setiap konfigurasi dihitung terpisah; nilai antarmodel tidak dijumlahkan.'):
                rows=[]
                has_comparison_metrics = False
                for candidate in choices:
                    records=repo.summary(candidate)
                    metric_values = {label:model_metric(records,key) for key,label in
                                     [('silhouette','Silhouette'),('davies_bouldin','Davies–Bouldin'),('calinski_harabasz','Calinski–Harabasz')]}
                    has_comparison_metrics = has_comparison_metrics or any(value != 'â€”' for value in metric_values.values())
                    rows.append({'Model':candidate.title,'Klaster':candidate.k,'Pelanggan':sum(r['customers'] for r in records),
                                 'Total nilai':rupiah(sum((r['monetary'] for r in records),Decimal(0))), **metric_values})
                if not has_comparison_metrics:
                    rows = [{key:value for key,value in row.items() if key not in ('Silhouette','Davies–Bouldin','Calinski–Harabasz')}
                            for row in rows]
                st.dataframe(pd.DataFrame(rows),hide_index=True,width='stretch')
                st.caption('Jumlah klaster bukan ukuran ketepatan. Skor hanya ditampilkan bila tersedia dari sumber eksperimen.')
        with detail_tab:
            totals=render_detail(repo,choice,{r['cluster']:r['name'] for r in summary})
        checks=reference_checks(summary,totals)
        with st.expander('Validasi cakupan terhadap notebook',expanded=not all(r['Sesuai'] for r in checks)):
            st.dataframe(pd.DataFrame(checks),hide_index=True,width='stretch')
            st.caption('Acuan: 1.456 label, 2.874 kelompok faktur, Rp8.225.196.662,39. Bukan pengganti data terbaca.')
    except DashboardError as exc:
        st.error(str(exc))
