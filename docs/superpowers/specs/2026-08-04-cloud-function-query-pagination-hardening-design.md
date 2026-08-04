# Cloud Function Query Pagination Hardening Design

**Date:** 2026-08-04
**Status:** Approved

## Context

CloudBase collection `get()` returns a bounded response. In the current test
environment, unfiltered server-side reads return at most 100 documents. The
environment already contains more than that limit in important collections,
including more than 180 users and more than 700 registrations.

The audit found two separate failure classes:

1. queries that read only the first collection page and then apply business
   filters in memory, which can produce incorrect results;
2. helpers that iterate every collection page before applying permission,
   date, or entity filters, which are complete but become slow as unrelated
   data grows.

The first class currently causes participant manager-alias updates to reject a
valid registration when that registration is outside the first 100 documents.
The same pattern makes the last-super-admin guard unreliable after the users
collection exceeds one page.

## Goals

- Remove every audited first-page truncation risk.
- Preserve deterministic bench promotion for activities with more than one
  CloudBase response page of joined registrations.
- Preserve complete activity-team selection, copy, and reconciliation when one
  activity has more than one CloudBase response page of team documents.
- Preserve complete joined-activity lists, activity statistics, and
  participant notifications beyond 100 matching records.
- Restrict Web Admin list, statistics, and log reads to the smallest practical
  permission and business scope before loading related documents.
- Preserve Version 0.9.4 mini-program cloud-function contracts and historical
  data behavior.
- Keep query contracts compatible with a future MySQL 8.x and self-hosted
  server implementation.

## Non-Goals

- No runtime MySQL migration, dual-write, or self-hosted HTTP API cutover.
- No collection rename, data backfill, or destructive migration.
- No mini-program or Web Admin layout change.
- No change to role, notification, attendance, cancellation, or bench business
  rules.
- No public page-size or response-contract change for Version 0.9.4 scopes.
- No deployment to production as part of implementation.

## Considered Approaches

### 1. Patch Only the Two Confirmed Failures

Change `updateParticipantManagerAlias` and `updateUserRoles` only. This is the
smallest immediate repair, but it leaves the same 100-document correctness risk
in bench promotion, joined activities, activity statistics, and notifications.

### 2. Hybrid Filtered Pagination and Scoped Loading

Apply exact database criteria first, iterate matching documents with a stable
cursor where the full matching set is required, and use database-side
`count`, `sort`, `skip`, and `limit` where a page is sufficient. Load related
documents only after the primary result set is known.

This is the selected approach. It preserves current APIs, is testable with the
existing cloud-function structure, and maps cleanly to future SQL queries.

### 3. Introduce a Shared Repository and Aggregation Layer

Move every query into a new repository package and implement all lists with
aggregation pipelines. This would centralize behavior, but every CloudBase
function is deployed as an independent package and currently copies shared
files into each function directory. The resulting deployment and regression
surface is too large for this repair.

## Query Rules

### Exact Entity Reads

Continue using `collection.doc(id).get()` for activities, users, teams,
registrations with deterministic IDs, and Web Admin sessions. These reads do
not have a collection-page truncation risk.

### Exact Existence and Count Queries

- Use a fully filtered query with `limit(1)` when only existence or one logical
  document is required.
- Use database-side `count()` for role invariants and list totals when the
  criteria can be expressed without changing current matching semantics.
- Do not read all users to count super administrators.

### Complete Matching Sets

When business logic requires every matching document:

1. apply `activityId`, `status`, permission, date, type, and action criteria
   before reading;
2. order by `_id` ascending;
3. read at most 100 documents per batch;
4. continue with `_id > lastId` until a short page is returned;
5. deduplicate by `_id` defensively;
6. apply the established business sort after all matching records are loaded.

Cursor pagination is preferred over increasing `skip` because it remains
stable while unrelated documents are written and maps to keyset pagination in
MySQL.

### Paged API Results

Web Admin APIs continue to accept `limit` and `skip` and return their current
additive pagination metadata. Database permission and business criteria must
be applied before result pagination. Related documents are loaded only for the
filtered or visible result set whenever that does not alter existing totals or
keyword behavior.

## Correctness Repairs

### Participant Manager Alias

`updateParticipantManagerAlias` must query one active real registration using:

```js
{
  activityId,
  userOpenId: targetOpenId,
  status: 'joined'
}
```

It must not read unrelated registrations. Existing permission checks,
proxy-registration rejection, user update fields, activity log shape, and
response fields remain unchanged.

### Last Super Administrator

`updateUserRoles` must count only user documents whose stable `roles` array
contains `super_admin`. Removing a super-admin role remains blocked when the
filtered total is one or zero. The target and caller continue to be loaded by
document ID.

### Bench Promotion

`cancelRegistration` and `removeRegistration` must load all active bench teams
for the activity and all joined registrations belonging to those teams. The
existing `compareBenchQueue` function remains the source of ordering so legacy
records without a modern timestamp keep their current fallback behavior.

The implementation must not assume that CloudBase query order is the business
queue order. Promotion stays inside the existing transaction and writes the
same activity, team, registration, and activity-log fields.

### Joined Activities

The mini-program `listActivities` scope `joined` must iterate every matching
joined registration for the caller, deduplicate activity IDs, load activities
in bounded ID groups, preserve deleted-activity filtering, and return the same
`{ items }` response shape and paging behavior.

### Activity Statistics

`getActivityStats` must load every team and registration matching one activity
in batches. Organizer authorization and the existing response shape remain
unchanged.

### Participant Notifications

