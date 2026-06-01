import subprocess
import unittest
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class VersionTests(unittest.TestCase):
    def test_versions_are_consistent(self):
        result = subprocess.run(
            ["python3", "Tools/check_versions.py"],
            cwd=ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_appstore_release_note_versions_match_project(self):
        project = (ROOT / "project.yml").read_text(encoding="utf-8")
        match = re.search(r'MARKETING_VERSION:\s*"([^"]+)"', project)
        self.assertIsNotNone(match)
        marketing = match.group(1)
        appstore = (ROOT / "APPSTORE.md").read_text(encoding="utf-8")
        for platform in ["iOS", "macOS"]:
            self.assertIn(f"### {platform} {marketing}", appstore)


if __name__ == "__main__":
    unittest.main()
