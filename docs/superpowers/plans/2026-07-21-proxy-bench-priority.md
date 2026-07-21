# Proxy Bench Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make proxy signup use an available regular-team slot before entering the bench queue, while preserving explicit regular-team selection.

**Architecture:** Keep the existing CloudBase API and storage model. `addProxyRegistration` will select the actual team inside its transaction only when the requested team is `bench`; the mini-program view model will hide the bench proxy action while a regular slot is visible, and the local CloudBase mock will mirror production behavior.

**Tech Stack:** Node.js CloudBase cloud functions, WeChat mini-program JavaScript/WXML, Jest.

## Global Constraints

- Do not introduce runtime MySQL, dual-write, or a self-hosted HTTP API.
- Preserve `signupLimitTotal` and the existing CloudBase collections.
- Treat historical teams without `teamType` as regular teams.
- Keep proxy requests for a specific regular team bound to that team.
- Preserve unrelated local configuration changes and do not push.

---

### Task 1: Transactional Proxy Team Selection

**Files:**
- Modify: `tests/cloudfunctions/addProxyRegistration.test.js`
- Modify: `cloudfunctions/addProxyRegistration/index.js`
- Modify: `tests/miniprogram/mocks/local-cloud.test.js`
- Modify: `miniprogram/mocks/local-cloud.js`

**Interfaces:**
- Consumes: `{ activityId, teamId, signupName, preferredPositions }`.
- Produces: `{ registrationId, requestedTeamId, teamId, teamName, status, proxyRegistration, autoAssigned, autoAssignedReason }`.

- [x] **Step 1: Write failing backend and local-mock tests**

Add cases proving that a bench request enters the first available regular team, remains in the bench when all regular teams are full, and does not change explicit regular-team selection.

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm test -- tests/cloudfunctions/addProxyRegistration.test.js tests/miniprogram/mocks/local-cloud.test.js --runInBand
```

Expected: new auto-assignment assertions fail because the requested bench `teamId` is still persisted directly.

- [x] **Step 3: Implement deterministic team selection**

When the requested team has `teamType: 'bench'`, query activity teams in the transaction, filter active regular teams with capacity, sort by numeric `sort` then `_id`, and use the first match. Persist and increment the selected team, write the actual team to `proxy_signup_created`, and return additive assignment metadata. Mirror the same selection in `local-cloud.js`.

- [x] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command and expect both suites to pass.

### Task 2: Mini-Program Proxy Signup State

**Files:**
- Modify: `tests/miniprogram/utils/view-models.test.js`
- Modify: `tests/miniprogram/pages/activity-detail.test.js`
- Modify: `miniprogram/utils/formatters.js`
- Modify: `miniprogram/pages/activity-detail/index.js`
- Modify: `miniprogram/locales/en-US.js`
- Modify: `miniprogram/locales/zh-CN.js`

**Interfaces:**
- Consumes: activity team view models and the additive `addProxyRegistration` response.
- Produces: a hidden bench proxy action while regular capacity exists and an actual-team success message after stale auto-assignment.

- [x] **Step 1: Write failing view-model and page tests**

Add a view-model case where a regular team has capacity and the bench team does not expose `canProxySignup`. Add a page case where `autoAssigned: true` uses the returned `teamName` in the success toast.

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm test -- tests/miniprogram/utils/view-models.test.js tests/miniprogram/pages/activity-detail.test.js --runInBand
```

Expected: the bench proxy action remains visible and the toast uses the generic success copy.

- [x] **Step 3: Implement the view and response handling**

Compute whether any active regular team has capacity before mapping teams, suppress only the bench proxy action in that state, and use the returned actual team name for auto-assignment feedback. Keep regular-team proxy buttons unchanged.

- [x] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command and expect both suites to pass.

### Task 3: Regression, Documentation, and Commit

**Files:**
- Modify: `docs/development-log-v2.md`
- Modify: `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`
- Modify: `docs/superpowers/specs/2026-06-10-sql-migration-readiness.md`

- [x] **Step 1: Run the complete regression suite**

```powershell
npm test -- --runInBand
git diff --check
```

Expected: all suites pass and there are no whitespace errors.

- [x] **Step 2: Record compatibility and deployment scope**

Document that the change adds no collection or field, preserves CloudBase runtime storage, and requires deploying `addProxyRegistration` plus uploading the mini-program. Web Admin does not require redeployment.

- [x] **Step 3: Commit only task files**

```powershell
git add -- cloudfunctions/addProxyRegistration/index.js miniprogram/locales/en-US.js miniprogram/locales/zh-CN.js miniprogram/mocks/local-cloud.js miniprogram/pages/activity-detail/index.js miniprogram/utils/formatters.js tests/cloudfunctions/addProxyRegistration.test.js tests/miniprogram/mocks/local-cloud.test.js tests/miniprogram/pages/activity-detail.test.js tests/miniprogram/utils/view-models.test.js docs/development-log-v2.md docs/superpowers/progress/football-signup-miniapp-v2-progress.md docs/superpowers/specs/2026-06-10-sql-migration-readiness.md
git commit -m "fix: prioritize regular slots for proxy signup"
```

Expected: unrelated local configuration files remain unstaged.
