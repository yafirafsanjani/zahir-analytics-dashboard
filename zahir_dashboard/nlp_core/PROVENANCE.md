# Asal core NLP dan perubahan untuk Streamlit

Sumber lokal yang ditelusuri: nlp_zahir/app/services/analysis_service.py untuk
upload dan analisis, src/ingestion/*.py, src/inference_pipeline.py serta modul
parsing/roles/conversation/client_response/remote/category_labeling/preprocessing/
normalization/predict/consolidation/taxonomy. Overview/issues memakai helper
AnalyticsService pada app/services/analytics_service.py.

Core disertakan sebagai source dashboard, tidak mengimpor proyek sibling.
Perubahan terbatas untuk integrasi:
- namespace src diganti zahir_dashboard.nlp_core;
- hanya helpers overview/issues analytics yang disertakan, tanpa FastAPI;
- model dibaca melalui nlp_assets, dipin hash sebelum unpickle, tanpa cache
  prediction/data pengguna;
- taxonomy dan mapping demo ada pada config paket; mapping pelanggan asli tidak
  disalin. nlp_roles privat dapat diteruskan per panggilan;
- diagnostic print yang dapat memuat chat diganti pass, tanpa global stdout
  redirection yang berbahaya untuk thread/sesi lain;
- jalur pipeline selalu menerima path workspace eksplisit; upload dan ringkasan
  dibungkus TemporaryDirectory oleh nlp_backend dan dihapus sesudah selesai/gagal;
- ZIP guard memeriksa batas uncompressed sebelum CRC/decompression dan containment
  path memakai Path.is_relative_to, bukan prefix string;
- pipeline training offline/fit/split tidak disertakan/dijalankan;
- uploader berakhir pada session_state ringkasan, bukan HTTP endpoint.

Rumus overview/issues tetap: unit kendala = sub_conversation_id unik,
percakapan = conversation_id unik, kategori memakai hasil ML, remote rate memakai
remote/(remote+non_remote), unknown dilaporkan terpisah, urutan kategori memakai
jumlah menurun lalu nama kategori. Respons ringkasan mempertahankan field API.
