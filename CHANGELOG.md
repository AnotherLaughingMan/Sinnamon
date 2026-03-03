# Changelog

All notable changes to this project are documented in this file.

The format follows Keep a Changelog and this project is currently pre-release.

## [Unreleased]

### Added

- Added `ISSUES.md` as the centralized issue register with serialized IDs (`SIN-####`), required tags, lifecycle sections, and a standard issue template for consistent tracking.
- Added repository baseline documentation files: `README.md`, `CODE_OF_CONDUCT.md`, and `LICENSE.md`.
- Added Electron runtime entrypoints (`electron/main.cjs`, `electron/preload.cjs`) for desktop app execution.

### Changed

- Expanded `ISSUES.md` with initial serialized edge-case backlog (`SIN-0001` to `SIN-0007`) covering security, sync reliability, state isolation, parsing gaps, and UX fallback risks.
- Updated project engineering guidance to require building and validating both Debug and Release variants for completed implementation changes.
- Updated engineering guidance to require a professional automated testing suite and to run/pass relevant tests before Debug and Release build validation.
- Added `copilot-instructions.md` to `.gitignore`.
- Expanded `.gitignore` with standard Node.js/TypeScript/Vite, environment, cache, IDE, OS, and test artifact ignore patterns.
- Updated project instructions to explicitly define Electron + React + TypeScript as the base stack direction.
- Updated project instructions to treat `https://github.com/AnotherLaughingMan/Sinnamon` as the canonical source repository for this project.
- Updated `package.json` scripts to run the app in Electron during development (`npm run dev`) and direct launch (`npm run start`).
- Updated README tech stack and commands to reflect Electron usage.
- Expanded `.gitignore` with Electron packaging output paths (`out/`, `release/`).
- Updated project license from MIT to GNU Affero General Public License v3.0 (AGPL-3.0).
- Corrected `LICENSE.md` to the full verbatim AGPL-3.0 text from `AnotherLaughingMan/Sinnamon` upstream `LICENSE`.
- Initialized local git repository on `main` and linked `origin` to `https://github.com/AnotherLaughingMan/Sinnamon.git`.

### Fixed

- Resolved `SIN-0002`: polling error handling no longer reports `connected` before successful recovery; state now remains degraded until incremental sync succeeds.
- Resolved `SIN-0003`: account/config context changes now clear prior room/timeline session data immediately to prevent stale cross-account visibility.

## [0.1.0-alpha.0] - 2026-03-03

### Added

- Initial project governance document in `copilot-instructions.md` covering product direction, UX requirements, feature phases, encryption/key direction, and engineering constraints.
- React + TypeScript + Vite application scaffold with `index.html`, TypeScript configs, Vite config, and application entrypoint wiring.
- First-pass Discord-style client shell layout with server rail, room sidebar, chat timeline, right-side member panel placeholder, and bottom composer.
- Reusable tooltip primitive and broad tooltip coverage for icon/action controls.
- Matrix data foundation:
  - Shared types in `src/matrix/types.ts`
  - Mock fallback dataset in `src/matrix/mockData.ts`
  - Matrix REST sync service in `src/matrix/matrixService.ts`
  - View-state hook in `src/state/useMatrixViewState.ts`
- Settings panel scaffold for Matrix connection configuration (homeserver URL, access token, user ID).
- Local persistence of Matrix settings using browser storage.
- Connection state presentation in UI (`mock`, `connecting`, `connected`, `error`).
- Shared message-retention constants in `src/matrix/retention.ts`.
- Retention visibility in both chat header tooltip and Settings panel read-only note.

### Changed

- Room list and timeline rendering moved from static arrays to state-driven Matrix-backed data.
- Matrix sync flow upgraded from one-shot fetch to incremental sync with `since` and `next_batch` token tracking.
- Room display-name resolution improved using Matrix room name, canonical alias, and heroes fallback.
- Save/connect behavior updated to connect using the latest settings draft and avoid stale state races.
- Long-session reliability improved through timeline de-duplication and retention capping:
  - 600 messages per room
  - 3000 messages global cap
- Unread behavior updated so the active room clears unread count locally for better UX consistency.

### Fixed

- Corrected connect flow race condition where freshly edited settings could be saved but not used for the immediate connection attempt.

### Notes

- In this environment, some terminal commands returned no output; editor diagnostics were used to verify code health.
- Future roadmap items remain unchanged: P2P Opus voice, richer room-level visual customization, and deeper customization surfaces.
