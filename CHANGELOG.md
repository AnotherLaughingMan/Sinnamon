# Changelog

All notable changes to this project are documented in this file.

The format follows Keep a Changelog and this project is currently pre-release.

## [Unreleased]

### Added

- Added explicit app-route resolver module for startup flow state selection in `src/app/routes.ts`.
- Added `src/app/AppRoot.tsx` as the root orchestration module for welcome auth, post-login security gate, and workspace handoff.
- Added `src/app/WorkspaceView.tsx` as a dedicated logged-in shell composition module to decouple workspace UI orchestration from root app routing.
- Added `src/app/useMatrixLifecycle.ts` to centralize session lifecycle ownership (config persistence, login/connect handoff, post-login gate reset, and sign-out restoration).
- Added `src/state/matrixSyncLifecycle.ts` to isolate incremental Matrix polling lifecycle (long-poll loop, retry delay, abort teardown, and token progression) from UI state wiring.
- Added `src/state/matrixSyncStateController.ts` to centralize initial session connect behavior and synced-state application for room/timeline/member/token/session updates.
- Added `src/state/matrixVerificationLifecycle.ts` to isolate DM verification-target resolution and incoming verification-request filtering logic from the view-state hook.
- Added `src/state/matrixRoomLifecycle.ts` to isolate connected-room lifecycle decisions for read-receipt publishing and member-list hydration.
- Added `src/features/encryption/roomKeyTransfer.ts` to centralize room-key import/export action orchestration and status messaging for the Key Transfer settings flow.
- Added `src/features/encryption/KeyTransferSection.tsx` as a dedicated settings component for room-key import/export UI and local state management.
- Added `src/state/matrixMessageLifecycle.ts` to isolate message sending logic, including optimistic updates, transaction ID generation, error recovery, and pending message count management.
- Added `src/state/matrixTypingLifecycle.ts` to isolate typing notification logic, including precondition checks, state deduplication, timeout management, and API calls.

### Changed

- Refactored `src/App.tsx` to a thin entry wrapper that delegates orchestration to `src/app/AppRoot.tsx`, beginning the phased full-app restructure.
- Refactored `src/app/AppRoot.tsx` to consume lifecycle behaviors through `useMatrixLifecycle` instead of owning connection/session transitions inline.
- Refactored `src/state/useMatrixViewState.ts` to delegate incremental sync loop ownership to `startIncrementalSyncLoop`, reducing hook-level lifecycle coupling while preserving existing state merge behavior.
- Refactored `src/state/useMatrixViewState.ts` to delegate initial connect and synced-state application through `connectMatrixSession` and `applySyncedStateToView`, reducing hook orchestration density.
- Refactored `src/state/useMatrixViewState.ts` to delegate incoming DM verification request resolution to `matrixVerificationLifecycle` helpers, trimming protocol-specific branching in hook effects.
- Refactored `src/state/useMatrixViewState.ts` to delegate read-receipt/member-hydration lifecycle flow to `matrixRoomLifecycle` helpers, reducing room-effect branching in the hook.
- Refactored `src/components/SettingsPanel.tsx` key-transfer button handlers to delegate import/export flow control to `roomKeyTransfer` helpers, reducing inline settings action complexity.
- Refactored `src/components/SettingsPanel.tsx` Key Transfer category to delegate UI rendering to `KeyTransferSection` component, removing inline key-management textarea and associated useState hooks.
- Refactored `src/state/useMatrixViewState.ts` message sending to delegate through `createSendMessageCallback` helper from `matrixMessageLifecycle`, reducing callback complexity and improving testability.
- Refactored `src/state/useMatrixViewState.ts` typing notifications to delegate through `createSetTypingCallback` helper from `matrixTypingLifecycle`, isolating timeout management and API calls.

### Fixed

- None yet.


## [0.3.0] - 2026-04-04

### Added

