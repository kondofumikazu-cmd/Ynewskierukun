import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "Extension" / "Resources" / "_locales"
POPUP_JS = ROOT / "Extension" / "Resources" / "popup.js"
MANIFEST = ROOT / "Extension" / "Resources" / "manifest.json"


def message_keys(locale):
    data = json.loads((LOCALES / locale / "messages.json").read_text(encoding="utf-8"))
    return set(data.keys()), data


def popup_fallback_keys():
    source = POPUP_JS.read_text(encoding="utf-8")
    match = re.search(r"var fallbackMessages = \{(.*?)\n  \};", source, re.S)
    if not match:
        return set()
    return set(re.findall(r"^\s{4}([a-zA-Z0-9_]+):", match.group(1), re.M))


def manifest_message_keys():
    manifest = MANIFEST.read_text(encoding="utf-8")
    return set(re.findall(r"__MSG_([a-zA-Z0-9_]+)__", manifest))


class LocaleTests(unittest.TestCase):
    def test_locale_keys_match_popup_fallbacks_and_manifest(self):
        ja_keys, _ = message_keys("ja")
        en_keys, _ = message_keys("en")
        required = popup_fallback_keys() | manifest_message_keys()
        self.assertEqual(ja_keys, en_keys)
        self.assertTrue(required.issubset(ja_keys), sorted(required - ja_keys))

    def test_locale_placeholder_sets_match(self):
        _, ja = message_keys("ja")
        _, en = message_keys("en")
        for key in sorted(set(ja) & set(en)):
            ja_placeholders = set(re.findall(r"\$[A-Z]+\$", ja[key].get("message", "")))
            en_placeholders = set(re.findall(r"\$[A-Z]+\$", en[key].get("message", "")))
            self.assertEqual(ja_placeholders, en_placeholders, key)


if __name__ == "__main__":
    unittest.main()
