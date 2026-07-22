# V2 Configurable Late Cancellation Notice Window Design

## Purpose

Complete the existing late-cancellation organizer notice by exposing its time window in the mini-program activity create and edit form. The runtime remains CloudBase and the data contract stays compatible with a future MySQL 8.x and self-hosted server migration.

## Confirmed Product Rules

- The stable activity field is `lateCancellationNoticeWindowHours`.
- Activity create and edit show a numeric field labelled `临近取消通知（小时）` in notification settings.
- The default value is `6`.
- Allowed values are integers from `0` through `168`, inclusive.
- `0` disables the late-cancellation organizer notice for the activity.
- Help text explains that the activity creator is notified when a participant cancels within the configured number of hours before activity start, and that `0` disables the notice.
- Only participant self-cancellation through `cancelRegistration` triggers this notification. Manager removal does not trigger it.
- The activity creator must still have accepted the existing manager registration notification subscription. Sending remains best-effort and must not roll back a cancellation.

## Data And API Contract

`createActivity` and `updateActivity` accept the field as an API-level integer:

```json
{
  "lateCancellationNoticeWindowHours": 6
}
```

Both cloud functions validate the value independently of the mini-program. Omitted values use `6` for backward compatibility. Values below `0`, above `168`, non-integers, and non-numeric values are rejected.

Activity copy preserves a valid source value, including `0`. A historical source activity without the field produces a copy draft with `6`.

The mini-program local mock follows the same defaults and validation boundaries so local development does not diverge from CloudBase behavior.

## Compatibility

- Historical CloudBase activity documents are not migrated in place. Readers treat a missing field as `6`.
- Existing V1 clients may omit the field; backend defaults keep their create and update requests valid.
- The change is additive. Existing clients ignore the new field when reading activities.
- The target SQL mapping remains `activities.late_cancellation_notice_window_hours INT NOT NULL DEFAULT 6`.
- A future self-hosted API should expose the same camelCase API field while mapping it to the SQL snake_case column.
- No runtime MySQL migration, dual-write, or self-hosted HTTP API cutover is included.

## UI Behavior

- The create form initializes the field to `6`.
- The edit form displays the stored value; a missing or invalid historical value displays `6`.
- A copied activity displays the source value; a missing or invalid historical value displays `6`.
- The field uses a numeric input and is validated before submission.
- Validation errors are localized in Chinese and English.

## Verification

- Cloud-function tests cover omitted, valid boundary, disabled, and invalid values for create and update.
- Copy-draft tests cover preservation of `0` and another valid value, plus the historical default.
- Mini-program tests cover form defaults, edit/copy normalization, payload construction, UI binding, validation, localization, and local mock persistence.
- Regression includes the existing `cancelRegistration` late-notice tests.
