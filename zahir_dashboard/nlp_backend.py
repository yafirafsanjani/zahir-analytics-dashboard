"""Session-scoped client for the existing synchronous NLP API."""
import os
from urllib.parse import urlsplit

import httpx


class NLPError(Exception):
    pass


def api_url(secrets):
    value = os.environ.get('NLP_API_BASE_URL') or secrets.get('nlp', {}).get('api_base_url', 'http://127.0.0.1:8000')
    value = str(value).strip().rstrip('/')
    parsed = urlsplit(value)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.query or parsed.fragment:
        raise NLPError('URL API NLP tidak valid. Atur NLP_API_BASE_URL atau nlp.api_base_url.')
    return value


def api_token(secrets):
    token = str(secrets.get('nlp', {}).get('service_token', '')).strip()
    if len(token) < 32:
        raise NLPError('Token layanan NLP belum dikonfigurasi. Isi nlp.service_token pada secrets Streamlit.')
    return token


def process_zip(base_url, name, content, service_token=None):
    if not name.lower().endswith('.zip') or not content:
        raise NLPError('Pilih file ZIP ekspor WhatsApp yang tidak kosong.')
    if not service_token or len(service_token.strip()) < 32:
        raise NLPError('Token layanan NLP belum dikonfigurasi. Periksa secrets Streamlit.')

    def request(client, method, path, stage, **kwargs):
        try:
            response = client.request(method, path, **kwargs)
        except httpx.TimeoutException as exc:
            raise NLPError(f'{stage}: waktu tunggu API habis. Analisis mungkin masih berjalan; unggahan tidak diulang otomatis.') from exc
        except httpx.RequestError as exc:
            raise NLPError(f'{stage}: API NLP tidak dapat dijangkau. Periksa URL dan pastikan FastAPI aktif.') from exc
        if not response.is_success:
            if response.status_code in (401, 403):
                raise NLPError('Akses API NLP ditolak. Pastikan token layanan di Streamlit dan FastAPI sama.')
            detail = ''
            try:
                detail = response.json().get('detail', '')
                if isinstance(detail, dict):
                    detail = detail.get('message', '')
                if not isinstance(detail, str):
                    detail = ''
            except ValueError:
                pass
            raise NLPError(f'{stage} (HTTP {response.status_code}). {detail}')
        try:
            result = response.json()
            if not isinstance(result, dict):
                raise ValueError()
            return result
        except ValueError as exc:
            raise NLPError(f'{stage}: respons API tidak valid.') from exc

    # No retries: each explicit submission creates exactly one upload/session.
    with httpx.Client(base_url=base_url + '/', timeout=httpx.Timeout(900, connect=10),
                      headers={'Authorization': f'Bearer {service_token.strip()}'}) as client:
        upload = request(client, 'POST', 'api/upload', 'Unggah ditolak atau gagal',
                         files={'file': (name, content, 'application/zip')})
        session_id = upload.get('session_id')
        if upload.get('success') is not True or not isinstance(session_id, str) or not session_id.strip():
            raise NLPError('Unggah gagal: API tidak memberikan session_id yang valid.')
        analysis = request(client, 'POST', 'api/analyze', 'Analisis gagal', json={'session_id': session_id})
        if analysis.get('success') is not True or analysis.get('status') != 'completed' or analysis.get('session_id') != session_id:
            raise NLPError('Analisis gagal atau belum selesai. Periksa layanan pipeline NLP.')
        overview = request(client, 'GET', 'api/overview', 'Ringkasan gagal dibaca', params={'session_id': session_id})
        issues = request(client, 'GET', 'api/issues', 'Kategori gagal dibaca', params={'session_id': session_id})
    try:
        for data in (overview, issues):
            if data['session_id'] != session_id or data['dataset']['session_id'] != session_id:
                raise ValueError()
        for key in ('total_issues', 'total_conversations', 'remote_cases', 'non_remote_cases', 'unknown_remote_cases', 'remote_rate'):
            if not isinstance(overview[key], (int, float)) or overview[key] < 0:
                raise ValueError()
        categories = issues['categories']
        if overview['total_issues'] == 0 or not categories:
            raise NLPError('Hasil analisis kosong. Gunakan ZIP berisi percakapan WhatsApp yang dapat dianalisis.')
        if issues['total_issues'] != overview['total_issues'] or not isinstance(categories, list):
            raise ValueError()
        for row in categories:
            if not isinstance(row['category'], str) or not isinstance(row['total_cases'], int) or row['total_cases'] < 0:
                raise ValueError()
            if not isinstance(row['percentage_of_total'], (int, float)):
                raise ValueError()
        if sum(row['total_cases'] for row in categories) != issues['total_issues']:
            raise ValueError()
    except (KeyError, TypeError, ValueError) as exc:
        raise NLPError('Hasil API tidak lengkap atau sesi hasil tidak sesuai. Hasil sebelumnya dipertahankan.') from exc
    return dict(session_id=session_id, overview=overview, issues=issues, api_url=base_url, filename=name)
