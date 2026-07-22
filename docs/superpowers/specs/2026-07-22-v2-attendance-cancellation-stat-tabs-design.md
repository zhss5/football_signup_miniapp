# V2 Attendance And Cancellation Statistics Tabs Design

## Purpose

Split the mixed Web Admin statistics table into two focused views under one statistics workspace:

- attendance statistics for started activities.
- cancellation statistics for final signup outcomes.

The change keeps the existing CloudBase runtime and role boundaries while making the two different metrics and their detail records explicit.

## Confirmed User Experience

The left navigation has one statistics entry named `统计分析`. The content area has two tabs:

- `出勤统计`
- `取消统计`

Both tabs share these filters:

- start date.
- end date.
- activity type: all, internal, or external.

Loading statistics refreshes both datasets from one `getAttendanceStats` response. Switching tabs does not issue another request. The export command exports only the active tab and uses an active-tab-specific filename and columns.

### Attendance Tab

The attendance table shows:

- participant.
- manager alias.
- attendance-eligible signup count.
- present count.
- absent count.
- attendance rate.

Opening a row shows attendance details for started activities: activity, activity type, start time, signup name, manager alias, and attendance status.

### Cancellation Tab

The cancellation table shows:

- participant.
- manager alias.
- effective signup activity count.
- cancelled activity count.
- cancellation rate.

Opening a row shows final-outcome details: activity, activity type, start time, signup name, manager alias, and final outcome (`joined` or `cancelled`). Cancelled outcomes also include `cancelledAt` when available.

The cancellation-rate formula remains:

```text
cancelledActivityCount /
  (effectiveSignupActivityCount + cancelledActivityCount)
```

Each participant-activity pair contributes at most one final outcome. Manager removals remain excluded. A cancelled registration followed by a successful rejoin contributes a final `joined` outcome.

## API Contract

`getAttendanceStats` keeps every existing response field. It adds `cancellationDetails` to each participant row:

```json
{
  "participantName": "Alex",
  "effectiveSignupActivityCount": 2,
  "cancelledActivityCount": 1,
  "cancelRate": 0.3333333333,
  "cancellationDetails": [
    {
      "activityId": "activity_1",
      "activityTitle": "Wednesday Match",
      "activityType": "internal",
      "startAt": "2026-07-23T12:00:00.000Z",
      "registrationId": "registration_1",
      "signupName": "Alex",
      "managerAlias": "Keeper",
      "outcome": "cancelled",
      "cancelledAt": "2026-07-22T10:00:00.000Z"
    }
  ]
}
```

Field rules:

- `cancellationDetails` is additive and always an array.
- It contains one row for each final participant-activity outcome used by the cancellation denominator.
- `outcome` uses stable enum strings: `joined` and `cancelled`.
- Missing historical `activityType` is returned as `internal`.
- Missing historical `cancelledAt` is returned as an empty string.
- Rows are sorted by `startAt` ascending, then activity title, then registration id.

The existing `details` array remains attendance-only so older clients keep their current behavior.

## Permission And Visibility

- `organizer` can view statistics only for activities they organize.
- `admin` and `super_admin` can view all activities allowed by the existing API.
- ordinary users remain forbidden.
- no manager-only fields are added to ordinary-user responses.

## Compatibility And Migration Readiness

- No CloudBase collection migration is required.
- No runtime MySQL, dual-write, or self-hosted HTTP API is introduced.
- The future SQL implementation derives the same final outcomes from registrations and returns the same API-shaped detail objects.
- Stable IDs, enum values, and timestamps remain independent from Web Admin DOM structure.
- Existing callers that ignore `cancellationDetails` remain compatible.

## Error And Empty States

- A failed load keeps both tabs empty and surfaces the existing request error.
- Attendance empty copy refers only to attendance records.
- Cancellation empty copy refers only to final signup outcomes.
- Export with no rows does not download a file and shows the active tab's empty guidance.

## Verification

- Backend tests prove final-outcome detail construction, rejoin behavior, role/date/type filtering, defaults, and ordering.
- Web Admin tests prove tab visibility, tab switching, separate tables, separate detail dialogs, and active-tab exports.
- Existing attendance response fields and attendance details remain unchanged.
- Full regression and `git diff --check` run before deployment.
