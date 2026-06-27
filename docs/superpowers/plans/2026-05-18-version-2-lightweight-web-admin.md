# Version 2 Plan: Lightweight Web Admin and Operations

## Goal

Version 2 should turn the MVP from a usable mini program into a practical daily operations tool. The mini program remains the participant-facing signup experience. A lightweight web admin is added for organizers and admins who need role management, activity review, attendance statistics, and export workflows.

## Positioning

Version 2 is an operations enhancement release, not a platform rewrite.

- Keep CloudBase document database for Version 2.
- Add a lightweight web admin that reads and writes the existing CloudBase data through controlled APIs/cloud functions.
- Add attendance management and attendance-rate reporting.
- Improve list scalability and organizer follow-up workflows.
- Prepare SQL migration readiness artifacts for a later self-hosted backend.
- Defer payments, refunds, a full enterprise admin console, and runtime MySQL migration.

## Recommended Scope

### 1. Lightweight Web Admin

The web admin should cover the highest-friction operational tasks first:

- admin login and access control.
- user list and user search.
- role management for adding or removing elevated permissions from regular `user` accounts.
- participant manager aliases so organizers/admins can recognize real WeChat signup users even after nickname or avatar changes.
- participant operation history for signup, cancellation, re-signup, removal, team movement, and attendance edits.
- activity list with filters for date range, status, organizer, and keyword.
- activity detail view with teams, registrations, proxy signups, preferred positions, and notification status.
- activity duplication so organizers/admins can create a new activity from a previous activity's reusable settings.
- roster export as CSV/XLSX.
- attendance management for started activities and manual corrections.
- attendance statistics by participant over a selected date range.
- basic notification-log review for troubleshooting.

The web admin does not require moving to MySQL. It should use the existing CloudBase collections and the same role rules as the mini program.

Recommended role model for Version 2:

- `super_admin`: root administrator. Can enter the web admin, manage all activities, grant or revoke `admin` and `organizer`, and manage all user roles except removing the last `super_admin`.
- `admin`: operations administrator. Can enter the web admin, manage all activities, manage attendance and exports, and grant or revoke `organizer`. Cannot grant or revoke `admin` or `super_admin`.
- `organizer`: activity manager. Can enter the web admin, but only for activities they created. Can manage rosters and attendance for their own activities. Cannot manage user roles.
- `user`: regular participant. Cannot enter the web admin.

Guardrails:

- Version 2 introduces `super_admin`; it is not part of the Version 1 implemented role set.
- Seed the first `super_admin` manually in CloudBase before enabling web-admin role management.
- Do not allow any user to remove their own highest administrative role in a way that could lock the system out.
- Do not allow deleting or downgrading the last active `super_admin`.
- All role changes must go through cloud functions that verify the caller's current role server-side.

User role management workflow:

- Web admin should provide user search by nickname, display name, copied user ID/openid, and role.
- Search results should show the user's current roles and the date they first used the mini program when available.
- The target is usually a regular `user`; admins should add or remove elevated roles on that existing user record.
- Do not delete the base `user` role when revoking `organizer` or `admin`; role removal means the user returns to ordinary participant access.
- `super_admin` can add or remove `admin` and `organizer` permissions for regular users.
- `admin` can add or remove only `organizer` permission for regular users.
- `organizer` and `user` cannot change any user's roles.
- Every role change should write an audit log with operator openid, target openid, previous roles, next roles, and timestamp.

### 2. Participant Identity And Operation Audit

Version 2 should help organizers identify repeat participants reliably.

Recommended shared user fields:

```js
managerAlias,
managerAliasUpdatedAt,
managerAliasUpdatedBy
```

Rules:

