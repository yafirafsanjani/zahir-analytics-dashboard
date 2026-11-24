"""Shared light workspace styling. Native widgets retain session and accessibility behavior."""
from contextlib import contextmanager
from html import escape
from pathlib import Path

import altair as alt
import streamlit as st

PALETTE = ['#D2231C', '#E11D48', '#F97316', '#94A3B8']
SENTIMENT_COLORS = ['#15803D', '#64748B', '#D2231C']


def activate(key, value):
    st.session_state[key] = value


def reset_widgets(keys):
    for key in keys:
        st.session_state.pop(key, None)


def badge(text):
    return '<span class="data-badge">' + escape(str(text)) + '</span>'


def progress_list(rows, total, unit=''):
    """Reference-style horizontal tracks, using escaped labels and actual counts."""
    html = '<div class="progress-list">'
    for i, (label, value) in enumerate(rows):
        pct = 100 * float(value) / total if total else 0
        color = PALETTE[min(i, len(PALETTE)-1)]
        display_value=f'{float(value):,.0f}'.replace(',','.')
        display_pct=f'{pct:.1f}'.replace('.',',')
        html += (f'<div class="progress-item"><div class="progress-caption"><span><i style="background:{color}"></i>'
                 f'{escape(str(label))}</span><strong>{display_value} {escape(unit)} '
                 f'<small>({display_pct}%)</small></strong></div>'
                 f'<div class="progress-track"><div style="width:{max(0,min(100,pct))}%;background:{color}"></div></div></div>')
    st.html(html + '</div>')


def data_card(title, subtitle='', badges=(), footer=''):
    st.html('<article class="record-card"><div class="record-top"><strong>' + escape(str(title)) +
            '</strong><div>' + ''.join(badge(x) for x in badges) + '</div></div>' +
            '<p>' + escape(str(subtitle)) + '</p><div class="record-footer">' + escape(str(footer)) + '</div></article>')


def mobile_navigation(current):
    pages = ['Segmentasi Pelanggan', 'Analisis Media Sosial', 'NLP WhatsApp']
    st.session_state['mobile_navigation'] = current
    with st.container(key='mobile-navigation'):
        st.radio('Navigasi mobile', pages, key='mobile_navigation', horizontal=True,
                 label_visibility='collapsed', format_func=lambda p: dict(zip(pages, ['Segmentasi','Medsos','WhatsApp']))[p],
                 on_change=lambda: activate('analytics_page', st.session_state['mobile_navigation']))


def apply_theme():
    st.session_state['_zahir_panel_count'] = 0
    css = Path(__file__).with_name('ui.css').read_text(encoding='utf-8')
    st.html('<style>' + css + '</style>')
    # Only a chart theme; no data or authenticated clients are cached here.
    alt.theme.register('zahir', enable=True)(lambda: alt.theme.ThemeConfig(config={
        'background': 'transparent',
        'view': {'stroke': None},
        'font': 'Manrope, sans-serif',
        'autosize': {'type': 'fit', 'contains': 'padding'},
        'padding': {'left': 12, 'right': 16, 'top': 12, 'bottom': 12},
        'axis': {'labelColor': '#64748B', 'titleColor': '#64748B', 'gridColor': '#E5EEFF',
                 'domain': False, 'ticks': False, 'labelPadding': 10, 'titlePadding': 12},
        'legend': {'title': None, 'labelColor': '#64748B', 'orient': 'bottom'},
        'range': {'category': PALETTE},
        'bar': {'color': '#D2231C'},
        'line': {'strokeWidth': 2.5},
    }))


def sidebar_brand():
    st.sidebar.markdown('<div class="brand"><div class="brand-mark">Z</div>'
                        '<div>Zahir <span>Analytics</span><small>ENTERPRISE BI</small></div></div>'
                        '<div class="nav-caption">MENU UTAMA</div>', unsafe_allow_html=True)


def page_header(title, description, section='Dashboard'):
    st.html('<div class="mobile-heading"><span class="mobile-brand">Z<span>AHIR</span></span>'
            f'<div><small>ZAHIR</small><strong>{escape(title)}</strong></div></div>')
    st.markdown(f'<div class="breadcrumb">Zahir Analytics <span>/</span> {escape(section)}</div>'
                f'<div class="page-heading"><div><h1>{escape(title)}</h1>'
                f'<p>{escape(description)}</p></div><span class="workspace-badge">Workspace internal</span></div>',
                unsafe_allow_html=True)


@contextmanager
def panel(title=None, caption=None):
    index = st.session_state.get('_zahir_panel_count', 0)
    st.session_state['_zahir_panel_count'] = index + 1
    with st.container(border=True, key=f'zahir-panel-{index}'):
        if title:
            st.subheader(title)
        if caption:
            st.caption(caption)
        yield


def section_label(text):
    st.markdown(f'<div class="section-label">{escape(text)}</div>', unsafe_allow_html=True)
