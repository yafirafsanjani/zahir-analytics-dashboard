from decimal import Decimal
from types import SimpleNamespace as NS
import unittest
from unittest.mock import patch
from pathlib import Path

from streamlit.testing.v1 import AppTest
from zahir_dashboard.backend import (
    SegmentationRepository, DashboardError, settings_from_secrets,
    reference_checks, resolve_columns, resolve_optional_columns, escape_like,
)


class Query:
    def __init__(self, client, table):
        self.client, self.table_name = client, table
        self.filters, self.orders = [], []
        self.start, self.end = 0, 999
        self.fields = "*"
    def select(self, fields, **kwargs):
        self.fields = fields
        return self
    def eq(self, field, value):
        self.filters.append(("eq", field, value))
        return self
    def ilike(self, field, value):
        self.filters.append(("ilike", field, value))
        return self
    def order(self, field):
        self.orders.append(field)
        return self
    def limit(self, n):
        self.end = n - 1
        return self
    def range(self, start, end):
        self.start, self.end = start, end
        return self
    def execute(self):
        self.client.queries.append(self)
        rows = list(self.client.tables[self.table_name])
        for op, key, value in self.filters:
            if op == "eq":
                rows = [r for r in rows if r[key] == value]
            else:
                term = value[1:-1].replace("\\%", "%").replace("\\_", "_").replace("\\\\", "\\")
                rows = [r for r in rows if term.casefold() in r[key].casefold()]
        rows.sort(key=lambda r: tuple(r[x] for x in self.orders))
        count = len(rows)
        rows = rows[self.start:self.end + 1]
        if self.fields != "*":
            rows = [{k: r[k] for k in self.fields.split(",")} for r in rows]
        return NS(data=rows, count=count)


class FakeClient:
    def __init__(self, allowed=True, signed_in=True):
        self.allowed, self.signed_in, self.queries = allowed, signed_in, []
        summary = []
        for model, k, prefix in [("K-Means", 4, "C"), ("GMM", 3, "G3_C"), ("GMM", 4, "G4_C")]:
            for i in range(k):
                summary.append(dict(model=model, k=k, cluster_code=f"{prefix}{i+1}",
                                    nama_segmen="Segmen uji", jumlah_label=1456 if i == 0 else 0,
                                    total_Monetary_Rp="8225196662.39" if i == 0 else "0"))
        detail = [dict(nama_klien=f"Perusahaan Uji {i:04}", id_kelompok_faktur=f"F{i:05}",
                       tanggal_faktur="2026-07-08", grand_total_rp="100",
                       kmeans_k4_cluster="C1", gmm_k3_cluster="G3_C1", gmm_k4_cluster="G4_C1")
                  for i in range(60)]
        self.tables = dict(segment_summary=summary, faktur_lolos_dengan_klaster=detail)
        self.auth = NS(get_session=self.session, get_user=lambda: NS(user=NS(id="test")),
                       refresh_session=lambda: NS(session=self.session()),
                       sign_in_with_password=self.login, sign_out=self.sign_out)
        self.postgrest = NS(auth=lambda token: None)
    def session(self):
        return NS(access_token="synthetic", expires_at=9999999999) if self.signed_in else None
    def login(self, credentials):
        self.signed_in = True
        return NS(session=self.session())
    def sign_out(self, options):
        self.signed_in = False
    def schema(self, schema):
        assert schema == "public"
        return self
    def table(self, name):
        return Query(self, name)
    def rpc(self, name):
        data = self.allowed if name == "has_segmentation_access" else [
            dict(invoice_count=60, customer_count=30, total_grand_total="6000", unique_invoice_count=60)]
        return NS(execute=lambda: NS(data=data))


