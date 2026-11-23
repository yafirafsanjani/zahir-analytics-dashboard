"""Identify roles using synthetic participants from config/roles.demo.json."""

import csv
from pathlib import Path
from collections import Counter


BASE_DIR = Path(__file__).resolve().parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"
INPUT_FILE = PROCESSED_DIR / "chat_parsed.csv"
OUTPUT_FILE = PROCESSED_DIR / "chat_with_roles.csv"

def load_demo_role_map():
    import json
    path = BASE_DIR / 'config' / 'roles.demo.json'
    with path.open(encoding='utf-8') as handle:
        mapping = json.load(handle)
    if not isinstance(mapping, dict) or not mapping or any(
        not isinstance(name, str) or role not in {'ADMIN', 'CLIENT', 'SYSTEM'}
        for name, role in mapping.items()
    ):
        raise ValueError('Invalid synthetic role configuration')
    return mapping


ROLE_MAP = load_demo_role_map()


def load_csv(filepath):
    """Baca CSV dan kembalikan list of dict."""
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def assign_roles(data, role_map=None):
    """Tambahkan kolom 'role' ke setiap baris berdasarkan ROLE_MAP.

    Pengirim yang tidak ada di ROLE_MAP akan mendapat role 'UNKNOWN'.
    """
    unknown_senders = set()

    for row in data:
        pengirim = row["pengirim"]
        role = (ROLE_MAP if role_map is None else role_map).get(pengirim, None)

        if role is None:
            role = "UNKNOWN"
            unknown_senders.add(pengirim)

        row["role"] = role

    return data, unknown_senders


def save_to_csv(data, output_path):
    """Simpan list of dict ke CSV dengan kolom role."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "id", "source_file", "tanggal", "waktu", "pengirim", "role",
        "percakapan", "media_type", "media_path", "has_media",
    ]
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)
    return output_path


def validate(data_before, data_after, unknown_senders):
    """Validasi hasil penambahan role."""
    pass  # Per-upload diagnostics are not logged by the dashboard.

    total_before = len(data_before)
    total_after = len(data_after)
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    role_counts = Counter(row["role"] for row in data_after)
    pass  # Per-upload diagnostics are not logged by the dashboard.
    for role, count in role_counts.most_common():
        pct = count / total_after * 100
        pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    role_per_file = {}
    for row in data_after:
        key = (row["source_file"], row["role"])
        role_per_file[key] = role_per_file.get(key, 0) + 1
    pass  # Per-upload diagnostics are not logged by the dashboard.
    current_file = None
    for (fname, role), count in sorted(role_per_file.items()):
        if fname != current_file:
            pass  # Per-upload diagnostics are not logged by the dashboard.
            current_file = fname
        pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    pengirim_role = {}
    for row in data_after:
        pengirim = row["pengirim"]
        role = row["role"]
        if pengirim not in pengirim_role:
            pengirim_role[pengirim] = set()
        pengirim_role[pengirim].add(role)

    pass  # Per-upload diagnostics are not logged by the dashboard.
    for pengirim, roles in sorted(pengirim_role.items()):
        roles_str = ", ".join(sorted(roles))
        status = "OK" if len(roles) == 1 else "KONFLIK"
        pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    no_role = sum(1 for row in data_after if not row.get("role"))
    pass  # Per-upload diagnostics are not logged by the dashboard.

    if unknown_senders:
        pass  # Per-upload diagnostics are not logged by the dashboard.
        pass  # Per-upload diagnostics are not logged by the dashboard.
        for s in sorted(unknown_senders):
            pass  # Per-upload diagnostics are not logged by the dashboard.
        pass  # Per-upload diagnostics are not logged by the dashboard.
    else:
        pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.


def identify_roles(input_file=INPUT_FILE, output_file=OUTPUT_FILE, role_map=ROLE_MAP):
    """Fase 4: Identifikasi role Admin, Client, System."""
    in_path = Path(input_file)
    out_path = Path(output_file) if output_file else None

    if not in_path.exists():
        pass  # Per-upload diagnostics are not logged by the dashboard.
        return [], set()

    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    if out_path:
        pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    data_before = load_csv(in_path)
    pass  # Per-upload diagnostics are not logged by the dashboard.

    pass  # Per-upload diagnostics are not logged by the dashboard.
    for pengirim, role in sorted(role_map.items()):
        pass  # Per-upload diagnostics are not logged by the dashboard.

    data_after, unknown_senders = assign_roles(data_before, role_map=role_map)

    if out_path:
        output = save_to_csv(data_after, out_path)
        pass  # Per-upload diagnostics are not logged by the dashboard.

    validate(data_before, data_after, unknown_senders)

    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.
    pass  # Per-upload diagnostics are not logged by the dashboard.

    return data_after, unknown_senders


def run():
    """Jalankan Fase 4: assign role ke setiap pesan."""
    identify_roles(INPUT_FILE, OUTPUT_FILE, ROLE_MAP)


if __name__ == "__main__":
    run()
