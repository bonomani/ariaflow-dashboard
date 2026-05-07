"""Client-side Sigstore verification of release artifacts.

CI release.yml signs each release tarball with cosign keyless (Sigstore
OIDC) and emits a GitHub provenance attestation. This module is the
client side: download the artifact + signature, run `cosign verify-blob`
to confirm the signing identity matches our GitHub Actions workflow.

Default off (config key `verify_signatures`). Will flip to opt-in when
~1 month of clean signed releases has accumulated. Long-term goal: flip
default on, with explicit opt-out for operators who don't want / can't
have `cosign` installed.

The verification protects against:
- Tap repo compromise (attacker rewrites Formula/<f>.rb with a poisoned
  URL + recomputed SHA256; cosign refuses because the bottle wasn't
  signed by our GitHub Actions OIDC identity)
- GitHub release tampering (replacing the bottle but not the signature)
- Auto-bump bot compromise (same as tap compromise)

What it does NOT protect against:
- Compromise of the GitHub Actions runner itself (signs malicious code
  with our identity)
- The PyPI distribution path — operators who pip-install from PyPI
  rather than via brew don't go through here. See docs/UPDATE_PROCESSES.md
  §18.10 for the documented workaround.

Failure modes are intentionally permissive when verification is *disabled*
(config off → never call into here). When *enabled*, failures are hard
errors: better to refuse an update than dispatch one we can't verify.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Tuple
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

# OIDC identity that should match the certificate we got back from
# cosign. Loose regex accepts any workflow file in the dashboard repo
# under any tag, so adding a new release workflow doesn't break
# verification. Keep tight enough to reject signatures from forks or
# unrelated repos in the same org.
EXPECTED_IDENTITY_REGEX = (
    r"^https://github\.com/bonomani/ariaflow-dashboard/\.github/workflows/.*"
)

# OIDC issuer is constant for GitHub Actions tokens.
EXPECTED_OIDC_ISSUER = "https://token.actions.githubusercontent.com"

# GitHub release base URL pattern. Filled in with version per call.
RELEASE_BASE = (
    "https://github.com/bonomani/ariaflow-dashboard/releases/download"
    "/v{version}/ariaflow-dashboard-v{version}.tar.gz"
)


def _download(url: str, dst: Path, timeout: int = 30) -> None:
    """Download URL to dst. Raises on failure (caller decides policy)."""
    with urlopen(url, timeout=timeout) as resp:  # noqa: S310 - fixed gh URL
        dst.write_bytes(resp.read())


def cosign_available() -> bool:
    """Check whether the `cosign` binary is on PATH.

    When operators enable `verify_signatures`, they accept the dependency.
    This helper lets the caller produce a friendly error message before
    attempting verification.
    """
    return shutil.which("cosign") is not None


def verify_release(version: str) -> Tuple[bool, str]:
    """Verify the Sigstore signature of a published release.

    Args:
        version: semver string without leading 'v' (e.g. "0.1.592").

    Returns:
        Tuple of (ok, message). ok=True means the artifact is signed by
        our GitHub Actions OIDC identity. ok=False means verification
        failed for any reason — the message field carries operator-
        readable detail.

    Network errors, missing cosign, signature mismatch are all reported
    as ok=False. Caller decides whether to abort the update or fall back.
    """
    if not cosign_available():
        return False, (
            "cosign not installed; install via `brew install cosign` "
            "or set verify_signatures=false to skip verification"
        )

    base_url = RELEASE_BASE.format(version=version)
    sig_url = base_url + ".sig"
    cert_url = base_url + ".pem"

    with tempfile.TemporaryDirectory(prefix="ariaflow-verify-") as tmp:
        tmp_path = Path(tmp)
        artifact = tmp_path / f"ariaflow-dashboard-v{version}.tar.gz"
        sig = tmp_path / "artifact.sig"
        cert = tmp_path / "artifact.pem"

        try:
            _download(base_url, artifact)
            _download(sig_url, sig)
            _download(cert_url, cert)
        except HTTPError as e:
            return False, f"download failed (HTTP {e.code}): {e.url}"
        except URLError as e:
            return False, f"download failed: {e.reason}"
        except OSError as e:
            return False, f"download failed: {e}"

        # cosign verify-blob exits 0 on success, non-zero on failure.
        # stderr carries the diagnostic; pass it through to the caller.
        result = subprocess.run(  # noqa: S603 - all args fixed/internal
            [
                "cosign",
                "verify-blob",
                "--certificate",
                str(cert),
                "--signature",
                str(sig),
                "--certificate-identity-regexp",
                EXPECTED_IDENTITY_REGEX,
                "--certificate-oidc-issuer",
                EXPECTED_OIDC_ISSUER,
                str(artifact),
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )

        if result.returncode == 0:
            return True, f"verified v{version} signed by GitHub Actions OIDC"
        # cosign prints the reason on stderr (or stdout in some versions)
        msg = (result.stderr or result.stdout or "unknown error").strip()
        return False, f"cosign verification failed: {msg}"