- Added `PostLoginE2EEGate` component (`src/features/encryption/PostLoginE2EEGate.tsx`) and supporting `CompleteSecurityView` / `InitialE2ESetupView` flows modeled after element-web-ex setup behavior.
- Added startup welcome auth entrypoint (`src/features/connection/WelcomeLoginView.tsx`) so app launch now begins on a dedicated login screen instead of requiring Settings-first login.
- Added `requestOwnUserVerification` to `src/matrix/matrixCryptoService.ts` and wired a new `Verify from another device` action into the post-login security gate.
- Added dedicated welcome-screen styling in `src/styles.css` for first-run and signed-out login flow.

### Changed

- Updated `src/App.tsx` to route unauthenticated sessions to the welcome login page, keep a shared login handler across welcome/settings flows, and pass verify-from-another-device action into the E2EE gate.
- Updated `src/features/connection/ConnectionSettingsSection.tsx` to export shared login typing/error mapping for reuse in welcome auth flow.
- Bumped application version to `0.3.0`.

### Fixed

- Fixed post-login encryption bootstrap failures for first-time setup by aligning `bootstrapCrossSigning` with element-web-ex initial crypto setup sequencing.
- Fixed E2EE gate routing for existing encrypted accounts so secret-storage and backup-enabled users are sent through recovery/verification instead of first-time setup.
- Fixed recovery-key restore handling so Element recovery keys unlock secret storage first and then load backup decryption keys.


## [0.2.0] - 2026-04-04

### Added

- Added login type selector in the Password Login form — users can now choose between "Username / Matrix ID" and "Email address" login flows; email login uses the `m.id.thirdparty` Matrix identifier.
- Added MXID homeserver auto-discovery on blur: when a full Matrix ID (`@user:server`) is entered in the username field, the homeserver URL is automatically filled via `/.well-known/matrix/client` lookup.
- Added `discoverHomeserverFromMxid` export to `matrixService.ts` for pre-login homeserver discovery from a Matrix ID.
- Added `autoComplete` attributes to login form inputs (`email`, `username`, `current-password`) for credential manager compatibility.

### Changed

- Extracted `ConnectionSettingsSection` to `src/features/connection/ConnectionSettingsSection.tsx`, reducing `SettingsPanel.tsx` below the 600-line threshold.
- Separated login-busy state from syncing state in the login button: shows "Logging In…" during the password-login HTTP call and "Syncing…" while the initial sync is running after credentials are confirmed; button is disabled throughout both phases.
- Improved login error mapping: network failures, `M_FORBIDDEN` / 401 / 403, `M_USER_IN_USE`, `M_INVALID_USERNAME`, and `M_LIMIT_EXCEEDED` now surface human-readable messages instead of raw HTTP status lines.
- Updated `loginWithPassword` in `matrixService.ts` to parse the Matrix error response body (`errcode`) and include it in thrown errors for richer client-side error mapping.
- Updated `loginWithPassword` to accept `identifierType: 'username' | 'email'` and emit the correct Matrix login identifier object for each type.
- Changed `onLogin` in `App.tsx` to fire `connect()` without `await` so the login promise resolves as soon as credentials are confirmed, decoupling the "Logging In…" and "Syncing…" UI phases.
- Bumped version to `0.2.0`.

