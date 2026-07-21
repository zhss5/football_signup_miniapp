# Post-V2 Cancellation, Statistics, Roster Export, and Bench Queue Design

## Purpose

This document records the confirmed post-Version 2 changes for four operational gaps:

1. notify the activity creator when a participant cancels shortly before the activity starts.
2. add participant cancellation counts and rates to statistics.
3. add activity type to roster CSV export rows.
4. make bench signups behave as a real waitlist that automatically fills regular-team vacancies.

The current runtime storage remains CloudBase document database. The design must stay compatible with a later MySQL 8.x and self-hosted server migration.

## Non-Goals

- Do not introduce runtime MySQL.
- Do not dual-write CloudBase and MySQL.
- Do not switch the mini-program or Web Admin to a self-hosted HTTP API.
- Do not generate CSV or XLSX files in cloud functions. Backend exports still return rows only.
- Do not expose manager-only fields to ordinary users.
- Do not change existing Version 1 data destructively.

## Confirmed Product Rules

### Late Cancellation Notice

- Activity create/edit exposes a configurable cancellation notice window.
- The default window is `6` hours before `activities.startAt`.
- `0` disables late cancellation notification for that activity.
- The stable CloudBase field is `lateCancellationNoticeWindowHours`.
- A user-initiated `cancelRegistration` triggers the check when `0 <= startAt - now <= lateCancellationNoticeWindowHours`.
- The notification recipient is the activity creator, identified by `activities.organizerOpenId`.
- Manager removal through `removeRegistration` does not trigger this late-cancellation notice.
- Notification sending is best-effort. A send failure or skipped subscription must not roll back the cancellation.
- The send attempt is recorded in `notification_logs` with `notificationType: registration_cancelled` and `templateKey: manager_registration_notice`.

### Participant Cancellation Statistics

Cancellation statistics use a final-outcome-per-activity model.

- For each real participant and activity, count at most one outcome.
- For each proxy participant and activity, count at most one outcome under the V2 proxy identity rule, which uses proxy signup name.
- `effectiveSignupActivityCount` counts participant-activity pairs whose final/current registration status is `joined`.
- `cancelledActivityCount` counts participant-activity pairs whose final/current state is user-initiated cancellation.
- `cancelRate = cancelledActivityCount / (effectiveSignupActivityCount + cancelledActivityCount)`.
- Manager removals are excluded from cancellation rate. They may remain visible in operation history and can become a separate statistic later.
- Rejoin churn inside the same activity does not double-count. If a user cancels and later rejoins, the final outcome is an effective signup for that activity, not both signup and cancellation.
- Cancellation statistics use the same role visibility, activity start-date range, and activity type filter as `getAttendanceStats`.
- Cancellation statistics exclude `cancelled` and `deleted` activities, but they do not require the activity start time to have passed. Attendance counts still require started activities.

Examples:

| Scenario | effectiveSignupActivityCount | cancelledActivityCount |
| --- | ---: | ---: |
| A joins one activity and remains joined | 1 | 0 |
| A joins one activity and cancels, with no rejoin | 0 | 1 |
| A joins, cancels, rejoins, and remains joined | 1 | 0 |
| A joins, cancels, rejoins, and cancels again | 0 | 1 |
| A joins three activities and cancels two as final outcome | 1 | 2 |

### Roster Export Activity Type

- `exportActivityRoster` adds `activityType` to each returned row.
- Stable enum values are `internal` and `external`.
- Missing historical `activityType` is treated as `internal`.
- Web Admin CSV output adds the visible column `活动类型`.
- Display labels are `内战` for `internal` and `外战` for `external`.
- The backend still returns CSV/XLSX-ready rows only; the browser remains responsible for CSV text generation.

### Bench Capacity and Total Capacity

- Activity create/edit no longer treats total signup limit as a primary manually edited value.
- Managers enter each regular team's capacity.
- Managers enter an explicit bench capacity.
- Total capacity is computed as:

```text
signupLimitTotal = sum(active regular team maxMembers) + active bench maxMembers
```

- `activities.signupLimitTotal` remains stored for compatibility with old clients and current queries.
- `activity_teams.teamType` remains the stable team-type enum. Allowed values are `regular` and `bench`.
- A bench team with `maxMembers: 0` means no bench queue.
- New and edited activities should have at most one active bench team.

### Ordinary Signup Into Bench

- Ordinary users cannot intentionally join the bench while any active regular team has capacity.
- The mini-program hides or disables bench signup while a regular slot exists.
- The backend must enforce the same rule because the user may submit stale UI state or a crafted request.
- If a user requests a bench team while a regular slot exists, the backend assigns the user to the first active regular team with capacity instead of rejecting the request.
- The regular assignment order is deterministic: active `regular` teams ordered by `sort` ascending, then team id ascending.
- The `joinActivity` response returns the actual assignment:

```json
{
  "registrationId": "activity_1_openid_1",
  "status": "joined",
  "requestedTeamId": "bench_team",
  "teamId": "team_red",
  "teamName": "Red",
  "autoAssigned": true,
  "autoAssignedReason": "regular_slot_available"
}
```

- If the user requests a regular team that is full while another regular team has capacity, the existing explicit-team behavior remains unchanged unless a later design approves auto-balancing regular teams.

### Bench Auto Promotion

