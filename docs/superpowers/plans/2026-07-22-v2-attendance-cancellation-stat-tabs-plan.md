# V2 Attendance And Cancellation Statistics Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present attendance and cancellation statistics as separate tabs in one Web Admin statistics workspace, with independent details and CSV exports.

**Architecture:** Extend `getAttendanceStats` with additive final-outcome detail rows while preserving its existing attendance fields. Keep one Web Admin API request and split the returned model into attendance and cancellation tables in the browser. Reuse shared filters and role checks, but keep tab-specific rows, details, empty states, and exports.

**Tech Stack:** CloudBase cloud functions, CloudBase document database, vanilla JavaScript Web Admin, Jest, CloudBase static hosting.

## Global Constraints

- Use TDD: write each behavior test first and observe the expected failure before production edits.
- Keep the current CloudBase runtime; do not add MySQL runtime access, dual-write, or a self-hosted HTTP API.
- Preserve existing `getAttendanceStats` response fields and role visibility.
- Use stable IDs, `joined` / `cancelled` enum strings, and ISO timestamp fields.
- Preserve unrelated local worktree changes and stage only files from the current milestone.
- Commit each task after its targeted verification passes.

---

### Task 1: Record The Approved Design And Plan

**Files:**

- Create: `docs/superpowers/specs/2026-07-22-v2-attendance-cancellation-stat-tabs-design.md`
- Create: `docs/superpowers/plans/2026-07-22-v2-attendance-cancellation-stat-tabs-plan.md`

**Interfaces:**

- Consumes: existing `getAttendanceStats` attendance and cancellation aggregate fields.
- Produces: approved `cancellationDetails` response contract and Web Admin tab behavior.

- [ ] **Step 1: Validate documentation formatting**

Run:

```powershell
git diff --check -- docs/superpowers/specs/2026-07-22-v2-attendance-cancellation-stat-tabs-design.md docs/superpowers/plans/2026-07-22-v2-attendance-cancellation-stat-tabs-plan.md
```

Expected: exit code `0` with no whitespace errors.

- [ ] **Step 2: Commit the design and plan**

```powershell
git add docs/superpowers/specs/2026-07-22-v2-attendance-cancellation-stat-tabs-design.md docs/superpowers/plans/2026-07-22-v2-attendance-cancellation-stat-tabs-plan.md
git commit -m "docs: plan split statistics views"
```

### Task 2: Add Final-Outcome Cancellation Details

**Files:**

- Modify: `tests/cloudfunctions/getAttendanceStats.test.js`
- Modify: `cloudfunctions/getAttendanceStats/index.js`
- Modify: `docs/superpowers/specs/2026-06-10-sql-migration-readiness.md`

**Interfaces:**

- Consumes: registrations with `status`, `activityId`, `signupName`, `cancelledAt`, and real/proxy identity fields; filtered activities; users by OpenID.
- Produces: `cancellationDetails: Array<{ activityId, activityTitle, activityType, startAt, registrationId, signupName, managerAlias, outcome, cancelledAt }>` on every returned participant row.

- [ ] **Step 1: Add failing backend tests**

Add assertions that a joined/cancelled final-outcome fixture returns stable detail rows:

```js
expect(alex.cancellationDetails).toEqual([
  expect.objectContaining({
    activityId: 'activity_joined',
    registrationId: 'registration_joined',
    outcome: 'joined',
    cancelledAt: ''
  }),
  expect.objectContaining({
    activityId: 'activity_cancelled',
    registrationId: 'registration_cancelled',
    outcome: 'cancelled',
    cancelledAt: '2026-07-22T10:00:00.000Z'
  })
]);
```

Also assert that rejoin history contributes only the current joined registration, missing activity type becomes `internal`, and rows use deterministic ordering.

- [ ] **Step 2: Run the backend test and observe RED**

```powershell
npm test -- tests/cloudfunctions/getAttendanceStats.test.js --runInBand
```

Expected: FAIL because `cancellationDetails` is absent.

- [ ] **Step 3: Implement additive detail rows**

Extend each aggregate row with `cancellationDetails: []`. While reducing `outcomeByParticipantActivity`, append one API-shaped detail object for the selected final outcome. Sort with the same stable activity-time/title/id ordering used by the contract. Do not modify the existing attendance-only `details` array.

- [ ] **Step 4: Update SQL readiness**

Record that the SQL-backed statistics API must return final-outcome detail rows from registration state, with stable enum/timestamp mapping, and that no new CloudBase field or migration is required.

- [ ] **Step 5: Run targeted backend regression**

```powershell
npm test -- tests/cloudfunctions/getAttendanceStats.test.js tests/web-admin/activity-management.test.js --runInBand
git diff --check -- cloudfunctions/getAttendanceStats/index.js tests/cloudfunctions/getAttendanceStats.test.js docs/superpowers/specs/2026-06-10-sql-migration-readiness.md
```

Expected: both suites pass and diff check exits `0`.

- [ ] **Step 6: Commit the backend contract**