- Added `ISSUES.md` as the centralized issue register with serialized IDs (`SIN-####`), required tags, lifecycle sections, and a standard issue template for consistent tracking.
- Added initial unit-test harness with Vitest and first coverage for Matrix state utility behavior (room merge/read-state updates and message retention/merge rules).
- Added Matrix message-mapping unit tests covering text/notice/media parsing and unsupported-message fallback behavior.
- Added Matrix send-message API tests covering successful event-id responses and HTTP failure handling.
- Added Matrix room-member mapping tests covering joined-member extraction, sorting, and leave/invite filtering.
- Added `fetchRoomMemberList` API helper that calls `GET /rooms/{id}/members` and returns a sorted `RoomMember[]` array.
- Added unit tests for `fetchRoomMemberList` covering successful member list fetch and HTTP failure handling (18 total tests).
- Added `formattedBody` field to `TimelineMessage` for Matrix HTML-formatted messages (`org.matrix.custom.html` format).
- Added `FormattedMessage` React component that sanitizes `formatted_body` HTML via DOMPurify before rendering, with an allowlist of safe Matrix tags and attributes.
- Added `topic` field to `RoomSummary`; parsed from `m.room.topic` state events during sync and displayed as a subtitle in the chat header.
- Added `typingByRoom` state tracking: `m.typing` ephemeral events from sync are parsed and exposed as `selectedRoomTyping` (filtered to exclude self) in the view state hook.
- Added `sendTypingNotification` API helper (`PUT /rooms/{id}/typing/{userId}`) and `setTyping` callback; fires on keystroke and clears on blur or message send.
- Added typing indicator UI with animated three-dot bounce and natural-language label ("X is typing…", "X and Y are typing…", "Several people are typing…").
- Added password login support against the Matrix `/_matrix/client/v3/login` endpoint, including device ID capture for the authenticated session.
- Added server-side key-backup lookup support via `GET /_matrix/client/v3/room_keys/version` and surfaced the result in Settings.
- Added encrypted-room detection from `m.room.encryption` state events and surfaced encryption state in the room list and chat header.
- Added Matrix JS SDK-backed exported room-key import/export support for the current device session, including progress reporting and JSON export download from Settings.
- Added Matrix JS SDK-backed timeline decryption for `m.room.encrypted` events so imported room keys can unlock older encrypted message content during sync.
- Added server key-backup restore flows using Matrix recovery keys and legacy passphrases, including restore progress and result reporting in Settings.
- Added crypto session status inspection in Settings to surface device binding, active backup version, local backup-key availability, and secret-storage backup-key state.
- Added per-room crypto health indicators that classify encrypted rooms as ready, backup-restore needed, key-import needed, or general decryption issues based on recent decryption outcomes.
- Added a Discord-style Settings dialog shell with a category sidebar (`My Account`, `Encryption Backup`, `Room Keys`) and a dedicated content pane to reduce visual clutter.
- Added a `Help & About` settings category with author attribution, Matrix.org/spec links, encryption-help reference links, and API/SDK implementation notes.
- Added a local credential-free Matrix mock server (`npm run dev:mock-matrix`) for operational testing without a remote test server or account, plus README usage guidance.
- Added robust tooltip dismissal handling across the app for edge cases like click transitions, scrolling, window blur, visibility changes, and Escape key dismissal.
- Added repository baseline documentation files: `README.md`, `CODE_OF_CONDUCT.md`, and `LICENSE.md`.
- Added Electron runtime entrypoints (`electron/main.cjs`, `electron/preload.cjs`) for desktop app execution.
- Added Electron packaging pipeline via `electron-builder` with end-to-end Debug and Release commands.

### Changed

