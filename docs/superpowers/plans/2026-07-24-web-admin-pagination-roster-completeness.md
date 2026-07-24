# Web Admin Pagination and Roster Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add exact, fixed-size Web Admin pagination and eliminate CloudBase collection-page truncation from activity rosters, exports, statistics, users, activities, and notification logs.

**Architecture:** Cloud functions will batch source collection reads before filtering, aggregation, sorting, and API pagination. Paginated APIs will return additive `total`, `limit`, `skip`, and `hasMore` metadata, while activity detail and roster export will return complete single-activity rows without visible roster pagination. A focused Web Admin pagination helper will drive identical 20-row previous/next controls and complete multi-page exports.

**Tech Stack:** Node.js, Jest, `wx-server-sdk`, static HTML/CSS/JavaScript Web Admin, CloudBase document database and static hosting.

## Global Constraints

- Work on `codex/version-2-web-admin`.
- Preserve unrelated local modifications and stage only files listed by each task.
- Use TDD for every behavior change: add a failing test, verify RED, implement, verify GREEN.
- Commit every independently testable task locally; do not push.
- Keep the fixed visible page size at exactly 20 rows.
- Do not add a page-size selector.
- Keep the single-activity roster visibly unpaginated.
- Keep CSV and XLSX exports complete rather than limited to the visible page.
- Preserve organizer, admin, super-admin, and ordinary-user permission boundaries.
- Do not implement runtime MySQL, dual-write, or self-hosted HTTP API migration.
- Use direct `npx jest --runInBand` commands because repository `npm test` runs a shared-file copy pretest that would overwrite unrelated dirty local notification files.

---

### Task 1: Complete Single-Activity Roster Reads

**Files:**
- Modify: `tests/cloudfunctions/getActivityDetail.test.js`
- Modify: `tests/cloudfunctions/exportActivityRoster.test.js`
- Modify: `cloudfunctions/getActivityDetail/index.js`
- Modify: `cloudfunctions/exportActivityRoster/index.js`

**Interfaces:**
- Consumes: `activityId`, caller identity, existing activity/team/registration/user documents.
- Produces: `getActivityDetail()` with every joined registration and `exportActivityRoster()` returning `{ rows, total }`.

- [ ] **Step 1: Add failing multi-batch roster tests**

Extend both fake database adapters with query objects that implement
`where(criteria)`, `skip(offset)`, `limit(count)`, and `get()`. Add at least 100
unrelated registrations before the target activity and more than 100 joined
registrations for the target activity.

Assert:

```js
expect(detail.teams.flatMap(team => team.members)).toHaveLength(105);
expect(exported.rows).toHaveLength(105);
expect(exported.total).toBe(105);
expect(exported.rows.every(row => row.activityId === 'activity_1')).toBe(true);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npx jest --runInBand tests/cloudfunctions/getActivityDetail.test.js tests/cloudfunctions/exportActivityRoster.test.js
```

Expected: FAIL because the current unpaged reads return only the fake database
query window and `exportActivityRoster` does not return `total`.

- [ ] **Step 3: Add filtered batched loaders**

In each function, add an explicit batch loader:

```js
const COLLECTION_BATCH_SIZE = 100;

async function loadCollection(db, collectionName, criteria = null) {
  const items = [];
  let offset = 0;

  while (true) {
    let query = db.collection(collectionName);
    if (criteria) {
      query = query.where(criteria);
    }

    const result = await query.skip(offset).limit(COLLECTION_BATCH_SIZE).get();
    const batch = Array.isArray(result.data) ? result.data : [];
    items.push(...batch);

    if (batch.length < COLLECTION_BATCH_SIZE) {
      return Array.from(new Map(items.map(item => [item._id, item])).values());
    }

    offset += batch.length;
  }
}
```

Use database-side criteria:

