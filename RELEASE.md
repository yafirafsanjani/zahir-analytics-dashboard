# Rilis dashboard dengan NLP dalam proses Streamlit

Persiapan saat ini belum di-commit atau di-push. Branch main dan origin dashboard
masih sama. Daftar file: RELEASE_FILES.txt. Perubahan mengganti panggilan HTTP NLP
dengan core inferensi lokal; tidak memerlukan repo/backend FastAPI saat runtime.

Yang disertakan: app.py/paket dashboard, nlp_core dan konfigurasi kategori/demo,
nlp_assets untuk provisioning model privat, requirements, contoh secrets
placeholder dan tes sintetis. Tidak disertakan: model, secrets lokal, .cache,
chat asli, handoff internal, hasil atau log tes. .gitignore mencakup semuanya.

Langkah pemilik setelah meninjau perubahan dan tes:
1. Siapkan kedua release asset pada repo GitHub privat dan PAT read-only.
2. Isi nlp_models di secrets Cloud (lihat README), pertahankan secrets Supabase.
3. Tinjau git status/RELEASE_FILES.txt sebelum memilih file untuk commit/push.
4. Deploy repo dashboard/main/app.py dengan Python 3.11 dan requirements.txt.
5. Login akun berizin, buka tiga halaman, unggah ZIP sintetis sampai hasil 3/3,
   pindah halaman dan kembali, uji ZIP rusak lalu logout dari browser lain.

Tidak ada push/deploy atau perubahan Supabase pada tahap implementasi ini.
NLP_API_BASE_URL dan token layanan lama tidak diperlukan. Model tetap privat
melalui download yang dipin hash; bukan melalui repo Git atau backend localhost.
