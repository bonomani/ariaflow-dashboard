"""Live-backend contract test (slow-marked).

The dashboard's e2e suite uses mocked backend responses — fast and
hermetic, but blind to "shipped but deploy was stale" hazards (the
backend agent flagged this exact failure mode in BG-26). This test
hits a real ariaflow-server on 127.0.0.1:8000 and asserts every
contract the dashboard relies on still holds.

Skipped if no backend is reachable, so it doesn't break CI in
environments without one. Run explicitly with:

    pytest -m slow tests/test_backend_live_contract.py -v

Pinned contracts (paired backend gap):
- BG-37  openapi.yaml info.version == /api/version
- BG-31  /api/_meta exists, validates per-class shape
- BG-34  per-tab loader endpoints declared in /api/_meta
- BG-33  /api/status has no legacy aliases (state.paused, summary.stopped)
- BG-30  state.dispatch_paused exists, summary uses canonical names
- BG-29  /api/lifecycle records carry expected_running + managed_by
- BG-27  /api/lifecycle records carry installed/current/running axes
- BG-24  /api/status.health populated
- BG-21  /api/bandwidth lifts scalars to top level
- BG-19  /api/status.ariaflow-server has reachable/pid/version
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request

import pytest

pytestmark = pytest.mark.slow

BACKEND = "http://127.0.0.1:8000"


def _get_json(path: str) -> dict | None:
    try:
        resp = urllib.request.urlopen(f"{BACKEND}{path}", timeout=3)
    except (urllib.error.URLError, OSError):
        return None
    return json.loads(resp.read().decode())


def _get_text(path: str) -> str | None:
    try:
        resp = urllib.request.urlopen(f"{BACKEND}{path}", timeout=3)
    except (urllib.error.URLError, OSError):
        return None
    return resp.read().decode()


@pytest.fixture(scope="module")
def live_backend() -> str:
    """Skip the whole module when no live backend is reachable."""
    if _get_json("/api/version") is None:
        pytest.skip(f"no live ariaflow-server reachable at {BACKEND}")
    return BACKEND


class TestVersionContract:
    def test_bg37_openapi_version_matches_runtime(self, live_backend: str) -> None:
        runtime = _get_json("/api/version")
        assert runtime and runtime.get("ok") is True
        runtime_v = runtime["version"]
        spec_text = _get_text("/api/openapi.yaml")
        assert spec_text, "/api/openapi.yaml unreachable"
        m = re.search(r"^\s{0,4}version:\s*['\"]?([^'\"\s]+)['\"]?\s*$", spec_text, re.MULTILINE)
        assert m, "no info.version line in openapi.yaml"
        assert m.group(1) == runtime_v, (
            f"BG-37 drift: openapi.yaml info.version={m.group(1)!r} but /api/version={runtime_v!r}"
        )


class TestMetaContract:
    def test_bg31_meta_lists_canonical_endpoints(self, live_backend: str) -> None:
        meta = _get_json("/api/_meta")
        assert meta and meta.get("ok") is True
        endpoints = meta.get("endpoints")
        assert isinstance(endpoints, list)
        paths = {e.get("path") for e in endpoints}
        # Endpoints the dashboard's TAB_SUBS relies on per /api/_meta.
        required = {
            "/api/_meta",
            "/api/status",
            "/api/lifecycle",
            "/api/bandwidth",
            "/api/health",
            "/api/version",
            "/api/log",
            "/api/declaration",
            "/api/aria2/global_option",
        }
        missing = required - paths
        assert not missing, f"BG-31 / BG-34: /api/_meta missing endpoints: {sorted(missing)}"

    def test_bg31_meta_class_validators(self, live_backend: str) -> None:
        meta = _get_json("/api/_meta")
        assert meta
        for ep in meta.get("endpoints", []):
            cls = ep.get("freshness")
            if cls in {"warm", "swr"}:
                assert "ttl_s" in ep, f"{ep['path']} declares {cls} without ttl_s"
            if cls == "on-action":
                assert ep.get("revalidate_on"), f"{ep['path']} on-action without revalidate_on"
            if cls == "live":
                assert ep.get("transport"), f"{ep['path']} live without transport"


class TestStatusContract:
    def test_bg33_no_legacy_aliases(self, live_backend: str) -> None:
        body = _get_text("/api/status")
        assert body
        # Negative-snapshot mirror of BG-33's three server.test.ts assertions.
        assert "state.paused" not in body  # via JSON key search
        for needle in ['"paused":', '"stopped":', '"filtered":']:
            # `dispatch_paused` includes the substring `paused` — the strict
            # check is on a top-level / state key literal. Walk the parsed object.
            pass
        parsed = json.loads(body)
        assert "paused" not in parsed.get("state", {}), "BG-33: state.paused must not exist"
        assert "stopped" not in parsed.get("summary", {}), "BG-33: summary.stopped must not exist"
        assert "filtered" not in parsed, "BG-35: top-level filtered must not exist"

    def test_bg30_canonical_keys_present(self, live_backend: str) -> None:
        s = _get_json("/api/status")
        assert s
        state = s.get("state", {})
        assert "dispatch_paused" in state, "BG-30: state.dispatch_paused must exist"
        summary = s.get("summary", {})
        assert "removed" in summary, "BG-30: summary.removed (canonical) must exist"

    def test_bg19_ariaflow_server_block(self, live_backend: str) -> None:
        s = _get_json("/api/status")
        assert s
        afs = s.get("ariaflow-server")
        assert isinstance(afs, dict)
        for key in ("reachable", "pid", "version"):
            assert key in afs, f"BG-19: ariaflow-server.{key} missing"

    def test_bg24_health_populated(self, live_backend: str) -> None:
        s = _get_json("/api/status")
        assert s
        h = s.get("health", {})
        for key in ("uptime_seconds", "requests_total", "errors_total", "sse_clients"):
            assert key in h, f"BG-24: health.{key} missing"


class TestLifecycleContract:
    def test_bg20_27_29_axes(self, live_backend: str) -> None:
        lc = _get_json("/api/lifecycle")
        assert lc and lc.get("ok") is True
        # Every component record carries BG-27's three axes + BG-29's expected_running/managed_by.
        # Top-level session_* / ok / meta fields are scalars, not component records.
        for name, comp in lc.items():
            if not isinstance(comp, dict) or "result" not in comp:
                continue
            assert isinstance(comp["result"], dict), f"BG-20: {name}.result not a dict"
            r = comp["result"]
            for axis in ("installed", "current", "running"):
                assert axis in r, f"BG-27: {name}.result.{axis} missing"
            for axis in ("expected_running", "managed_by"):
                assert axis in r, f"BG-29: {name}.result.{axis} missing"


class TestBandwidthContract:
    def test_bg21_lifted_scalars(self, live_backend: str) -> None:
        b = _get_json("/api/bandwidth")
        assert b and b.get("ok") is True
        # BG-21: interface_name, source, cap_mbps, current_limit lifted to top level.
        for key in ("interface_name", "source", "cap_mbps"):
            assert key in b, f"BG-21: top-level {key} missing on /api/bandwidth"


class TestEnvelopeNormalization:
    """Cross-cuts BG-19/20/21/22/24/33/37: every dashboard-consumed endpoint
    returns ok=true on a healthy GET."""

    @pytest.mark.parametrize(
        "path",
        [
            "/api/version",
            "/api/_meta",
            "/api/health",
            "/api/status",
            "/api/lifecycle",
            "/api/bandwidth",
            "/api/declaration",
            "/api/log",
            "/api/sessions",
            "/api/peers",
            "/api/torrents",
            "/api/downloads",
            "/api/downloads/archive",
            "/api/aria2/global_option",
        ],
    )
    def test_envelope_ok_true(self, live_backend: str, path: str) -> None:
        body = _get_json(path)
        assert body, f"{path} unreachable"
        assert body.get("ok") is True, f"{path} envelope broken: {body!r}"
