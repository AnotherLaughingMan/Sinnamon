# Issues Register

This file tracks bugs, defects, technical debt, UX gaps, and operational issues for Sinnamon.

## Tracking Rules

- Every issue must have a unique serialized ID: `SIN-0001`, `SIN-0002`, `SIN-0003`, etc.
- IDs are never reused, even if an issue is removed or merged.
- Create new issues by incrementing the `Next Issue ID` value below.
- Keep issue records immutable except for status, assignee, links, and progress notes.

## Issue ID Serialization

- Prefix: `SIN`
- Format: `SIN-####` (4 digits, zero-padded)
- Examples: `SIN-0001`, `SIN-0142`, `SIN-1024`

## Required Tags

Each issue must include all required tags:

- `Type`: `bug` | `feature-gap` | `tech-debt` | `performance` | `security` | `ux` | `docs` | `infra`
- `Priority`: `p0` | `p1` | `p2` | `p3`
- `Severity`: `critical` | `high` | `medium` | `low`
- `Area`: `ui` | `matrix-sync` | `encryption` | `settings` | `state` | `build` | `docs` | `testing`
- `Status`: `open` | `in-progress` | `blocked` | `resolved` | `closed`

## Metadata Standard

Use this metadata block for every issue:

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
- Links: (PR/commit/design/doc links)

**Summary**
One concise paragraph describing the issue.

**Steps to Reproduce**

1. Step one
2. Step two
3. Observed result

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

- Next Issue ID: `SIN-0011`
- Last Updated: `2026-04-03`

## Open

### SIN-0001 — Matrix access token stored in local storage without hardening

- Type: security
- Priority: p1
- Severity: high
- Area: settings
- Status: open
- Reporter: @copilot
- Assignee: unassigned
- Created: 2026-03-03
- Updated: 2026-03-03
- Links: src/App.tsx

**Summary**
The Matrix access token is persisted in browser local storage, which increases exposure risk for token theft on compromised clients.

**Steps to Reproduce**

1. Open Settings and save a valid access token.
2. Open browser dev tools storage inspector.
3. Observe token is stored as plain text under app storage keys.

**Expected Behavior**
Sensitive tokens should use safer storage patterns and explicit session controls.

**Impact**
Potential account compromise if local storage is accessed by malicious scripts or shared workstation users.

**Acceptance Criteria**

- [ ] Storage strategy for access tokens is documented with threat model tradeoffs.
- [ ] Token handling supports safer defaults (session scope or encrypted-at-rest strategy where feasible).
- [ ] UI includes explicit “remember me” behavior instead of implicit persistent storage.

**Progress Notes**

- 2026-03-03: Issue logged from architecture review.

### SIN-0004 — Timeline parser excludes non-text events needed for core chat parity

- Type: feature-gap
- Priority: p2
- Severity: medium
- Area: matrix-sync
- Status: open
- Reporter: @copilot
- Assignee: unassigned
- Created: 2026-03-03
- Updated: 2026-03-03
- Links: src/matrix/matrixService.ts

**Summary**
Current sync mapping only accepts `m.room.message` with `msgtype=m.text`; media, emote, notice, reply metadata, and edits are ignored.

**Steps to Reproduce**

1. Open a room containing image/sticker/reply/edit events.
2. Sync room timeline in Sinnamon.
3. Observe only plain text messages appear.

**Expected Behavior**
Timeline should gracefully represent common message variants and relation metadata.

**Impact**
Conversation context is incomplete and diverges from user expectations for modern chat UX.

**Acceptance Criteria**

- [ ] Message model includes common msgtypes and relation metadata.
- [ ] Unsupported events render with safe fallback instead of being silently dropped.
- [ ] Parsing behavior documented for supported/unsupported event types.

**Progress Notes**

- 2026-03-03: Issue logged from timeline parser review.

### SIN-0005 — Poll requests are not abortable on teardown/config change

- Type: performance
- Priority: p2
- Severity: medium
- Area: matrix-sync
- Status: open
- Reporter: @copilot
- Assignee: unassigned
- Created: 2026-03-03
- Updated: 2026-03-03
- Links: src/state/useMatrixViewState.ts; src/matrix/matrixService.ts

**Summary**
Polling loop relies on a cancellation flag but does not abort in-flight fetch requests, which can leave long-poll requests running during unmount or rapid config changes.

**Steps to Reproduce**

1. Connect and start long-poll incremental sync.
2. Rapidly switch config or navigate away/unmount component.
3. Observe in-flight requests continue until timeout.

**Expected Behavior**
In-flight poll requests should be aborted immediately when no longer relevant.

**Impact**
Wasted network resources and potential stale update races.

**Acceptance Criteria**

- [ ] Polling uses `AbortController` (or equivalent) for request cancellation.
- [ ] Teardown and config changes abort pending requests deterministically.
- [ ] No stale response applies state after cancellation.

