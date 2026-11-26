# Zahir Analytics Dashboard (Next.js + TypeScript)

Aplikasi analitik bisnis Zahir yang telah dimigrasikan dari Streamlit ke **Next.js 14 (App Router) + TypeScript**, dengan antarmuka bertema **Stitch** (Tailwind CSS), visualisasi **Recharts**, dan autentikasi berbasis sesi cookie via **Supabase SSR (`@supabase/ssr`)**.

Aplikasi ini siap di-deploy ke **Vercel** dan terhubung langsung ke proyek Supabase yang sudah aktif.

---

## Modul Aktif

Sesuai arsitektur migrasi terbaru, dashboard hanya memuat 2 modul utama:

1. **Segmentasi Pelanggan (`/segmentasi`)**:
   - Mendukung 3 model klastering: **K-Means (k=4)**, **GMM (k=3)**, dan **GMM (k=4)**.
   - Tiga tab analitik: **Ikhtisar Segmen**, **Perbandingan Model**, dan **Detail Faktur**.
   - Metrik RFM lengkap (Recency, Frequency, Monetary), metrik evaluasi model (Silhouette, Davies–Bouldin, Calinski–Harabasz jika tersedia), pencarian faktur real-time, pagination, dan ekspor CSV aman (kebijakan anti formula injection & UTF-8 BOM untuk Excel).
   - Pengecekan validasi snapshot acuan (1.456 pelanggan, 2.874 kelompok faktur, Rp8.225.196.662,39).

2. **Analisis Media Sosial (`/medsos`)**:
   - Tiga tab komprehensif: **Play Store**, **Instagram**, serta **Evaluasi & Eksplorasi**.
   - Analisis sentimen ulasan Google Play, rating, identifikasi 8 aspek keluhan/fitur, tren waktu ulasan, dan ringkasan eksekutif.
   - Performa konten Instagram (likes, komentar, format postingan, rasio kolaborasi, heatmap hari & jam WIB, korelasi caption & hashtag, dan tabel top postingan).
   - Tab Evaluasi: benchmark model sentimen (IndoBERT, InSet Lexicon, TF-IDF + LR, Majority baseline), interactive 3x3 confusion matrix heatmap, klaster topik eksploratif K-Means k=4, diagnostik silhouette k=3–6, serta tabel kualitas data & cakupan.
   - Pengecekan snapshot acuan (417 ulasan Play Store, 234 pasangan aspek, 55 postingan Instagram, 13.147 interaksi).

> **Catatan NLP WhatsApp**: Modul WhatsApp NLP telah dipisahkan dari rute navigasi dan dependensi runtime dashboard produksi. Riwayat implementasi NLP tetap tersimpan utuh dalam riwayat Git (commit `80711e1` dan sebelumnya) sehingga dapat digunakan kembali sebagai repositori atau layanan terpisah kapan pun diperlukan.

---

## Prasyarat Lingkungan

- **Node.js**: Versi 18.17.0 atau lebih baru (direkomendasikan Node.js v20 LTS atau v24).
- **npm**: Versi 9 atau lebih baru.
- Akun dan kredensial Supabase aktif (URL & Publishable/Anon Key).

---

## Panduan Instalasi Lokal (PowerShell)

Jalankan perintah berikut di PowerShell dari direktori root proyek:

```powershell
# 1. Pastikan dependensi JavaScript/Node terpasang
npm install

# 2. Siapkan file konfigurasi lingkungan lokal
Copy-Item .env.example .env.local

# 3. Edit .env.local dan isi kredensial Supabase Anda
notepad .env.local

# 4. Jalankan server pengembangan lokal (hot-reload)
npm run dev
```

Buka peramban di [http://localhost:3000](http://localhost:3000). Aplikasi akan otomatis mengarahkan ke `/login` jika belum terautentikasi, atau `/segmentasi` jika sesi sudah aktif.

---

## Konfigurasi Lingkungan (`.env.local`)

File `.env.local` digunakan untuk menyimpan kredensial lokal dan sudah dimasukkan ke `.gitignore` agar tidak bocor ke Git.

Format file `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here

# Opsional: Jika menggunakan legacy anon key
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> **Keamanan Kredensial**:
> - Jangan pernah memasukkan `service_role` key ke dalam file `.env.local` atau kode sumber.
> - Dashboard beroperasi dengan identitas pengguna login (`authenticated` role) sehingga seluruh aturan Row Level Security (RLS) dan RPC perizinan (`has_segmentation_access`, `has_social_analytics_access`) ditegakkan langsung oleh server database.

---

## Verifikasi Kualitas Kode & Pengujian

Aplikasi telah dilengkapi rangkaian pengujian otomatis, type-checking, linter, dan production build runner:

```powershell
# 1. Jalankan pemeriksaan tipe statis TypeScript
npm run typecheck

# 2. Jalankan linter ESLint
npm run lint

# 3. Jalankan suite pengujian unit dan integrasi (Node.js test runner)
npm run test

# 4. Uji pembuatan production bundle Next.js
npm run build

# 5. Jalankan server production lokal untuk evaluasi performa
npm run start
```

---

## Panduan Deployment ke Vercel

Aplikasi ini siap di-deploy ke Vercel tanpa perlu konfigurasi kustom tambahan:

1. **Import Repositori**:
   - Masuk ke dashboard [Vercel](https://vercel.com).
   - Klik **Add New Project** dan pilih repositori `zahir-analytics-dashboard`.
   - Pilih branch yang akan di-deploy (misalnya `migrasi` atau `main` setelah merge disetujui).

2. **Pengaturan Project**:
   - **Framework Preset**: `Next.js` (terdeteksi otomatis).
   - **Root Directory**: `./` (root repositori).
   - **Build Command**: `npm run build` atau `next build`.
   - **Output Directory**: `.next` (otomatis).

3. **Environment Variables**:
   Tambahkan environment variables berikut pada pengaturan Vercel (**Settings > Environment Variables**):
   - `NEXT_PUBLIC_SUPABASE_URL` = Nilai URL Supabase proyek Anda.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = Nilai publishable key / anon key Supabase proyek Anda.

4. **Deploy**:
   - Klik **Deploy**.
   - Vercel akan menjalankan build Next.js, memproses static optimization, dan meluncurkan App Router beserta Edge/Node middleware secara otomatis.

---

## Kebersihan Repositori

Dalam proses migrasi ini:
- Folder Streamlit terpisah `segmentation_dashboard/` telah dihapus dari repositori kerja.
- Entry point Streamlit lama (`app.py`, `requirements.txt`, `requirements-dashboard.txt`) telah dibersihkan.
- Seluruh riwayat komit Git tetap terjaga.