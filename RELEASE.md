# Rilis lokal demo sintetis

Status: persiapan lokal saja. Tidak ada commit, push, atau deployment otomatis.
Remote origin cocok dengan `https://github.com/yafirafsanjani/zahir-analytics-dashboard.git`.
Git lokal diinisialisasi pada branch main; belum ada commit.

## Isi rilis

Daftar file usulan commit ada di [RELEASE_FILES.txt](RELEASE_FILES.txt).
Termasuk app.py, paket zahir_dashboard, tiga modul halaman, manifest Python,
contoh secrets placeholder, dokumentasi, tes dan fixture sintetis.
Tidak ada perubahan alur login, pemeriksaan izin per halaman atau query Supabase.

Dikecualikan: `.venv/`, `.streamlit/secrets.toml`, `.env*` asli, cache/log,
`social_analytics_handoff/`, ekspor CSV/SQL/XLSX/Parquet, data dan hasil tes lokal.
Folder handoff tetap di laptop. Tes sosial sekarang membuat fixture sendiri dan
tidak membaca salinan data internal. ZIP fixture adalah data buatan.

## Validasi lokal yang dijalankan

- Python dashboard 3.11.9, requirements standar memuat pandas 3.1.1 secara eksplisit.
- `python -m unittest discover -s tests -v`: 24 tes, 23 lulus, 1 integrasi dilewati.
- Dengan NLP_INTEGRATION_URL=http://127.0.0.1:8013, suite test_nlp.py: 5/5 lulus.
- Tes integrasi mengunggah ZIP 12 pesan lewat HTTP ke backend terisolasi dan
  menampilkan 3 percakapan/kendala, menguji error ZIP/API, hasil lama dan logout.
- `python -m pip check`: lulus.
- Log hanya lokal: `.release-test/dashboard-tests.log`, `nlp-integration.log`.
- Instalasi Linux bersih belum diuji; pemilihan Python 3.11 dan uji build hosting
  masih diperlukan. Verifikasi login/izin Supabase nyata dilakukan manual.

## Langkah selanjutnya, dijalankan oleh pemilik repo

1. Tinjau RELEASE_FILES.txt dan `git status --short`. Pastikan tidak ada data asli.
2. Commit dan push dashboard setelah tinjauan:

```powershell
git add -- .gitignore .python-version .streamlit/secrets.toml.example README.md RELEASE.md RELEASE_FILES.txt requirements.txt requirements-dashboard.txt app.py zahir_dashboard tests
git diff --cached --name-status
git commit -m "Prepare synthetic demo Streamlit release"
git push -u origin main
```

3. Selesaikan tinjauan privasi/history backend di `../nlp_zahir/RELEASE.md`
   sebelum push backend; deploy backend lebih dahulu.
4. Setelah FastAPI HTTPS lolos health dan smoke sintetis, deploy Community Cloud:
   repo dashboard, branch main, entry point app.py, Python 3.11.
5. Isi Secrets Supabase dan `[nlp] api_base_url` dengan URL HTTPS backend.
   Environment NLP_API_BASE_URL memiliki prioritas di atas secrets.
6. Uji link dari incognito/browser lain: login akun berizin, buka tiga halaman,
   uji filter/pencarian, unggah ZIP fixture, tunggu 3 percakapan/kendala,
   pindah halaman dan kembali, uji ZIP rusak, lalu logout.

Demo harus memakai backend bersih berisi data sintetis saja. Login Streamlit
belum memberikan autentikasi atau pemeriksaan pemilik session_id pada FastAPI.
Jangan gunakan backend publik dengan data pelanggan asli sebelum kontrol akses
backend dan kebijakan penyimpanan/retensi disiapkan.
