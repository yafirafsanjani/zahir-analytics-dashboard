"""WhatsApp upload page behind the dashboard's existing login."""
import pandas as pd
import streamlit as st

from zahir_dashboard.nlp_backend import NLPError, process_zip


def render_nlp():
    st.header('NLP WhatsApp')
    st.caption('Unggah ZIP ekspor WhatsApp untuk menganalisis percakapan dan kategori kendala. Setiap unggahan diproses sebagai sesi tersendiri.')
    with st.form('nlp_upload'):
        uploaded = st.file_uploader('ZIP ekspor WhatsApp', type=['zip'], key='nlp_file')
        submitted = st.form_submit_button('Proses')
    if submitted:
        if uploaded is None:
            st.error('Pilih file ZIP ekspor WhatsApp terlebih dahulu.')
        else:
            try:
                with st.spinner('Memproses ZIP dan menjalankan NLP di aplikasi. Mohon tunggu hingga selesai...'):
                    result = process_zip(uploaded.name, uploaded.getvalue(),
                                         model_config=st.secrets.get('nlp_models', {}),
                                         role_map=st.secrets.get('nlp_roles'))
                # Publish only after local analysis and both summaries succeed.
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
    st.caption(f"Hasil terakhir: {result['filename']} | Sesi: {result['session_id']} | Pemrosesan lokal")
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
