"""Uploaded datasets use production inference, never offline model fitting."""
from pathlib import Path

from zahir_dashboard.nlp_core.parser import parse_whatsapp_chats
from zahir_dashboard.nlp_core.roles import identify_roles
from zahir_dashboard.nlp_core.conversation import group_conversations
from zahir_dashboard.nlp_core.client_response import analyze_client_responses
from zahir_dashboard.nlp_core.remote import classify_remote
from zahir_dashboard.nlp_core.category_labeling import label_sub_conversations
from zahir_dashboard.nlp_core.preprocessing import preprocess_text_data
from zahir_dashboard.nlp_core.normalization import normalize_text_data
from zahir_dashboard.nlp_core.predict import load_inference_artifacts
from zahir_dashboard.nlp_core.consolidation import consolidate_master_data


def analyze_uploaded_conversations(raw_dir, media_dir, run_dir, role_map=None):
    """Keep every intermediate and final artifact inside this session directory."""
    load_inference_artifacts()  # Fail before processing if production artifacts are invalid.
    run_dir = Path(run_dir)
    processed = run_dir / 'processed'
    processed.mkdir(parents=True, exist_ok=True)
    parsed = processed / 'chat_parsed.csv'
    messages = parse_whatsapp_chats(raw_dir=raw_dir, media_dir=media_dir, output_file=parsed)
    if not messages:
        raise ValueError('Tidak ada pesan WhatsApp yang dapat dianalisis.')
    previous = parsed
    for stage, filename in (
        (identify_roles, 'chat_with_roles.csv'),
        (group_conversations, 'chat_with_conversations.csv'),
        (analyze_client_responses, 'chat_with_responses.csv'),
        (classify_remote, 'chat_with_remotes.csv'),
        (label_sub_conversations, 'chat_with_categories.csv'),
    ):
        target = processed / filename
        if stage is identify_roles and role_map is not None:
            stage(input_file=previous, output_file=target, role_map=role_map)
        else:
            stage(input_file=previous, output_file=target)
        previous = target
    categories = previous
    preprocessed = processed / 'chat_preprocessed.csv'
    documents = preprocess_text_data(input_file=categories, output_file=preprocessed)
    if not documents:
        raise ValueError('Tidak ada dokumen percakapan yang dapat dianalisis.')
    normalized = processed / 'chat_normalized.csv'
    normalize_text_data(input_file=preprocessed, output_file=normalized)
    # The existing consolidation performs transform + predict with production artifacts.
    # Publish the CSV last, so analytics never reads a partially written result.
    output = run_dir / 'output'
    staging = run_dir / 'staging'
    master_name = 'master_conversations_final.csv'
    records = consolidate_master_data(cat_file=categories, norm_file=normalized,
                                      output_file=staging / master_name)
    if not records:
        raise ValueError('Hasil analisis percakapan kosong.')
    output.mkdir(parents=True, exist_ok=True)
    workbook = (staging / master_name).with_suffix('.xlsx')
    if workbook.exists():
        workbook.replace((output / master_name).with_suffix('.xlsx'))
    (staging / master_name).replace(output / master_name)
    return records
