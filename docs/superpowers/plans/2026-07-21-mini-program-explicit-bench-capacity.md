# Mini-Program Explicit Bench Capacity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editable total signup limit in mini-program activity create/edit/copy flows with an explicit bench capacity and a computed read-only total.

**Architecture:** Keep `benchCapacity` as an API/form field while retaining `activities.signupLimitTotal` as the persisted compatibility field. Derive total capacity from active regular-team capacities plus bench capacity at every mini-program boundary, and derive historical bench capacity from an active bench team or the legacy total-minus-regular difference.

**Tech Stack:** WeChat Mini Program JavaScript/WXML/WXSS, CloudBase cloud functions, Jest, local CloudBase mock.

## Global Constraints

- Preserve existing Version 1 clients that still submit only `signupLimitTotal`.
- Keep stable API field names: `benchCapacity` and `signupLimitTotal`.
- Store bench capacity in the generated `activity_teams` bench row; do not add a duplicate persisted activity field.
- Do not introduce MySQL runtime access, dual-write, or a self-hosted HTTP API.
- Use TDD and commit only milestone files; preserve unrelated local configuration changes.

---

### Task 1: Activity Draft Capacity Model

**Files:**
- Modify: `tests/miniprogram/utils/activity-draft.test.js`
- Modify: `tests/miniprogram/utils/validators.test.js`
- Modify: `miniprogram/utils/activity-draft.js`
- Modify: `miniprogram/utils/validators.js`

**Interfaces:**
- Consumes: regular teams with `maxMembers`, optional active bench teams, legacy `signupLimitTotal`.
- Produces: `benchCapacity: number`, computed `signupLimitTotal: number`, and payloads carrying both fields.

- [ ] **Step 1: Write failing draft-model tests**

Add assertions that defaults include `benchCapacity: 0`, payload totals are recomputed from regular plus bench capacity, edit forms recover bench capacity from a bench team, and copy forms fall back to legacy total-minus-regular capacity.

- [ ] **Step 2: Run the draft tests and verify RED**

Run: `npm test -- tests/miniprogram/utils/activity-draft.test.js --runInBand`

Expected: failures for missing `benchCapacity` and totals still copied from the editable legacy field.

- [ ] **Step 3: Implement capacity helpers and mappings**

Add focused helpers that normalize non-negative integer capacities, sum regular teams, derive bench capacity, and synchronize form totals. Make `buildActivityPayload()` always return:

```js
{
  benchCapacity,
  signupLimitTotal: regularCapacity + benchCapacity
}
```

- [ ] **Step 4: Write and run validation tests**

Add failing tests for negative or non-integer bench capacity, then update `validateActivityDraft()` to reject them while validating the computed total.

Run: `npm test -- tests/miniprogram/utils/activity-draft.test.js tests/miniprogram/utils/validators.test.js --runInBand`

Expected: both suites pass.

### Task 2: Activity Create/Edit/Copy UI

**Files:**
- Modify: `tests/miniprogram/pages/activity-create-submit.test.js`
- Modify: `miniprogram/pages/activity-create/index.js`
- Modify: `miniprogram/pages/activity-create/index.wxml`
- Modify: `miniprogram/pages/activity-create/index.wxss`
- Modify: `miniprogram/locales/zh-CN.js`
- Modify: `miniprogram/locales/en-US.js`

**Interfaces:**
- Consumes: synchronized form from Task 1.
- Produces: editable `benchCapacity`, read-only `signupLimitTotal`, recalculated notification threshold, and create/update payloads carrying explicit capacity.

- [ ] **Step 1: Write failing page/UI tests**

Assert that WXML binds an editable `benchCapacity`, no longer binds an editable `signupLimitTotal`, and displays the computed total. Assert that changing either teams or bench capacity recomputes total and preserves a custom valid notification threshold.

- [ ] **Step 2: Run the page tests and verify RED**

Run: `npm test -- tests/miniprogram/pages/activity-create-submit.test.js --runInBand`

Expected: failures because the page still edits `signupLimitTotal` directly.

- [ ] **Step 3: Implement the capacity controls**

Replace the total input with a bench-capacity number input plus a computed total display. Update `onFieldInput`, `onTeamsChange`, and derived state synchronization to call the shared capacity model and recalculate the default registration notice threshold from the new total.

- [ ] **Step 4: Run page and draft tests**

Run: `npm test -- tests/miniprogram/pages/activity-create-submit.test.js tests/miniprogram/utils/activity-draft.test.js tests/miniprogram/utils/validators.test.js --runInBand`

Expected: all three suites pass.

### Task 3: Copy API and Local Mock Parity

**Files:**
- Modify: `tests/cloudfunctions/getActivityCopyDraft.test.js`
- Modify: `cloudfunctions/getActivityCopyDraft/index.js`
- Modify: `tests/miniprogram/mocks/local-cloud.test.js`
- Modify: `miniprogram/mocks/local-cloud.js`

**Interfaces:**
- Consumes: activity rows and regular/bench team rows.
- Produces: copy drafts with `benchCapacity`; local create/update behavior matching CloudBase total computation.

- [ ] **Step 1: Write failing copy/local-mock tests**

Assert that `getActivityCopyDraft` returns the active bench team's capacity and that local create/update ignore a conflicting legacy total when explicit `benchCapacity` is present.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/cloudfunctions/getActivityCopyDraft.test.js tests/miniprogram/mocks/local-cloud.test.js --runInBand`

Expected: failures for missing copy-draft capacity and legacy-total local behavior.

- [ ] **Step 3: Implement API and local parity**

Add a stable numeric `benchCapacity` field to copy drafts. In the local mock, compute `signupLimitTotal` from regular drafts plus explicit bench capacity while retaining the old total-only fallback.

- [ ] **Step 4: Run targeted regression**

Run: `npm test -- tests/cloudfunctions/getActivityCopyDraft.test.js tests/miniprogram/mocks/local-cloud.test.js tests/miniprogram/pages/activity-create-submit.test.js tests/miniprogram/utils/activity-draft.test.js tests/miniprogram/utils/validators.test.js --runInBand`

Expected: all targeted suites pass.

### Task 4: Documentation, Regression, and Commit

**Files:**
- Modify: `docs/development-log-v2.md`
- Modify: `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`
- Modify if needed: `docs/superpowers/specs/2026-06-10-sql-migration-readiness.md`

**Interfaces:**
- Produces: deployment notes identifying the mini-program upload and `getActivityCopyDraft` redeployment requirements.

- [ ] **Step 1: Update implementation records**

Record the explicit bench-capacity UI, compatibility derivation, copy API field, tests, and deployment scope.

- [ ] **Step 2: Run the full regression**

Run: `npm test -- --runInBand`

Expected: all suites pass with zero failures.

- [ ] **Step 3: Check the patch**

Run: `git diff --check` and inspect `git status --short` to ensure unrelated configuration files remain unstaged.

- [ ] **Step 4: Commit the milestone**

Stage only the plan, mini-program capacity files, copy-draft cloud function, tests, and V2 documentation. Commit with:

```text
feat: add explicit bench capacity to activity form
```
