# Web Admin Pagination and Roster Completeness Design

**Date:** 2026-07-24
**Status:** Approved

## Context

Several Web Admin views currently request a fixed first page and either omit
pagination controls or display the loaded row count as if it were the complete
result count. Some backend functions also call CloudBase collection `get()`
without database-side filters or batch iteration. Those calls can truncate
source data before application filtering or aggregation.

The affected behavior includes:

- user management loading only the first 20 users;
- activity management loading only the first 20 activities;
- attendance and cancellation statistics aggregating unpaged collection reads;
- notification logs loading only the first 50 rows;
- activity detail and roster export relying on unpaged registration reads.

## Goals

- Add visible, consistent pagination to user management, activity management,
  attendance statistics, cancellation statistics, and notification logs.
- Return an exact filtered total from paginated list APIs.
- Keep single-activity rosters unpaginated in the UI while ensuring that both
  activity detail and exports include every joined registration.
- Keep CSV and XLSX exports complete after visible tables become paginated.
- Preserve current permissions, field contracts, CloudBase runtime storage, and
  Version 1 compatibility.
- Keep the API contracts suitable for a future MySQL 8.x and self-hosted HTTP
  API implementation.

## Non-Goals

- No runtime MySQL migration, dual-write, or self-hosted HTTP API cutover.
- No cursor-only public API in Version 2.
- No visible pagination inside a single activity roster.
- No change to role permissions or manager-only field visibility.
- No database backfill or new collection.

## User Experience

### Paginated Views

The following views use the same fixed page size of 20 rows:

- user management;
- activity management;
- attendance statistics;
- cancellation statistics;
- notification logs.

Each view displays:

```text
Total 86    Previous    Page 1 / 5    Next
```

The production Chinese labels are:

```text
共 86 条    上一页    第 1 / 5 页    下一页
```

There is no page-size selector. `Previous` is disabled on the first page.
`Next` is disabled when `hasMore` is false. A result set with zero rows displays
page `0 / 0` and disables both buttons.

Changing any search filter resets the view to the first page. Switching between
attendance and cancellation tabs preserves the shared filters but keeps
independent page positions for the two result tables.

While a page is loading, both navigation buttons are disabled. If loading
fails, the existing page remains visible and the view shows an inline error.

### Single-Activity Roster

The activity roster remains a single scrollable table without visible
pagination. The backend must retrieve all joined registrations for the selected
activity in batches. The activity detail table, CSV export, and XLSX export must
contain the same participants and row order.

## API Contract

Paginated APIs return the additive response shape:

```js
{
  items: [],
  total: 86,
  limit: 20,
  skip: 0,
  hasMore: true
}
```

Existing clients that only consume `items` and `hasMore` remain compatible.
`limit` and `skip` remain stable API fields that map directly to SQL
`LIMIT/OFFSET`. A future cursor may be added without removing these fields while
Version 2 clients remain active.

The following APIs adopt the complete paginated response:

- `listUsers`;
- Web Admin scope of `listActivities`;
- `getAttendanceStats`;
- `listNotificationLogs`.

`getAttendanceStats` applies pagination after the complete filtered aggregation
and stable participant sort. Attendance and cancellation rows come from the
same filtered dataset, but each tab sends its own `limit` and `skip`.

Roster APIs remain row-oriented:

```js
{
  rows: [],
  total: 126
}
```

`total` is additive. Existing Web Admin code may continue reading `rows`.

## Backend Data Loading

### General Batch Rule

Collection reads that may exceed one CloudBase response page must:

1. apply permission and business filters before the read whenever supported;
2. use an explicit stable batch size;
3. iterate with `skip` and `limit` until a short or empty page is returned;
4. deduplicate by document `_id`;
5. perform the final business sort before API pagination.

This rule prevents unrelated documents from consuming the collection read
window before application filtering.

### Users

`listUsers` loads all required user batches before applying keyword and role
filters, then returns the requested 20-row page and the exact filtered total.
The current sort remains stable, with `_id` as the final tie-breaker.

