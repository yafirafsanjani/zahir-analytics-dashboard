"""WhatsApp upload page behind the dashboard's existing login."""
import pandas as pd
import streamlit as st

from zahir_dashboard.nlp_backend import NLPError, api_url, api_token, process_zip


def render_nlp():
    st.header('NLP WhatsApp')
    st.caption('Unggah ZIP ekspor WhatsApp untuk menganalisis percakapan dan kategori kendala. Setiap unggahan diproses sebagai sesi tersendiri.')
    try:
        base_url = api_url(st.secrets)
        service_token = api_token(st.secrets)
    except NLPError as exc:
        st.error(str(exc))
        base_url = None
    with st.form('nlp_upload'):
        uploaded = st.file_uploader('ZIP ekspor WhatsApp', type=['zip'], key='nlp_file')
        submitted = st.form_submit_button('Proses', disabled=base_url is None)
    if submitted:
        if uploaded is None:
            st.error('Pilih file ZIP ekspor WhatsApp terlebih dahulu.')
        else:
            try:
                with st.spinner('Mengunggah dan menjalankan analisis NLP. Mohon tunggu hingga selesai...'):
                    result = process_zip(base_url, uploaded.name, uploaded.getvalue(), service_token=service_token)
                # Commit only after upload, analysis and both result reads succeed.
                st.session_state['nlp_result'] = result
                st.success('Analisis selesai. Hasil terbaru berhasil dimuat.')
            except NLPError as exc:
                st.error(str(exc))
                if 'nlp_result' in st.session_state:
                    st.info('Hasil terakhir yang berhasil tetap ditampilkan.')
    result = st.session_state.get('nlp_result')
    if result is None:
        st.info('Belum ada hasil analisis. Pilih ZIP lalu tekan Proses.')
        return
    overview = result['overview']
    st.caption(f"Hasil terakhir: {result['filename']} | Sesi: {result['session_id']} | API: {result['api_url']}")
    a, b, c, d = st.columns(4)
    a.metric('Total kendala', overview['total_issues'])
    b.metric('Total percakapan', overview['total_conversations'])
    c.metric('Kasus remote', overview['remote_cases'])
    d.metric('Persentase remote', f"{overview['remote_rate']:.1f}%")
    st.caption(f"Non-remote: {overview['non_remote_cases']} | Penanganan belum diketahui: {overview['unknown_remote_cases']}. Kendala dihitung per subpercakapan.")
    st.subheader('Distribusi kategori kendala')
    frame = pd.DataFrame(result['issues']['categories'])
    frame = frame.rename(columns={'category': 'Kategori', 'total_cases': 'Jumlah kendala', 'percentage_of_total': 'Persentase (%)'})
    st.bar_chart(frame, x='Kategori', y='Jumlah kendala', horizontal=True)
    st.dataframe(frame[['Kategori', 'Jumlah kendala', 'Persentase (%)']], hide_index=True, width='stretch')
