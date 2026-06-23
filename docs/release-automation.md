# Release automation — design doc

Context doc for AI-assisted development. Records what the release workflow does and **why**.

## Goal

Every merge to `main` produces an incremented, traceable **version tag** + a **GitHub pre-release**, so each deployable state of the product has a version. No manual version bumping.

## How it works

`.github/workflows/release.yml` triggers on `push` to `main` (i.e. when a PR merges) and:
1. Reads Conventional Commit messages since the last tag and computes the next **SemVer** bump (`fix:`→patch, `feat:`→minor, `feat!`/`BREAKING CHANGE`→major; defaults to patch).
2. Creates a **pre-release** tag (`vX.Y.Z-rc.N`).
3. Publishes a **GitHub pre-release** with auto-generated notes (the commits since the last tag).

Pre-release because the project is pre-1.0 / not formally released yet. A tag = a deployable version; a deploy workflow can later trigger on tag push (`v*`).

## Key decisions (and why)

- **Auto-per-merge (not gated).** Matches the requirement "every merge → a version." Simpler than a gated model for a small project.
  - *Alternative for later:* **release-please** (Google) opens a "release PR" that batches changes + changelog; merging it cuts a release. Better when you don't want every merge to be a release. Swap-in when the team grows / cadence needs gating.
- **Conventional Commits drive the bump.** The version then *means* something (breaking vs feature vs fix) with zero manual bumping. Requires squash-merge + Conventional-Commit PR titles.
- **Pre-release marking.** Keeps these clearly "not the official release" until a deliberate 1.0 / graduation.
- **Separate workflow from `ci.yml`.** CI gates PRs (lint/typecheck/test/e2e/build/audit/secret-scan); release runs only post-merge on `main`. Single responsibility.

## Admin prerequisites (one-time, owner)

This workflow is **inert until merged to `main`** and until the repo grants write:
- **Settings → Actions → General → Workflow permissions → "Read and write permissions"** — so `GITHUB_TOKEN` can push tags + create releases.
- Recommended alongside: branch protection on `main` requiring the `CI` checks green before merge, and **squash-merge** with Conventional-Commit titles (so the bump computes correctly).

## Hardening follow-ups

- **Pin third-party actions to commit SHAs** (currently `@v6.2` / `@v2`) for supply-chain safety.
- Add a **deploy workflow** triggered on tag push (`v*`) to ship the tagged build.
- When ready for full (non-pre) releases, either flip `pre_release_branches`/`prerelease` off or migrate to release-please.

## Progress log

### 2026-06-22 — `generate_release_notes: true` added

- Releases now include GitHub's native auto-generated release notes (groups merged PRs by title/author with links), combined with the tag-action's changelog. Every release is still editable manually.

### 2026-06-21 — prepared on `ci/release-automation`

- Added `release.yml` (auto pre-release tag + GitHub pre-release from Conventional Commits) as a workaround branch while admin/permission access is pending. Inert until merged to `main` + write permission enabled.
