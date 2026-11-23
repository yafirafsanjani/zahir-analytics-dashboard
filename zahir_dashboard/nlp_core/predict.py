"""
predict.py - Inference Engine untuk Prediksi Data Baru (Fase 17)

Menyediakan pipeline inferensi end-to-end:
Raw Text -> Preprocessing -> Normalization -> TF-IDF Vectorizer -> Best Model.
Mendukung:
1. Prediksi kalimat teks langsung via CLI / argumen.
2. Mode interaktif ketik chat di terminal.
3. Prediksi batch file chat WhatsApp baru (.txt / .csv).
Menghasilkan label kategori kendala beserta tingkat keyakinan (confidence score).
"""

import sys
import csv
import pickle
import numpy as np
from pathlib import Path

# Import pipeline preprocessing & normalisasi yang sudah teruji
from zahir_dashboard.nlp_core.preprocessing import clean_text_advanced
from zahir_dashboard.nlp_core.normalization import normalize_text_cascaded

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
OUTPUT_DIR = BASE_DIR / "data" / "output"
BEST_MODEL_FILE = MODELS_DIR / "best_model.pkl"
VECTORIZER_FILE = MODELS_DIR / "tfidf_vectorizer.pkl"

def load_inference_artifacts():
    from zahir_dashboard.nlp_assets import load_artifacts
    return load_artifacts()


def validate_inference_artifacts(model, vectorizer):
    """Reject overwritten vectorizers before predictions or session writes."""
    if hasattr(model, 'named_steps'):
        embedded = model.named_steps.get('tfidf')
        if embedded is None or embedded.vocabulary_ != vectorizer.vocabulary_ or not np.array_equal(embedded.idf_, vectorizer.idf_):
            raise ValueError('Model produksi dan vectorizer tidak cocok; pulihkan pasangan artefak terverifikasi.')
        classifier = model.named_steps['clf']
    else:
        classifier = model
    if classifier.n_features_in_ != len(vectorizer.get_feature_names_out()):
        raise ValueError('Jumlah fitur vectorizer tidak cocok dengan model produksi.')

def predict_single_text(raw_text):
    """
    Menjalankan inferensi end-to-end pada satu teks pesan chat:
    1. Preprocessing (Pembersihan teks mentah)
    2. Normalization (Cascaded Slang Normalization)
    3. TF-IDF Vectorization
    4. Model Classification & Confidence Score
    """
    model, vectorizer = load_inference_artifacts()

    clean_text = clean_text_advanced(raw_text)
    norm_text, _ = normalize_text_cascaded(clean_text)

    if not norm_text.strip():
        return {
            "predicted_category": "LAINNYA_UNCATEGORIZED",
            "confidence": 100.0,
            "all_probabilities": {},
            "normalized_text": "",
        }

    if hasattr(model, "named_steps"):
        pred_label = model.predict([norm_text])[0]
        probs_dict = {}
        confidence = 0.0
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba([norm_text])[0]
            confidence = float(np.max(probs) * 100)
            classes = getattr(model, "classes_", model.named_steps["clf"].classes_)
            for cls_name, prob in zip(classes, probs):
                probs_dict[cls_name] = round(float(prob * 100), 2)
        elif hasattr(model.named_steps["clf"], "decision_function"):
            decision = model.decision_function([norm_text])[0]
            if len(decision.shape) > 0:
                exp_d = np.exp(decision - np.max(decision))
                probs = exp_d / np.sum(exp_d)
                confidence = float(np.max(probs) * 100)
                classes = model.named_steps["clf"].classes_
                for cls_name, prob in zip(classes, probs):
                    probs_dict[cls_name] = round(float(prob * 100), 2)
            else:
                confidence = 100.0
        else:
            confidence = 100.0
    else:
        X_vec = vectorizer.transform([norm_text])
        pred_label = model.predict(X_vec)[0]
        probs_dict = {}
        confidence = 0.0
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(X_vec)[0]
            confidence = float(np.max(probs) * 100)
            for cls_name, prob in zip(model.classes_, probs):
                probs_dict[cls_name] = round(float(prob * 100), 2)
        else:
            confidence = 100.0

    return {
        "predicted_category": pred_label,
        "confidence": confidence,
        "all_probabilities": probs_dict,
        "normalized_text": norm_text,
    }