- Expanded `ISSUES.md` with initial serialized edge-case backlog (`SIN-0001` to `SIN-0007`) covering security, sync reliability, state isolation, parsing gaps, and UX fallback risks.
- Updated Matrix credential persistence policy: settings now default to session storage with an explicit "Remember credentials" opt-in for local persistence.
- Expanded Matrix timeline parsing and UI rendering beyond plain text to support `m.notice`, `m.emote`, `m.image`, and `m.file` message types with unsupported-type fallback handling.
- Updated room-read behavior to publish Matrix `m.read` receipts for the active room's latest event and deduplicate repeated receipt submissions.
- Implemented composer send flow with optimistic timeline updates, Matrix send API integration, Enter-to-send behavior, and send-button loading guardrails.
- Added member panel toggle behavior in the chat header and responsive layout switching between three-column and four-column shell modes.
- Replaced static member-panel placeholders with real Matrix room member data mapped from sync state and surfaced per selected room.
- Added room member fetch fallback: when a room is selected while connected and its member list is empty, the hook automatically fetches `/rooms/{id}/members` and merges the result into state.
- Added display name resolution in the message timeline: author userIds are resolved to display names from the room member list; avatar initials and emote action lines also use the resolved name.
- Extended `matrixService.ts` sync response type to include `ephemeral.events` per joined room and `typingByRoom` in `SyncState`.
- Updated `mapSyncToState` to parse `m.room.topic` into room summaries and `m.typing` ephemeral events into `typingByRoom`.
- Updated `mapMatrixMessageEvent` to extract `formatted_body` for `m.text` and `m.notice` when `format: org.matrix.custom.html`.
- Updated `chat-main` CSS grid to four rows to accommodate the typing indicator between the composer and timeline.
- Updated `matrixViewStateUtils.test.ts` fixtures to include the now-required `topic` field on `RoomSummary`.
- Updated `MatrixConfig` to include `deviceId` so authenticated sessions retain device metadata for future encryption workflows.
- Updated `RoomSummary` to include `isEncrypted` so encrypted rooms can be represented explicitly in state and UI.
- Updated the settings dialog with a first-class password-login path, key-backup status check, and device/session metadata display.
- Updated the settings dialog with an encrypted room-keys section for importing Element-compatible exported key JSON and exporting this device's stored room keys.
- Removed duplicated key-transfer controls from Encryption Backup; Import / Export Keys remains the single source of truth for cross-client key import/export.
- Updated room-key import/export UX to support `.txt` exports from other Matrix clients (alongside `.json`), including file picker accept rules and compatible export filename defaults.
- Updated room-key import to normalize additional export payload shapes and support passphrase-protected megolm key exports from Element-compatible clients.
- Updated timeline rendering to distinguish decrypted encrypted messages from undecryptable placeholders and surface per-message encrypted state in the chat view.
- Updated the encryption backup section with recovery-key and passphrase restore actions so encrypted history can be recovered directly from the homeserver backup.
- Updated undecryptable encrypted-message placeholders with actionable recovery guidance for backup restore vs manual key import paths.
- Updated room-list and active-room header UI to expose crypto recovery state directly where users navigate and read conversations.
- Updated Settings spacing, section card styling, and responsive behavior to avoid cramped presentation while preserving all existing Matrix and encryption flows.
- Tightened the Discord-style Settings dialog width and constrained settings content sections to readable bounds so encryption controls no longer render in overly wide layouts.
- Updated the Encryption Backup action layout to a stacked Discord-like flow so restore actions no longer trigger horizontal scrolling in the settings content pane.
- Updated the Settings dialog shell to a stable fixed-height layout with a dedicated scrollable content region so category switching no longer changes dialog size and vertical scrolling remains consistent.
- Tightened the main chat shell spacing and panel widths so the timeline, composer, and header feel denser and more Discord-like instead of vertically stretched.
- Fixed chat shell overflow so the timeline is the only scrolling region and the composer stays docked at the bottom instead of falling below the fold.
- Fixed a responsive layout regression where closing the Members List at mid-width breakpoints could still leave a reserved right-side gap due to breakpoint grid overrides.
- Added room-list filter controls for `All`, `People`, `Rooms`, and `Unread`, with direct-message classification to support person-vs-room filtering in the sidebar.
- Fixed the Remember credentials checkbox row alignment in Settings so the checkmark and label baseline are visually aligned.
- Added tooltip coverage for Settings navigation tabs and high-impact actions (login/connect, backup checks, restore/import/export actions, close, and save/connect).
- Updated the shared `Tooltip` primitive from CSS-only hover/focus behavior to explicit open-state management so stuck tooltips reliably vanish in desktop and touch-adjacent interactions.
- Updated tooltip presentation to wrap long labels, cap tooltip width, and automatically flip left when right-side space is insufficient, preventing off-screen rendering in Settings and other narrow edges.
- Updated Vite development server configuration to enforce port `5173` via strict port mode and ignore `release`, `dist`, and `out` directories during watch, reducing dev-session instability and spurious reload churn.
- Reverted Vite dev-session WASM ESM resolution condition for `@matrix-org/matrix-sdk-crypto-wasm` because it caused runtime overlay failures (`ESM integration proposal for Wasm is not supported currently`) during crypto status refresh.
- Fixed Vite dev-time WASM MIME failures by excluding `@matrix-org/matrix-sdk-crypto-wasm` from optimize-deps prebundling so wasm is loaded from its real package path instead of a broken `.vite/deps/pkg` URL.
- Updated project instructions to require fully implemented features with no unfinished scaffolds or leftover core-feature `TODO` markers.
- Removed `LICENSE.md` from the repository; canonical license file remains `LICENSE`.
- Updated project engineering guidance to require building and validating both Debug and Release variants for completed implementation changes.
- Updated engineering guidance to require a professional automated testing suite and to run/pass relevant tests before Debug and Release build validation.
- Added `copilot-instructions.md` to `.gitignore`.
- Expanded `.gitignore` with standard Node.js/TypeScript/Vite, environment, cache, IDE, OS, and test artifact ignore patterns.
- Updated project instructions to explicitly define Electron + React + TypeScript as the base stack direction.
- Updated project instructions to treat `https://github.com/AnotherLaughingMan/Sinnamon` as the canonical source repository for this project.
- Updated `package.json` scripts to run the app in Electron during development (`npm run dev`) and direct launch (`npm run start`).
- Updated `package.json` with `package:debug` and `package:release` scripts plus Electron builder configuration for Windows packaging targets.
- Updated README tech stack and commands to reflect Electron usage.
- Updated README with Electron packaging commands for Debug (`npm run package:debug`) and Release (`npm run package:release`) builds.
- Updated login persistence so homeserver/user/device profile fields are restored reliably while access tokens are stored separately according to the Remember credentials setting.
- Updated backup mismatch guidance in Encryption Backup and missing-key recovery status to explicitly state that exported room-key imports can still decrypt history even when server backup recovery key/passphrase does not match the current backup version.
- Expanded `.gitignore` with Electron packaging output paths (`out/`, `release/`).
- Updated project license from MIT to GNU Affero General Public License v3.0 (AGPL-3.0).
- Corrected `LICENSE.md` to the full verbatim AGPL-3.0 text from `AnotherLaughingMan/Sinnamon` upstream `LICENSE`.
- Initialized local git repository on `main` and linked `origin` to `https://github.com/AnotherLaughingMan/Sinnamon.git`.
- Added Electron builder configuration and scripts for executable end-to-end Debug and Release packaging pipeline.
- Updated `tsconfig.node.json` to `noEmit` to prevent generated `vite.config` build artifacts during typecheck/build runs.

