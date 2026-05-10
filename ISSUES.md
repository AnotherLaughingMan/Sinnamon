# Issues Register

This file tracks active defects, feature gaps, and technical debt for the rebuilt Sinnamon client baseline.

The previous issue register referenced a pre-rebuild client architecture and has been intentionally replaced.

## Tracking Rules

- Every issue must have a unique serialized ID: `SIN-0001`, `SIN-0002`, `SIN-0003`, etc.
- IDs are never reused, even when issues are resolved or removed from active sections.
- New issues increment `Next Issue ID`.
- Preserve issue history in progress notes; do not rewrite prior notes.

## Required Tags

Each issue must include all required tags:

- `Type`: `bug` | `feature-gap` | `tech-debt` | `performance` | `security` | `ux` | `docs` | `infra`
- `Priority`: `p0` | `p1` | `p2` | `p3`
- `Severity`: `critical` | `high` | `medium` | `low`
- `Area`: `ui` | `matrix-sync` | `encryption` | `settings` | `state` | `build` | `docs` | `testing` | `desktop`
- `Status`: `open` | `in-progress` | `blocked` | `resolved` | `closed`

## Metadata Template

Use this structure for each issue:

```md
### SIN-0001 — Short Issue Title

- Type: bug
- Priority: p1
- Severity: high
- Area: ui
- Status: open
- Reporter: @name
- Assignee: unassigned
- Created: YYYY-MM-DD
- Updated: YYYY-MM-DD
- Links: path/to/file.ts; path/to/other.ts

**Summary**
One concise paragraph describing the issue.

**Steps to Reproduce**

1. Step one.
2. Step two.
3. Observed result.

**Expected Behavior**
What should happen.

**Impact**
User/business/technical impact.

**Acceptance Criteria**

- [ ] Condition 1
- [ ] Condition 2

**Progress Notes**

- YYYY-MM-DD: Note.
```

## Tracker State

- Baseline Reset Date: `2026-04-04`
- Next Issue ID: `SIN-0006`
- Last Updated: `2026-04-04`

## Open

### SIN-0003 — Discord-like shell layout is not implemented on rebuilt baseline

- Type: feature-gap
- Priority: p1
- Severity: high
- Area: ui
- Status: in-progress
- Reporter: @copilot
- Assignee: unassigned
- Created: 2026-04-04
- Updated: 2026-04-04
- Links: apps/web/src/components/structures/LoggedInView.tsx; .github/copilot-instructions.md

**Summary**
Current logged-in experience retains the Element layout rather than the required Sinnamon Discord-style shell.

**Steps to Reproduce**

1. Launch and sign in.
2. Observe the logged-in layout structure.
3. Compare against required server rail + channel sidebar + timeline + optional right panel + bottom composer target.

**Expected Behavior**
Logged-in shell should match the approved Discord-like spatial model.

**Impact**
Primary product differentiation is not yet visible.

**Acceptance Criteria**

- [ ] Dedicated server rail exists as first column.
- [ ] Channel/room list column is distinct from main timeline.
- [ ] Main timeline and composer occupy primary central area.
- [ ] Optional right panel placeholder can be enabled without layout breakage.

**Progress Notes**

- 2026-04-04: Issue created from implementation gap review.
- 2026-04-04: Added initial `SinnamonLayout` shell behind config flag `sinnamon_discord_layout` in `LoggedInView`; layout now supports server rail, channel sidebar, and main timeline regions with responsive grid sizing.
- 2026-04-04: Added dedicated `ServerRail` and `ChannelSidebar` wrapper components around `SpacePanel` and `LeftPanel`, giving the shell Sinnamon-owned structural surfaces for further Discord-style refinement.

### SIN-0004 — Tooltip coverage for actionable icon controls is below project requirement

- Type: ux
- Priority: p2
- Severity: medium
- Area: ui
- Status: open
- Reporter: @copilot
- Assignee: unassigned
- Created: 2026-04-04
- Updated: 2026-04-04
- Links: .github/copilot-instructions.md; apps/web/src/components/

**Summary**
Project directive requires near-universal tooltip coverage for actionable controls, but current rebuilt baseline has inconsistent tooltip behavior and no unified scaffold for new Sinnamon UI surfaces.

**Steps to Reproduce**

1. Navigate primary app surfaces (space controls, room actions, header actions).
2. Hover actionable icons.
3. Observe missing or inconsistent tooltip behavior across controls.

**Expected Behavior**
Actionable controls should expose clear, consistent tooltips with accessible interaction behavior.

**Impact**
Reduced discoverability and accessibility for power and first-time users.

**Acceptance Criteria**