```js
loadCollection(db, COLLECTIONS.ACTIVITY_TEAMS, { activityId });
loadCollection(db, COLLECTIONS.REGISTRATIONS, {
  activityId,
  status: 'joined'
});
```

Fetch user profiles only for non-proxy roster OpenIDs, in bounded groups, and
add registration ID as the final roster sort tie-breaker. Return:

```js
return {
  rows,
  total: rows.length
};
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
npx jest --runInBand tests/cloudfunctions/getActivityDetail.test.js tests/cloudfunctions/exportActivityRoster.test.js
```

Expected: both suites PASS.

- [ ] **Step 5: Commit the roster milestone**

```powershell
git add -- tests/cloudfunctions/getActivityDetail.test.js tests/cloudfunctions/exportActivityRoster.test.js cloudfunctions/getActivityDetail/index.js cloudfunctions/exportActivityRoster/index.js
git diff --cached --check
git commit -m "fix: load complete activity rosters"
```

---

### Task 2: Paginate Users and Activities with Exact Totals

**Files:**
- Modify: `tests/cloudfunctions/listUsers.test.js`
- Modify: `tests/cloudfunctions/listActivities.test.js`
- Modify: `cloudfunctions/listUsers/index.js`
- Modify: `cloudfunctions/listActivities/index.js`

**Interfaces:**
- Consumes: existing `keyword`, role/status/organizer/date filters, `limit`, and `skip`.
- Produces: `{ items, total, limit, skip, hasMore }` for `listUsers` and Web Admin `listActivities`.

- [ ] **Step 1: Add failing pagination and truncation tests**

Add fake query support and datasets larger than 100 documents. Assert an exact
second page:

```js
expect(result).toMatchObject({
  total: 125,
  limit: 20,
  skip: 20,
  hasMore: true
});
expect(result.items).toHaveLength(20);
```

Add stable-order assertions where timestamps tie, and verify keyword/role or
activity filters compute `total` before slicing.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npx jest --runInBand tests/cloudfunctions/listUsers.test.js tests/cloudfunctions/listActivities.test.js
```

Expected: FAIL because responses omit pagination metadata and source reads stop
at one collection page.

- [ ] **Step 3: Implement complete batched reads and additive metadata**

Add the Task 1 batch-loader pattern locally to both functions. Batch
registration avatar fallback reads in `listUsers`. Add `_id` as the final user
and activity sort tie-breaker.

Return:

```js
return {
  items: filtered.slice(skip, skip + limit),
  total: filtered.length,
  limit,
  skip,
  hasMore: skip + limit < filtered.length
};
```

Only the `web-admin` activity scope adopts this response in this task; preserve
mini-program scope behavior.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
npx jest --runInBand tests/cloudfunctions/listUsers.test.js tests/cloudfunctions/listActivities.test.js
```

Expected: both suites PASS.

- [ ] **Step 5: Commit the list API milestone**

```powershell
git add -- tests/cloudfunctions/listUsers.test.js tests/cloudfunctions/listActivities.test.js cloudfunctions/listUsers/index.js cloudfunctions/listActivities/index.js
git diff --cached --check
git commit -m "feat: paginate web admin users and activities"
```

---

### Task 3: Paginate Statistics and Notification Logs

**Files:**
- Modify: `tests/cloudfunctions/getAttendanceStats.test.js`
- Modify: `tests/cloudfunctions/listNotificationLogs.test.js`
- Modify: `cloudfunctions/getAttendanceStats/index.js`
- Modify: `cloudfunctions/listNotificationLogs/index.js`

**Interfaces:**
- Consumes: statistics date/type filters or notification-log filters plus `limit` and `skip`.
- Produces: `{ items, total, limit, skip, hasMore }` after complete filtering and aggregation.

- [ ] **Step 1: Add failing source-batch and result-page tests**

For statistics, place relevant activities and registrations after at least 100
unrelated documents. Verify aggregation includes them, then verify pagination
is applied after participant sorting:

