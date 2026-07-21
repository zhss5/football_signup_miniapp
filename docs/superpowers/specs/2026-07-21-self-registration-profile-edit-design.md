# Self Registration Profile Edit Design

## Purpose

Allow a real WeChat user who has joined an activity to correct their own avatar, activity-specific signup name, and preferred positions before the activity starts.

This change keeps the current CloudBase runtime and existing registration model. It does not add runtime MySQL, dual-write, or a self-hosted HTTP API.

## Confirmed Product Rules

- A joined user may edit their own registration profile until, but not including, the activity start time.
- At or after `activities.startAt`, the registration snapshot is read-only.
- Editing remains allowed after the signup deadline when the activity has not started, because the change does not consume capacity or alter team membership.
- Only real-user self-registration is editable through this flow.
- Proxy registrations are not editable through this flow.
- Organizers, admins, and super admins cannot use this self-service API to edit another participant's signup name, avatar, or preferred positions.
- Editing profile data must not change team, signup status, attendance, joined time, cancellation counts, removal counts, or activity/team counters.

## User Experience

### Activity Detail Member Row

Do not add a third full-width text action beside the existing move and cancel/remove actions.

- Every viewer may continue tapping a participant's avatar/name area to open the existing participant dialog.
- The current user's joined row shows a small pencil edit indicator next to the name only while the activity has not started.
- The entire current-user profile area remains tappable; the pencil is a discoverability cue, not a separate large action.
- Existing `move`, `cancel signup`, and manager `remove` actions keep their current placement and behavior.

### Participant Dialog

- Other participants remain information-only for ordinary users.
- Before activity start, the current user's dialog shows a clear `修改报名信息` action.
- At or after activity start, the current user's dialog is read-only and does not show the edit action.
- If the current user is also an organizer/admin, manager alias and attendance controls keep their existing permission rules. The self-profile edit action is a separate operation and must not modify manager-only fields.

### Edit Form

Reuse the existing activity signup form behavior in an explicit edit mode rather than adding the fields inline to the participant dialog.

- Page title: `修改报名信息`.
- Prefill from the current registration snapshot, not only from reusable user defaults.
- Editable fields: avatar, signup name, and up to two preferred positions.
- Team is not editable in this form. If shown, it is read-only.
- The avatar remains optional. Submitting an empty avatar explicitly clears the avatar from both the current registration snapshot and reusable user defaults.
- Saving returns to Activity Detail, marks it for refresh, and shows a success message.
- If the activity starts or the registration stops being joined while the form is open, saving fails with a stable localized error and leaves the stored data unchanged.

## Data Ownership

The existing split between activity-specific data and reusable defaults remains authoritative:

- `registrations.signupName`, `registrations.avatarUrl`, and `registrations.preferredPositions` are the current activity snapshot used by rosters and exports.
- `users.preferredName`, `users.avatarUrl`, and `users.preferredPositions` are defaults for future signup forms.

A successful edit updates both records in one CloudBase transaction:

```text
registrations.signupName          <- normalized signupName
registrations.avatarUrl           <- normalized avatarUrl, including empty string
registrations.profileSource       <- normalized profileSource
registrations.preferredPositions  <- normalized preferredPositions
registrations.updatedAt           <- current UTC timestamp

users.preferredName               <- normalized signupName
users.avatarUrl                   <- normalized avatarUrl, including empty string
users.profileSource               <- normalized profileSource
users.preferredPositions          <- normalized preferredPositions
users.lastActiveAt                <- current UTC timestamp
users.updatedAt                   <- current UTC timestamp
```

No new CloudBase field or SQL column is required.

## Backend API

Add a dedicated cloud function named `updateMyRegistrationProfile`.

### Input

```json
{
  "activityId": "activity_1",
  "signupName": "Alex",
  "avatarUrl": "cloud://env/user-avatars/openid.jpg",
  "profileSource": "manual",
  "preferredPositions": ["前锋", "门将"]
}
```

