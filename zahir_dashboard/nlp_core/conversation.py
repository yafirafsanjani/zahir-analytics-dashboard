"""
conversation.py - Pembentukan Unit Percakapan (Fase 5)

Membaca chat_with_roles.csv, menganalisis jeda waktu antar pesan,
mengelompokkan pesan menjadi conversation threads berdasarkan
threshold jeda waktu, lalu menyimpan ke chat_with_conversations.csv.

Langkah:
1. Analisis distribusi jeda waktu antar pesan per file
2. Tentukan threshold pemisah percakapan
3. Assign conversation_id ke setiap pesan
4. Validasi hasil pembentukan percakapan
"""

import csv
from pathlib import Path
from collections import Counter
from datetime import datetime, timedelta


BASE_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
INPUT_FILE = PROCESSED_DIR / "chat_with_roles.csv"
OUTPUT_FILE = PROCESSED_DIR / "chat_with_conversations.csv"

THRESHOLD_HOURS = None


def load_csv(filepath):
    """Baca CSV dan kembalikan list of dict."""
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def parse_datetime(tanggal, waktu):
    """Konversi tanggal DD/MM/YY dan waktu HH.MM ke datetime object."""
    try:
        return datetime.strptime(f"{tanggal} {waktu}", "%d/%m/%y %H.%M")
    except ValueError:
        return None


def print_header(title):
    """Cetak header section."""
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.


def analyze_time_gaps(data):
    """Analisis distribusi jeda waktu antar pesan per file.

    Menghitung jeda waktu antara setiap pesan berturut-turut
    dalam satu file, lalu menampilkan distribusinya.
    """
    print_header("LANGKAH 1: ANALISIS JEDA WAKTU ANTAR PESAN")

    files = {}
    for row in data:
        fname = row["source_file"]
        if fname not in files:
            files[fname] = []
        files[fname].append(row)

    all_gaps_minutes = []

    for fname, rows in sorted(files.items()):
        pass  # Per-upload diagnostics are not logged by the dashboard.
        gaps = []
        prev_dt = None

        for row in rows:
            dt = parse_datetime(row["tanggal"], row["waktu"])
            if dt and prev_dt:
                gap = dt - prev_dt
                gap_minutes = gap.total_seconds() / 60
                if gap_minutes >= 0:
                    gaps.append(gap_minutes)
                    all_gaps_minutes.append(gap_minutes)
            if dt:
                prev_dt = dt

        if not gaps:
            pass  # Per-upload diagnostics are not logged by the dashboard.
            continue

        brackets = [
            (0, 1, "0-1 menit"),
            (1, 5, "1-5 menit"),
            (5, 15, "5-15 menit"),
            (15, 30, "15-30 menit"),
            (30, 60, "30-60 menit"),
            (60, 120, "1-2 jam"),
            (120, 360, "2-6 jam"),
            (360, 720, "6-12 jam"),
            (720, 1440, "12-24 jam"),
            (1440, 4320, "1-3 hari"),
            (4320, 10080, "3-7 hari"),
            (10080, 43200, "1-4 minggu"),
            (43200, float("inf"), "> 1 bulan"),
        ]

        pass  # Per-upload diagnostics are not logged by the dashboard.
        pass  # Per-upload diagnostics are not logged by the dashboard.
        pass  # Per-upload diagnostics are not logged by the dashboard.
        pass  # Per-upload diagnostics are not logged by the dashboard.
        pass  # Per-upload diagnostics are not logged by the dashboard.
        pass  # Per-upload diagnostics are not logged by the dashboard.
        for low, high, label in brackets:
            count = sum(1 for g in gaps if low <= g < high)
            if count > 0:
                pct = count / len(gaps) * 100
                bar = "#" * int(pct / 2)
                pass  # Per-upload diagnostics are not logged by the dashboard.

    print_header("RINGKASAN JEDA WAKTU (SEMUA FILE)")

    if not all_gaps_minutes:
        pass  # Per-upload diagnostics are not logged by the dashboard.
        return all_gaps_minutes

    sorted_gaps = sorted(all_gaps_minutes)
    total = len(sorted_gaps)

    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    percentiles = [50, 75, 90, 95, 99]
    pass  # Per-upload diagnostics are not logged by the dashboard.
    for p in percentiles:
        idx = int(total * p / 100)
        if idx >= total:
            idx = total - 1
        val = sorted_gaps[idx]
        pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    threshold_candidates = [1, 2, 3, 4, 6, 8, 12, 24]
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    files_for_sim = {}
    for row in data:
        fname = row["source_file"]
        if fname not in files_for_sim:
            files_for_sim[fname] = []
        files_for_sim[fname].append(row)

    for hours in threshold_candidates:
        threshold_min = hours * 60
        total_convs = 0
        total_msgs = 0

        for fname, rows in files_for_sim.items():
            conv_count = 1
            prev_dt = None
            for row in rows:
                dt = parse_datetime(row["tanggal"], row["waktu"])
                if dt and prev_dt:
                    gap = (dt - prev_dt).total_seconds() / 60
                    if gap >= threshold_min:
                        conv_count += 1
                if dt:
                    prev_dt = dt
            total_convs += conv_count
            total_msgs += len(rows)

        avg_msgs = total_msgs / total_convs if total_convs > 0 else 0
        pass  # Per-upload diagnostics are not logged by the dashboard.

    return all_gaps_minutes


