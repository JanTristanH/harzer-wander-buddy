import csv
import importlib.util
from pathlib import Path
import tempfile
import json
import subprocess
import sys
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "export-public-stamps.py"
SPEC = importlib.util.spec_from_file_location("public_stamps", SCRIPT)
exporter = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(exporter)


class PublicCatalogueTest(unittest.TestCase):
    def setUp(self):
        with (exporter.ROOT / exporter.SOURCE).open(encoding="utf-8") as stream:
            self.rows = list(csv.DictReader(stream))

    def export(self, rows):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "stamps.csv"
            with path.open("w", newline="", encoding="utf-8") as stream:
                writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
                writer.writeheader()
                writer.writerows(rows)
            return exporter.catalogue(path, "2026-10-20", "test-revision")

    def test_exports_all_numbers_and_excludes_private_state(self):
        for row in self.rows:
            row["stampedUsers"] = "PRIVATE USER"
            row["groupFilterStampings"] = "PRIVATE GROUP"
        stamps = self.export(self.rows)["stamps"]
        self.assertEqual([stamp["number"] for stamp in stamps], list(range(1, 223)))
        self.assertEqual(set(stamps[0]), {"id", "number", "name", "description", "latitude", "longitude", "validFrom", "validTo"})

    def test_csv_quoting_unicode_and_newlines_survive(self):
        self.rows[0]["description"] = 'Höhle, Wald und "Fels"\nZweite Zeile'
        stamp = next(s for s in self.export(self.rows)["stamps"] if s["id"] == self.rows[0]["ID"])
        self.assertEqual(stamp["description"], self.rows[0]["description"])

    def test_expired_and_future_rows_do_not_replace_current_stamp(self):
        for start, end in [("1970-01-01T00:00:00Z", "2026-10-20T00:00:00Z"),
                           ("2026-10-21T00:00:00Z", "2037-01-01T00:00:00Z")]:
            other = dict(self.rows[0], validFrom=start, validTo=end)
            self.assertEqual(len(self.export(self.rows + [other])["stamps"]), 222)

    def test_rejects_missing_duplicate_and_invalid_coordinates(self):
        for rows in [self.rows[1:], self.rows + [self.rows[0]],
                     [dict(self.rows[0], latitude="nan")] + self.rows[1:]]:
            with self.subTest(), self.assertRaises(ValueError):
                self.export(rows)

    def test_cli_exports_public_parking_and_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'catalogue.json'
            subprocess.run([sys.executable, str(SCRIPT), '--as-of', '2026-10-20', '--output', str(path)], check=True, capture_output=True)
            data = json.loads(path.read_text())
            self.assertTrue(data['parkingSpots'])
            self.assertEqual(len(data['source']['parkingSha256']), 64)
            self.assertTrue(all(set(row) == {'ID', 'name', 'description', 'latitude', 'longitude'} for row in data['parkingSpots']))


if __name__ == "__main__":
    unittest.main()