**Progress Notes**

- 2026-03-03: Issue logged from lifecycle behavior review.

### SIN-0006 — Local unread clearing can diverge from server unread/read-receipt state

- Type: bug
- Priority: p2
- Severity: medium
- Area: state
- Status: open
- Reporter: @copilot
- Assignee: unassigned
- Created: 2026-03-03
- Updated: 2026-03-03
- Links: src/state/useMatrixViewState.ts

**Summary**
Unread count for the active room is forcibly zeroed in local state without publishing read receipts, which can diverge from true server-side unread state.

**Steps to Reproduce**

1. Receive unread messages in a room.
2. Open the room in Sinnamon.
3. Observe unread badge clears locally even without explicit read receipt sync.

**Expected Behavior**
Unread presentation should align with acknowledged read semantics and server state.

**Impact**
Badge inconsistencies across clients and potential confusion for users.

**Acceptance Criteria**

- [ ] Unread-clearing strategy is defined (local optimistic vs server-confirmed).
- [ ] If optimistic, reconciliation logic corrects mismatches on subsequent sync.
- [ ] Behavior is documented for multi-client scenarios.

**Progress Notes**

- 2026-03-03: Issue logged from unread-state edge-case review.

### SIN-0007 — Room title fallback can expose raw room IDs during limited/incremental state

- Type: ux
- Priority: p3
- Severity: low
- Area: ui
- Status: open
- Reporter: @copilot
- Assignee: unassigned
- Created: 2026-03-03
- Updated: 2026-03-03
- Links: src/matrix/matrixService.ts

**Summary**
When name/canonical alias/heroes are unavailable in incremental or limited state snapshots, room label falls back to raw room ID, reducing readability.

**Steps to Reproduce**

1. Join/sync rooms where state events are partial or delayed.
2. Load room list.
3. Observe raw Matrix room IDs displayed as names.

**Expected Behavior**
UI should preserve a user-friendly fallback naming strategy and recover display names when state arrives.

**Impact**
Reduced usability and discoverability in room navigation.

**Acceptance Criteria**

- [ ] Friendly fallback naming strategy is defined for unknown rooms.
- [ ] Late-arriving state updates room titles without requiring full reconnect.
- [ ] Raw room IDs are minimized in visible room list UX.

**Progress Notes**

- 2026-03-03: Issue logged from room labeling edge-case review.

## In Progress

### SIN-0008 — Incremental sync polling can apply stale room/read state during session and room transitions

- Type: bug
- Priority: p0
- Severity: critical
- Area: state
- Status: in-progress
- Reporter: @copilot
- Assignee: unassigned
- Created: 2026-04-03
- Updated: 2026-04-03
- Links: src/state/useMatrixViewState.ts

**Summary**
The incremental sync loop captured mutable view state in closures (selected room and retry sleep lifecycle), allowing stale room/read behavior and delayed cancellation during account or room transitions.

**Steps to Reproduce**

1. Connect to Matrix and start incremental polling.
2. Rapidly switch rooms while a sync retry cycle is active.
3. Observe unread/read effects can be applied against stale room context.

**Expected Behavior**
Polling should only apply state using the latest active room and should cancel retry sleep immediately when session/poll lifecycle is torn down.

**Impact**
User-visible unread/read inconsistencies and elevated risk of stale state application under connection churn.

**Acceptance Criteria**

- [x] Polling read-state merges use current-room refs instead of stale closure values.
- [x] Retry sleep can be canceled on cleanup to avoid hanging stale loops.
- [ ] Add focused regression tests for room-switch + retry-cancel race behavior.

**Progress Notes**

- 2026-04-03: Issue logged from severe audit pass.
- 2026-04-03: Implemented first mitigation (current-room ref + cancelable retry wait) in `useMatrixViewState`; test expansion still pending.

### SIN-0009 — Missing-key recovery flow can run concurrently and produce ambiguous failure/session outcomes

- Type: bug
- Priority: p0
- Severity: critical
- Area: encryption
- Status: in-progress
- Reporter: @copilot
- Assignee: unassigned
- Created: 2026-04-03
- Updated: 2026-04-03
- Links: src/state/useMatrixViewState.ts; src/components/SettingsPanel.tsx

**Summary**
Recovery actions could overlap and lacked strict session-stability checks during long-running recovery/sync operations, causing ambiguous status outcomes under account/session changes.

**Steps to Reproduce**

1. Trigger missing-key recovery repeatedly while switching accounts/config.
2. Let backup restore partially fail and sync refresh fail.
3. Observe confusing or inconsistent state/error transitions.

**Expected Behavior**
Only one recovery run should be active, and session changes during recovery should fail deterministically with explicit user guidance.

**Impact**
Risk of misleading recovery state and difficult incident diagnosis for encrypted history recovery.

