"""Validate docs/ucc-declarations.yaml against its JSON schema.

Catches malformed edits to the UCC declaration artifact (e.g. mistyped
preference names, count out of sync with known_unused).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
UCC_YAML = REPO_ROOT / "docs" / "ucc-declarations.yaml"
UCC_SCHEMA = REPO_ROOT / "docs" / "schemas" / "ucc-declarations.schema.json"


def test_ucc_declarations_match_schema() -> None:
    yaml = pytest.importorskip("yaml")
    jsonschema = pytest.importorskip("jsonschema")

    data = yaml.safe_load(UCC_YAML.read_text(encoding="utf-8"))
    schema = json.loads(UCC_SCHEMA.read_text(encoding="utf-8"))

    jsonschema.Draft202012Validator.check_schema(schema)
    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(data), key=lambda e: list(e.path))
    assert not errors, "ucc-declarations.yaml does not match its schema:\n" + "\n".join(
        f"  - {list(e.path)}: {e.message}" for e in errors
    )


def test_known_unused_count_matches_dict_length() -> None:
    """Cross-check the stability guard against the dict it guards."""
    yaml = pytest.importorskip("yaml")
    data = yaml.safe_load(UCC_YAML.read_text(encoding="utf-8"))
    assert data["known_unused_expected_count"] == len(data["known_unused"]), (
        f"known_unused_expected_count ({data['known_unused_expected_count']}) "
        f"!= len(known_unused) ({len(data['known_unused'])})"
    )
