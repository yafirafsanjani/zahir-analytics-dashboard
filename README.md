# Zahir Analytics Dashboard

Aplikasi Streamlit dengan tiga halaman setelah login Supabase:
Segmentasi Pelanggan, Analisis Media Sosial, dan NLP WhatsApp.
Entry point: **app.py**. Versi Python rilis: **3.11** (lokal 3.11.9).

## Instalasi dan konfigurasi lokal

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

`requirements.txt` merujuk `requirements-dashboard.txt`. pandas dideklarasikan
langsung. Buat `.streamlit/secrets.toml` dari contoh hanya jika belum ada;
jangan menimpa secrets lokal yang sudah terisi. Contoh placeholder:

```toml
[supabase]
url = "https://YOUR_PROJECT.supabase.co"
publishable_key = "sb_publishable_REPLACE_WITH_PROJECT_PUBLIC_KEY"

[nlp]
api_base_url = "http://127.0.0.1:8000"
service_token = "REPLACE_WITH_THE_SAME_RANDOM_SERVICE_TOKEN"
```

Gunakan publishable key atau legacy anon key, bukan service-role/secret key.
Password pengguna diisi melalui form login, bukan disimpan pada secrets.
Gunakan proyek Supabase serta izin/RLS yang sudah tersedia; tidak perlu migrasi.
Segmentasi memeriksa `has_segmentation_access()` dan Media Sosial memeriksa
`has_social_analytics_access()`. NLP berada di balik login dashboard, tetapi
backend demo nlp-zahir-deploy memakai token antarlayanan, belum identitas/pemilik sesi pengguna.

Urutan konfigurasi URL FastAPI di `zahir_dashboard/nlp_backend.py`:
1. Environment `NLP_API_BASE_URL`.
2. Secrets `[nlp] api_base_url`.
3. Default `http://127.0.0.1:8000`.

URL harus berupa URL dasar tanpa akhiran `/api`. Untuk hosting gunakan HTTPS,
misalnya `https://YOUR_NLP_SERVICE.example`. Pastikan environment lama tidak
menimpa secrets hosting. Community Cloud tidak bisa mengakses localhost laptop.

```powershell
.\.venv\Scripts\python.exe -m streamlit run app.py
```

## Streamlit Community Cloud

Repository tujuan: `https://github.com/yafirafsanjani/zahir-analytics-dashboard.git`.
Pilih branch `main`, entry point `app.py`, Python **3.11**. Isi konfigurasi pada
App settings > Secrets menggunakan struktur contoh di atas dan nilai asli
proyek sendiri. URL `[nlp] api_base_url` diisi URL HTTPS backend yang sudah diuji.
Jangan commit secrets. Panduan urutan rilis: [RELEASE.md](RELEASE.md).

## Tes yang aman untuk repo publik

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Tes Supabase menggunakan fake client dan tidak menulis database. Fixture sosial
berasal dari `tests/synthetic_social.py`, seluruhnya dibuat oleh kode, tanpa
membaca handoff internal. Angka fixture berbeda dari snapshot asli sehingga
peringatan validasi snapshot pada tes sintetis adalah perilaku yang diharapkan.
Folder `social_analytics_handoff/` (CSV dan SQL salinan data) tetap di laptop dan
masuk `.gitignore`; tes maupun runtime dashboard tidak bergantung padanya.

Tes HTTP nyata opsional, hanya arahkan ke backend terisolasi/demo sintetis:

```powershell
$env:NLP_INTEGRATION_URL='http://127.0.0.1:8013'
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_nlp.py -v
```

Fixture ZIP: `tests/fixtures/WhatsApp_Uji_Sintetis_Zahir.zip`, 12 pesan buatan,
3 percakapan/kendala. AppTest menginjeksi file uploader dan pengguna tiruan;
HTTP serta pipeline analisis berjalan nyata. Jangan arahkan tes ke data asli.

## Uji manual

Login dengan akun berizin, buka tiga halaman, periksa KPI/filter/pencarian.
Di NLP WhatsApp, unggah fixture ZIP dan tekan Proses: harapkan 3 percakapan dan
3 kendala. Pindah halaman dan kembali: hasil tetap tampil. ZIP rusak harus
menampilkan error dan mempertahankan hasil sebelumnya. Logout membersihkan
sesi tampilan, tetapi tidak menghapus file hasil pada backend. Browser baru
memerlukan login dan tidak otomatis memulihkan hasil sesi browser sebelumnya.

## Token layanan NLP / Render

Isi secrets `[nlp] service_token` dengan secret acak minimal 32 karakter yang
sama dengan environment NLP_SERVICE_TOKEN pada FastAPI. Jangan pakai PAT GitHub
sebagai token ini. Semua empat panggilan NLP mengirim Authorization: Bearer,
tanpa menampilkan token di UI. Token salah menampilkan error dan mempertahankan
hasil terakhir. Hanya backend nlp-zahir-deploy yang mendapat mekanisme token baru;
backend pengembangan lama tidak diubah. Lihat ../nlp-zahir-deploy/RENDER.md untuk
startup unduhan aset privat dan konfigurasi Render. Untuk tes HTTP,
NLP_SERVICE_TOKEN pada environment proses tes harus sama dengan backend, selain
NLP_INTEGRATION_URL. Tidak perlu mengubah login atau konfigurasi Supabase.
