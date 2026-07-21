# Self Registration Profile Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow a real WeChat user to update their own joined registration name, avatar, and preferred positions until the activity starts, while preserving the activity registration snapshot and future user defaults.

**Architecture:** Add one API-shaped CloudBase mutation that derives the caller from trusted context and transactionally updates the current registration snapshot, the user's reusable profile defaults, and an audit log. Reuse the existing activity join page in explicit edit mode, and expose the entry through the existing participant dialog without changing team, attendance, or registration state behavior.

**Tech Stack:** WeChat Mini Program, Node.js CloudBase cloud functions, Jest, CloudBase document database.

## Global Constraints

- Follow `AGENTS.md`, especially the MySQL 8.x and self-hosted migration compatibility constraints.
- Keep current CloudBase runtime storage; do not add MySQL, dual-write, or a self-hosted HTTP API.
- Preserve unrelated local modifications and stage only files belonging to each milestone.
- Use TDD for each behavior change and create one local commit per independently verifiable milestone.
- Do not change registration team, status, attendance, joined time, counters, or activity capacity.

---

### Task 1: Add the self-registration profile mutation

**Files:**
- Create: `tests/cloudfunctions/updateMyRegistrationProfile.test.js`
- Create: `cloudfunctions/updateMyRegistrationProfile/index.js`
- Create: `cloudfunctions/updateMyRegistrationProfile/package.json`
- Create: `cloudfunctions/updateMyRegistrationProfile/config.json`
- Modify: `tests/helpers/local-cloudbase.js`

**Step 1: Write failing cloud function tests**

Cover trusted OpenID ownership, joined real-user registration enforcement, proxy rejection, start-time freeze, signup-deadline independence, field validation, empty-avatar clearing, transactional registration/user updates, immutable registration fields, and `registration_profile_update` audit logging.

Run: `npm test -- --runInBand tests/cloudfunctions/updateMyRegistrationProfile.test.js`

Expected: FAIL because the cloud function and local mock method do not exist.

**Step 2: Implement the smallest backend mutation**

Add `updateMyRegistrationProfile` with API-shaped input `{ activityId, signupName, avatarUrl, profileSource, preferredPositions }`. Derive OpenID from CloudBase context, validate stable profile fields, and update `registrations`, `users`, and `activity_logs` in one transaction. Return the normalized saved profile and stable registration identity only.

**Step 3: Add the local CloudBase test adapter**

Mirror the production contract and invariants in the local test adapter so mini-program integration tests exercise the same ownership and lock rules.

**Step 4: Verify and commit**

Run:
- `npm test -- --runInBand tests/cloudfunctions/updateMyRegistrationProfile.test.js`
- `git diff --check`

Commit: `feat: add self registration profile update api`

---

### Task 2: Reuse the activity join page as an edit form

**Files:**
- Modify: `tests/miniprogram/activity-join.test.js`
- Modify: `tests/miniprogram/registration-service.test.js`
- Modify: `miniprogram/services/registration-service.js`
- Modify: `miniprogram/pages/activity-join/index.js`
- Modify: `miniprogram/pages/activity-join/index.wxml`
- Modify: `miniprogram/pages/activity-join/index.wxss`
- Modify: `miniprogram/i18n/index.js`

**Step 1: Write failing service and page tests**

Cover the new service call, explicit `mode=edit`, registration-snapshot prefilling, edit-specific copy, avatar clearing, save payload, no subscription request in edit mode, back navigation, and unchanged normal join behavior.

Run: `npm test -- --runInBand tests/miniprogram/registration-service.test.js tests/miniprogram/activity-join.test.js`

Expected: FAIL because edit mode and the service mutation are absent.

**Step 2: Add the service boundary**

Expose `updateMyRegistrationProfile(payload)` through the existing registration service and keep the page independent of CloudBase invocation details.

**Step 3: Implement explicit edit mode**

When opened with `mode=edit&activityId=...`, load `myRegistration` from `getActivityDetail`, prefill snapshot fields, show edit-specific Chinese copy, support explicit avatar removal, save through the new service, set the activity refresh flag, and navigate back. Keep the existing join and notification-subscription path unchanged outside edit mode.

**Step 4: Verify and commit**

Run:
- `npm test -- --runInBand tests/miniprogram/registration-service.test.js tests/miniprogram/activity-join.test.js`
- `git diff --check`

Commit: `feat: add self registration profile edit form`

---

### Task 3: Add the activity-detail edit entry

**Files:**
- Modify: `tests/miniprogram/activity-detail-view-model.test.js`
- Modify: `tests/miniprogram/team-list-component.test.js`
- Modify: `tests/miniprogram/activity-detail-page.test.js`
- Modify: `miniprogram/utils/formatters.js`
- Modify: `miniprogram/components/team-list/index.js`
- Modify: `miniprogram/components/team-list/index.wxml`
- Modify: `miniprogram/components/team-list/index.wxss`
- Modify: `miniprogram/pages/activity-detail/index.js`
- Modify: `miniprogram/pages/activity-detail/index.wxml`
- Modify: `miniprogram/pages/activity-detail/index.wxss`
- Modify: `miniprogram/i18n/index.js`

**Step 1: Write failing view and interaction tests**

Cover the pencil cue only on the current user's joined row before start, ordinary-user access to the participant dialog, the full `修改报名信息` dialog action, edit-page navigation, hidden action after activity start, and unchanged read-only behavior for other participants.

Run: `npm test -- --runInBand tests/miniprogram/activity-detail-view-model.test.js tests/miniprogram/team-list-component.test.js tests/miniprogram/activity-detail-page.test.js`

Expected: FAIL because the self-edit view state and navigation action are absent.

**Step 2: Add stable view-model state**

Compute `selfProfileEditVisible` from current-user ownership, joined state, published activity status, and `now < startAt`. Pass only the required UI state through the team component event.

**Step 3: Implement the participant-dialog entry**

Render a compact pencil cue in the current user's row. Keep row tapping as the dialog opener, show one full `修改报名信息` command inside that dialog before start, and navigate to `/pages/activity-join/index?mode=edit&activityId=...`. Do not expose manager-only controls to ordinary users.

**Step 4: Verify and commit**

Run:
- `npm test -- --runInBand tests/miniprogram/activity-detail-view-model.test.js tests/miniprogram/team-list-component.test.js tests/miniprogram/activity-detail-page.test.js`
- `git diff --check`

Commit: `feat: expose self registration profile editing`

---

### Task 4: Document the contract and run V2 regression

**Files:**
- Modify: `docs/superpowers/specs/2026-06-10-sql-migration-readiness.md`
- Modify: `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`
- Modify: `docs/development-log-v2.md`

**Step 1: Update migration and audit documentation**

Document the reused registration/user fields, `registration_profile_update` action, transaction boundary, immutable snapshot fields, additive V1 compatibility, and deployment requirements.

**Step 2: Run targeted and full verification**

Run:
- `npm test -- --runInBand tests/cloudfunctions/updateMyRegistrationProfile.test.js tests/miniprogram/registration-service.test.js tests/miniprogram/activity-join.test.js tests/miniprogram/activity-detail-view-model.test.js tests/miniprogram/team-list-component.test.js tests/miniprogram/activity-detail-page.test.js`
- `npm test -- --runInBand`
- `git diff --check`

Expected: all tests pass and no whitespace errors are reported.

**Step 3: Commit documentation**

Commit: `docs: record self registration profile editing`

**Step 4: Record deployment handoff**

State that testing requires deployment of `updateMyRegistrationProfile` and a new mini-program build. No Web Admin deployment or database migration is required.
