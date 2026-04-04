# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

### Added

- Initialized a new changelog baseline.
- Added `apps/web` and `apps/desktop` directories to re-establish a full dual-target client structure.
- Added shared monorepo support directories (`packages`, `scripts`) and workspace manifests (`pnpm-workspace.yaml`, `nx.json`, `pnpm-lock.yaml`) from the reference implementation baseline.
- Added `docs/E2EE-IMPLEMENTATION-BASELINE.md` to define mandatory encryption, verification, and key-recovery behavior for the rebuild.

### Changed

- Updated root `package.json` to a pnpm monorepo orchestration manifest with web/desktop dev, build, and test scripts.
- Updated `.github/copilot-instructions.md` to explicitly forbid creative plan deviation, workaround-only fixes, and issue-hiding behavior.
- Renamed monorepo app package identities from `element-web`/`element-desktop` to `sinnamon-web`/`sinnamon-desktop` and retargeted root script filters accordingly.
- Updated `apps/web/package.json` and `apps/desktop/package.json` metadata (description, author, homepage, repository, product name) to Sinnamon project identity.
- Updated `apps/desktop/project.json` implicit dependency mapping to `sinnamon-web`.
- Added root gate scripts for `typecheck:web`, `typecheck:desktop`, `package:debug`, and `package:release` to align with required validation workflow.
- Added a deterministic matrix SDK compatibility patch step (`scripts/fix-matrix-sdk-dts.mjs`) and wired it into `typecheck:web`.
- Updated web dependency typing support in `apps/web/package.json` with explicit `@types/http-errors`, `@types/qs`, `@types/range-parser`, and `@types/send`.
- Updated desktop scripts TypeScript configuration in `apps/desktop/scripts/tsconfig.json` to a TS5.8-compatible Node module mode.

### Fixed

- Fixed web typecheck blocker chain caused by matrix-js-sdk declaration/source incompatibilities under monorepo TypeScript checks.
- Fixed desktop scripts typecheck failures caused by unsupported module configuration values in `apps/desktop/scripts/tsconfig.json`.

### Notes

- Previous changelog history was intentionally replaced to start fresh.
- Source tree rebuild is now structured around `apps/web` and `apps/desktop` as the canonical application roots.
