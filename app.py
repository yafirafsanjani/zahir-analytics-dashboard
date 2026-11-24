"""Zahir Analytics: authenticated segmentation and social analytics."""
from __future__ import annotations

import time
import streamlit as st
from supabase import create_client
from supabase.lib.client_options import SyncClientOptions
from zahir_dashboard.social_page import render_social
from zahir_dashboard.nlp_page import render_nlp
from zahir_dashboard.ui import apply_theme, page_header, mobile_navigation, sidebar_brand
from zahir_dashboard.segmentation_page import render_segmentation

from zahir_dashboard.backend import (
    DashboardError,
    SegmentationRepository,
    settings_from_secrets,
)


def logout() -> None:
    client = st.session_state.get("_supabase_client")
    try:
        if client is not None:
            client.auth.sign_out({"scope": "local"})
    except Exception:
        pass
    # Clear this browser session, including any previously displayed search/state.
    st.session_state.clear()


def authenticated_user(client):
    try:
        session = client.auth.get_session()
        if session is None:
            return None
        if session.expires_at and session.expires_at <= time.time() + 60:
            session = client.auth.refresh_session().session
        if session is None:
            return None
        client.postgrest.auth(session.access_token)
        response = client.auth.get_user()
        return response.user
    except Exception:
        logout()
        st.warning("Sesi tidak tersedia atau telah berakhir. Silakan masuk kembali.")
        return None


def render_login(client) -> None:
    st.subheader("Masuk untuk pengguna internal")
    st.caption("Gunakan akun Supabase Auth yang telah diberi izin baca oleh administrator.")
    with st.form("login", clear_on_submit=True):
        email = st.text_input("Email", max_chars=254)
        password = st.text_input("Kata sandi", type="password", max_chars=256)
        submitted = st.form_submit_button("Masuk")
    if submitted:
        if not email.strip() or not password:
            st.error("Isi email dan kata sandi.")
            return
        try:
            response = client.auth.sign_in_with_password({"email": email.strip(), "password": password})
            if response.session is None:
                st.error("Login belum berhasil. Periksa akun dan konfirmasi email.")
                return
            client.postgrest.auth(response.session.access_token)
        except Exception:
            st.error("Login belum berhasil. Periksa kredensial atau ketersediaan layanan autentikasi.")
            return
        st.rerun()


def main() -> None:
    st.set_page_config(page_title="Zahir Analytics", page_icon="📊", layout="wide")
    apply_theme()
    try:
        settings = settings_from_secrets(st.secrets)
    except DashboardError as exc:
        st.error(str(exc))
        return
    except Exception:
        st.error("Streamlit secrets belum tersedia atau formatnya belum valid. Gunakan contoh konfigurasi proyek.")
        return
    if "_supabase_client" not in st.session_state:
        try:
            # Never share an authenticated client via cache_resource or a module global.
            st.session_state["_supabase_client"] = create_client(
                settings.url,
                settings.key,
                options=SyncClientOptions(
                    auto_refresh_token=False,
                    persist_session=False,
            ),
)
        except Exception:
            st.error("Koneksi Supabase belum dapat dibuat. Periksa konfigurasi administrator.")
            return
    client = st.session_state["_supabase_client"]
    user = authenticated_user(client)
    if user is None:
        page_header('Selamat datang di Zahir Analytics',
                    'Masuk untuk mengakses insight bisnis dan analisis pelanggan Anda.', 'Masuk')
        render_login(client)
        return
    sidebar_brand()
    page = st.sidebar.radio('Halaman', ['Segmentasi Pelanggan', 'Analisis Media Sosial', 'NLP WhatsApp'], key='analytics_page')
    mobile_navigation(page)
    st.sidebar.divider()
    st.sidebar.caption('Internal BI ? Live workspace')
    st.sidebar.button('Keluar', on_click=logout, icon=':material/logout:')
    if page == 'NLP WhatsApp':
        render_nlp(SegmentationRepository(client, settings.columns).authorize)
        return
    if page == 'Analisis Media Sosial':
        render_social(client)
        return
    render_segmentation(SegmentationRepository(client, settings.columns))


if __name__ == "__main__":
    main()
