# Cloud Function Query Pagination Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate audited CloudBase first-page truncation and unscoped collection loading while preserving Version 0.9.4 and Version 2 cloud-function contracts.

**Architecture:** Exact entity reads remain document-ID based. Queries that require a complete matching set use database criteria plus stable `_id` cursor batches, while paged Web Admin APIs apply permission and business scope before loading related records. Existing event and response contracts remain unchanged so the same functions can serve V0.9.4 and V2 clients.

**Tech Stack:** Node.js, Jest, `wx-server-sdk`, CloudBase document database, PowerShell, Git.

## Global Constraints

- Work on `codex/version-2-web-admin`.
- Follow `AGENTS.md`, including MySQL 8.x and self-hosted migration readiness.
- Use TDD for every behavior change and record the expected RED result.
- Preserve unrelated local changes and stage only milestone files.
- Commit every independently verified milestone locally; do not push.
- Preserve existing public function names, event fields, response shapes, error semantics, permissions, enum strings, document IDs, and timestamps.
- Keep V0.9.4 compatibility for `cancelRegistration`, `removeRegistration`, `listActivities`, `getActivityStats`, and `notifyActivityParticipants`.
- Do not introduce runtime MySQL, dual-write, a self-hosted HTTP API, or a storage migration.
- Use a CloudBase batch size of 100 and `_id` ascending keyset pagination for complete matching sets.
- Use direct focused Jest commands during RED/GREEN cycles and run the full repository suite at the final gate.

---

### Task 1: Commit the Approved Design and Plan

**Files:**
- Create: `docs/superpowers/specs/2026-08-04-cloud-function-query-pagination-hardening-design.md`
- Create: `docs/superpowers/plans/2026-08-04-cloud-function-query-pagination-hardening.md`

**Interfaces:**
- Consumes: the cloud-function query audit and approved compatibility boundaries.
- Produces: the normative design and this executable task plan.

- [ ] **Step 1: Validate documentation completeness**

Run:

```powershell
$patterns = @(('T' + 'BD'), ('T' + 'ODO'), ('PLACE' + 'HOLDER'))
Select-String -Path docs/superpowers/specs/2026-08-04-cloud-function-query-pagination-hardening-design.md,docs/superpowers/plans/2026-08-04-cloud-function-query-pagination-hardening.md -Pattern $patterns
```

Expected: no matches.

- [ ] **Step 2: Validate formatting**

Run:

```powershell
git diff --check -- docs/superpowers/specs/2026-08-04-cloud-function-query-pagination-hardening-design.md docs/superpowers/plans/2026-08-04-cloud-function-query-pagination-hardening.md
```

Expected: exit code 0.

- [ ] **Step 3: Commit documentation**

```powershell
git add -- docs/superpowers/specs/2026-08-04-cloud-function-query-pagination-hardening-design.md docs/superpowers/plans/2026-08-04-cloud-function-query-pagination-hardening.md
git diff --cached --check
git commit -m "docs: design cloud query pagination hardening"
```

---

### Task 2: Repair Participant Alias and Super-Admin Queries

**Files:**
- Modify: `tests/cloudfunctions/updateParticipantManagerAlias.test.js`
- Modify: `tests/cloudfunctions/updateUserRoles.test.js`
- Modify: `cloudfunctions/updateParticipantManagerAlias/index.js`
- Modify: `cloudfunctions/updateUserRoles/index.js`

**Interfaces:**
- Consumes: existing alias mutation payload and user-role mutation payload.
- Produces: the same responses while querying only the relevant registration and counting only super-admin users.

- [ ] **Step 1: Add failing 100-document-window tests**

Extend the fake database queries to cap each `get()` at 100 documents. Add a
valid alias target after 100 unrelated registrations and more than one
super-admin after 100 unrelated users.

Assert:

```js
expect(result.user.managerAlias).toBe('Captain');
expect(db.state.users.openid_target.roles).not.toContain('super_admin');
```

Also assert that the alias query receives `activityId`, `userOpenId`, and
`status: 'joined'`, and that role counting does not call unfiltered
`users.get()`.

