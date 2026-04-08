"""Cross-check frontend-owned API schemas against the backend's openapi.yaml.

For each schema in docs/schemas/api-*.schema.json, walk every property name
the frontend declares and assert it appears somewhere in the backend's
OpenAPI spec. Failures indicate either backend OpenAPI under-specification
(file a backend gap) or a stale frontend schema (tighten the schema to
match what the frontend actually consumes).

Skipped when the backend openapi.yaml isn't available (e.g. CI without the
sibling repo).
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = REPO_ROOT / "docs" / "schemas"
BACKEND_OPENAPI = REPO_ROOT.parent / "ariaflow" / "src" / "aria_queue" / "openapi.yaml"

# Frontend schemas to cross-check. Each entry is just the schema filename;
# we walk it generically.
FRONTEND_SCHEMAS = [
    "api-status.schema.json",
    "api-declaration.schema.json",
    "api-lifecycle.schema.json",
    "api-log.schema.json",
    "api-scheduler.schema.json",
    "api-bandwidth.schema.json",
    "api-sessions.schema.json",
    "api-sessions-stats.schema.json",
    "api-torrents.schema.json",
    "api-peers.schema.json",
    "api-aria2-get-option.schema.json",
    "api-aria2-get-global-option.schema.json",
    "api-aria2-option-tiers.schema.json",
    "api-downloads-archive.schema.json",
    "api-health.schema.json",
    "api-bandwidth-probe.schema.json",
]


def _collect_property_names(node: object) -> set[str]:
    """Recursively collect every JSON-Schema property name found anywhere.

    Walks the entire structure (not just JSON-Schema keywords) so it can find
    `properties:` blocks nested inside OpenAPI path items, response objects,
    etc. Any dict whose key is `properties` contributes its sub-keys.
    """
    out: set[str] = set()
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "properties" and isinstance(value, dict):
                for prop_name, sub in value.items():
                    out.add(prop_name)
                    out |= _collect_property_names(sub)
            else:
                out |= _collect_property_names(value)
    elif isinstance(node, list):
        for sub in node:
            out |= _collect_property_names(sub)
    return out


def _all_openapi_field_names(spec: dict) -> set[str]:
    """Flatten every property name appearing anywhere in the OpenAPI spec.

    Loose intersection check: we don't care which schema owns a field, only
    that the backend acknowledges it somewhere. This is intentionally
    permissive — the frontend doesn't track per-endpoint provenance.
    """
    return _collect_property_names(spec)


@pytest.fixture(scope="module")
def backend_field_names() -> set[str]:
    if not BACKEND_OPENAPI.exists():
        pytest.skip(f"Backend openapi.yaml not at {BACKEND_OPENAPI}")
    yaml = pytest.importorskip("yaml")
    spec = yaml.safe_load(BACKEND_OPENAPI.read_text(encoding="utf-8"))
    return _all_openapi_field_names(spec)


# Frontend-only convenience fields the backend doesn't publish under these
# names. Listed explicitly so each waiver is auditable.
WAIVERS: dict[str, set[str]] = {
    # /api/status: 'actives' is a frontend-side flattening of active+items
    "api-status.schema.json": {"actives"},
    "api-declaration.schema.json": set(),
    "api-lifecycle.schema.json": set(),
    "api-log.schema.json": set(),
    "api-scheduler.schema.json": set(),
    "api-bandwidth.schema.json": set(),
    "api-sessions.schema.json": set(),
    "api-sessions-stats.schema.json": set(),
    "api-torrents.schema.json": set(),
    "api-peers.schema.json": set(),
    "api-aria2-get-option.schema.json": set(),
    "api-aria2-get-global-option.schema.json": set(),
    "api-aria2-option-tiers.schema.json": set(),
    "api-downloads-archive.schema.json": set(),
    "api-health.schema.json": set(),
    "api-bandwidth-probe.schema.json": set(),
}


@pytest.mark.parametrize("schema_name", FRONTEND_SCHEMAS)
def test_frontend_schema_fields_exist_in_backend_openapi(
    schema_name: str, backend_field_names: set[str]
) -> None:
    """Every property name in a frontend schema must appear in backend openapi.yaml.

    Failures mean either:
      (a) the backend's OpenAPI spec under-specifies the response — file a
          backend gap (BG-N) and add the field to WAIVERS until resolved, or
      (b) the frontend schema declares a field the frontend doesn't actually
          consume — tighten the schema to drop it.
    """
    schema = json.loads((SCHEMA_DIR / schema_name).read_text(encoding="utf-8"))
    frontend_fields = _collect_property_names(schema)
    waived = WAIVERS.get(schema_name, set())
    missing = sorted((frontend_fields - backend_field_names) - waived)
    assert not missing, (
        f"{schema_name}: {len(missing)} frontend field(s) absent from backend "
        f"openapi.yaml: {missing}\n"
        "Either add them to the backend OpenAPI spec, drop them from the "
        "frontend schema, or add them to WAIVERS with a clear reason."
    )