- `managerAlias` is a management-facing identity note, not a legal real-name field.
- The alias is stored on the real WeChat user record and follows that user across activities.
- Organizers, admins, and super admins share the same alias value.
- The alias can be edited from both the mini-program manager roster surface and the web admin. Both surfaces must call the same controlled backend API instead of writing directly to CloudBase.
- Ordinary users cannot see or edit management aliases.
- Proxy signups do not have a stable real WeChat identity yet. Version 2 attendance statistics use the proxy signup name as the proxy participant identity; a later participant-profile model can replace name-based identity if needed.

Participant operations should keep current state separate from historical trace data:

- `registrations` remains the current state used by activity detail, capacity, team counts, and attendance state.
- Participant action logs record the history used for audit and dispute resolution.

Actions that should leave a trace:

- participant self signup.
- participant self cancellation.
- participant re-signup after cancellation.
- organizer/admin proxy signup.
- organizer/admin participant removal.
- organizer/admin team movement.
- organizer/admin attendance change.
- manager alias change.

Each operation log should capture operator, target participant, activity, registration, action type, timestamp, and enough before/after data to explain what changed.

### 3. Attendance Management

Attendance should be tracked on registration records.

Recommended fields on `registrations`:

```js
attendanceStatus: 'present' | 'absent',
attendanceMarkedAt,
attendanceMarkedBy
```

Default rule:

- After an activity has started, every active registration is counted as `present` by default.
- If `attendanceStatus` is empty, statistics treat it as `present`.
- Organizers/admins only write an attendance value when they manually mark a participant as `absent` or switch the participant back to `present`.

Counting rules:

- Only activities whose start time has passed are included in attendance statistics.
- Cancelled, deleted, and future activities are excluded.
- Active registration records are included.
- Proxy signups are included.
- Version 2 aggregates real WeChat users by openid and proxy signups by proxy signup name. A later version can add a participant profile/person identity model if name-based proxy aggregation becomes inaccurate.

Statistics columns:

- participant name.
- signup count.
- present count.
- absent count.
- attendance rate.

Formula:

```text
signup count = active registrations in started, non-cancelled, non-deleted activities within the date range
absent count = registrations with attendanceStatus === 'absent'
present count = signup count - absent count
attendance rate = present count / signup count
```

### 4. Where Attendance Is Edited

Add attendance editing in both places, with different purposes:

- Mini program Activity Detail: organizer/admin can quickly mark attendance on the phone.
- Web admin: organizer/admin can review, batch-correct, audit, and export attendance data.

Recommended guardrails:

- Only the activity organizer or an admin can edit attendance.
- Regular users cannot edit attendance.
- The UI should make the default visible: everyone is counted as present unless marked absent.

### 5. Activity List Pagination

Home and My should support loading additional activity batches.

- Keep cloud-side sorting before pagination.
- Reuse the current `limit` and `skip` support unless cursor pagination becomes necessary.
- Add `onReachBottom` loading in Home and My.
- Preserve current filters while loading more.

### 6. Activity Duplication

Organizers often create recurring activities with similar teams, capacity, venue, images, and descriptions. Version 2 should let managers copy an existing activity into a new activity draft.

Copy rules:

- Activity creators can copy their own activities.
- Admins and super admins can copy any activity.
- Copy reusable setup fields: title, description, venue, location, images, team names, team colors, team capacities, signup limits, and notification settings.
- Do not copy registrations, attendance state, participant operation logs, notification logs, or subscription state.
- The copied activity must be reviewed before saving, and the UI should force the manager to confirm or change the new activity time.
- The copied activity is a new activity with a new ID; later changes to either activity must not affect the other.

### 7. Overdue Activity Handling

The mini-program My page should not show an overdue unresolved action prompt. Organizers and admins can still confirm or cancel from the activity detail flow. No automatic confirmation should run in Version 2.

### 8. Roster Export Improvements

Improve participant exports for organizers:

- group by team.
- include manager aliases when visible to the exporter.
- include preferred positions.
- identify proxy signups.
- support copy format in the mini program.
- support CSV/XLSX export in the web admin.

### 9. Notification Operations