`notifyActivityParticipants` must batch all joined registrations and accepted
activity subscriptions. The sent-log existence query must use `limit(1)`.
Recipient deduplication, subscription consumption, logs, confirmation state,
and notification payloads remain unchanged.

The manager threshold notification query used by `joinActivity` is scoped to
one activity and normally contains only a few managers. It will nevertheless
use the same bounded matching-set rule so configured manager recipients cannot
be silently omitted.

## Scoped Web Admin Loading

### Users

`listUsers` must avoid loading all registrations on every request solely to
recover fallback avatars. The requested user result set is established first.
Fallback registration avatars are queried only for those returned user IDs.
Keyword and role filtering retain their current semantics and exact total.

Where CloudBase cannot express the existing multi-field substring search with
a simple query, a bounded filtered scan is permitted for non-empty search input;
the default unfiltered page must not scan every registration.

### Activities

Web Admin activity queries must apply caller ownership, status, organizer, and
date criteria in the database before keyword filtering and enrichment. The
response remains `{ items, total, limit, skip, hasMore }` with the established
stable activity ordering.

### Attendance and Cancellation Statistics

`getAttendanceStats` first loads only activities in the requested date, type,
state, and organizer scope. It then loads registrations for those activity IDs
in bounded groups and loads only referenced real users. Aggregation and visible
pagination continue after the complete scoped source set has been assembled.

### Activity and Notification Logs

Log APIs must apply activity, action/type, status, target, and permission scope
before reading log pages. Only registrations, teams, activities, and users
referenced by the filtered logs or explicitly selected activity are loaded for
enrichment. The existing legacy log-field fallbacks remain supported.

## Residual Activity-Team Query Hardening

Four activity-scoped paths still read `activity_teams` with one `get()` call:

- `joinActivity` when a stale bench signup request must be redirected to an
  available regular team;
- `addProxyRegistration` when a bench proxy-signup request must be redirected
  to an available regular team;
- `getActivityCopyDraft` when reusable regular-team and bench-capacity settings
  are assembled;
- `updateActivity` when existing regular and bench teams are reconciled with an
  edited activity draft.

Each path must read the complete `activityId` matching set in batches of 100,
ordered by `_id` ascending and continued with `_id > lastId`. Duplicate IDs are
discarded defensively. The complete result then enters the existing business
ordering and reconciliation logic, including the established regular-team
`sort` and `_id` tie-breakers.

This repair changes no event field, response field, permission, validation,
team status, or UI flow. Activities whose matching team set fits in one page
retain identical behavior. The only externally observable change is correction
of previously truncated results after the first page.

## Version 0.9.4 Compatibility

The following functions already exist in tag `0.9.4` and are shared by V1 and
V2 clients when both point to the same CloudBase environment:

- `cancelRegistration`;
- `removeRegistration`;
- `listActivities`;
- `getActivityStats`;
- `notifyActivityParticipants`.

For these functions:

- existing event fields remain accepted;
- no new field becomes required;
- response fields and error messages remain compatible;
- missing optional V2 timestamps and role fields are handled with existing
  fallbacks;
- existing document IDs and statuses remain unchanged;
- additive internal batching must not require a client upgrade.

The test gate includes focused compatibility tests and the repository's
existing cloud-function regression suite. Before production deployment, the
same functions must also pass the documented V0.9.4 test-environment smoke
rehearsal against preserved representative data.

## Index and SQL Readiness

The implementation reuses existing stable fields:

- registrations: `activityId`, `userOpenId`, `teamId`, `status`, `_id`;
- activity teams: `activityId`, `teamType`, `status`, `_id`;
- activities: `organizerOpenId`, `status`, `startAt`, `_id`;
- users: `roles`, `_id`;
- logs: `activityId`, `action` or `notificationType`, `status`, `targetOpenId`,
  `createdAt`, `_id`;
- subscriptions: `activityId`, `userOpenId`, `templateKey`, `status`, `_id`.

Any new compound index required by a filtered cursor query must be added to the
bootstrap/index manifest and documented before deployment. The equivalent SQL
implementation can use indexed `WHERE` predicates, `COUNT(*)`, keyset
pagination, and bounded `IN` groups without changing the cloud-function API.

No new stored field or SQL column is introduced by this repair.

## Testing

Every milestone follows TDD and proves RED before production code changes.
Tests must use fake CloudBase query windows of 100 documents and place relevant
records beyond the first page.

Required coverage:

- valid participant alias target after more than 100 unrelated registrations;
- last-super-admin counting after more than 100 unrelated users;
- earliest bench candidate after more than 100 active registrations;
- joined activity beyond the first 100 registrations;
- activity totals beyond 100 registrations;
- participant and manager notifications beyond 100 subscriptions;
- scoped Web Admin reads do not request unrelated registrations or users;
- activity and notification log enrichment remains complete;
- stale self-signup and proxy-signup bench requests find a regular-team vacancy
  placed after the first 100 activity-team documents;
- activity copy drafts include regular and bench settings placed after the
  first 100 activity-team documents;
- activity editing reconciles existing teams placed after the first 100
  activity-team documents;
- existing V0.9.4 event and response contracts do not change.

## Delivery

Implementation is split into independently testable local commits:

1. design and implementation documentation;
2. participant alias and super-admin invariant;
3. bench promotion;
4. joined activities, activity statistics, and notifications;
5. Web Admin user and activity list scoping;
6. statistics and log scoping;
7. final regression and documentation update;
8. residual activity-team query pagination and follow-up regression.

Changed cloud functions must be redeployed to the test environment only after
local verification. This goal does not push commits or deploy to production.