def assign_conversations(data, threshold_hours):
    """Assign conversation_id ke setiap pesan berdasarkan threshold.

    Aturan:
    - Pesan SYSTEM di awal file (sebelum pesan pertama CLIENT/ADMIN)
      mendapat conversation_id tersendiri
    - Pesan pertama non-SYSTEM di file = mulai percakapan baru
    - Jika jeda ke pesan berikutnya >= threshold -> percakapan baru
    - Format: chat_1_conv_001, chat_1_conv_002, dst.
    """
    threshold_min = threshold_hours * 60

    files = {}
    for row in data:
        fname = row["source_file"]
        if fname not in files:
            files[fname] = []
        files[fname].append(row)

    for fname, rows in sorted(files.items()):
        chat_name = Path(fname).stem
        conv_num = 0
        prev_dt = None

        for row in rows:
            dt = parse_datetime(row["tanggal"], row["waktu"])

            if row["role"] == "SYSTEM":
                if conv_num == 0:
                    conv_num = 1
                row["conversation_id"] = f"{chat_name}_conv_{conv_num:03d}"
                continue

            if prev_dt is None:
                conv_num += 1 if conv_num == 0 else 0
                if conv_num == 0:
                    conv_num = 1
            elif dt and prev_dt:
                gap = (dt - prev_dt).total_seconds() / 60
                if gap >= threshold_min:
                    conv_num += 1

            row["conversation_id"] = f"{chat_name}_conv_{conv_num:03d}"

            if dt:
                prev_dt = dt

    return data


def save_to_csv(data, output_path):
    """Simpan list of dict ke CSV dengan kolom conversation_id."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "id", "conversation_id", "source_file", "tanggal", "waktu",
        "pengirim", "role", "percakapan", "media_type", "media_path",
        "has_media",
    ]
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)
    return output_path


def validate(data):
    """Validasi hasil pembentukan percakapan."""
    print_header("VALIDASI HASIL PEMBENTUKAN PERCAKAPAN")

    total = len(data)
    conv_ids = set(row["conversation_id"] for row in data)
    total_convs = len(conv_ids)

    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    conv_per_file = {}
    for row in data:
        fname = row["source_file"]
        conv_id = row["conversation_id"]
        if fname not in conv_per_file:
            conv_per_file[fname] = set()
        conv_per_file[fname].add(conv_id)

    pass  # Per-upload diagnostics are not logged by the dashboard.
    for fname, convs in sorted(conv_per_file.items()):
        msgs_in_file = sum(1 for row in data if row["source_file"] == fname)
        pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    conv_sizes = Counter(row["conversation_id"] for row in data)
    sizes = list(conv_sizes.values())
    sizes_sorted = sorted(sizes)

    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    brackets = [
        (1, 1, "1 pesan"),
        (2, 5, "2-5 pesan"),
        (6, 15, "6-15 pesan"),
        (16, 30, "16-30 pesan"),
        (31, 50, "31-50 pesan"),
        (51, float("inf"), "> 50 pesan"),
    ]
    pass  # Per-upload diagnostics are not logged by the dashboard.
    for low, high, label in brackets:
        count = sum(1 for s in sizes if low <= s <= high)
        if count > 0:
            pct = count / len(sizes) * 100
            pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    no_conv = sum(1 for row in data if not row.get("conversation_id"))
    pass  # Per-upload diagnostics are not logged by the dashboard.

    single_msg_convs = [cid for cid, count in conv_sizes.items() if count == 1]
    if single_msg_convs:
        pass  # Per-upload diagnostics are not logged by the dashboard.
        for cid in single_msg_convs[:10]:
            row = next(r for r in data if r["conversation_id"] == cid)
            pesan = row["percakapan"][:60]
            pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    conv_roles = {}
    for row in data:
        cid = row["conversation_id"]
        if cid not in conv_roles:
            conv_roles[cid] = set()
        conv_roles[cid].add(row["role"])

    admin_only = sum(1 for roles in conv_roles.values() if roles == {"ADMIN"})
    client_only = sum(1 for roles in conv_roles.values() if roles == {"CLIENT"})
    system_only = sum(1 for roles in conv_roles.values() if roles == {"SYSTEM"})
    both = sum(1 for roles in conv_roles.values() if "ADMIN" in roles and "CLIENT" in roles)

    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.


def run_analyze():
    """Jalankan hanya analisis jeda waktu (sebelum menentukan threshold)."""
    if not INPUT_FILE.exists():
        pass  # Per-upload diagnostics are not logged by the dashboard.
        pass  # Per-upload diagnostics are not logged by the dashboard.
        return

    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    data = load_csv(INPUT_FILE)
    pass  # Per-upload diagnostics are not logged by the dashboard.

    analyze_time_gaps(data)

    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.


def group_conversations(input_file=INPUT_FILE, output_file=OUTPUT_FILE, threshold_hours=4.0):
    """Fase 5: Pembentukan unit percakapan berdasarkan threshold jeda jam."""
    in_path = Path(input_file)
    out_path = Path(output_file) if output_file else None

    if not in_path.exists():
        pass  # Per-upload diagnostics are not logged by the dashboard.
        return []

    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    if out_path:
        pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    data = load_csv(in_path)
    pass  # Per-upload diagnostics are not logged by the dashboard.

    data = assign_conversations(data, threshold_hours)

    if out_path:
        output = save_to_csv(data, out_path)
        pass  # Per-upload diagnostics are not logged by the dashboard.

    validate(data)

    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    return data


def run(threshold_hours=None):
    """Jalankan pembentukan percakapan dengan threshold tertentu."""
    if threshold_hours is None:
        run_analyze()
        return
    group_conversations(INPUT_FILE, OUTPUT_FILE, threshold_hours)


if __name__ == "__main__":
    run()