- [ ] A shared tooltip primitive/provider is defined for Sinnamon UI work.
- [ ] New server rail and sidebar controls include tooltips.
- [ ] Existing high-frequency icon controls are audited for tooltip coverage.

**Progress Notes**

- 2026-04-04: Issue created from UX directive compliance review.

### SIN-0005 — Encryption/key recovery behavior parity audit against reference implementation is incomplete

- Type: tech-debt
- Priority: p1
- Severity: high
- Area: encryption
- Status: open
- Reporter: @copilot
- Assignee: unassigned
- Created: 2026-04-04
- Updated: 2026-04-04
- Links: docs/E2EE-IMPLEMENTATION-BASELINE.md; /memories/repo/crypto-import-notes.md

**Summary**
Rebuild baseline needs an explicit parity audit to confirm key backup, recovery, secret storage, and device trust flows align with project encryption requirements.

**Steps to Reproduce**

1. Execute post-login setup and key recovery scenarios.
2. Compare flow behavior to required reference guidance.
3. Record mismatches in flow order, messaging, and recovery outcomes.

**Expected Behavior**
Critical encryption and key recovery flows should be validated and tracked with explicit parity outcomes.

**Impact**
Potential encrypted history recovery failures and user trust regressions.

**Acceptance Criteria**

- [ ] Documented parity checklist for key backup/recovery and cross-signing flows.
- [ ] Gaps tracked as discrete issues with reproducible steps.
- [ ] Critical mismatches prioritized before release hardening.

**Progress Notes**

- 2026-04-04: Issue created from E2EE baseline directive review.

## In Progress

_No in-progress issues._

## Blocked

_No blocked issues._

## Resolved / Closed

### SIN-0001 — Desktop build identity still uses Element metadata in packaged artifacts

- Type: bug
- Priority: p0
- Severity: critical
- Area: desktop
- Status: resolved
- Reporter: @copilot
- Assignee: unassigned
- Created: 2026-04-04
- Updated: 2026-04-04
- Links: apps/desktop/sinnamon/release/build.json; apps/desktop/sinnamon/release/config.json; apps/desktop/sinnamon/nightly/build.json; apps/desktop/sinnamon/nightly/config.json

**Summary**
Desktop build metadata and config referenced Element naming and infrastructure, causing installer identity and runtime branding mismatch.

**Steps to Reproduce**

1. Build desktop package.
2. Inspect generated app metadata and in-app branding.
3. Observe Element naming/identifiers instead of Sinnamon.

**Expected Behavior**
All desktop build variants identify as Sinnamon and use Sinnamon-specific branding values.

**Impact**
Incorrect product identity in installers and runtime, release risk, and user confusion.

**Acceptance Criteria**

- [x] Release and nightly build metadata use Sinnamon app IDs and product names.
- [x] Runtime config brand values are Sinnamon-specific.
- [x] Element-specific telemetry/update/bug-report endpoints were removed from the desktop variant configs.

**Progress Notes**

- 2026-04-04: Issue created during desktop launch readiness audit.
- 2026-04-04: Updated desktop release/nightly build and config variants to Sinnamon branding; verified packaged output reports `appId: chat.sinnamon.desktop`, `productName: Sinnamon`.

### SIN-0002 — Desktop dev startup does not guarantee webapp availability

- Type: bug
- Priority: p0
- Severity: critical
- Area: build
- Status: resolved
- Reporter: @copilot
- Assignee: unassigned
- Created: 2026-04-04
- Updated: 2026-04-04
- Links: package.json; apps/desktop/scripts/link-webapp.mjs; apps/desktop/src/asar.ts; apps/web/webpack.config.ts

**Summary**
Desktop startup assumed `webapp` or `webapp.asar` exists, but dev workflow did not consistently build and stage web output before launching Electron.

**Steps to Reproduce**

1. Run desktop dev command from a clean state.
2. Electron launches without staged web assets.
3. App fails to load UI content.

**Expected Behavior**
Desktop dev startup should always stage the web output before launching Electron.

**Impact**
Blocks reliable local development and onboarding.

**Acceptance Criteria**

- [x] Dev script builds web output before desktop launch.
- [x] Dev script stages output into expected desktop `webapp` location.
- [x] Fresh startup path now includes deterministic staging (`stage:webapp:desktop`) before Electron launch.

**Progress Notes**

- 2026-04-04: Issue created during desktop launch readiness audit.
- 2026-04-04: Added `apps/desktop/scripts/link-webapp.mjs` and updated root scripts to build + stage web assets before desktop start.

## Change Discipline

When updating this file:

1. Move issues between sections as status changes.
2. Update `Updated` date on every issue change.
3. Keep `Next Issue ID` accurate whenever a new issue is added.
4. Keep acceptance criteria concrete and testable.
