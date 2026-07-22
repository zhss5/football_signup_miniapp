# Configurable Late Cancellation Notice Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for every behavior change and superpowers:verification-before-completion before each commit.

**Goal:** Add a configurable `0..168` hour late-cancellation organizer notice window to mini-program activity create, edit, and copy flows while preserving backward compatibility.

**Architecture:** Keep `lateCancellationNoticeWindowHours` as an activity API field and CloudBase document field. Validate it independently at mini-program and cloud-function boundaries, default historical or omitted values to `6`, and preserve valid values through copy drafts. Keep the existing `cancelRegistration` notification behavior unchanged.

**Tech Stack:** WeChat Mini Program, CloudBase cloud functions, CloudBase document database, Jest.

---

## Global Constraints

- Do not modify the existing cancellation notification execution logic unless a regression test proves a defect.
- Do not introduce runtime MySQL, dual-write, or a self-hosted HTTP API.
- Preserve the API/SQL boundary: camelCase API field and snake_case target SQL column.
- Do not stage unrelated local changes.
- Each milestone must start with a failing test, pass its target tests, update documentation when its contract changes, and end in a local commit.

## Milestone 1: Backend Create And Update Persistence

**Files:**

- Modify: `tests/cloudfunctions/createActivity.test.js`
- Modify: `tests/cloudfunctions/updateActivity.test.js`
- Modify: `cloudfunctions/createActivity/index.js`
- Modify: `cloudfunctions/updateActivity/index.js`

1. Add failing tests proving omitted values default to `6`, `0` and `168` persist, and invalid values are rejected.
2. Run the two target test files and confirm the new tests fail.
3. Add narrow local normalization helpers to both cloud functions and persist the field.
4. Verify update audit metadata includes the field when changed.
5. Run the target tests and `git diff --check`.
6. Commit as `feat: persist late cancellation notice window`.

## Milestone 2: Activity Copy Compatibility

**Files:**

- Modify: `tests/cloudfunctions/getActivityCopyDraft.test.js`
- Modify: `cloudfunctions/getActivityCopyDraft/index.js`

1. Add failing tests proving valid values, including `0`, are preserved and a missing historical value becomes `6`.
2. Run the target test and confirm failure.
3. Normalize the copied field without coupling the API response to page state.
4. Run the target test and `git diff --check`.
5. Commit as `feat: preserve cancellation notice window in activity copies`.

## Milestone 3: Mini-Program Form And Local Runtime

**Files:**

- Modify: `tests/miniprogram/utils/activity-draft.test.js`
- Modify: `tests/miniprogram/utils/validators.test.js`
- Modify: `tests/miniprogram/pages/activity-create-submit.test.js`
- Modify: `tests/miniprogram/pages/activity-create-default-teams.test.js`
- Modify: `tests/miniprogram/utils/i18n.test.js`
- Modify: `tests/miniprogram/mocks/local-cloud.test.js`
- Modify: `miniprogram/utils/activity-draft.js`
- Modify: `miniprogram/utils/validators.js`
- Modify: `miniprogram/pages/activity-create/index.js`
- Modify: `miniprogram/pages/activity-create/index.wxml`
- Modify: `miniprogram/locales/zh-CN.js`
- Modify: `miniprogram/locales/en-US.js`
- Modify: `miniprogram/mocks/local-cloud.js`

1. Add failing tests for default/edit/copy form values, payload inclusion, input binding, validation, localization, and local persistence.
2. Run the target mini-program tests and confirm failure.
3. Add the notification-settings field, localized copy, client validation, draft mapping, and local mock persistence.
4. Run all affected mini-program tests and `git diff --check`.
5. Commit as `feat: configure cancellation notice window in mini program`.

## Milestone 4: Readiness Documentation And Deployment Verification

**Files:**

- Modify: `docs/superpowers/specs/2026-06-10-sql-migration-readiness.md`
- Modify: `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`
- Modify: `docs/development-log-v2.md`
- Modify: `docs/superpowers/handoff/football-signup-miniapp-handoff.md`

1. Document the accepted `0..168` range, default, disabled value, API mapping, tests, and deployment scope.
2. Run backend, copy, mini-program, and existing `cancelRegistration` target tests.
3. Run the full `npm test` suite where feasible and run `git diff --check`.
4. Deploy `createActivity`, `updateActivity`, and `getActivityCopyDraft` to `cloudbase-miniapp-test-dfc753877` if credentials and tooling are available.
5. Record mini-program experience-build requirements or blockers without modifying unrelated local configuration.
6. Commit as `docs: record cancellation notice window rollout`.