The API deliberately does not accept `userOpenId`, `teamId`, registration status, attendance, or counters. The target user is always derived from the authenticated CloudBase context.

### Validation

Inside one transaction:

1. Resolve the caller's OpenID from trusted context.
2. Load the activity and reject missing, deleted, or non-published activities.
3. Compare the current timestamp with `startAt`; reject at or after activity start.
4. Load the caller's registration for the activity and require `status: joined`.
5. Reject proxy registration records.
6. Apply the existing signup-name normalization and length rules.
7. Apply the existing preferred-position enum, deduplication, and maximum-two rules.
8. Normalize `avatarUrl` and `profileSource` using the same contract as signup.
9. Update the registration snapshot and reusable user defaults atomically.
10. Write the audit log before returning.

### Output

```json
{
  "activityId": "activity_1",
  "registrationId": "activity_1_openid_1",
  "signupName": "Alex",
  "avatarUrl": "cloud://env/user-avatars/openid.jpg",
  "profileSource": "manual",
  "preferredPositions": ["前锋", "门将"],
  "updatedAt": "2026-07-21T10:00:00.000Z"
}
```

The response is API-shaped and does not expose raw CloudBase documents.

## Audit Log

Write one `activity_logs` document with stable action:

```text
action = registration_profile_update
```

Required fields:

- `activityId`
- `registrationId`
- `operatorOpenId`
- `targetOpenId`
- `before.signupName`
- `before.avatarUrl`
- `before.profileSource`
- `before.preferredPositions`
- `after.signupName`
- `after.avatarUrl`
- `after.profileSource`
- `after.preferredPositions`
- `createdAt`

For this self-service action, `operatorOpenId` and `targetOpenId` are identical. The audit log stays separate from current registration state and maps to the existing future SQL `activity_logs.payload` JSON field.

## Compatibility And Migration Readiness

- Version 1 clients remain compatible because they do not call the new function and continue reading the same existing fields.
- Old registration documents with missing `avatarUrl`, `profileSource`, or `preferredPositions` use empty-string/empty-array defaults in the edit form.
- Existing `getActivityDetail`, roster export, attendance statistics, and notification flows continue reading the registration snapshot.
- Existing user defaults continue prefilling future signup forms.
- The new API uses explicit IDs, stable field names, stable enum strings, and UTC timestamps for future MySQL 8.x and self-hosted API compatibility.
- No collection bootstrap change, data migration, runtime MySQL migration, dual-write, or HTTP API cutover is required.

## Error Contract

Use stable business errors with Chinese localization in the mini-program:

- `Activity not found`
- `Activity is not open for signup`
- `Registration not found`
- `Only joined registrations can be edited`
- `Proxy registrations cannot be edited`
- `Registration profile is locked after activity start`
- existing signup-name and preferred-position validation errors

## Test Requirements

Implementation must use TDD.

Backend tests:

- a joined real user can update all three fields before start.
- the registration snapshot and user defaults update atomically.
- empty avatar explicitly clears both stored avatar values.
- another user's registration cannot be targeted because the API has no target-user input.
- proxy, cancelled, removed, missing, deleted-activity, and started-activity cases are rejected.
- editing after signup deadline but before start remains allowed.
- team, status, attendance, joined time, counters, and activity/team counts remain unchanged.
- `registration_profile_update` records complete before/after audit data.

Mini-program tests:

- ordinary users can still open information-only participant dialogs for other users.
- the current user's row shows the pencil indicator only before start.
- the current user's participant dialog shows the edit action only before start.
- manager controls remain governed by their existing permissions when the manager is also the current participant.
- edit mode prefills from `myRegistration`, uploads a newly selected avatar, and calls `updateMyRegistrationProfile`.
- successful save refreshes Activity Detail.
- backend lock and validation errors display localized messages.

## Deployment Scope

- Deploy the new `updateMyRegistrationProfile` cloud function.
- Upload a new mini-program build.
- Do not redeploy Web Admin for this feature.
- Do not migrate or recreate CloudBase collections.
