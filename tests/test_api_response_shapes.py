"""TIC oracle: validate critical API response shapes against JSON schemas.

The schemas in docs/schemas/ are the frontend-owned contract for the
backend boundary. We validate the test mock fixtures against the schemas
so that drift between the mock and the documented contract is caught.

This complements test_api_params.py's field-level checks (which read the
backend's openapi.yaml) by exercising the frontend's *own* expectation of
the response shape.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from conftest import (  # noqa: E402
    DEFAULT_ARIA2_GET_GLOBAL_OPTION,
    DEFAULT_ARIA2_GET_OPTION,
    DEFAULT_ARIA2_OPTION_TIERS,
    DEFAULT_BANDWIDTH,
    DEFAULT_BANDWIDTH_PROBE,
    DEFAULT_DECLARATION,
    DEFAULT_DOWNLOADS_ARCHIVE,
    DEFAULT_HEALTH,
    DEFAULT_LIFECYCLE,
    DEFAULT_LOG,
    DEFAULT_PEERS,
    DEFAULT_SCHEDULER,
    DEFAULT_SESSIONS,
    DEFAULT_SESSIONS_STATS,
    DEFAULT_STATUS,
    DEFAULT_TORRENTS,
)

SCHEMA_DIR = Path(__file__).resolve().parents[1] / "docs" / "schemas"

# (schema_filename, mock_fixture, fixture_label)
SHAPE_CASES = [
    ("api-status.schema.json", DEFAULT_STATUS, "DEFAULT_STATUS"),
    ("api-declaration.schema.json", DEFAULT_DECLARATION, "DEFAULT_DECLARATION"),
    ("api-lifecycle.schema.json", DEFAULT_LIFECYCLE, "DEFAULT_LIFECYCLE"),
    ("api-log.schema.json", DEFAULT_LOG, "DEFAULT_LOG"),
    ("api-scheduler.schema.json", DEFAULT_SCHEDULER, "DEFAULT_SCHEDULER"),
    ("api-bandwidth.schema.json", DEFAULT_BANDWIDTH, "DEFAULT_BANDWIDTH"),
    ("api-sessions.schema.json", DEFAULT_SESSIONS, "DEFAULT_SESSIONS"),
    (
        "api-sessions-stats.schema.json",
        DEFAULT_SESSIONS_STATS,
        "DEFAULT_SESSIONS_STATS",
    ),
    ("api-torrents.schema.json", DEFAULT_TORRENTS, "DEFAULT_TORRENTS"),
    ("api-peers.schema.json", DEFAULT_PEERS, "DEFAULT_PEERS"),
    (
        "api-aria2-get-option.schema.json",
        DEFAULT_ARIA2_GET_OPTION,
        "DEFAULT_ARIA2_GET_OPTION",
    ),
    (
        "api-aria2-get-global-option.schema.json",
        DEFAULT_ARIA2_GET_GLOBAL_OPTION,
        "DEFAULT_ARIA2_GET_GLOBAL_OPTION",
    ),
    (
        "api-aria2-option-tiers.schema.json",
        DEFAULT_ARIA2_OPTION_TIERS,
        "DEFAULT_ARIA2_OPTION_TIERS",
    ),
    (
        "api-downloads-archive.schema.json",
        DEFAULT_DOWNLOADS_ARCHIVE,
        "DEFAULT_DOWNLOADS_ARCHIVE",
    ),
    ("api-health.schema.json", DEFAULT_HEALTH, "DEFAULT_HEALTH"),
    (
        "api-bandwidth-probe.schema.json",
        DEFAULT_BANDWIDTH_PROBE,
        "DEFAULT_BANDWIDTH_PROBE",
    ),
]


def _load_schema(name: str) -> dict:
    return json.loads((SCHEMA_DIR / name).read_text(encoding="utf-8"))


def _validator(schema: dict):
    jsonschema = pytest.importorskip("jsonschema")
    return jsonschema.Draft202012Validator(schema)


@pytest.mark.parametrize(
    "schema_name,mock,label", SHAPE_CASES, ids=[c[0] for c in SHAPE_CASES]
)
def test_mock_matches_schema(schema_name: str, mock: dict, label: str) -> None:
    """Each mock fixture must validate against its frontend-owned schema."""
    schema = _load_schema(schema_name)
    validator = _validator(schema)
    errors = sorted(validator.iter_errors(mock), key=lambda e: list(e.path))
    assert not errors, f"{label} does not match {schema_name}:\n" + "\n".join(
        f"  - {list(e.path)}: {e.message}" for e in errors
    )


@pytest.mark.parametrize("schema_name", [c[0] for c in SHAPE_CASES])
def test_schema_is_well_formed(schema_name: str) -> None:
    """Every shape schema must itself be a valid JSON-Schema 2020-12 document."""
    schema = _load_schema(schema_name)
    jsonschema = pytest.importorskip("jsonschema")
    jsonschema.Draft202012Validator.check_schema(schema)


def test_fake_backend_status_matches_schema() -> None:
    """FakeBackend in test_download_lifecycle.py builds /api/status dynamically.
    Its output must validate against api-status.schema.json so behavior tests
    exercise the same contract as static fixtures.
    """
    from test_download_lifecycle import FakeBackend  # noqa: E402

    backend = FakeBackend()
    backend.add_items(
        [{"url": "https://example.com/a.iso"}, {"url": "https://example.com/b.iso"}]
    )
    backend.run_action("start")
    snapshot = backend.status()

    schema = _load_schema("api-status.schema.json")
    validator = _validator(schema)
    errors = sorted(validator.iter_errors(snapshot), key=lambda e: list(e.path))
    assert not errors, (
        "FakeBackend.status() does not match api-status.schema.json:\n"
        + "\n".join(f"  - {list(e.path)}: {e.message}" for e in errors)
    )
