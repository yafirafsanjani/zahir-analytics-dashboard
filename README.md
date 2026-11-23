# Zahir Analytics Dashboard

Streamlit dengan login Supabase dan tiga halaman: Segmentasi Pelanggan,
Analisis Media Sosial, NLP WhatsApp. Entry point **app.py**, Python **3.11**.
NLP WhatsApp sekarang memproses ZIP langsung dalam proses Streamlit, tanpa
FastAPI, localhost, Render, atau token layanan antaraplikasi.

## Instalasi lokal

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m streamlit run app.py
```

requirements.txt merujuk requirements-dashboard.txt. Paket inferensi CPU dipin:
scikit-learn 1.8.0, NumPy 2.4.4, SciPy 1.17.1, pandas 3.0.5,
indo-normalizer 1.2.0. Tidak memerlukan FastAPI/Uvicorn atau SDK LLM sebagai
komponen NLP lokal. Paket yang menjadi dependency Streamlit sendiri tetap
terpasang sesuai resolusi dependency.

Konfigurasi asli tetap pada .streamlit/secrets.toml (diabaikan Git). Jangan
menimpa file lokal yang sudah ada. Contoh placeholder tersedia pada
.streamlit/secrets.toml.example. Supabase tetap menggunakan:

```toml
[supabase]
url = "https://YOUR_PROJECT.supabase.co"
publishable_key = "sb_publishable_REPLACE_WITH_PROJECT_PUBLIC_KEY"
```

Gunakan publishable atau legacy anon key, bukan service-role/secret key.
Akun masuk lewat form login. Izin/RLS dan RPC Segmentasi/Media Sosial tetap
mengikuti proyek yang sudah berjalan; tidak ada perubahan Supabase.

## Model privat untuk NLP lokal dan Community Cloud

Dua pickle produksi tidak dimasukkan ke Git. Kode membaca cache privat lokal:
.cache/nlp_models/best_model.pkl dan .cache/nlp_models/tfidf_vectorizer.pkl.
Pasangan diperiksa SHA-256 sebelum unpickle dan divalidasi vocabulary/IDF serta
jumlah fiturnya. Tidak ada fit TF-IDF, split atau training pada jalur unggahan.

| File | SHA-256 |
| --- | --- |
| best_model.pkl | bb6dd03738b4a6c1595623c68abf3ed399932afa44655a0230d8a372972c29b5 |
| tfidf_vectorizer.pkl | 299a0b1454504d49ee3ee4ac707f92cd8fba4a04545d891c05e20ce04fa24acf |

Lokal: pasangan tepercaya dapat disalin secara privat ke cache tersebut.
Community Cloud: lampirkan kedua file ke GitHub Release pada **repository
private**, lalu isi App settings > Secrets:

```toml
[nlp_models]
repository = "OWNER/PRIVATE_MODEL_REPOSITORY"
read_token = "REPLACE_WITH_READ_ONLY_GITHUB_TOKEN"
model_asset_id = "REPLACE_WITH_NUMERIC_MODEL_ASSET_ID"
vectorizer_asset_id = "REPLACE_WITH_NUMERIC_VECTORIZER_ASSET_ID"
```

ID adalah ID masing-masing release asset, bukan release ID atau tag. Aset pada
repo publik bukan aset privat. Fine-grained PAT hanya untuk repo model privat,
Contents: Read-only. PAT hanya untuk provisioning model, tidak dikirim bersama
ZIP atau ke browser. Kode memakai GitHub API dan redirect CDN HTTPS tanpa
meneruskan PAT. Hash salah menghentikan proses, tanpa memuat pickle yang salah.

Jika hosting menyediakan environment, alternatif nama konfigurasinya adalah
GITHUB_MODEL_REPOSITORY, GITHUB_MODEL_TOKEN, GITHUB_MODEL_ASSET_ID,
GITHUB_VECTORIZER_ASSET_ID; environment memiliki prioritas di atas secrets.
Cache yang sudah valid tidak mengunduh ulang. Pada cache kosong, konfigurasi
private asset harus lengkap. Repo lain atau folder nlp_zahir tidak diperlukan
oleh aplikasi setelah deployment. Tidak ada model atau credential bawaan.

Konfigurasi lama NLP_API_BASE_URL, nlp.api_base_url dan nlp.service_token tidak
lagi dibaca. Tidak perlu mengubah secrets Supabase yang sudah valid.

## Pemrosesan dan isolasi

Fungsi inti disalin dari nlp_zahir ke zahir_dashboard/nlp_core dengan import
relatif ke namespace dashboard. Rantai proses: ingestion ZIP, parsing, role,
percakapan/respons/remote, kategori, preprocessing/normalisasi, inferensi produksi,
konsolidasi, lalu overview/issues dengan perhitungan yang sama seperti API lama.
Lihat zahir_dashboard/nlp_core/PROVENANCE.md untuk penyesuaian.

Setiap klik Proses membuat UUID sesi dan direktori sementara sendiri. Seluruh
chat, media, ZIP dan CSV intermediate/master dihapus ketika proses selesai atau
gagal. Hanya ringkasan hasil terakhir tersimpan pada session_state pengguna.
Tidak ada cache hasil/data pengguna bersama atau file global data/runs. Dua
unggahan bersamaan tidak berbagi workspace. Tidak ada redirect stdout global;
diagnostik yang memuat chat dinonaktifkan pada core salinan.

Widget biasa tidak mengulang pemrosesan. Unggahan gagal mempertahankan hasil
terakhir yang berhasil. Logout menghapus state hasil dan uploader. Browser/sesi
baru tidak otomatis melihat hasil pengguna lain. Restart Streamlit menghilangkan
hasil di memori. Cache model saja yang boleh dipakai bersama.

Mapping role default hanya berisi peserta demo sintetis dan SYSTEM. Untuk nama
pengirim sebenarnya, isi tabel privat [nlp_roles] di secrets, nilai ADMIN,
CLIENT, SYSTEM. Mapping diteruskan per panggilan tanpa mengubah global role map;
pengirim yang tidak dikenal tetap UNKNOWN sesuai perilaku core sebelumnya.
Jangan commit nama pelanggan pada contoh/source. Hasil role berbeda dapat
mempengaruhi teks keluhan yang dipakai model.

## Deployment Community Cloud

Repo dashboard/main, entry point app.py, Python 3.11. requirements.txt standar
menyediakan semua dependensi dan nlp_core/config ikut source. Isi secrets
Supabase dan nlp_models. Tidak perlu menjalankan backend lain. Model diunduh
secara privat ketika pertama kali Proses ditekan bila cache belum ada.

Pemeriksaan lokal berhasil meresolusikan dan mengunduh seluruh wheel untuk
Linux x86_64/Python 3.11 (manylinux), tanpa source build. Runtime Linux/Community
Cloud belum dijalankan pada persiapan ini. Model lokal tersedia dan cocok, namun
empat field nlp_models belum diisi pada konfigurasi lokal yang diperiksa. Pada
instance Cloud baru, kekurangan tersebut menghalangi NLP sampai private asset
beserta konfigurasinya tersedia. Tidak ada hambatan dependency yang ditemukan
pada pemeriksaan wheel; hasil ini bukan pengganti smoke test Cloud.

## Pengujian

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m pip check
```

Tes inferensi nyata memerlukan model privat pada cache di atas. Tanpa model,
tes tersebut skipped; jangan menganggap skip sebagai bukti inferensi berhasil.
Fixture tests/fixtures/WhatsApp_Uji_Sintetis_Zahir.zip berisi 12 pesan buatan;
hasil pembanding 3 percakapan dan 3 kendala. Tes lokal memblokir semua HTTP ketika
model siap, melarang fit/train, menguji unggahan bersamaan 3 vs 1 percakapan,
cleanup, browser/sesi baru, kegagalan, pergantian halaman dan logout.
Tes Supabase memakai fake client tanpa mengubah database. Handoff internal tidak
dibaca dan tetap diabaikan Git. Detail hasil: LOCAL_NLP_REPORT.md.