class BackendTests(unittest.TestCase):
    def test_models_and_kpi_not_double_counted(self):
        client = FakeClient()
        repo = SegmentationRepository(client)
        repo.authorize()
        choices = repo.discover_models()
        self.assertEqual([c.key for c in choices], ["kmeans_k4", "gmm_k3", "gmm_k4"])
        for choice in choices:
            summary = repo.summary(choice)
            self.assertTrue(all(x["Sesuai"] for x in reference_checks(summary)))
            self.assertIn(("eq", "model", choice.raw_model), client.queries[-1].filters)
            self.assertIn(("eq", "k", choice.k), client.queries[-1].filters)

    def test_server_search_pagination_selected_cluster(self):
        client = FakeClient()
        repo = SegmentationRepository(client)
        choice = repo.discover_models()[1]
        repo.discover_detail(choice)
        first = repo.detail_page(choice, "", 0, 25)
        second = repo.detail_page(choice, "", 1, 25)
        self.assertEqual(first.count, 60)
        self.assertEqual(len(first.rows), 25)
        self.assertNotEqual(first.rows[0], second.rows[0])
        self.assertEqual(client.queries[-1].orders, ["id_kelompok_faktur"])
        self.assertEqual(client.queries[-1].start, 25)
        self.assertIn("gmm_k3_cluster", client.queries[-1].fields)
        repo.detail_page(choice, "Uji %_", 0, 25)
        self.assertIn(("ilike", "nama_klien", "%Uji \\%\\_%"), client.queries[-1].filters)

    def test_rfm_summary_uses_actual_invoice_groups(self):
        client = FakeClient()
        client.tables["faktur_lolos_dengan_klaster"] = [
            dict(nama_klien="A", id_kelompok_faktur="F1", tanggal_faktur="2026-07-01", grand_total_rp="100",
                 kmeans_k4_cluster="C1", gmm_k3_cluster="G3_C1", gmm_k4_cluster="G4_C1"),
            dict(nama_klien="A", id_kelompok_faktur="F2", tanggal_faktur="2026-07-10", grand_total_rp="300",
                 kmeans_k4_cluster="C1", gmm_k3_cluster="G3_C1", gmm_k4_cluster="G4_C1"),
            dict(nama_klien="B", id_kelompok_faktur="F3", tanggal_faktur="2026-07-05", grand_total_rp="200",
                 kmeans_k4_cluster="C2", gmm_k3_cluster="G3_C2", gmm_k4_cluster="G4_C2"),
        ]
        repo = SegmentationRepository(client)
        rfm = repo.rfm_summary(repo.discover_models()[0])
        self.assertEqual(rfm["C1"], {"recency": 0.0, "frequency": 2.0, "rfm_monetary": Decimal("400"), "companies": 1, "invoices": 2})
        self.assertEqual(rfm["C2"], {"recency": 5.0, "frequency": 1.0, "rfm_monetary": Decimal("200"), "companies": 1, "invoices": 1})

    def test_access_and_schema_fail_closed(self):
        with self.assertRaises(DashboardError):
            SegmentationRepository(FakeClient(False)).authorize()
        with self.assertRaises(DashboardError):
            resolve_columns({}, {"model": ("model",)})
        self.assertEqual(resolve_columns({"TOTAL_MONETARY_RP": 0}, {"money": ("total_Monetary_Rp",)}),
                         {"money": "TOTAL_MONETARY_RP"})
        with self.assertRaises(DashboardError):
            settings_from_secrets({"supabase": {"url": "https://example.supabase.co", "publishable_key": "sb_secret_test"}})
        self.assertEqual(escape_like("a%_"), "a\\%\\_")

    def test_optional_summary_fields_honor_live_column_overrides(self):
        client = FakeClient()
        for row in client.tables["segment_summary"]:
            row.update(
                custom_recency=30,
                custom_frequency=3,
                custom_monetary=2000,
                custom_silhouette=0.5,
                custom_davies_bouldin=0.7,
                custom_calinski_harabasz=100,
            )
        repo = SegmentationRepository(client, {"segment_summary": {
            "recency": "custom_recency",
            "frequency": "custom_frequency",
            "rfm_monetary": "custom_monetary",
            "silhouette": "custom_silhouette",
            "davies_bouldin": "custom_davies_bouldin",
            "calinski_harabasz": "custom_calinski_harabasz",
        }})
        choice = repo.discover_models()[0]
        summary = repo.summary(choice)
        self.assertEqual(summary[0]["recency"], 30)
        self.assertEqual(summary[0]["frequency"], 3)
        self.assertEqual(summary[0]["rfm_monetary"], 2000)
        self.assertEqual(summary[0]["silhouette"], 0.5)
        self.assertEqual(summary[0]["davies_bouldin"], 0.7)
        self.assertEqual(summary[0]["calinski_harabasz"], 100)
        self.assertEqual(
            resolve_optional_columns({"RECENCY_MEAN": 1}, {"recency": ("recency_mean",)}),
            {"recency": "RECENCY_MEAN"},
        )
        with self.assertRaises(DashboardError):
            resolve_optional_columns({"a": 1}, {"recency": ("recency_mean",)}, {"recency": "missing"})

    def test_optional_summary_fields_read_notebook_median_columns(self):
        client = FakeClient()
        for row in client.tables["segment_summary"]:
            row.update(median_Recency_hari=30, median_Frequency=3, median_Monetary_Rp=2000)
        repo = SegmentationRepository(client)
        summary = repo.summary(repo.discover_models()[0])
        self.assertEqual(summary[0]["recency"], 30)
        self.assertEqual(summary[0]["frequency"], 3)
        self.assertEqual(summary[0]["rfm_monetary"], 2000)


