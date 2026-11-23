"""Pinned private production artifacts; no per-user data is cached here."""
import hashlib
import os
from pathlib import Path
import re
import tempfile
from urllib.parse import urlsplit
import httpx

MODEL_ROOT = Path(__file__).resolve().parents[1] / '.cache' / 'nlp_models'
EXPECTED = {
    'best_model.pkl': 'bb6dd03738b4a6c1595623c68abf3ed399932afa44655a0230d8a372972c29b5',
    'tfidf_vectorizer.pkl': '299a0b1454504d49ee3ee4ac707f92cd8fba4a04545d891c05e20ce04fa24acf',
}

MAX_ASSET_BYTES = 200 * 1024 * 1024


class StartupError(Exception):
    pass


def artifact_config(env):
    repository = env.get('GITHUB_MODEL_REPOSITORY', '').strip()
    token = env.get('GITHUB_MODEL_TOKEN', '').strip()
    ids = {name: env.get(key, '').strip() for name, key in (
        ('best_model.pkl', 'GITHUB_MODEL_ASSET_ID'),
        ('tfidf_vectorizer.pkl', 'GITHUB_VECTORIZER_ASSET_ID'),
    )}
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
        raise StartupError('Set GITHUB_MODEL_REPOSITORY to owner/private-repository.')
    if not token or any(not value.isdecimal() or int(value) <= 0 for value in ids.values()):
        raise StartupError('Set the read-only GitHub token and both numeric release asset IDs.')
    if len(set(ids.values())) != 2:
        raise StartupError('Model and vectorizer must have different asset IDs.')
    return repository, token, ids


def download_asset(client, repository, asset_id, token, destination, expected):
    url = f'https://api.github.com/repos/{repository}/releases/assets/{asset_id}'
    headers = {'Authorization': f'Bearer {token}', 'Accept': 'application/octet-stream',
               'X-GitHub-Api-Version': '2022-11-28'}
    for _ in range(5):
        try:
            with client.stream('GET', url, headers=headers, follow_redirects=False) as response:
                if response.status_code in (301, 302, 303, 307, 308):
                    location = response.headers.get('location', '')
                    parsed = urlsplit(location)
                    if parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.githubusercontent.com') or parsed.username or parsed.password:
                        raise StartupError('GitHub returned an unsupported asset redirect.')
                    url = location
                    # Signed CDN URLs carry their own authorization. Never forward the PAT.
                    headers = {'Accept': 'application/octet-stream'}
                    continue
                if response.status_code != 200:
                    raise StartupError(f'GitHub asset download failed (HTTP {response.status_code}); check repository access and asset ID.')
                digest, size = hashlib.sha256(), 0
                with destination.open('wb') as handle:
                    for chunk in response.iter_bytes():
                        size += len(chunk)
                        if size > MAX_ASSET_BYTES:
                            raise StartupError('GitHub asset exceeds the download size limit.')
                        digest.update(chunk)
                        handle.write(chunk)
                if digest.hexdigest() != expected:
                    raise StartupError('GitHub asset SHA-256 mismatch; server will not start.')
                return
        except httpx.HTTPError:
            # Do not include signed URLs, response bodies or request headers in errors.
            raise StartupError('GitHub asset request failed or timed out.') from None
    raise StartupError('Too many GitHub asset redirects.')


def prepare_models(env=None, root=None, client=None):
    model_dir = Path(MODEL_ROOT if root is None else root)
    model_dir.mkdir(parents=True, exist_ok=True)
    missing = [name for name, digest in EXPECTED.items()
               if not (model_dir / name).is_file() or hashlib.sha256((model_dir / name).read_bytes()).hexdigest() != digest]
    if not missing:
        return
    repository, token, ids = artifact_config(os.environ if env is None else env)
    # Download and verify every needed file before replacing any production artifact.
    with tempfile.TemporaryDirectory(prefix='.assets-', dir=model_dir) as directory:
        staging = Path(directory)
        def fetch(active_client):
            for name in missing:
                download_asset(active_client, repository, ids[name], token, staging / name, EXPECTED[name])
        if client is None:
            with httpx.Client(timeout=httpx.Timeout(180, connect=15), trust_env=False) as active:
                fetch(active)
        else:
            fetch(client)
        for name in missing:
            (staging / name).replace(model_dir / name)



# Only immutable model bytes/resources can be shared between sessions.
import pickle
import threading

_MODEL_LOCK = threading.RLock()


def ensure_models(config=None):
    """Use verified local cache, or provision from private GitHub release assets."""
    config = config or {}
    if not hasattr(config, 'get'):
        raise StartupError('Secrets nlp_models harus berupa tabel konfigurasi model privat.')
    keys = {
        'GITHUB_MODEL_REPOSITORY': 'repository',
        'GITHUB_MODEL_TOKEN': 'read_token',
        'GITHUB_MODEL_ASSET_ID': 'model_asset_id',
        'GITHUB_VECTORIZER_ASSET_ID': 'vectorizer_asset_id',
    }
    env = {key: os.environ.get(key) or str(config.get(field, '')) for key, field in keys.items()}
    with _MODEL_LOCK:
        try:
            prepare_models(env=env)
        except StartupError as exc:
            raise StartupError('Model NLP belum siap. Periksa secrets nlp_models (repository, read_token, model_asset_id, vectorizer_asset_id). ' + str(exc)) from None
        load_artifacts()


def load_artifacts():
    """Hash is checked before each unpickle; each processing call gets its own objects."""
    from zahir_dashboard.nlp_core.predict import validate_inference_artifacts
    with _MODEL_LOCK:
        payloads = {}
        for name, expected in EXPECTED.items():
            path = MODEL_ROOT / name
            if not path.is_file():
                raise StartupError('Model NLP tidak tersedia. Konfigurasikan model privat di secrets nlp_models.')
            payloads[name] = path.read_bytes()
            if hashlib.sha256(payloads[name]).hexdigest() != expected:
                raise StartupError('Hash artefak NLP tidak sesuai: ' + name)
        model = pickle.loads(payloads['best_model.pkl'])
        vectorizer = pickle.loads(payloads['tfidf_vectorizer.pkl'])
        validate_inference_artifacts(model, vectorizer)
        return model, vectorizer