Keep the existing notification model and add operational visibility:

- show notification log rows in web admin.
- show send status and failure reason when available.
- keep automatic pre-activity reminders deferred until manual notification behavior is stable.

### 10. SQL Migration Readiness

Version 2 should prepare for a later self-hosted backend without moving the live runtime off CloudBase.

Readiness scope:

- Draft a target MySQL 8.x schema for the current and planned Version 2 data model.
- Map CloudBase collections and fields to SQL tables and columns.
- Keep new Version 2 fields SQL-friendly: explicit IDs, flat scalar fields where practical, clear timestamps, and stable enum values.
- Preserve the separation between current state tables and history tables. For example, `registrations` remains the current signup state while `activity_logs` records participant operations.
- Document backward-compatible schema rules: add fields first, keep old fields alive, make new fields optional with defaults, dual-write only when needed, migrate data, and remove old fields last.
- Define migration validation checks for users, activities, teams, registrations, operation logs, role logs, notification subscriptions, and notification logs.

Recommended target tables:

```text
users
user_roles
activities
activity_teams
registrations
activity_logs
user_role_logs
notification_subscriptions
notification_logs
```

This work is documentation and design readiness only. Version 2 should not dual-write to MySQL, replace CloudBase functions with HTTP APIs, or move storage/auth/notification integrations to a self-hosted service.

### 11. Invite-Code Signup

Add invite-code signup only after the operational core is stable:

- create/edit activity can configure an invite code.
- signup requires the correct code when one is configured.
- backend validates the code.
- Home visibility rules can remain simple in Version 2: show the activity, but require code before signup.

### 12. Cover Crop UX

Replace slider-only cover crop controls with drag/zoom gestures when time allows. This is useful polish, but it is lower priority than web admin and attendance operations.

## Deferred From Version 2

- Runtime migration to MySQL or a self-hosted backend.
- full enterprise-grade backend/admin console.
- payment, refund, and fee settlement flows.
- automatic scheduled reminders.
- complex membership system.
- historical image thumbnail backfill.
- participant identity unification beyond signup display name.

## Implementation Order

1. Add attendance fields, update APIs/cloud functions, and add tests for the default-present attendance rules.
2. Add mini program attendance editing for activity managers.
3. Add shared participant manager aliases and participant operation audit logs.
4. Build the web admin foundation: login, role guard, user search, regular-user permission add/remove, and activity list.
5. Add activity duplication for creating new activities from previous reusable settings.
6. Add web admin activity detail and attendance management.
7. Add web admin attendance statistics with date range filters and export.
8. Add Home/My pagination.
9. Keep overdue activity prompt out of the mini-program My page.
10. Improve roster export formats.
11. Add notification-log review.
12. Add SQL migration readiness documentation and keep it aligned with Version 2 data-model changes.
13. Add invite-code signup.
14. Improve cover-crop gestures.

## Version 2 Success Criteria

- A seeded `super_admin` can grant or revoke `admin` access without manually editing CloudBase documents.
- Admins can grant or revoke organizer access without manually editing CloudBase documents.
- Admins cannot grant or revoke `admin` or `super_admin` access.
- Removing elevated permissions leaves the user as a regular participant instead of deleting the account.
- Organizers/admins can set a shared management alias for a real WeChat signup user and see it across later activities.
- Participant signup, cancellation, re-signup, removal, team movement, attendance change, and alias changes leave operation history.
- Organizers/admins can copy an existing activity into a new activity draft without copying registrations or attendance history.
- Organizers/admins can mark attendance from the mini program.
- Admins can review and correct attendance from the web admin.
- Admins can generate attendance statistics for a selected date range.
- Organizers can export rosters and attendance data.
- The Version 2 data model has a documented MySQL 8.x target schema, CloudBase-to-SQL field mapping, and migration validation checklist for future self-hosting work.
- Home/My can handle more than the first activity batch.
- The system still runs on the existing CloudBase document database.