```js
expect(result).toMatchObject({
  total: 45,
  limit: 20,
  skip: 20,
  hasMore: true
});
expect(result.items).toHaveLength(20);
```

For notification logs, add 100 unrelated logs before a matching activity log
and assert it is still returned. Verify exact totals and second-page ordering.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npx jest --runInBand tests/cloudfunctions/getAttendanceStats.test.js tests/cloudfunctions/listNotificationLogs.test.js
```

Expected: FAIL because current source reads and response shapes are unpaged.

- [ ] **Step 3: Implement complete source loading and output pagination**

Add local batch loaders. Keep statistics aggregation unchanged until the final
sorted `items` array, then apply:

```js
const limit = normalizeLimit(payload.limit);
const skip = normalizeSkip(payload.skip);
const total = items.length;

return {
  items: items.slice(skip, skip + limit),
  total,
  limit,
  skip,
  hasMore: skip + limit < total
};
```

For notification logs, apply `activityId`, `notificationType`, and `status`
criteria before batch reads when possible, enforce the allowed activity set,
then sort and page.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
npx jest --runInBand tests/cloudfunctions/getAttendanceStats.test.js tests/cloudfunctions/listNotificationLogs.test.js
```

Expected: both suites PASS.

- [ ] **Step 5: Commit the statistics/log milestone**

```powershell
git add -- tests/cloudfunctions/getAttendanceStats.test.js tests/cloudfunctions/listNotificationLogs.test.js cloudfunctions/getAttendanceStats/index.js cloudfunctions/listNotificationLogs/index.js
git diff --cached --check
git commit -m "feat: paginate statistics and notification logs"
```

---

### Task 4: Add the Shared Web Admin Pagination Model

**Files:**
- Create: `web-admin/src/pagination.js`
- Create: `tests/web-admin/pagination.test.js`
- Modify: `web-admin/index.html`
- Modify: `web-admin/styles.css`
- Modify: `tests/web-admin/app-layout.test.js`
- Modify: `web-admin/src/app.js`

**Interfaces:**
- Consumes: `{ total, limit, skip, hasMore, loading }`.
- Produces: `buildPaginationModel()` and consistent controls for users, activities, attendance, cancellation, and notification logs.

- [ ] **Step 1: Write failing pure pagination tests**

Define the desired helper API:

```js
expect(buildPaginationModel({
  total: 86,
  limit: 20,
  skip: 20,
  hasMore: true
})).toEqual({
  total: 86,
  page: 2,
  pageCount: 5,
  canPrevious: true,
  canNext: true,
  previousSkip: 0,
  nextSkip: 40
});
```

Also cover zero rows, the last page, and loading-disabled controls.

- [ ] **Step 2: Run the pure helper test and verify RED**

Run:

```powershell
npx jest --runInBand tests/web-admin/pagination.test.js
```

Expected: FAIL because `web-admin/src/pagination.js` does not exist.

- [ ] **Step 3: Implement the pagination helper**

Export a UMD-compatible module matching other Web Admin modules:

```js
function buildPaginationModel(input = {}) {
  const total = Math.max(0, Number(input.total) || 0);
  const limit = Math.max(1, Number(input.limit) || 20);
  const skip = Math.max(0, Number(input.skip) || 0);
  const pageCount = total === 0 ? 0 : Math.ceil(total / limit);
  const page = total === 0 ? 0 : Math.floor(skip / limit) + 1;

  return {
    total,
    page,
    pageCount,
    canPrevious: !input.loading && skip > 0,
    canNext: !input.loading && Boolean(input.hasMore),
    previousSkip: Math.max(0, skip - limit),
    nextSkip: skip + limit
  };
}
```

- [ ] **Step 4: Verify the helper test passes**

Run:

```powershell
npx jest --runInBand tests/web-admin/pagination.test.js
```

Expected: PASS.

- [ ] **Step 5: Add failing app-layout pagination tests**

