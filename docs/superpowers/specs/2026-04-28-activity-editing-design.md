# Activity Editing Design

- Date: 2026-04-28
- Status: Proposed backlog design
- Scope: Organizer and admin editing for existing activities

## 1. Goal

Let organizers correct activity details after publishing without deleting and recreating the activity.

The first version should preserve existing registrations, existing shared links, and the activity document ID.

## 2. Product Decision

Activity editing should be implemented before more advanced organizer operations.

The current product already lets organizers create, cancel, and delete empty activities. The missing daily-use action is editing a published activity when time, venue, description, cover image, or capacity changes.

First version behavior:

1. Organizer opens Activity Detail or My Created list.
2. Organizer taps `Edit`.
3. The app opens the existing Create Activity page in edit mode.
4. Organizer updates supported fields.
5. The app calls a new `updateActivity` cloud function.
6. The cloud function validates permission, data, and capacity rules.
7. The activity is updated in place and an `activity_logs` entry is written.

## 3. Permissions

Allowed:

- the original activity organizer
- users with `admin` in `users.roles`

Blocked:

- regular participants
- anonymous or unresolved users
- organizers editing activities created by someone else, unless they also have `admin`

The frontend should hide edit actions from blocked users, but the cloud function must enforce the permission.

## 4. Editable Fields

First version editable fields:

- title
- activity date and start/end time
- signup deadline date and time
- location and address text
- description
- cover image
- total signup capacity

The implementation may reuse existing create-page form fields and validation helpers.

## 5. Capacity Rules

Capacity changes must not invalidate existing registrations.

Rules:

- total signup capacity cannot be reduced below the current `joinedCount`
- total signup capacity must still cover the configured team slots
- if team capacities are exposed in edit mode, each team capacity cannot be reduced below that team's current `joinedCount`
- teams with existing registrations should not be deleted in the first version

If a requested edit violates these rules, the update should fail with a clear validation error.

## 6. Deferred Scope

Do not include these in the first version:

- moving players between teams
- deleting teams that already have registrations
- migrating registrations to another activity
- restoring deleted activities
- bulk editing multiple activities
- full admin-console editing
- payment, refund, or fee recalculation behavior

These can be added later as separate organizer operations.

## 7. Data Model Direction

Reuse the existing `activities` and `activity_teams` collections.

For activity updates:

- update the existing `activities/{activityId}` document
- preserve `_id`, `organizerOpenId`, `createdAt`, `joinedCount`, and registration-derived counters
- update `updatedAt`

For logs:

- write an `activity_logs` entry with:
  - `activityId`
  - `operatorOpenId`
  - `action`: `update_activity`
  - changed field names or a compact before/after summary
  - `createdAt`

The first version does not need a full audit diff UI, but the backend should leave enough trace data for troubleshooting.

## 8. Cloud Function Direction

Add:

- `updateActivity`

Responsibilities:

- resolve the caller openid
- load the current activity
- load the caller user document for role checks
- allow only the activity organizer or `admin`
- reject deleted activities
- validate all editable fields
- enforce capacity constraints against existing joined counts
- upload/storage handling should continue to happen before the cloud function receives final CloudBase file IDs, matching the create flow
- update activity/team documents in place
- write `activity_logs`
- return the updated activity ID and any useful summary

Use a function-level `package.json` and copied shared helpers, following the current cloud function packaging pattern.

## 9. Frontend Direction

Entry points:

- Activity Detail: show `Edit` for the organizer or `admin`
- My Created list: optionally show `Edit` beside existing organizer actions

Page behavior:

- reuse `pages/activity-create` in edit mode if practical
- load existing activity data into the form
- keep create-mode labels separate from edit-mode labels where necessary
- submit to `updateActivity` instead of `createActivity`
- show clear validation errors for capacity and deadline issues

The page should avoid accidental data loss when switching from create mode to edit mode.

## 10. Local Mock Direction

Extend the local mock client with `updateActivity`.

Mock behavior should mirror CloudBase rules:

- organizer/admin permission
- total capacity cannot drop below joined count
- deleted activities cannot be edited
- update existing activity data instead of creating a new activity

## 11. Testing Direction

Cover these paths:

- organizer can edit supported activity fields
- `admin` can edit an activity
- regular user cannot edit
- non-owner organizer cannot edit another organizer's activity
- deleted activity cannot be edited
- total capacity cannot be reduced below joined count
- existing registrations remain attached to the same activity after edit
- activity log is written
- create page still works in create mode after adding edit mode