```powershell
git add cloudfunctions/getAttendanceStats/index.js tests/cloudfunctions/getAttendanceStats.test.js docs/superpowers/specs/2026-06-10-sql-migration-readiness.md
git commit -m "feat: expose cancellation statistic details"
```

### Task 3: Split The Web Admin Statistics Workspace

**Files:**

- Modify: `tests/web-admin/static.test.js`
- Modify: `tests/web-admin/activity-management.test.js`
- Modify: `tests/web-admin/app-layout.test.js`
- Modify: `web-admin/index.html`
- Modify: `web-admin/styles.css`
- Modify: `web-admin/src/activity-management.js`
- Modify: `web-admin/src/app.js`

**Interfaces:**

- Consumes: one `getAttendanceStats({ startAt, endAt, activityType })` response with `details` and `cancellationDetails`.
- Produces: `statistics` navigation view with active tab state `attendance` or `cancellation`, independent row tables/detail dialogs, and independent CSV exports.

- [ ] **Step 1: Add failing static and model tests**

Require the page to contain a `统计分析` navigation label, tab controls, two table bodies, tab-specific empty text, and one export command whose label follows the active tab. Require `buildStatsRows` to preserve formatted `cancellationDetails`.

- [ ] **Step 2: Run focused tests and observe RED**

```powershell
npm test -- tests/web-admin/static.test.js tests/web-admin/activity-management.test.js --runInBand
```

Expected: FAIL because the cancellation tab and detail mapping are absent.

- [ ] **Step 3: Implement the static tab structure and row model**

Rename the sidebar/title to `统计分析`, add a stable segmented tab control, keep shared filters above both tabs, and map `cancellationDetails` without changing stable backend enum strings.

- [ ] **Step 4: Add failing interaction tests**

Test that:

```js
expect(app.state.activeStatisticsTab).toBe('attendance');
appRoot.click(createElement({ statisticsTab: 'cancellation' }));
expect(app.state.activeStatisticsTab).toBe('cancellation');
expect(elements['[data-cancellation-stats-table]'].innerHTML).toContain('33.33%');
```

Also require a cancellation-row double click to open cancellation details and require the active export to use either `attendance-stats.csv` or `cancellation-stats.csv` with only that tab's columns.

- [ ] **Step 5: Run the interaction tests and observe RED**

```powershell
npm test -- tests/web-admin/app-layout.test.js --runInBand
```

Expected: FAIL because tab state, cancellation detail rendering, and active-tab export are absent.

- [ ] **Step 6: Implement tab interactions, detail modal, and exports**

Keep one loaded `statsRows` array. Render attendance and cancellation projections separately, switch visibility without a network request, use distinct modal headings, and download only active-tab columns. Replace ambiguous cancellation column copy with `最终保留报名数`, `最终取消数`, and `取消率`.

- [ ] **Step 7: Run Web Admin regression**

```powershell
npm test -- tests/web-admin --runInBand
git diff --check -- web-admin tests/web-admin
```

Expected: all Web Admin suites pass and diff check exits `0`.

- [ ] **Step 8: Commit the Web Admin change**

```powershell
git add web-admin/index.html web-admin/styles.css web-admin/src/activity-management.js web-admin/src/app.js tests/web-admin/static.test.js tests/web-admin/activity-management.test.js tests/web-admin/app-layout.test.js
git commit -m "feat: split attendance and cancellation statistics"
```

### Task 4: Regression, Documentation, And Test Deployment

**Files:**

- Modify: `docs/development-log-v2.md`
- Modify: `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`
- Modify: `docs/superpowers/handoff/football-signup-miniapp-handoff.md`

**Interfaces:**

- Consumes: completed backend and Web Admin milestones.
- Produces: verified deployment instructions and current test-environment status.

- [ ] **Step 1: Run full regression and diff validation**

```powershell
npm test -- --runInBand
git diff --check
```

Expected: all suites pass and diff check exits `0`.

- [ ] **Step 2: Update V2 status documents**

Record the API field, UI tabs, separate exports, test counts, deployment targets, and the explicit absence of runtime MySQL, dual-write, or HTTP cutover.

- [ ] **Step 3: Commit final documentation**

```powershell
git add docs/development-log-v2.md docs/superpowers/progress/football-signup-miniapp-v2-progress.md docs/superpowers/handoff/football-signup-miniapp-handoff.md
git commit -m "docs: record split statistics rollout"
```

- [ ] **Step 4: Deploy the changed cloud function**

```powershell
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 functions:deploy getAttendanceStats
```

Expected: `getAttendanceStats` deployment succeeds in the test environment.

- [ ] **Step 5: Deploy Web Admin**

```powershell
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 hosting deploy web-admin /admin
```

Expected: every Web Admin file uploads successfully.

- [ ] **Step 6: Smoke the hosted page**

Open `https://cloudbase-miniapp-test-dfc753877-1424891512.tcloudbaseapp.com/admin/`, sign in by QR, and verify both tabs, one load request, cancellation details, and both CSV downloads.