Extend the harness with previous/next buttons and summary elements. Verify:

- user and activity navigation sends the correct `skip`;
- searches reset `skip` to zero;
- attendance and cancellation tabs retain independent skips;
- zero and last-page disabled states;
- a failed page request keeps the previous rows;
- opening the notification-log view loads its first page.

- [ ] **Step 6: Run app-layout tests and verify RED**

Run:

```powershell
npx jest --runInBand tests/web-admin/app-layout.test.js
```

Expected: FAIL because the controls and state transitions are absent.

- [ ] **Step 7: Implement view controls and state**

Add the script before `app.js` and bump all static query versions. Add one
reusable HTML control shape per target view:

```html
<div class="pagination" data-pagination="users">
  <span data-pagination-total="users">共 0 条</span>
  <button type="button" data-page-action="previous" data-page-target="users">上一页</button>
  <span data-pagination-page="users">第 0 / 0 页</span>
  <button type="button" data-page-action="next" data-page-target="users">下一页</button>
</div>
```

Add a `notification-logs` navigation item and table using the existing
notification-log row builder and renderer. Maintain independent pagination
state objects:

```js
{
  users: { total: 0, limit: 20, skip: 0, hasMore: false, loading: false },
  activities: { total: 0, limit: 20, skip: 0, hasMore: false, loading: false },
  attendance: { total: 0, limit: 20, skip: 0, hasMore: false, loading: false },
  cancellation: { total: 0, limit: 20, skip: 0, hasMore: false, loading: false },
  notificationLogs: { total: 0, limit: 20, skip: 0, hasMore: false, loading: false }
}
```

Render exact totals from API metadata, not `rows.length`.

- [ ] **Step 8: Verify focused Web Admin tests pass**

Run:

```powershell
npx jest --runInBand tests/web-admin/pagination.test.js tests/web-admin/app-layout.test.js tests/web-admin/api.test.js
```

Expected: all focused suites PASS.

- [ ] **Step 9: Commit the Web Admin pagination milestone**

```powershell
git add -- web-admin/src/pagination.js tests/web-admin/pagination.test.js web-admin/index.html web-admin/styles.css tests/web-admin/app-layout.test.js web-admin/src/app.js
git diff --cached --check
git commit -m "feat: add web admin pagination controls"
```

---

### Task 5: Keep Paginated Statistics Exports Complete

**Files:**
- Modify: `tests/web-admin/api.test.js`
- Modify: `tests/web-admin/app-layout.test.js`
- Modify: `web-admin/src/api.js`
- Modify: `web-admin/src/app.js`

**Interfaces:**
- Consumes: paginated `getAttendanceStats` responses.
- Produces: complete attendance/cancellation CSV and XLSX rows across all result pages.

- [ ] **Step 1: Add failing complete-export tests**

Mock two statistics API pages:

```js
api.getAttendanceStats
  .mockResolvedValueOnce({
    items: firstPage,
    total: 25,
    limit: 20,
    skip: 0,
    hasMore: true
  })
  .mockResolvedValueOnce({
    items: secondPage,
    total: 25,
    limit: 20,
    skip: 20,
    hasMore: false
  });
```

Assert CSV and XLSX exporters receive all 25 rows, while the visible table still
contains only its current 20-row page. Verify a second-page failure produces no
download.

- [ ] **Step 2: Run focused export tests and verify RED**

Run:

```powershell
npx jest --runInBand tests/web-admin/app-layout.test.js tests/web-admin/api.test.js
```

Expected: FAIL because exports currently use only `state.statsRows`.

- [ ] **Step 3: Implement complete page collection for export**

Add an internal API-page collector:

```js
async function loadAllStatisticsRows(filters) {
  const items = [];
  let skip = 0;

  while (true) {
    const result = await api.getAttendanceStats({
      ...filters,
      limit: 20,
      skip
    });
    items.push(...(result.items || []));

    if (!result.hasMore) {
      return items;
    }

    skip += Number(result.limit) || 20;
  }
}
```

