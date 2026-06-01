import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class DocsTests(unittest.TestCase):
    def test_public_docs_do_not_contain_merge_conflict_markers(self):
        for path in (ROOT / "docs").glob("*.html"):
            text = path.read_text(encoding="utf-8")
            for marker in ["<<<<<<<", "=======", ">>>>>>>"]:
                self.assertNotIn(marker, text, str(path.relative_to(ROOT)))

    def test_support_contact_points_to_email(self):
        support = (ROOT / "docs" / "support.html").read_text(encoding="utf-8")
        self.assertIn("kondofumikazu@icloud.com までご連絡ください。", support)
        self.assertIn("please email kondofumikazu@icloud.com.", support)
        self.assertNotIn("このkondofumikazu@icloud.com", support)
        self.assertNotIn("Issuesから", support)


if __name__ == "__main__":
    unittest.main()
