# Laporan integrasi NLP langsung di Streamlit

## Perubahan

NLP WhatsApp sekarang memanggil fungsi Python lokal, bukan /api/upload atau
/api/analyze lewat HTTP. nlp_backend.process_zip membungkus fungsi ingestion,
inference_pipeline dan AnalyticsService overview/issues yang sudah berjalan pada
nlp_zahir. Paket zahir_dashboard/nlp_core dan config disertakan dalam repo
sehingga deployment tidak mengakses folder sibling. PROVENANCE.md menjelaskan
asal dan penyesuaian. Login/RPC/izin Supabase dan dua halaman lain tidak diubah.

Model produksi dipasang privat pada .cache/nlp_models, dipin hash sebelum
unpickle dan dicek kecocokannya. Cold start Cloud dapat mengunduh release assets
GitHub privat melalui nlp_models pada secrets. Ini hanya provisioning artefak;
ZIP dan hasil NLP tidak dikirim ke HTTP/backend mana pun. Semua data pengguna
hanya berada di workspace sementara per submission dan ringkasan session_state.

## Pengujian yang benar-benar dijalankan

Environment dashboard sendiri, Python 3.11.9:

- Instalasi requirements.txt pada .venv dashboard: berhasil; scikit-learn 1.8.0,
  NumPy 2.4.4, SciPy 1.17.1, pandas 3.0.5, indo-normalizer 1.2.0. Pip memberi
  peringatan sisa folder temporary paket Windows saat mengganti NumPy/pandas;
  versi terpasang benar dan pip check bersih.
- unittest discover -s tests -v dari root dashboard: **27/27 lulus**, tanpa skip.
- Fixture WhatsApp_Uji_Sintetis_Zahir.zip: **3 percakapan dan 3 kendala**.
  Seluruh field overview/issues (kecuali ID dinamis) sama dengan snapshot hasil
  FastAPI untuk ZIP sintetis yang sama, tersimpan pada fixture JSON aman.
- AppTest memproses ZIP nyata dengan semua HTTP diblokir: KPI/grafik tampil,
  pindah halaman mempertahankan hasil, ZIP rusak mempertahankan hasil sukses,
  browser/sesi baru tidak menerima hasil sesi sebelumnya, logout membersihkan.
- Dua pemrosesan bersamaan: ZIP penuh 3/3 dan ZIP satu chat 1/1. UUID/workspace
  berbeda; file sementara dibersihkan sesudah sukses maupun kegagalan pipeline.
- Fit TF-IDF/fit classifier dilarang pada tes inferensi; tidak ada training ulang.
- Model privat diverifikasi hash sebelum/sesudah: tidak berubah. Tidak ada
  penggunaan output global produksi atau penulisan ke repo nlp_zahir.
- Tes provisioning model: redirect CDN tidak membawa PAT, cache tervalidasi,
  hash salah ditolak sebelum unpickle/publikasi pasangan. Tidak mengakses repo
  GitHub privat nyata; transport provisioning diuji memakai mock.
- pip check: No broken requirements found.
- pip download --only-binary untuk Linux x86_64/Python 3.11: seluruh dependency
  requirements.txt berhasil di-resolve dan wheel diunduh (manylinux). Tidak ada
  dependency yang memerlukan source build pada pemeriksaan ini.
- Instalasi/runtime Linux dan Community Cloud sebenarnya belum dijalankan.

Dua kegagalan suite lama backend (tes pembaca CSV BOM dan filter conversations)
tidak dipanggil suite dashboard dan tidak dinyatakan diperbaiki. Core analytics
ringkasan memakai pandas.read_csv dan hanya overview/issues yang dibutuhkan UI.

Log hanya lokal dan diabaikan Git: .release-test/local-nlp-tests-final.log,
local-nlp-install.log, linux-wheel-check.log. Tidak ada secrets atau chat asli
pada source/fixture yang disiapkan; fixture sosial tetap sintetis.

## Penghalang deployment yang masih konkret

Pada instance Cloud baru cache model tidak ikut Git. Empat field berikut belum
tersedia pada konfigurasi yang diperiksa:
- nlp_models.repository
- nlp_models.read_token
- nlp_models.model_asset_id
- nlp_models.vectorizer_asset_id

Sediakan kedua aset pada GitHub Release dalam repository privat dan PAT Contents:
Read-only, lalu isi App settings > Secrets seperti README. Alternatif environment
GITHUB_MODEL_* juga didukung. Tanpa model cache valid atau konfigurasi tersebut,
halaman menampilkan error model dan NLP tidak bisa memproses. Ini bukan masalah
localhost/FastAPI. Keberadaan/izin aset privat nyata belum dapat diverifikasi.

Wheel Linux tersedia pada resolusi yang diuji; smoke test runtime Cloud tetap
perlu dilakukan dengan Python 3.11. Mapping role default khusus peserta demo;
untuk pengirim sebenarnya gunakan nlp_roles privat agar identifikasi role sesuai.
Tidak ada alasan dependency yang diketahui menghalangi build pada pemeriksaan ini.

Tidak ada commit, push, deployment atau perubahan Supabase pada pekerjaan ini.
