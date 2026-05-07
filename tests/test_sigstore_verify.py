"""Unit tests for sigstore_verify.

Network-touching path is exercised in integration runs only (not here).
These tests cover:
  - cosign-not-available short-circuit
  - URL construction
  - subprocess invocation arg shape (mocked)
  - successful and failed cosign exits
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

from ariaflow_dashboard import sigstore_verify


def test_cosign_available_true(monkeypatch):
    """`cosign` on PATH → cosign_available() returns True."""
    monkeypatch.setattr(sigstore_verify.shutil, "which", lambda _: "/usr/bin/cosign")
    assert sigstore_verify.cosign_available() is True


def test_cosign_available_false(monkeypatch):
    """`cosign` not on PATH → cosign_available() returns False."""
    monkeypatch.setattr(sigstore_verify.shutil, "which", lambda _: None)
    assert sigstore_verify.cosign_available() is False


def test_verify_release_no_cosign_short_circuits(monkeypatch):
    """Verification refuses early when cosign is missing.

    No download attempt should happen when cosign isn't installed —
    otherwise we'd hit the network for nothing.
    """
    monkeypatch.setattr(sigstore_verify, "cosign_available", lambda: False)
    download_calls = []
    monkeypatch.setattr(
        sigstore_verify,
        "_download",
        lambda url, dst, **_kw: download_calls.append(url),
    )

    ok, msg = sigstore_verify.verify_release("0.1.999")
    assert ok is False
    assert "cosign not installed" in msg
    assert download_calls == []


def test_verify_release_download_failure(monkeypatch):
    """Network failure during download surfaces as ok=False with detail."""
    from urllib.error import URLError

    monkeypatch.setattr(sigstore_verify, "cosign_available", lambda: True)

    def boom(url, dst, **_kw):
        raise URLError("network down")

    monkeypatch.setattr(sigstore_verify, "_download", boom)

    ok, msg = sigstore_verify.verify_release("0.1.999")
    assert ok is False
    assert "download failed" in msg
    assert "network down" in msg


def test_verify_release_cosign_success(monkeypatch):
    """When cosign exits 0, verify_release reports success."""
    monkeypatch.setattr(sigstore_verify, "cosign_available", lambda: True)
    monkeypatch.setattr(sigstore_verify, "_download", lambda *a, **kw: None)

    fake_result = MagicMock(returncode=0, stderr="", stdout="Verified OK")
    monkeypatch.setattr(
        sigstore_verify.subprocess, "run", lambda *a, **kw: fake_result
    )

    ok, msg = sigstore_verify.verify_release("0.1.592")
    assert ok is True
    assert "0.1.592" in msg


def test_verify_release_cosign_failure(monkeypatch):
    """When cosign exits non-zero, the stderr message is propagated."""
    monkeypatch.setattr(sigstore_verify, "cosign_available", lambda: True)
    monkeypatch.setattr(sigstore_verify, "_download", lambda *a, **kw: None)

    fake_result = MagicMock(
        returncode=1, stderr="signature mismatch", stdout=""
    )
    monkeypatch.setattr(
        sigstore_verify.subprocess, "run", lambda *a, **kw: fake_result
    )

    ok, msg = sigstore_verify.verify_release("0.1.592")
    assert ok is False
    assert "signature mismatch" in msg


def test_verify_release_passes_correct_args(monkeypatch):
    """cosign is invoked with the expected identity regex and issuer.

    The identity regex pins us to the dashboard repo's workflows; the
    issuer pins us to GitHub Actions. Both must match what release.yml
    publishes, otherwise verification is meaningless.
    """
    monkeypatch.setattr(sigstore_verify, "cosign_available", lambda: True)
    monkeypatch.setattr(sigstore_verify, "_download", lambda *a, **kw: None)

    captured_args = []

    def fake_run(args, **kw):
        captured_args.extend(args)
        return MagicMock(returncode=0, stderr="", stdout="Verified OK")

    monkeypatch.setattr(sigstore_verify.subprocess, "run", fake_run)

    sigstore_verify.verify_release("0.1.592")

    # The args list contains both flag and value; check pairs.
    flat = " ".join(captured_args)
    assert "cosign" in flat
    assert "verify-blob" in flat
    assert "bonomani/ariaflow-dashboard" in flat
    assert "token.actions.githubusercontent.com" in flat