- [ ] **Step 2: Verify RED**

```powershell
npx jest --runInBand tests/cloudfunctions/updateParticipantManagerAlias.test.js tests/cloudfunctions/updateUserRoles.test.js
```

Expected: FAIL because the alias target is outside the first page and role
counting still uses an unfiltered collection read.

- [ ] **Step 3: Implement exact filtered queries**

Replace alias collection loading with:

```js
db.collection(COLLECTIONS.REGISTRATIONS)
  .where({ activityId, userOpenId: targetOpenId, status: 'joined' })
  .limit(1)
  .get();
```

Replace super-admin collection loading with a filtered database count whose
result is read from `result.total`. Keep the existing guard and all audit-log
fields unchanged.

- [ ] **Step 4: Verify GREEN and regression**

```powershell
npx jest --runInBand tests/cloudfunctions/updateParticipantManagerAlias.test.js tests/cloudfunctions/updateUserRoles.test.js tests/cloudfunctions/roles.test.js
```

Expected: all suites pass.

- [ ] **Step 5: Commit P0 repairs**

```powershell
git add -- tests/cloudfunctions/updateParticipantManagerAlias.test.js tests/cloudfunctions/updateUserRoles.test.js cloudfunctions/updateParticipantManagerAlias/index.js cloudfunctions/updateUserRoles/index.js
git diff --cached --check
git commit -m "fix: scope participant and role queries"
```

---

### Task 3: Make Bench Promotion Complete

**Files:**
- Modify: `tests/cloudfunctions/cancelRegistration.test.js`
- Modify: `tests/cloudfunctions/removeRegistration.test.js`
- Modify: `cloudfunctions/cancelRegistration/index.js`
- Modify: `cloudfunctions/removeRegistration/index.js`

**Interfaces:**
- Consumes: existing cancellation/removal events and legacy/current registration documents.
- Produces: unchanged mutation responses with the earliest active bench registration promoted.

- [ ] **Step 1: Add failing multi-page queue tests**

Cap fake query pages at 100 and add more than 100 joined registrations. Place
the earliest valid bench registration beyond the first returned query page.
Include one legacy candidate without `joinedAt` and assert the existing
`compareBenchQueue` fallback remains deterministic.

- [ ] **Step 2: Verify RED**

```powershell
npx jest --runInBand tests/cloudfunctions/cancelRegistration.test.js tests/cloudfunctions/removeRegistration.test.js
```

Expected: FAIL because the current transaction query examines one page only.

- [ ] **Step 3: Implement transaction-safe cursor batching**

Change the transaction collection helper to accept `db.command`, append
`_id: command.gt(lastId)`, order by `_id`, and read batches of 100. Query only
the activity's active teams and joined registrations. Preserve the existing
in-memory queue comparator and all transaction writes.

- [ ] **Step 4: Verify GREEN and V1 behavior**

```powershell
npx jest --runInBand tests/cloudfunctions/cancelRegistration.test.js tests/cloudfunctions/removeRegistration.test.js tests/cloudfunctions/joinActivity.test.js tests/cloudfunctions/addProxyRegistration.test.js
```

Expected: all suites pass, including existing direct, proxy, and legacy
registration cases.

- [ ] **Step 5: Commit bench repairs**

```powershell
git add -- tests/cloudfunctions/cancelRegistration.test.js tests/cloudfunctions/removeRegistration.test.js cloudfunctions/cancelRegistration/index.js cloudfunctions/removeRegistration/index.js
git diff --cached --check
git commit -m "fix: paginate bench promotion queries"
```

---

### Task 4: Complete Joined Lists, Activity Stats, and Notifications

**Files:**
- Modify: `tests/cloudfunctions/listActivities.test.js`
- Modify: `tests/cloudfunctions/getActivityStats.test.js`
- Modify: `tests/cloudfunctions/notifyActivityParticipants.test.js`
- Modify: `tests/cloudfunctions/manager-notifications.test.js`
- Modify: `cloudfunctions/listActivities/index.js`
- Modify: `cloudfunctions/getActivityStats/index.js`
- Modify: `cloudfunctions/notifyActivityParticipants/index.js`
- Modify: `cloudfunctions/joinActivity/manager-notifications.js`

