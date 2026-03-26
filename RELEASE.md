# Release

`ariaflow-web` uses the same stable tag-push release pattern as `ariaflow`.

## Version Sources

Keep these two files aligned:

- `pyproject.toml`
- `src/ariaflow_web/__init__.py`

The existing repo tags use the stable pattern `vX.Y.Z`, for example `v0.1.13`.
Do not publish alpha tags or prereleases from this repo.

## Preferred Flow

Run the helper from a clean checkout on `main`:

```bash
python3 scripts/release.py --dry-run
python3 scripts/release.py --push
```

The helper will:

- validate that `pyproject.toml` and `src/ariaflow_web/__init__.py` agree
- refuse to reuse an existing tag
- run `py_compile` and `python3 -m unittest tests.test_web tests.test_cli -v` unless `--no-tests` is used
- bump the package version
- commit the version bump
- create the matching `vX.Y.Z` tag
- push `main` and tags when `--push` is given

Once the repo is on a stable version, the helper bumps the patch version
automatically, for example `0.1.17` to `0.1.18`.

Useful flags:

- `--dry-run`: print the release plan without changing files
- `--version 0.1.18`: set an explicit stable version instead of auto-bumping
- `--no-tests`: skip local tests
- `--allow-dirty`: bypass the clean-tree check

## After Tag Push

The GitHub workflow in `.github/workflows/release.yml` runs automatically on
stable tag pushes. It will:

- run the test suite again on GitHub Actions
- build the source distribution
- create the GitHub release
- update `bonomani/homebrew-ariaflow/Formula/ariaflow-web.rb` directly

## Manual Flow

1. Start from a clean checkout on the branch you release from.
2. Run the local checks:

```bash
python3 -m unittest tests.test_web tests.test_cli
python3 -m py_compile src/aria_queue/webapp.py src/aria_queue/cli.py src/ariaflow_web/cli.py
```

3. Bump `pyproject.toml` and `src/ariaflow_web/__init__.py` to the same version.
4. Commit the version bump.
5. Create the matching tag, for example `v0.1.14`.
6. Push the branch and tag.

## Verification

After release:

- confirm the new tag exists in the repo
- confirm the GitHub release is published as a normal release
- confirm the Homebrew tap formula updated to the same version
- confirm `ariaflow-web --version` reports the released version
- on macOS, check:

```bash
brew tap bonomani/ariaflow
brew upgrade ariaflow-web
ariaflow-web --version
```

## GitHub Secret

Set `ARIAFLOW_TAP_TOKEN` in this repo with write access to
`bonomani/homebrew-ariaflow`. The release workflow uses it to commit the
formula update.