- When a regular registration is cancelled through `cancelRegistration` or removed by a manager through `removeRegistration`, the earliest joined active bench registration is promoted into the vacated regular team.
- Promotion order is `joinedAt` ascending, then registration id ascending for deterministic behavior.
- The promoted participant keeps the same registration id and `joinedAt`; only `teamId` and `updatedAt` change.
- A self-cancelled registration gets `cancelledAt`, `cancelCount`, and `updatedAt`; a manager-removed registration keeps the existing removal audit fields. Both change to `status: cancelled`.
- If a bench participant cancels, no promotion is attempted.
- If no bench participant exists, the regular team vacancy remains open.
- `activities.joinedCount` decreases by one for the cancelled participant. The promoted bench participant was already counted as joined, so promotion does not add back to activity total.
- Regular team `joinedCount` is unchanged when a bench participant is promoted into the cancelled slot; otherwise it decreases by one.
- Bench team `joinedCount` decreases by one when a bench participant is promoted.
- Promotion writes an `activity_logs` row with `action: registration_auto_promoted`.
- Promotion does not send a separate WeChat notification to the promoted participant in this change. The participant sees the updated team when they reopen activity detail.

## API Contracts

### `cancelRegistration`

The cancellation response remains compatible with old callers. Additive fields are allowed:

```json
{
  "registrationId": "activity_1_openid_1",
  "status": "cancelled",
  "promotedRegistrationId": "activity_1_openid_2",
  "promotedTeamId": "team_red",
  "lateCancellationNotice": {
    "attempted": true,
    "recipientOpenId": "organizer_openid",
    "status": "sent"
  }
}
```

Old callers may ignore `promotedRegistrationId`, `promotedTeamId`, and `lateCancellationNotice`.

### `removeRegistration`

Manager-removal responses use the same additive promotion identifiers as `cancelRegistration`: `promotedRegistrationId`, `promotedTeamId`, and `promotedFromTeamId`. Old callers may ignore these fields.

### `getAttendanceStats`

Add participant-level cancellation fields without changing existing attendance fields:

```json
{
  "openid": "openid_1",
  "displayName": "Zhang",
  "effectiveSignupActivityCount": 8,
  "cancelledActivityCount": 2,
  "cancelRate": 0.2
}
```

The implementation can derive these from current `registrations` plus operation logs where needed. The API must not expose raw CloudBase document layouts.

Cancellation fields use the same `startAt`, `endAt`, `activityType`, and role visibility filters as the existing attendance statistics API. The existing attendance fields continue to count only started activities; the new cancellation fields may include future non-deleted, non-cancelled activities in the selected date range.

### `exportActivityRoster`

Each row adds:

```json
{
  "activityType": "internal",
  "activityTypeLabel": "内战"
}
```

`activityTypeLabel` is optional API convenience for clients. `activityType` is the stable field used for SQL/self-hosted compatibility.

## Data Compatibility

- Historical activities without `activityType` are treated as `internal`.
- Historical activities without `lateCancellationNoticeWindowHours` use the default value `6`.
- Historical activities that already have a bench team use that team's `maxMembers` as bench capacity.
- Historical activities with `signupLimitTotal` greater than regular-team capacity and no bench team may derive bench capacity from the difference during a future edit path, but no destructive migration is required before implementation.
- Old clients that still submit `signupLimitTotal` remain accepted. New create/edit code computes and stores it from regular plus bench capacities.
- New fields and new log actions are additive. Existing V1 mini-program reads should continue to ignore them.

## SQL and Self-Hosted Readiness

- Existing target SQL column `activities.activity_type` stores the stable `internal` / `external` enum used by statistics and roster export.
- New target SQL column: `activities.late_cancellation_notice_window_hours INT NOT NULL DEFAULT 6`.
- Existing target SQL column `activities.signup_limit_total` remains because old CloudBase data and older clients depend on it.
- Existing target SQL column `activity_teams.team_type` remains the regular/bench discriminator.
- Existing target SQL field `activity_logs.payload` stores promotion details such as cancelled registration id, promoted registration id, from team, to team, and queue order.
- Existing target SQL field `notification_logs.notification_type` accepts `registration_cancelled`.
- No MySQL migration, dual-write, or self-hosted HTTP API cutover is part of this change.

## Testing Plan For Implementation

Implementation must be TDD. The first implementation goal should add failing tests before business code changes.

Minimum backend tests:

- `cancelRegistration` sends a late-cancellation notice only inside the configured window.
- `cancelRegistration` skips the notice when the window is `0`, when outside the window, or when the action is manager removal.
- `cancelRegistration` promotes the earliest bench registration into a cancelled regular slot.
- `cancelRegistration` keeps activity and team counts correct after promotion.
- `removeRegistration` promotes the earliest bench registration after a regular proxy or real-user registration is removed.
- `removeRegistration` keeps activity and team counts correct after promotion.
- `joinActivity` auto-assigns a stale bench request to a regular slot when regular capacity exists.
- `joinActivity` allows bench signup only when all active regular teams are full.
- `getAttendanceStats` returns final-outcome cancellation counts and rates.
- `exportActivityRoster` returns `activityType` with default `internal`.

Minimum mini-program tests:

- Activity create/edit computes total capacity from regular plus bench capacity.
- Bench signup is hidden or disabled while regular capacity exists.
- Stale bench submission displays the actual assigned regular team returned by the backend.

Minimum Web Admin tests:

- Roster CSV includes the `活动类型` column.
- Statistics views show cancellation count and cancellation rate without exposing raw logs.

## Recommended Implementation Order

1. Add `activityType` to `exportActivityRoster` rows and Web Admin CSV. This is the smallest low-risk contract change.
2. Add cancellation statistics to `getAttendanceStats`. This is read-only and establishes the final-outcome metric.
3. Add late cancellation notice from `cancelRegistration`, with notification logging and failure isolation.
4. Add computed total capacity and bench signup enforcement.
5. Add bench auto-promotion inside `cancelRegistration` after the capacity rules are locked.
