from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def _request(path: str, method: str = "GET", payload: dict | None = None, base_url: str = "http://127.0.0.1:8000") -> dict:
    url = f"{base_url.rstrip('/')}{path}"
    headers = {}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            result = json.loads(body) if body else {}
        except json.JSONDecodeError:
            result = {
                "ok": False,
                "error": "http_error",
                "message": body or str(exc),
            }
        if not isinstance(result, dict):
            result = {
                "ok": False,
                "error": "http_error",
                "message": str(result),
            }
        result.setdefault("ok", False)
        result.setdefault("http_status", exc.code)
        result.setdefault(
            "backend",
            {
                "reachable": True,
                "status": exc.code,
                "url": url,
            },
        )
        return result
    except URLError as exc:
        return {
            "ok": False,
            "backend": {
                "reachable": False,
                "error": str(exc),
                "url": url,
            },
        }


def get_api_discovery_from(base_url: str) -> dict:
    return _request("/api", base_url=base_url)


def get_status_from(base_url: str) -> dict:
    return _request("/api/status", base_url=base_url)


def get_bandwidth_from(base_url: str) -> dict:
    return _request("/api/bandwidth", base_url=base_url)


def bandwidth_probe_from(base_url: str) -> dict:
    return _request("/api/bandwidth/probe", method="POST", base_url=base_url)


def get_log_from(base_url: str, limit: int = 120) -> dict:
    return _request(f"/api/log?{urlencode({'limit': limit})}", base_url=base_url)


def get_declaration_from(base_url: str) -> dict:
    return _request("/api/declaration", base_url=base_url)


def save_declaration_from(base_url: str, declaration: dict) -> dict:
    return _request("/api/declaration", method="POST", payload=declaration, base_url=base_url)


def get_lifecycle_from(base_url: str) -> dict:
    return _request("/api/lifecycle", base_url=base_url)


def add_items_from(base_url: str, items: list[dict[str, object]]) -> dict:
    payload: dict[str, object] = {"items": items}
    return _request("/api/add", method="POST", payload=payload, base_url=base_url)


def preflight_from(base_url: str) -> dict:
    return _request("/api/preflight", method="POST", base_url=base_url)


def run_action_from(base_url: str, action: str, auto_preflight_on_run: bool | None = None) -> dict:
    payload: dict[str, object] = {"action": action}
    if auto_preflight_on_run is not None:
        payload["auto_preflight_on_run"] = auto_preflight_on_run
    return _request("/api/run", method="POST", payload=payload, base_url=base_url)


def run_ucc_from(base_url: str) -> dict:
    return _request("/api/ucc", method="POST", base_url=base_url)


def set_session_from(base_url: str, action: str = "new") -> dict:
    return _request("/api/session", method="POST", payload={"action": action}, base_url=base_url)


def pause_from(base_url: str) -> dict:
    return _request("/api/pause", method="POST", base_url=base_url)


def resume_from(base_url: str) -> dict:
    return _request("/api/resume", method="POST", base_url=base_url)


def item_action_from(base_url: str, item_id: str, action: str) -> dict:
    return _request(f"/api/item/{item_id}/{action}", method="POST", base_url=base_url)


def lifecycle_action_from(base_url: str, target: str, action: str) -> dict:
    return _request("/api/lifecycle/action", method="POST", payload={"target": target, "action": action}, base_url=base_url)
