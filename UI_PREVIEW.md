# Revisi UI berdasarkan ekspor Google Stitch

## Referensi

Arsip `C:\Users\Yafi Rafsanjani H\Downloads\stitch_zahir_analytics_ui_design(1).zip`
berhasil dibaca: ketiga screen.png/code.html dan zahir_analytics/DESIGN.md.
Screenshot referensi adalah layout mobile (291 / 313 / 289 px). Desktop diadaptasi
menggunakan grid DESIGN.md; tidak ada screenshot desktop tambahan dalam arsip.
Salinan referensi dan screenshot pengujian hanya berada dalam .release-test/.

## Preview

```powershell
Set-Location -LiteralPath 'D:\FILE KULIAH\semester 5\magang\zahir-analytics-dashboard'
.\.venv\Scripts\python.exe -m streamlit run app.py --server.port 8502
```

Buka http://localhost:8502. Server preview di-restart setelah ditemukan cache modul
UI lama yang menyebabkan error impor. Kode terbaru dimuat dan halaman login diperiksa;
pengguna mungkin perlu login kembali. Jika port sudah dipakai, cukup buka URL.
Tidak ada push, deploy, atau perubahan Supabase.

## Implementasi dan aksi nyata

- Shell bersama: Inter, kanvas slate terang, kartu putih 8 px, aksen #D2231C,
  badge data aktual, fokus/hover, sidebar desktop/drawer native dan navigasi bawah
  mobile yang mengubah halaman melalui session state. Keluar tetap tersedia.
- Segmentasi: pemilih algoritma tersegmentasi dan Konfigurasi tersinkronisasi;
  periode/referensi hanya bila tersedia. Tab Ikhtisar Segmen, Perbandingan Model,
  Detail Faktur memiliki state. Tombol perbandingan/detail mengaktifkan tab tujuan.
- Urutan ikhtisar: Total Pelanggan Terklaster, Klaster, Total Nilai; batang horizontal
  jumlah/persentase pelanggan; grafik vertikal nilai/kontribusi transaksi; kartu RFM;
  strip evaluasi model dan aksi. M=miliar, Jt=juta; nilai tepat ada pada tooltip/tabel.
- Detail Faktur: pencarian server, filter klaster, pagination, validasi notebook.
  Ekspor default halaman aktif; pilihan seluruh hasil pencarian memeriksa authorize,
  count dan keunikan ID, mengikuti model/pencarian/klaster dan RLS pengguna.
- Play Store: filter periode/aplikasi/rating/sentimen dalam popover, reset, tiga KPI
  termasuk sentimen dominan, tren garis, track horizontal aspek dan batang horizontal
  bertumpuk sentimen ulasan yang menyebut aspek. Distribusi rating/sentimen tetap ada.
- Ulasan Terkini: kartu metadata aktual; Lihat Semua membuka daftar terfilter dan
  unduhan. Ringkasan Instagram memakai data aktual; Buka Tab memilih Instagram.
  Analisis Instagram serta Evaluasi & Eksplorasi tetap tersedia.
- NLP: Data Historis (Cloud) default saat dikonfigurasi; tujuh tab sesuai referensi.
  Filter Cepat NLP/reset; track kategori, cincin Respons Klien, batang bertumpuk
  penanganan per kategori termasuk status belum diketahui, serta kartu percakapan.
- Tambah Data: drag/drop ZIP, siap, spinner proses, berhasil/gagal, Unggah File Lain,
  Tinjau Data. Hasil sukses per sesi; kegagalan tidak menghapus hasil terakhir.
  Tinjau Data memilih hasil unggahan/detail, tidak mengklaim menggabungkan ke cloud.

## Verifikasi

- Suite: 35 tes, log .release-test/stitch-tests-final.log. Mencakup auth/RLS/logout,
  pagination/pencarian, sinkronisasi model, aksi tab, filter/reset, ekspor, error,
  ZIP sintetis, model lokal nyata, isolasi hasil dan pembersihan file sementara.
- Chrome headless: desktop 1440 px dan mobile 390/311 px; pemilih GMM, perbandingan,
  detail/unduhan CSV, navigasi mobile, Lihat Semua ulasan, Buka Tab Instagram,
  evaluasi, detail/remote NLP, unggah ZIP, Tinjau Data. Harness auth/data sintetis
  terpisah di port 8503; app.py produksi tidak memiliki bypass login.
- Upload ZIP sintetis dengan model lokal aktual: 3 kendala / 3 percakapan.
- Historis privat dibaca aktual lalu diuji melalui UI dengan otorisasi test double:
  559 kendala / 348 percakapan pada rentang penuh.
- Login Supabase nyata oleh agent belum diuji; preview produksi menampilkan login.
- Secrets asli dan LOCAL_NLP_REPORT.md tidak berubah berdasarkan SHA-256.
  Tidak ada token atau isi chat mentah dalam screenshot; semua screenshot sintetis.

## Perbedaan dan kebutuhan data

1. Slot RFM dan Silhouette/Davies-Bouldin/Calinski-Harabasz tetap ada dengan tanda
   kosong bila kolom belum tersedia. Diperlukan agregat RFM per klaster yang jelas,
   skor eksperimen, atau matriks fitur/preprocessing dan label eksperimen yang sama.
   Nama perusahaan tidak dijadikan identitas pelanggan untuk menghitung ulang RFM.
2. Periode/tanggal referensi ditandai belum tersedia jika summary tidak memuatnya
   secara konsisten. Tanggal contoh Stitch tidak dipakai.
3. Tabel social_playstore_reviews tidak mengandung teks ulasan atau versi aplikasi.
   Kartu memakai tanggal/rating/sentimen/aspek/aplikasi dan slot informasi kosong.
   Teks/versi memerlukan ekspor/tabel terizin dengan kolom tambahan. Tidak ada
   perubahan skema maupun CSV privat sebagai fallback pada tahap ini.
4. NLP mengukur respons, bukan kepuasan/resolusi. Label tetap Respons Klien.
   Pelanggan memakai kode sumber, bukan nama/avatar mockup. Durasi hanya dihitung
   bila kedua waktu tersedia dan urutannya valid. Tidak mengarang jenis aplikasi
   remote, operator, enkripsi praproses, atau status sinkronisasi cloud.
5. Input tanggal, popover, uploader, tabel dan scrolling tab mempertahankan native
   Streamlit; tinggi/animasi/detail tipografi tidak identik dengan HTML statis.
   Filter Play Store dapat digeser horizontal. Tidak ada badge demo, pertumbuhan
   palsu, atau klaim model optimal tanpa data pembanding.

## File

app.py; zahir_dashboard/segmentation_page.py, backend.py, social_page.py,
nlp_page.py, ui.py, ui.css; .streamlit/config.toml; tes dashboard/sosial/NLP/desain;
laporan ini. Tidak ada dependency runtime baru. Perubahan sebelumnya dipertahankan;
tidak melakukan stage/commit/push/deploy.
