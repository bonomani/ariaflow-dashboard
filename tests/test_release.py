from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "release.py"
SPEC = importlib.util.spec_from_file_location("release_script", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
release_script = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release_script)


class ReleaseScriptTests(unittest.TestCase):
    def test_next_release_version_bumps_stable_patch(self) -> None:
        self.assertEqual(release_script.next_release_version("0.1.17"), "0.1.18")

    def test_version_to_tag_uses_stable_tag_shape(self) -> None:
        self.assertEqual(release_script.version_to_tag("0.1.18"), "v0.1.18")

    def test_parse_version_rejects_prerelease_shape(self) -> None:
        with self.assertRaises(SystemExit):
            release_script.parse_version("0.1.18-alpha.1")


if __name__ == "__main__":
    unittest.main()
