# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

### Added

- Initialized a new changelog baseline.
- Added `apps/web` and `apps/desktop` directories to re-establish a full dual-target client structure.
- Added shared monorepo support directories (`packages`, `scripts`) and workspace manifests (`pnpm-workspace.yaml`, `nx.json`, `pnpm-lock.yaml`) from the reference implementation baseline.
- Added `docs/E2EE-IMPLEMENTATION-BASELINE.md` to define mandatory encryption, verification, and key-recovery behavior for the rebuild.
- Added `apps/desktop/scripts/link-webapp.mjs` to stage web build output into `apps/desktop/webapp` before Electron startup.
- Added `apps/web/src/ui/layout/SinnamonLayout.tsx` as the first dedicated Discord-like shell container for server rail, channel sidebar, and main content regions.
- Added `ServerRail` and `ChannelSidebar` wrapper components so the Discord-like shell owns the left-side structural regions instead of rendering raw Element internals directly.
- Added `LEGAL_DISCLAIMER.md` as a dedicated project legal notice covering California use restrictions, no-warranty language, and project policy on posthumous ownership transfer.

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
- Updated `apps/desktop/scripts/tsconfig.json` to pair `allowImportingTsExtensions` with non-emitting compiler options for valid TypeScript config diagnostics.
- Updated desktop variant identity/config files (`apps/desktop/sinnamon/release/*`, `apps/desktop/sinnamon/nightly/*`) from Element defaults to Sinnamon branding and protocol/app IDs.
- Renamed desktop variant folder from `apps/desktop/element.io` to `apps/desktop/sinnamon`, removed legacy `New_Vector_Ltd.pem`, and removed unused `apps/web/element.io` deployment config folder.
- Updated root dev scripts so `dev:desktop` now runs `build:web` and `stage:webapp:desktop` before launching Electron.
- Updated `apps/web/project.json` build/start commands to load TS webpack config via `node --import tsx`.
- Updated desktop resource/build helper script invocations to use `node --experimental-strip-types` for direct `.ts` execution under Node 22.
- Updated `apps/web/src/components/structures/LoggedInView.tsx` to optionally render `SinnamonLayout` when `feature_new_room_list` and config flag `sinnamon_discord_layout` are enabled.
- Updated `apps/web/res/css/structures/_MatrixChat.pcss` with responsive shell grid styles for the new Sinnamon layout regions.
- Updated desktop icon assets and tray temp icon naming to use Sinnamon branding instead of Element defaults.
- Removed unused Docker, Storybook, Localazy, SonarQube, Jitsi-vendor, and Nightly workflow scaffolding from active project configs and scripts for the standalone Sinnamon client.
- Reworked the root `README.md` into a more professional project overview with clearer development guidance and an explicit link to the dedicated legal disclaimer.

### Fixed

- Restored `nx.json` and all four `project.json` files (`apps/web`, `apps/desktop`, `packages/shared-components`, `packages/playwright-common`) after a cancelled Nx removal attempt.
- Reverted `apps/web/package.json` scripts back to `nx build`, `nx start`, `nx lint:types`, and `nx test:unit` delegates; reverted `packages/shared-components/package.json` scripts to Nx delegates.
- Restored `@nx-tools/nx-container`, `@nx/jest`, and `nx 22.5.4` to root `package.json` devDependencies and pnpm built/ignored dependency lists.
- Added `counterpart` and `events` as explicit direct devDependencies of `sinnamon-web` — required by `webpack.config.ts` (via `import.meta.resolve`) and `src/stores`; were phantom deps that cannot survive pnpm isolated node linker without declaration.
- Fixed undefined PostCSS variable `$message-action-bar-border` (4 occurrences) in `res/css/structures/_MatrixChat.pcss` — corrected to `$message-action-bar-border-color`, the actual defined variable in all theme files.
- Fixed web typecheck blocker chain caused by matrix-js-sdk declaration/source incompatibilities under monorepo TypeScript checks.
- Fixed desktop scripts typecheck failures caused by unsupported module configuration values in `apps/desktop/scripts/tsconfig.json`.
- Fixed desktop startup reliability by guaranteeing staged `webapp` assets before Electron start.
- Fixed desktop packaging identity mismatch; debug and release package validations now complete with Sinnamon app identity.
- Fixed root `tsconfig.json` and `tsconfig.app.json` to properly configure monorepo workspace with project references to `apps/web` and `apps/desktop`, enabling VS Code TypeScript language server to correctly resolve types and JSX.
- Cleared VS Code TypeScript cache to eliminate stale error reports for deleted/moved files.
- Resolved all 105 VS Code TypeScript diagnostic problems; `tsc --noEmit` now exits clean with zero errors across the workspace.

### Notes

- Previous changelog history was intentionally replaced to start fresh.
- Source tree rebuild is now structured around `apps/web` and `apps/desktop` as the canonical application roots.