**Interfaces:**
- Consumes: existing mini-program scopes, statistics event, and notification event.
- Produces: unchanged public responses and complete matching results beyond 100 documents.

- [ ] **Step 1: Add failing completeness tests**

Add fixtures where the relevant joined registration, activity, recipient, or
accepted subscription is beyond the first 100 matches. Assert the V1 joined
scope still returns `{ items }`, activity totals include every record, every
eligible recipient is attempted once, and sent-log existence uses a one-row
query.

- [ ] **Step 2: Verify RED**

```powershell
npx jest --runInBand tests/cloudfunctions/listActivities.test.js tests/cloudfunctions/getActivityStats.test.js tests/cloudfunctions/notifyActivityParticipants.test.js tests/cloudfunctions/manager-notifications.test.js
```

Expected: FAIL on records outside the first query page.

- [ ] **Step 3: Implement filtered cursor batches**

Use local 100-row `_id` cursor loaders. For joined activities, deduplicate IDs
and load activities in supported ID groups. For statistics, batch teams and
registrations by `activityId`. For notifications, batch joined registrations
and accepted subscriptions and add `limit(1)` to sent-log existence checks.
Keep message payloads, consumption, and log writes unchanged.

- [ ] **Step 4: Verify GREEN and V1 regression**

```powershell
npx jest --runInBand tests/cloudfunctions/listActivities.test.js tests/cloudfunctions/getActivityStats.test.js tests/cloudfunctions/notifyActivityParticipants.test.js tests/cloudfunctions/manager-notifications.test.js
```

Expected: all suites pass.

- [ ] **Step 5: Commit completeness repairs**

```powershell
git add -- tests/cloudfunctions/listActivities.test.js tests/cloudfunctions/getActivityStats.test.js tests/cloudfunctions/notifyActivityParticipants.test.js tests/cloudfunctions/manager-notifications.test.js cloudfunctions/listActivities/index.js cloudfunctions/getActivityStats/index.js cloudfunctions/notifyActivityParticipants/index.js cloudfunctions/joinActivity/manager-notifications.js
git diff --cached --check
git commit -m "fix: complete activity and notification queries"
```

---

### Task 5: Scope Web Admin User and Activity Lists

**Files:**
- Modify: `tests/cloudfunctions/listUsers.test.js`
- Modify: `tests/cloudfunctions/listActivities.test.js`
- Modify: `cloudfunctions/listUsers/index.js`
- Modify: `cloudfunctions/listActivities/index.js`

**Interfaces:**
- Consumes: existing keyword, role, activity, organizer, date, `limit`, and `skip` filters.
- Produces: unchanged `{ items, total, limit, skip, hasMore }` responses with bounded related-document loading.

- [ ] **Step 1: Add failing query-scope tests**

Instrument fake queries and assert that a default 20-row user page does not
load the entire registrations collection, organizer activity requests apply
`organizerOpenId` before reading, and returned totals and stable order remain
unchanged.

- [ ] **Step 2: Verify RED**

```powershell
npx jest --runInBand tests/cloudfunctions/listUsers.test.js tests/cloudfunctions/listActivities.test.js
```

Expected: FAIL because current implementations load complete source
collections before page selection.

- [ ] **Step 3: Implement scoped list loading**

Establish the filtered user/activity result set before related profile or
registration-avatar loading. Query fallback avatars only for returned user
IDs. Apply ownership, status, organizer, and date criteria before activity
batch reads. Preserve current keyword semantics and exact totals.

- [ ] **Step 4: Verify GREEN**

```powershell
npx jest --runInBand tests/cloudfunctions/listUsers.test.js tests/cloudfunctions/listActivities.test.js tests/web-admin/api.test.js tests/web-admin/pagination.test.js
```

