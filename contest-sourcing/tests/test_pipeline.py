import importlib.util
import sys
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "pipeline.py"
spec = importlib.util.spec_from_file_location("pipeline", MODULE)
pipeline = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = pipeline
spec.loader.exec_module(pipeline)

class PipelineTests(unittest.TestCase):
    def test_normalize_url_removes_tracking(self):
        self.assertEqual(pipeline.normalize_url("https://www.example.com/a/?utm_source=x&ref=abc#frag"),
                         "https://example.com/a?ref=abc")

    def test_slugify(self):
        self.assertEqual(pipeline.slugify("Win $10,000! Now"), "win-10-000-now")

    def test_parse_date(self):
        self.assertEqual(pipeline.parse_date("October 31, 2027"), "2027-10-31")

    def test_frontend_and_review_fields_are_present(self):
        self.assertIn("image_url", pipeline.FIELDS)
        self.assertIn("status", pipeline.FIELDS)
        self.assertIn("review_status", pipeline.FIELDS)
        self.assertIn("source_url", pipeline.FIELDS)

    def test_all_six_categories_have_labels(self):
        self.assertEqual(len(pipeline.LABELS), 6)
        self.assertIn("technology", pipeline.LABELS)

if __name__ == "__main__":
    unittest.main()
