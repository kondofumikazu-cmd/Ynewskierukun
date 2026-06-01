import json
import re
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RULES_PATH = ROOT / "Shared" / "rules.json"
MANIFEST_PATH = ROOT / "Extension" / "Resources" / "manifest.json"
GENERATED_CONFIG_PATH = ROOT / "Extension" / "Resources" / "generated_config.js"
CONTENT_BLOCKER_PATH = ROOT / "ContentBlocker" / "blockerList.json"


class RulesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rules = json.loads(RULES_PATH.read_text(encoding="utf-8"))

    def test_selector_groups_are_present_and_unique(self):
        for key in [
            "supportedHosts",
            "staticHideSelectors",
            "mobileYahooHideSelectors",
            "keywordScopes",
            "keywordCards",
            "keywordArticleLinks",
            "keywordHeadlines",
            "keywordPendingScopes",
        ]:
            values = self.rules.get(key)
            self.assertIsInstance(values, list, key)
            self.assertGreater(len(values), 0, key)
            self.assertEqual(len(values), len(set(values)), key)

    def test_network_tokens_are_present_and_unique(self):
        network = self.rules.get("networkBlock")
        self.assertIsInstance(network, dict)
        for key in ["domains", "tokens"]:
            values = network.get(key)
            self.assertIsInstance(values, list, key)
            self.assertGreater(len(values), 0, key)
            self.assertEqual(len(values), len(set(values)), key)
        self.assertTrue(set(network["domains"]).issubset(set(self.rules["supportedHosts"])))

    def test_manifest_loads_required_content_helpers_before_content_script(self):
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        scripts = manifest["content_scripts"][0]["js"]
        expected = [
            "generated_config.js",
            "keyword_utils.js",
            "keyword_matcher.js",
            "content_lifecycle.js",
            "content.js",
        ]
        for item in expected:
            self.assertIn(item, scripts)
        self.assertEqual([scripts.index(item) for item in expected], sorted(scripts.index(item) for item in expected))

    def test_generated_config_matches_keyword_rule_source(self):
        source = GENERATED_CONFIG_PATH.read_text(encoding="utf-8")
        match = re.search(r"Object\.freeze\((\{.*\})\);", source, re.S)
        self.assertIsNotNone(match)
        config = json.loads(match.group(1))
        for key in [
            "supportedHosts",
            "keywordScopes",
            "keywordCards",
            "keywordArticleLinks",
            "keywordHeadlines",
        ]:
            self.assertEqual(config[key], self.rules[key])

    def test_content_blocker_rules_stay_within_generator_limits(self):
        blocker = json.loads(CONTENT_BLOCKER_PATH.read_text(encoding="utf-8"))
        self.assertGreater(len(blocker), 1)
        css_rules = [item for item in blocker if item.get("action", {}).get("type") == "css-display-none"]
        self.assertGreater(len(css_rules), 0)
        for rule in css_rules:
            selector = rule["action"]["selector"]
            self.assertLessEqual(len([item for item in selector.split(",") if item.strip()]), 5)

    def test_generated_files_are_current(self):
        result = subprocess.run(
            ["python3", "Tools/generate_rules.py", "--check"],
            cwd=ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