Expected: all suites pass with unchanged Web Admin API usage.

- [ ] **Step 5: Commit Web Admin list scoping**

```powershell
git add -- tests/cloudfunctions/listUsers.test.js tests/cloudfunctions/listActivities.test.js cloudfunctions/listUsers/index.js cloudfunctions/listActivities/index.js
git diff --cached --check
git commit -m "perf: scope web admin list queries"
```

---

### Task 6: Scope Statistics and Log Enrichment

**Files:**
- Modify: `tests/cloudfunctions/getAttendanceStats.test.js`
- Modify: `tests/cloudfunctions/listActivityLogs.test.js`
- Modify: `tests/cloudfunctions/listNotificationLogs.test.js`
- Modify: `cloudfunctions/getAttendanceStats/index.js`
- Modify: `cloudfunctions/listActivityLogs/index.js`
- Modify: `cloudfunctions/listNotificationLogs/index.js`

**Interfaces:**
- Consumes: existing permission, date, activity type, statistics type, log filters, `limit`, and `skip`.
- Produces: unchanged paginated responses and detail fields from scoped source data.

- [ ] **Step 1: Add failing bounded-source tests**

Record collection criteria in the fake databases. Assert statistics first
restrict activities by date/type/organizer and fetch registrations only for
matching activity IDs. Assert activity and notification log queries load only
records and enrichment documents in the caller's allowed scope.

- [ ] **Step 2: Verify RED**

```powershell
npx jest --runInBand tests/cloudfunctions/getAttendanceStats.test.js tests/cloudfunctions/listActivityLogs.test.js tests/cloudfunctions/listNotificationLogs.test.js
```

Expected: FAIL because the current global paths scan complete source
collections.

- [ ] **Step 3: Implement scoped source loading**

Load eligible activities first, query registrations/logs in bounded activity
ID groups, then fetch only referenced teams and users. Preserve legacy
`userOpenId`/`targetOpenId` and `type`/`notificationType` fallbacks. Keep final
aggregation, stable sort, exact totals, and API pagination unchanged.

- [ ] **Step 4: Verify GREEN and loading regression**

```powershell
npx jest --runInBand tests/cloudfunctions/getAttendanceStats.test.js tests/cloudfunctions/listActivityLogs.test.js tests/cloudfunctions/listNotificationLogs.test.js tests/web-admin/app-layout.test.js
```

Expected: all suites pass and existing timeout/retry behavior remains intact.

- [ ] **Step 5: Commit scoped statistics and logs**

```powershell
git add -- tests/cloudfunctions/getAttendanceStats.test.js tests/cloudfunctions/listActivityLogs.test.js tests/cloudfunctions/listNotificationLogs.test.js cloudfunctions/getAttendanceStats/index.js cloudfunctions/listActivityLogs/index.js cloudfunctions/listNotificationLogs/index.js
git diff --cached --check
git commit -m "perf: scope statistics and log queries"
```

---

### Task 7: Final Regression and Documentation

**Files:**
- Modify: `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`
- Modify: `docs/development-log-v2.md`
- Modify if query indexes change: `docs/superpowers/specs/2026-06-10-sql-migration-readiness.md`
- Modify if query indexes change: `cloudfunctions/bootstrapV2Collections/index.js`

**Interfaces:**
- Consumes: all completed milestones.
- Produces: verified repository state and deployment-ready documentation.

- [ ] **Step 1: Run focused V0.9.4 compatibility regression**

```powershell
npx jest --runInBand tests/cloudfunctions/cancelRegistration.test.js tests/cloudfunctions/removeRegistration.test.js tests/cloudfunctions/listActivities.test.js tests/cloudfunctions/getActivityStats.test.js tests/cloudfunctions/notifyActivityParticipants.test.js
```

Expected: all suites pass.

- [ ] **Step 2: Run all cloud-function tests**

```powershell
npx jest --runInBand tests/cloudfunctions
```

Expected: all suites pass.

- [ ] **Step 3: Run full repository regression**