Use the collected rows only for export generation. Keep the current visible
page and independent attendance/cancellation page state unchanged. Disable the
export trigger while collecting and abort without a file on any failed page.

- [ ] **Step 4: Verify focused export tests pass**

Run:

```powershell
npx jest --runInBand tests/web-admin/app-layout.test.js tests/web-admin/api.test.js tests/web-admin/export-files.test.js
```

Expected: all focused suites PASS.

- [ ] **Step 5: Commit the complete-export milestone**

```powershell
git add -- tests/web-admin/api.test.js tests/web-admin/app-layout.test.js web-admin/src/api.js web-admin/src/app.js
git diff --cached --check
git commit -m "fix: export complete paginated statistics"
```

---

### Task 6: Documentation and Full Regression

**Files:**
- Modify: `docs/superpowers/specs/2026-06-10-sql-migration-readiness.md`
- Modify: `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`
- Modify: `docs/development-log-v2.md`
- Modify: `docs/superpowers/handoff/football-signup-miniapp-handoff.md`

**Interfaces:**
- Consumes: completed API and UI behavior from Tasks 1-5.
- Produces: current migration mapping, progress, development, and deployment handoff records.

- [ ] **Step 1: Update migration and progress documentation**

Record:

- additive `{ total, limit, skip, hasMore }` response fields;
- fixed 20-row Web Admin pagination;
- complete pre-aggregation CloudBase batch reads;
- complete roster detail and export reads;
- complete multi-page CSV/XLSX export behavior;
- unchanged runtime storage and Version 1 compatibility;
- no runtime MySQL, dual-write, or self-hosted HTTP API migration.

- [ ] **Step 2: Run focused and full regression**

Run:

```powershell
npx jest --runInBand tests/cloudfunctions/getActivityDetail.test.js tests/cloudfunctions/exportActivityRoster.test.js tests/cloudfunctions/listUsers.test.js tests/cloudfunctions/listActivities.test.js tests/cloudfunctions/getAttendanceStats.test.js tests/cloudfunctions/listNotificationLogs.test.js tests/web-admin/pagination.test.js tests/web-admin/app-layout.test.js tests/web-admin/api.test.js tests/web-admin/export-files.test.js
npx jest --runInBand
git diff --check
```

Expected: all suites PASS and `git diff --check` reports no whitespace errors.

- [ ] **Step 3: Commit the documentation milestone**

```powershell
git add -- docs/superpowers/specs/2026-06-10-sql-migration-readiness.md docs/superpowers/progress/football-signup-miniapp-v2-progress.md docs/development-log-v2.md docs/superpowers/handoff/football-signup-miniapp-handoff.md
git diff --cached --check
git commit -m "docs: record web admin pagination rollout"
```

---

### Task 7: Test-Environment Deployment and Smoke Verification

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: committed cloud functions and `web-admin/` static assets.
- Produces: deployed test environment and recorded smoke evidence.

- [ ] **Step 1: Deploy changed cloud functions**

From each function directory, run:

```powershell
'' | npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 fn deploy <function-name> --dir . --force --deployMode zip --json
```

Deploy:

- `listUsers`;
- `listActivities`;
- `getAttendanceStats`;
- `listNotificationLogs`;
- `getActivityDetail`;
- `exportActivityRoster`.

- [ ] **Step 2: Redeploy Web Admin static hosting**

Run:

```powershell
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 hosting deploy web-admin /admin
```

- [ ] **Step 3: Verify hosted assets and live behavior**

Verify:

- `/admin/` returns HTTP 200 and references the new static asset version;
- user and activity second pages load;
- statistics pages switch independently;
- notification logs paginate;
- roster detail and XLSX/CSV export counts match;
- ordinary users remain denied.

If authenticated live smoke is blocked, record the exact blocker without
claiming the protected calls passed.