class UITests(unittest.TestCase):
    def test_client_options_without_network(self):
        client = FakeClient(signed_in=False)
        app = AppTest.from_file(str(Path(__file__).resolve().parents[1] / "app.py"), default_timeout=30)
        app.secrets["supabase"] = dict(url="https://example.supabase.co", publishable_key="sb_publishable_test")
        with patch("supabase.create_client", return_value=client) as create:
            app.run()
        self.assertEqual(len(app.exception), 0)
        options = create.call_args.kwargs["options"]
        from supabase.lib.client_options import SyncClientOptions
        self.assertIsInstance(options, SyncClientOptions)
        self.assertFalse(options.auto_refresh_token)
        self.assertFalse(options.persist_session)
        self.assertEqual(len(app.metric), 0)

    def test_company_search_resets_page(self):
        app = self.app(FakeClient()).run()
        app.button(key="next_page").click().run()
        self.assertEqual(app.session_state["invoice_page"], 1)
        app.text_input[0].input("Uji 0001")
        next(b for b in app.button if b.label == "Cari perusahaan").click().run()
        self.assertEqual(len(app.exception), 0)
        self.assertEqual(app.session_state["invoice_page"], 0)
        self.assertTrue(any("dari 1 kelompok" in x.value for x in app.caption))
        self.assertTrue(app.button(key="next_page").disabled)
        app.run()
        app.text_input[0].input("Tidak ada perusahaan ini")
        next(b for b in app.button if b.label == "Cari perusahaan").click().run()
        self.assertTrue(any("Tidak ada faktur" in x.value for x in app.info))

    def app(self, client):
        app = AppTest.from_file(str(Path(__file__).resolve().parents[1] / "app.py"), default_timeout=20)
        app.secrets["supabase"] = dict(url="https://example.supabase.co", publishable_key="sb_publishable_test")
        app.session_state["_supabase_client"] = client
        return app

    def test_switch_models_and_pagination(self):
        client = FakeClient()
        app = self.app(client).run()
        self.assertEqual(len(app.exception), 0)
        self.assertEqual(app.metric[0].value, "1.456")
        self.assertEqual(app.selectbox(key="model_key").value, "kmeans_k4")
        app.button(key="next_page").click().run()
        self.assertEqual(app.session_state["invoice_page"], 1)
        app.selectbox(key="model_key").select("gmm_k3").run()
        self.assertEqual(len(app.exception), 0)
        self.assertEqual(app.session_state["invoice_page"], 0)
        self.assertEqual(app.metric[0].value, "1.456")
        self.assertEqual(next(m.value for m in app.metric if m.label == 'Klaster'), "3")
        app.selectbox(key="model_key").select("gmm_k4").run()
        self.assertEqual(next(m.value for m in app.metric if m.label == 'Klaster'), "4")

    def test_unauthorized_never_reads_tables(self):
        client = FakeClient(False)
        app = self.app(client).run()
        self.assertEqual(len(app.exception), 0)
        self.assertEqual(client.queries, [])
        self.assertTrue(any("izin" in x.value for x in app.error))

    def test_login_and_logout(self):
        client = FakeClient(signed_in=False)
        app = self.app(client).run()
        self.assertEqual(len(app.metric), 0)
        app.text_input[0].input("internal@example.test")
        app.text_input[1].input("synthetic-password")
        app.button[0].click().run()
        self.assertEqual(len(app.exception), 0)
        self.assertEqual(app.metric[0].value, "1.456")
        next(b for b in app.button if b.label == "Keluar").click().run()
        self.assertEqual(len(app.metric), 0)
        self.assertFalse(client.signed_in)

    def test_missing_detail_setup(self):
        client = FakeClient()
        original = client.rpc
        def rpc(name):
            if name == "segmentation_invoice_totals":
                class MissingRPC(Exception):
                    code = "PGRST202"
                def fail():
                    raise MissingRPC("synthetic")
                return NS(execute=fail)
            return original(name)
        client.rpc = rpc
        app = self.app(client).run()
        self.assertEqual(len(app.exception), 0)
        self.assertTrue(any("detail belum lengkap" in x.value for x in app.warning))
        self.assertTrue(any(q.table_name == "faktur_lolos_dengan_klaster" for q in client.queries))

    def test_missing_secrets(self):
        app = AppTest.from_file(str(Path(__file__).resolve().parents[1] / "app.py"), default_timeout=30)
        # Isolate from synthetic secrets installed by earlier AppTest runs.
        with patch("streamlit.secrets", {}):
            app.run()
        self.assertEqual(len(app.exception), 0)
        self.assertGreater(len(app.error), 0)


if __name__ == "__main__":
    unittest.main()
