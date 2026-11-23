"""Dashboard records derived from private NLP results, with no chat text."""
import argparse
from pathlib import Path
import re
import tempfile

import httpx
import pandas as pd

from zahir_dashboard.nlp_assets import StartupError, download_asset
from zahir_dashboard.nlp_core.analytics import AnalyticsService, REQUIRED_COLUMNS

COLUMNS = (
    'Kendala', 'Percakapan', 'Pelanggan', 'Mulai', 'Selesai', 'Kategori',
    'Penanganan', 'Respons klien', 'Jumlah pesan', 'Pesan klien', 'Pesan admin',
    'Ada media', 'Indikasi kredensial', 'Kategori aturan', 'Skor model', 'Kecocokan',
)
STATUS = {'REMOTE': 'Remote', 'NON_REMOTE': 'Non-remote', 'UNKNOWN': 'Belum diketahui'}
FREQUENCIES = {'Harian': 'D', 'Mingguan': 'W-SUN', 'Bulanan': 'M', 'Tahunan': 'Y'}


def records_from_master(path, mapping=None):
    data = pd.read_csv(path, dtype=str, keep_default_na=False, encoding='utf-8-sig')
    if REQUIRED_COLUMNS.difference(data.columns):
        raise ValueError('CSV master NLP tidak memiliki kolom yang diperlukan.')
    data = data.drop_duplicates('sub_conversation_id', keep='first').reset_index(drop=True)

    def field(name):
        return data.get(name, pd.Series('', index=data.index, dtype=str))

    def codes(series, prefix):
        return [f'{prefix}-{index + 1:04}' for index in pd.factorize(series)[0]]

    def categories(series):
        return series.map(AnalyticsService._category)

    def timestamps(series):
        return series.map(AnalyticsService._parse_timestamp).astype('datetime64[ns]')

    customer = data['source_file'].map(
        lambda source: AnalyticsService._customer_name(source, mapping or {})
    )
    records = pd.DataFrame({
        'Kendala': codes(data['sub_conversation_id'], 'K'),
        'Percakapan': codes(data['conversation_id'], 'P'),
        'Pelanggan': codes(customer, 'C'),
        'Mulai': timestamps(data['start_time']),
        'Selesai': timestamps(field('end_time')),
        'Kategori': categories(data['kategori_kendala_ml_predicted']),
        'Penanganan': data['penanganan_remote'].map(AnalyticsService._remote_status).map(STATUS),
        'Respons klien': field('client_response').str.strip().str.upper().map({
            'RESPONS': 'Merespons', 'TIDAK_RESPONS': 'Tidak merespons',
        }).fillna('Belum diketahui'),
        'Kategori aturan': categories(field('kategori_kendala_ground_truth')),
        'Skor model': pd.to_numeric(field('prediction_confidence').str.rstrip('%'), errors='coerce'),
        'Kecocokan': field('prediction_match').str.strip().str.upper().map({
            'MATCH': 'Sesuai', 'DIFFER': 'Berbeda',
        }).fillna('Belum diketahui'),
    })
    for label, field_name in [('Jumlah pesan', 'total_messages'), ('Pesan klien', 'client_messages_count'),
                              ('Pesan admin', 'admin_messages_count')]:
        records[label] = pd.to_numeric(field(field_name), errors='coerce')
    for label, field_name in [('Ada media', 'has_media'), ('Indikasi kredensial', 'contains_credentials')]:
        records[label] = field(field_name).str.strip().str.lower().map({
            '1': 'Ya', 'true': 'Ya', '0': 'Tidak', 'false': 'Tidak',
        }).fillna('Belum diketahui')
    return records[list(COLUMNS)]


def load_history(config, model_config):
    repository = str(model_config.get('repository', '')).strip()
    token = str(model_config.get('read_token', '')).strip()
    asset_id = str(config.get('asset_id', '')).strip()
    digest = str(config.get('sha256', '')).removeprefix('sha256:').lower().strip()
    if (not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository) or not token
            or not re.fullmatch(r'[1-9][0-9]*', asset_id) or not re.fullmatch(r'[a-f0-9]{64}', digest)):
        raise ValueError('Periksa konfigurasi aset historis NLP dan akses repo model.')
    with tempfile.TemporaryDirectory(prefix='zahir_nlp_history_') as folder:
        path = Path(folder) / 'history.csv'
        try:
            with httpx.Client(timeout=httpx.Timeout(120, connect=15), trust_env=False) as client:
                download_asset(client, repository, asset_id, token, path, digest)
        except StartupError as exc:
            raise ValueError('Unduhan data historis gagal. ' + str(exc)) from None
        data = pd.read_csv(path, usecols=list(COLUMNS), keep_default_na=False)
    for column in ('Mulai', 'Selesai'):
        data[column] = pd.to_datetime(data[column], format='ISO8601', errors='coerce')
    for column in ('Jumlah pesan', 'Pesan klien', 'Pesan admin', 'Skor model'):
        data[column] = pd.to_numeric(data[column], errors='coerce')
    for column, prefix in [('Kendala', 'K'), ('Percakapan', 'P'), ('Pelanggan', 'C')]:
        if not data[column].astype(str).str.fullmatch(prefix + r'-[0-9]{4,}').all():
            raise ValueError('Ekspor historis harus memakai kode samaran dari nlp_data.')
    return data[list(COLUMNS)]


def count_by(frame, column, limit=None):
    counts = frame.groupby(column).size().rename('Jumlah kendala').reset_index()
    counts = counts.sort_values(['Jumlah kendala', column], ascending=[False, True])
    return counts if limit is None else counts.head(limit)


def trend(frame, period):
    dated = frame.dropna(subset=['Mulai']).copy()
    dated['Periode'] = dated['Mulai'].dt.to_period(FREQUENCIES[period]).dt.start_time
    return dated.groupby('Periode').size().rename('Jumlah kendala').reset_index()


def main():
    parser = argparse.ArgumentParser(description='Ekspor metadata NLP untuk dashboard internal.')
    parser.add_argument('master', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--mapping', type=Path)
    args = parser.parse_args()
    if args.master.resolve() == args.output.resolve():
        parser.error('File output harus berbeda dari master.')
    guessed_mapping = args.master.parent.parent / 'raw' / 'chat' / 'chat_mapping.json'
    mapping = AnalyticsService._load_mapping_path(args.mapping or guessed_mapping)
    records_from_master(args.master, mapping).to_csv(args.output, index=False, encoding='utf-8-sig')


if __name__ == '__main__':
    main()
