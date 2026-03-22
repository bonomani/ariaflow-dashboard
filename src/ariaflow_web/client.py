from __future__ import annotations

import json
import os
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def api_base_url() -> str:
    return os.environ.get("ARIAFLOW_API_URL", "http://127.0.0.1:8000")


def _request(path: str, method: str = "GET", payload: dict | None = None, base_url: str | None = None) -> dict:
    url = f"{(base_url or api_base_url()).rstrip('/')}{path}"
    headers = {}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except URLError as exc:
        return {
            "ok": False,
            "backend": {
                "reachable": False,
                "error": str(exc),
                "url": url,
            },
        }


def get_status() -> dict:
    return _request("/api/status")


def get_status_from(base_url: str) -> dict:
    return _request("/api/status", base_url=base_url)


def get_log(limit: int = 120) -> dict:
    return _request(f"/api/log?{urlencode({'limit': limit})}")


def get_log_from(base_url: str, limit: int = 120) -> dict:
    return _request(f"/api/log?{urlencode({'limit': limit})}", base_url=base_url)


def get_declaration() -> dict:
    return _request("/api/declaration")


def get_declaration_from(base_url: str) -> dict:
    return _request("/api/declaration", base_url=base_url)


def save_declaration(declaration: dict) -> dict:
    return _request("/api/declaration", method="POST", payload=declaration)


def save_declaration_from(base_url: str, declaration: dict) -> dict:
    return _request("/api/declaration", method="POST", payload=declaration, base_url=base_url)


def get_lifecycle() -> dict:
    return _request("/api/lifecycle")


def get_lifecycle_from(base_url: str) -> dict:
    return _request("/api/lifecycle", base_url=base_url)


def add_item(url: str, output: str | None = None, post_action_rule: str = "pending") -> dict:
    payload: dict[str, object] = {"url": url, "post_action_rule": post_action_rule}
    if output is not None:
        payload["output"] = output
    return _request("/api/add", method="POST", payload=payload)


def add_item_from(base_url: str, url: str, output: str | None = None, post_action_rule: str = "pending") -> dict:
    payload: dict[str, object] = {"url": url, "post_action_rule": post_action_rule}
    if output is not None:
        payload["output"] = output
    return _request("/api/add", method="POST", payload=payload, base_url=base_url)


def preflight() -> dict:
    return _request("/api/preflight", method="POST")


def preflight_from(base_url: str) -> dict:
    return _request("/api/preflight", method="POST", base_url=base_url)


def run_queue(auto_preflight_on_run: bool = False) -> dict:
    return _request("/api/run", method="POST", payload={"auto_preflight_on_run": auto_preflight_on_run})


def run_queue_from(base_url: str, auto_preflight_on_run: bool = False) -> dict:
    return _request("/api/run", method="POST", payload={"auto_preflight_on_run": auto_preflight_on_run}, base_url=base_url)


def run_ucc() -> dict:
    return _request("/api/ucc", method="POST")


def run_ucc_from(base_url: str) -> dict:
    return _request("/api/ucc", method="POST", base_url=base_url)


def set_session(action: str = "new") -> dict:
    return _request("/api/session", method="POST", payload={"action": action})


def set_session_from(base_url: str, action: str = "new") -> dict:
    return _request("/api/session", method="POST", payload={"action": action}, base_url=base_url)


def pause() -> dict:
    return _request("/api/pause", method="POST")


def pause_from(base_url: str) -> dict:
    return _request("/api/pause", method="POST", base_url=base_url)


def resume() -> dict:
    return _request("/api/resume", method="POST")


def resume_from(base_url: str) -> dict:
    return _request("/api/resume", method="POST", base_url=base_url)


def lifecycle_action(target: str, action: str) -> dict:
    return _request("/api/lifecycle/action", method="POST", payload={"target": target, "action": action})


def lifecycle_action_from(base_url: str, target: str, action: str) -> dict:
    return _request("/api/lifecycle/action", method="POST", payload={"target": target, "action": action}, base_url=base_url)