```powershell
npm test -- --runInBand
```

Expected: all suites pass.

- [ ] **Step 4: Update progress, development, and migration documentation**

Record each commit, query behavior, tests, V1 compatibility result, changed
function deployment list, and any required compound index. Explicitly state
that no runtime MySQL migration, dual-write, or self-hosted HTTP API switch was
introduced.

- [ ] **Step 5: Validate and commit final documentation**

```powershell
git diff --check
git add -- docs/superpowers/progress/football-signup-miniapp-v2-progress.md docs/development-log-v2.md docs/superpowers/specs/2026-06-10-sql-migration-readiness.md cloudfunctions/bootstrapV2Collections/index.js
git diff --cached --check
git commit -m "docs: record cloud query hardening"
```

Only stage the SQL readiness and bootstrap files if they actually changed.

---

### Task 8: Complete Activity-Team Matching Sets

**Files:**
- Modify: `tests/cloudfunctions/joinActivity.test.js`
- Modify: `tests/cloudfunctions/addProxyRegistration.test.js`
- Modify: `tests/cloudfunctions/getActivityCopyDraft.test.js`
- Modify: `tests/cloudfunctions/updateActivity.test.js`
- Modify: `cloudfunctions/joinActivity/index.js`
- Modify: `cloudfunctions/addProxyRegistration/index.js`
- Modify: `cloudfunctions/getActivityCopyDraft/index.js`
- Modify: `cloudfunctions/updateActivity/index.js`
- Modify: `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`
- Modify: `docs/development-log-v2.md`

**Interfaces:**
- Consumes: existing `activityId`, requested team, activity-copy, and
  activity-update events.
- Produces: unchanged public responses after complete activity-team loading.

- [ ] **Step 1: Add failing multi-page activity-team tests**

Use fake CloudBase query windows of 100 documents. Place the only available
regular team, copied team/bench settings, or existing edited team after the
first page. Assert the current implementation omits that team or setting.

- [ ] **Step 2: Verify RED**

```powershell
npx jest --runInBand tests/cloudfunctions/joinActivity.test.js tests/cloudfunctions/addProxyRegistration.test.js tests/cloudfunctions/getActivityCopyDraft.test.js tests/cloudfunctions/updateActivity.test.js
```

Expected: the new tests fail because each function performs one
`activity_teams.where({ activityId }).get()` call.

- [ ] **Step 3: Implement complete activity-team loading**

Add a private helper in each cloud function that queries only the selected
`activityId`, orders by `_id` ascending, reads at most 100 documents, continues
with `_id: command.gt(lastId)`, and deduplicates by `_id`. Transactional signup
paths use the transaction collection and the database command object. Copy and
update paths use the regular database collection. Preserve all existing final
team sorting, validation, synchronization, events, responses, and errors.

- [ ] **Step 4: Verify GREEN and V0.9.4 compatibility**

```powershell
npx jest --runInBand tests/cloudfunctions/joinActivity.test.js tests/cloudfunctions/addProxyRegistration.test.js tests/cloudfunctions/getActivityCopyDraft.test.js tests/cloudfunctions/updateActivity.test.js
npm test -- --runInBand
git diff --check
```

Expected: all focused and repository suites pass with no formatting errors.

- [ ] **Step 5: Record and commit the follow-up**

Document RED/GREEN evidence, the four-function deployment set, and the
unchanged UI/API/MySQL boundaries in the V2 progress and development logs.

```powershell
git add -- tests/cloudfunctions/joinActivity.test.js tests/cloudfunctions/addProxyRegistration.test.js tests/cloudfunctions/getActivityCopyDraft.test.js tests/cloudfunctions/updateActivity.test.js cloudfunctions/joinActivity/index.js cloudfunctions/addProxyRegistration/index.js cloudfunctions/getActivityCopyDraft/index.js cloudfunctions/updateActivity/index.js docs/superpowers/progress/football-signup-miniapp-v2-progress.md docs/development-log-v2.md
git diff --cached --check
git commit -m "fix: complete activity team queries"
```
