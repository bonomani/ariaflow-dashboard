from __future__ import annotations

import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from aria_queue.cli import build_parser as legacy_build_parser  # noqa: E402
from ariaflow_web.cli import build_parser as canonical_build_parser  # noqa: E402


class CliCompatibilityTests(unittest.TestCase):
    def test_legacy_cli_parser_matches_canonical_defaults(self) -> None:
        legacy_args = legacy_build_parser().parse_args([])
        canonical_args = canonical_build_parser().parse_args([])

        self.assertEqual(legacy_args.host, canonical_args.host)
        self.assertEqual(legacy_args.port, canonical_args.port)
