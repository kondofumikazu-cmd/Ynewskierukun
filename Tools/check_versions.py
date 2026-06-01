#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "project.yml"
MANIFEST = ROOT / "Extension" / "Resources" / "manifest.json"


def single_value(pattern, text, label):
    values = re.findall(pattern, text)
    if len(values) != 1:
        raise ValueError(f"{label} must appear exactly once, found {len(values)}")
    return values[0]


def main():
    project = PROJECT.read_text(encoding="utf-8")
    marketing = single_value(r'MARKETING_VERSION:\s*"([^"]+)"', project, "MARKETING_VERSION")
    build = single_value(r"CURRENT_PROJECT_VERSION:\s*([0-9]+)", project, "CURRENT_PROJECT_VERSION")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    manifest_version = manifest.get("version")
    if manifest_version != marketing:
        print(
            f"manifest version {manifest_version!r} does not match MARKETING_VERSION {marketing!r}",
            file=sys.stderr,
        )
        return 1

    if not build.isdigit() or int(build) <= 0:
        print(f"CURRENT_PROJECT_VERSION must be a positive integer, got {build!r}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