**Acceptance Criteria**

- [x] Concurrent recovery runs are prevented.
- [x] Session fingerprint checks abort stale recovery runs.
- [x] Sync failure after recovery attempt sets deterministic error state.
- [ ] Add tests for session-switch during recovery.

**Progress Notes**

- 2026-04-03: Issue logged from severe audit pass.
- 2026-04-03: Implemented in-flight guard + session fingerprint checks + deterministic error transitions.

### SIN-0010 — Crypto client cache is not stable after account-store mismatch recovery

- Type: bug
- Priority: p1
- Severity: high
- Area: encryption
- Status: in-progress
- Reporter: @copilot
- Assignee: unassigned
- Created: 2026-04-03
- Updated: 2026-04-03
- Links: src/matrix/matrixCryptoService.ts; src/matrix/matrixCryptoService.test.ts

**Summary**
After rust-crypto account-store mismatch handling, the successfully reset client was not guaranteed to remain cached for subsequent operations, causing unnecessary re-creation and instability risk.

**Steps to Reproduce**

1. Trigger account-store mismatch path during crypto initialization.
2. Execute sequential crypto operations requiring the same session.
3. Observe client recreation instead of stable reuse.

**Expected Behavior**
Mismatch recovery should return and cache a stable client instance for subsequent operations.

**Impact**
Increased initialization churn and elevated risk of inconsistent crypto operation behavior.

**Acceptance Criteria**

- [x] Recovered client is cached after successful mismatch reset path.
- [x] Regression test verifies no extra client recreation on subsequent operations.

**Progress Notes**

- 2026-04-03: Issue logged from severe audit pass.
- 2026-04-03: Implemented cache stabilization and added regression test.

## Blocked

_No blocked issues._

## Resolved / Closed

### SIN-0002 — Connection state can report connected after repeated polling failures

- Type: bug
- Priority: p1
- Severity: medium
- Area: matrix-sync
- Status: resolved
- Reporter: @copilot
- Assignee: unassigned
- Created: 2026-03-03
- Updated: 2026-03-03
- Links: src/state/useMatrixViewState.ts

**Summary**
On incremental sync errors, the poll loop set `error` and then flipped state back to `connected` after retry delay even if the next request had not succeeded.

**Steps to Reproduce**

1. Connect to Matrix successfully.
2. Simulate network outage or invalid token response during polling.
3. Observe connection label can revert to connected before successful recovery.

**Expected Behavior**
Connection state should remain degraded until a confirmed successful sync response.

**Impact**
Misleading status can hide outages and complicate debugging/reporting.

**Acceptance Criteria**

- [x] Status remains `error`/`degraded` until a successful poll response occurs.
- [x] Recovery path transitions are explicit and testable.
- [x] Retry behavior is documented in state notes.

**Progress Notes**

- 2026-03-03: Issue logged from polling flow review.
- 2026-03-03: Fixed by keeping polling loop active via session token gating and only returning to `connected` on successful incremental sync responses.

### SIN-0003 — Switching Matrix account/config can leave stale room and message data visible

- Type: bug
- Priority: p1
- Severity: high
- Area: state
- Status: resolved
- Reporter: @copilot
- Assignee: unassigned
- Created: 2026-03-03
- Updated: 2026-03-03
- Links: src/state/useMatrixViewState.ts

**Summary**
When credentials or homeserver changed, prior session rooms/messages could remain in memory/UI until a new successful connect, causing cross-account data leakage in-session.

**Steps to Reproduce**

1. Connect using Account A and view rooms/messages.
2. Open settings and replace with Account B credentials.
3. Before successful reconnect, observe Account A data can remain visible.

**Expected Behavior**
Session-scoped data should be cleared or isolated immediately when account context changes.

**Impact**
Privacy and correctness risk in shared-session or multi-account workflows.

**Acceptance Criteria**

- [x] Changing config invalidates prior account room/message state immediately.
- [x] UI clearly shows reconnecting/empty state while new session data loads.
- [x] No cross-account room/timeline bleed-through.

**Progress Notes**

- 2026-03-03: Issue logged during edge-case session review.
- 2026-03-03: Fixed by fingerprinting active session config and immediately clearing rooms/messages/token whenever saved config context changes.

## Tagging Guidance

- `Type=bug` when behavior deviates from expected behavior.
- `Type=feature-gap` when expected product capability is missing by design scope.
- `Priority` should reflect urgency/order of execution; `Severity` should reflect user/system impact.
- If uncertain between two tags, choose the higher-impact tag and document rationale in `Progress Notes`.

## Change Discipline

When updating this file:

1. Move issues between sections as status changes.
2. Update `Updated` date on every issue change.
3. Keep `Next Issue ID` accurate whenever a new issue is added.
4. Preserve historical notes; do not delete prior progress entries.
