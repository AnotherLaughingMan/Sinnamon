# Sinnamon E2EE Implementation Baseline

This document defines the non-negotiable E2EE implementation baseline while rebuilding Sinnamon from scratch using the `apps/web` and `apps/desktop` architecture.

## Goals

- Preserve end-to-end encryption safety across login, device changes, and recovery.
- Keep behavior aligned with Element-style UX for trust, backup, and recovery flows.
- Expose failures clearly; never suppress, fake, or bypass encryption errors.

## Required Flows

- Device identity bootstrap and persistent device ID handling.
- Cross-signing status visibility and explicit user-driven trust actions.
- Secret storage and key backup restore/import flows.
- Room key import/export compatibility for account recovery scenarios.
- Verification request handling (including incoming verification state updates).
- Clear undecryptable-message state and actionable recovery guidance.

## Engineering Constraints

- Do not add workaround-only paths to hide crypto bugs.
- Do not remove failing E2EE behavior to force green checks.
- Keep all E2EE code paths typed and test-covered.
- Treat backup mismatch and trust mismatch as explicit, user-visible states.

## Validation Expectations

- Unit coverage for key recovery and verification state transitions.
- Integration coverage for backup restore and undecryptable-message retries.
- Build checks for both web and desktop targets before shipping changes.
