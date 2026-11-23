"""Private artifact provisioning is separate from local upload processing."""
import hashlib
import secrets
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

import httpx
from zahir_dashboard import nlp_assets


class ModelAssetsTests(unittest.TestCase):
    def test_private_download_verifies_hash_and_never_forwards_pat_to_cdn(self):
        token = secrets.token_urlsafe(32)
        env = {'GITHUB_MODEL_REPOSITORY':'demo/private-models', 'GITHUB_MODEL_TOKEN':token,
               'GITHUB_MODEL_ASSET_ID':'101', 'GITHUB_VECTORIZER_ASSET_ID':'102'}
        payloads = {'best_model.pkl':b'model-fixture', 'tfidf_vectorizer.pkl':b'vectorizer-fixture'}
        expected = {name:hashlib.sha256(value).hexdigest() for name,value in payloads.items()}
        calls = []
        def handler(request):
            calls.append(request)
            if request.url.host == 'api.github.com':
                self.assertEqual(request.headers['Authorization'], 'Bearer '+token)
                return httpx.Response(302, headers={'Location':'https://release-assets.githubusercontent.com/'+request.url.path.split('/')[-1]})
            self.assertNotIn('Authorization', request.headers)
            name = 'best_model.pkl' if request.url.path == '/101' else 'tfidf_vectorizer.pkl'
            return httpx.Response(200, content=payloads[name])
        with tempfile.TemporaryDirectory() as folder, patch.object(nlp_assets, 'EXPECTED', expected), httpx.Client(transport=httpx.MockTransport(handler)) as client:
            nlp_assets.prepare_models(env=env, root=Path(folder), client=client)
            nlp_assets.prepare_models(env={}, root=Path(folder), client=client)
            self.assertEqual(len(calls),4)
            self.assertEqual((Path(folder)/'best_model.pkl').read_bytes(),payloads['best_model.pkl'])

    def test_bad_hash_prevents_unpickle_and_files_are_not_published(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(nlp_assets, 'MODEL_ROOT', Path(folder)):
            (Path(folder)/'best_model.pkl').write_bytes(b'wrong')
            with patch('pickle.loads') as load:
                with self.assertRaisesRegex(nlp_assets.StartupError, 'Hash'):
                    nlp_assets.load_artifacts()
                load.assert_not_called()
        env = {'GITHUB_MODEL_REPOSITORY':'demo/private-models','GITHUB_MODEL_TOKEN':secrets.token_urlsafe(32),
               'GITHUB_MODEL_ASSET_ID':'101','GITHUB_VECTORIZER_ASSET_ID':'102'}
        with tempfile.TemporaryDirectory() as folder, httpx.Client(transport=httpx.MockTransport(lambda request:httpx.Response(200,content=b'wrong'))) as client:
            with self.assertRaises(nlp_assets.StartupError):
                nlp_assets.prepare_models(env=env,root=Path(folder),client=client)
            self.assertFalse((Path(folder)/'best_model.pkl').exists())
            self.assertFalse((Path(folder)/'tfidf_vectorizer.pkl').exists())


if __name__ == '__main__': unittest.main()