Registration avatar fallback loading must also be batched so a large
registration collection cannot hide later user avatars.

### Activities

The Web Admin scope of `listActivities` batches the activity collection,
applies status, permission, organizer, keyword, and date filters, enriches the
matching organizer identities, sorts by `startAt`, and then returns the
requested page and total.

### Attendance and Cancellation Statistics

`getAttendanceStats` batches all relevant activities, registrations, and users
before aggregation. Organizer permission, date range, activity type, activity
state, and start-time eligibility are applied consistently to every batch.

The function aggregates the complete source set, sorts participant rows, and
only then applies `skip` and `limit`. Participant detail arrays remain complete
for every returned participant row.

### Notification Logs

`listNotificationLogs` batches logs after applying `activityId`,
`notificationType`, and `status` filters wherever possible. It applies the
organizer/admin activity boundary before returning a stable
`createdAt`-descending page and exact total.

### Activity Detail and Roster Export

Both `getActivityDetail` and `exportActivityRoster` query registrations by:

```js
{
  activityId,
  status: 'joined'
}
```

They iterate through every matching registration batch instead of loading the
entire registration collection and filtering afterward.

Team rows are queried by `activityId`. User profile lookups are restricted to
the real user OpenIDs present in the roster and are executed in supported
batches. Proxy registrations do not trigger user profile lookups.

The final roster order remains:

1. team sort;
2. registration join time;
3. participant name;
4. registration ID as a stable tie-breaker.

## Export Behavior

Visible pagination must not change export semantics.

- User-facing table exports, where present, export the complete filtered result.
- Attendance and cancellation CSV/XLSX exports iterate API pages and combine
  them before generating the file.
- Activity roster CSV/XLSX exports use the complete `rows` returned by
  `exportActivityRoster`.
- Export requests show a loading state and prevent duplicate downloads.
- A failed intermediate page aborts the export instead of producing a partial
  file.

## Compatibility and Migration Readiness

- All new response fields are additive.
- Existing stable enum strings and timestamps remain unchanged.
- CloudBase document IDs continue to map to future explicit SQL primary keys.
- Filtering, sorting, total counting, and pagination remain backend
  responsibilities and do not depend on Web Admin DOM structure.
- Future SQL implementations can replace batched CloudBase reads with indexed
  filters, aggregate queries, `COUNT(*)`, and `LIMIT/OFFSET` while preserving
  the public API.
- This change does not introduce runtime MySQL, dual-write, or a self-hosted
  HTTP API.

## Testing

Implementation must follow TDD.

### Cloud Function Coverage

- `listUsers` returns the second page and an exact filtered total.
- `listUsers` still finds users after more than one collection batch.
- `listActivities` returns stable pages and exact totals after all filters.
- `getAttendanceStats` includes source documents beyond the first collection
  batch and paginates only after complete aggregation.
- `listNotificationLogs` returns later filtered records even when earlier
  unrelated records fill a collection batch.
- `getActivityDetail` returns more than one registration batch for one
  activity.
- `exportActivityRoster` ignores unrelated registrations and exports more than
  one matching batch.
- Cancelled registrations remain excluded from current rosters.
- Organizer, admin, super-admin, and ordinary-user permissions do not regress.

### Web Admin Coverage

- Each paginated view renders the exact total and current page.
- Previous/next disabled states are correct.
- Search resets to page one.
- Attendance and cancellation tabs keep independent pages.
- Failed page requests retain the existing table.
- CSV and XLSX exports include all filtered pages, not only the visible page.
- Single-activity roster rendering remains unpaginated.

## Deployment

The implementation requires redeploying the changed cloud functions:

- `listUsers`;
- `listActivities`;
- `getAttendanceStats`;
- `listNotificationLogs`;
- `getActivityDetail`;
- `exportActivityRoster`.

Web Admin static hosting must also be redeployed to `/admin/` in the target
environment. No database migration or collection bootstrap is required.
