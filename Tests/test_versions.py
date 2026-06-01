import subprocess
import unittest
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


if __name__ == "__main__":
    unittest.main()
