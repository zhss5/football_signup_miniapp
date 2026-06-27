# V2 Activity Type and Review Fields

## Scope

This note records the confirmed Version 2 behavior for activity type, attendance filtering, and web-admin-only review fields.

## Activity Type

- Activities have an `activityType` enum.
- Stable enum values:
  - `internal`: internal match, displayed as `内战`.
  - `external`: external match, displayed as `外战`.
- Historical activities without `activityType` are treated as `internal`.
- Creating an activity requires choosing an activity type.
- Editing an activity can change the activity type.
- Expired activities can still be edited when the caller has normal edit permission and the activity is not deleted.

## Attendance Statistics

- Attendance statistics support filtering by activity type:
  - all activity types.
  - internal matches only.
  - external matches only.
- Historical activities with missing `activityType` count as internal matches.
- Existing attendance inclusion rules remain:
  - not cancelled.
  - not deleted.
  - either already confirmed or activity start time has passed.

## Web Admin Review Fields

- Activity detail in web admin includes an `activitySummary` field for the whole activity.
- Each participant row in web admin includes a `performanceDescription` field for that participant in that activity.
- Proxy participants can also have `performanceDescription`.
- These fields are web-admin-only display/editing fields and are not shown in the mini-program UI.
- Maximum lengths:
  - `performanceDescription`: 500 characters.
  - `activitySummary`: 2000 characters.

## Data Contract Notes

- Current activity state remains on the activity or registration records.
- Audit/history remains in logs.
- Backend APIs should use explicit field names and stable enum values so the contract can map cleanly to a future MySQL 8.x and self-hosted server migration.