### Fixed

- Resolved `SIN-0002`: polling error handling no longer reports `connected` before successful recovery; state now remains degraded until incremental sync succeeds.
- Resolved `SIN-0003`: account/config context changes now clear prior room/timeline session data immediately to prevent stale cross-account visibility.
- Improved incremental sync lifecycle safety: polling requests now use abort signals so in-flight sync calls are canceled during teardown/config changes instead of applying stale updates.
- Fixed Matrix read receipt publishing against matrix.org by matching SDK-style JSON receipt posts and falling back to `/read_markers` when the direct `m.read` receipt endpoint rejects the request with `400`.
- Fixed encrypted room-key import failures for real-world `.txt` exports by adding explicit passphrase input and actionable format/decryption error guidance.
- Fixed rust-crypto account/device store mismatch recovery by reusing the existing device ID on password login and auto-clearing stale local crypto stores when a stored account tuple no longer matches the current session.
- Improved backup and key-import recovery UX by adding immediate start-status feedback, restore timeout protection, explicit no-backup preflight checks, and automatic post-restore/post-import timeline resync so decrypted history updates immediately.
- Improved backup restore error handling for backup-version/key mismatches (`getBackupDecryptor` mismatch) with actionable guidance to use the newest Element recovery key and fall back to exported room-key import for older history.
- Fixed sparse incremental sync regressions that could replace room names with raw room IDs and incorrectly flip rooms into the `People` filter; room metadata now preserves stable names/encryption state and applies a stricter direct-message classification heuristic.
- Improved encryption recovery status messaging to explicitly report zero-key restore/import outcomes and direct users toward exported room-key imports when backup restores complete without recovering decryptable sessions.
- Improved encrypted-message recovery guidance for rust-crypto pre-login failures (`sent before this device logged in` + `key backup is not working`) and classify these cases as key-import-needed in room crypto health badges.
- Fixed room-list duplication regressions by deduplicating room summaries on both initial and incremental sync updates, while preserving stable room metadata when duplicate payload entries disagree.
- Updated recovery guidance copy to align with current Element behavior (`Change recovery key` flow with generated key file), including explicit warning that older history may be unrecoverable without prior key export.
- Refactored Encryption Backup settings into a dedicated `BackupSettingsSection` feature component to reduce `SettingsPanel` monolith complexity and keep recovery/backup flows isolated.
- Updated `.github/copilot-instructions.md` to require consulting `element-web-ex` for settings, encryption UX, key backup/recovery, verification, and device trust implementation decisions.
- Reorganized Settings information architecture into explicit categories (`Connection & Login`, `Verification & Trust`, `Backup & Recovery`, `Key Transfer`, `Help & About`) with grouped sidebar sections and category summary copy for clearer navigation.
- Replaced all Unicode/emoji icon characters (⚙, 🔒, 🔎, 📌, 👥, 😀, ➤, ⓘ, ✕, +) with `lucide-react` SVG components across `LayoutShell.tsx` and `SettingsPanel.tsx` for a professional icon system. Added per-category icons to the Settings sidebar navigation (icon + label pattern, Discord-style). `@tabler/icons-react` designated as the supplemental fallback for icons not covered by Lucide.
- Fixed app-shell layout in maximized and full-screen window states: removed `width: min(100%, 1680px)` centering cap and `min-width: 980px` override so the shell fills the full window at all sizes. Previously, on monitors wider than 1680px the grid would center with gutters and the different-colored panels (sidebar, member panel) would produce a visible color seam against the background.
- Updated responsive member-panel behavior: at small window widths it still auto-collapses by default, but clicking the Member List button now opens it as a right-side overlay so users can view members on-demand without requiring a wider window.
- Improved small-width member-panel usability: added an explicit close (`X`) button inside the member panel header and shifted chat header action buttons left while the overlay is open so the member toggle remains visible and actionable.
- Updated the chat header `Info` action to open the right-side panel in a dedicated `Room Info` mode, showing room metadata (name/topic/id/encryption/member count) and providing an in-panel `Settings` link for quick access to room/session settings.
- Fixed right-panel close behavior to follow an Element-style single-panel phase model: the panel close (`X`) now always closes the currently active right panel instead of switching from Room Info to Members, preventing stacked/overlapping panel interactions.
- Updated Room Info `Settings` navigation to open a dedicated Room Settings dialog (separate from User Settings), matching Element-style room-summary-to-room-settings separation and supporting per-room admin-oriented controls.
- Added verification workflow foundation in Settings with DM verification request initiation and verification-state inspection (cross-signing state, pending to-device requests, and in-progress DM verification sessions) wired to rust-crypto APIs.
- Expanded verification workflow controls with DM request accept/cancel and SAS actions (start/continue, confirm match, mismatch), including in-app SAS decimal/emoji display for manual cross-client verification.
- Added device-trust management controls for E2EE verification: list per-device trust status, mark a device locally verified, and cross-sign own devices from Settings to complete trust setup across clients.
- Added a phase-4 missing-key recovery workflow that retries undecryptable events for the current room by attempting backup-key restore (when available) and forcing a fresh sync/decrypt pass with before/after undecryptable counts.
- Added `recoverMissingKeysFromBackup` crypto helper plus dedicated unit tests covering backup-restore, no-backup, and missing-local-backup-key paths.
- Hardened Matrix polling lifecycle against stale-room and retry-sleep cancellation races by using room refs and cancelable retry waits during incremental sync.
- Hardened missing-key recovery flow against concurrent runs and session changes, with deterministic error state transitions when refresh sync fails.
- Fixed crypto client cache behavior after account-store mismatch recovery so the successfully reset rust-crypto client is reused instead of re-created on subsequent operations.
- Fixed a post-refactor type regression in `SettingsPanel` by restoring the missing `VerificationSasData` import used by SAS verification props.

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
