"""Run the existing NLP ingestion/inference/analytics locally in Streamlit."""
import tempfile
from pathlib import Path
from uuid import uuid4
from collections.abc import Mapping


class NLPError(Exception):
    pass


def process_zip(name, content, model_config=None, role_map=None):
    if not name.lower().endswith('.zip') or not content:
        raise NLPError('Pilih file ZIP ekspor WhatsApp yang tidak kosong.')
    if len(content) > 100 * 1024 * 1024:
        raise NLPError('Ukuran ZIP melebihi batas 100 MB.')
    if role_map is not None and (not isinstance(role_map, Mapping) or not role_map or any(
        not isinstance(sender, str) or role not in {'ADMIN', 'CLIENT', 'SYSTEM'}
        for sender, role in role_map.items()
    )):
        raise NLPError('Konfigurasi nlp_roles harus memetakan pengirim ke ADMIN, CLIENT, atau SYSTEM.')
    try:
        from zahir_dashboard.nlp_assets import ensure_models, StartupError
        from zahir_dashboard.nlp_core.ingestion import ingest_whatsapp_zip, ZipValidationError
        from zahir_dashboard.nlp_core.inference_pipeline import analyze_uploaded_conversations
        from zahir_dashboard.nlp_core.analytics import AnalyticsService
    except ImportError as exc:
        raise NLPError('Dependensi NLP belum tersedia: ' + str(exc.name) + '. Instal requirements.txt dashboard.') from None
    try:
        ensure_models(model_config)
        # No user input is used as a filesystem path; one random workspace per submission.
        session_id = 'session_' + uuid4().hex
        with tempfile.TemporaryDirectory(prefix='zahir_nlp_') as directory:
            workspace = Path(directory)
            run_dir = workspace / 'runs' / session_id
            zip_path = workspace / 'upload.zip'
            zip_path.write_bytes(content)
            metadata = ingest_whatsapp_zip(zip_path, target_dir=run_dir / 'raw', session_id=session_id)
            if not metadata.get('total_chats'):
                raise NLPError('Hasil kosong. ZIP tidak berisi percakapan WhatsApp yang dapat dibaca.')
            analyze_uploaded_conversations(raw_dir=run_dir / 'raw/chat', media_dir=run_dir / 'raw/media',
                                          run_dir=run_dir, role_map=role_map)
            analytics = AnalyticsService(runs_dir=workspace / 'runs')
            overview = analytics.overview(session_id=session_id)
            issues = analytics.issues(session_id=session_id)
            if not overview['total_issues'] or not issues['categories']:
                raise NLPError('Hasil analisis kosong. Periksa isi ekspor WhatsApp.')
            return dict(session_id=session_id, overview=overview, issues=issues,
                        filename=name, processing='local')
        # All chat/media/intermediate/master files are removed even if processing fails.
    except StartupError as exc:
        raise NLPError(str(exc)) from None
    except ZipValidationError:
        raise NLPError('ZIP ditolak. Pastikan arsip valid, aman, dan sesuai batas ukuran.') from None
    except NLPError:
        raise
    except Exception:
        raise NLPError('Analisis NLP lokal gagal. Periksa format chat dan kompatibilitas model/dependensi.') from None
