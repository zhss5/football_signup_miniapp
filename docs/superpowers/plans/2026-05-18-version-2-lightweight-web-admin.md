# Version 2 Plan: Lightweight Web Admin and Operations

## Goal

Version 2 should turn the MVP from a usable mini program into a practical daily operations tool. The mini program remains the participant-facing signup experience. A lightweight web admin is added for organizers and admins who need role management, activity review, attendance statistics, and export workflows.

## Positioning

Version 2 is an operations enhancement release, not a platform rewrite.

- Keep CloudBase document database for Version 2.
- Add a lightweight web admin that reads and writes the existing CloudBase data through controlled APIs/cloud functions.
- Add attendance management and attendance-rate reporting.
- Improve list scalability and organizer follow-up workflows.
- Defer payments, refunds, a full enterprise admin console, and MySQL migration.

## Recommended Scope

### 1. Lightweight Web Admin

The web admin should cover the highest-friction operational tasks first:

- admin login and access control.
- user list and user search.
- role management for `user`, `organizer`, `admin`, and `super_admin`.
- activity list with filters for date range, status, organizer, and keyword.
- activity detail view with teams, registrations, proxy signups, preferred positions, and notification status.
- roster export as CSV/XLSX.
- attendance management for confirmed activities.
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

### 2. Attendance Management

Attendance should be tracked on registration records.

Recommended fields on `registrations`:

```js
attendanceStatus: 'present' | 'absent',
attendanceMarkedAt,
attendanceMarkedBy
```

Default rule:

- After an activity is confirmed as held, every active registration is counted as `present` by default.
- If `attendanceStatus` is empty, statistics treat it as `present`.
- Organizers/admins only write an attendance value when they manually mark a participant as `absent` or switch the participant back to `present`.

Counting rules:

- Only activities with `confirmStatus: 'confirmed'` are included in attendance statistics.
- Cancelled, deleted, and unconfirmed activities are excluded.
- Active registration records are included.
- Proxy signups are included.
- Version 2 can aggregate by signup display name first. A later version can add a participant profile/person identity model if name-based aggregation becomes inaccurate.

Statistics columns:

- participant name.
- signup count.
- present count.
- absent count.
- attendance rate.

Formula:

```text
signup count = active registrations in confirmed activities within the date range
absent count = registrations with attendanceStatus === 'absent'
present count = signup count - absent count
attendance rate = present count / signup count
```

### 3. Where Attendance Is Edited

Add attendance editing in both places, with different purposes:

- Mini program Activity Detail: organizer/admin can quickly mark attendance on the phone after the activity ends.
- Web admin: organizer/admin can review, batch-correct, audit, and export attendance data.

Recommended guardrails:

- Only the activity organizer or an admin can edit attendance.
- Only confirmed activities allow attendance edits.
- Regular users cannot edit attendance.
- The UI should make the default visible: everyone is counted as present unless marked absent.

### 4. Activity List Pagination

Home and My should support loading additional activity batches.

- Keep cloud-side sorting before pagination.
- Reuse the current `limit` and `skip` support unless cursor pagination becomes necessary.
- Add `onReachBottom` loading in Home and My.
- Preserve current filters while loading more.

### 5. Overdue Activity Handling

After `endAt` passes, if an activity is still `published` and `confirmStatus: 'pending'`, organizers should see a clear action prompt:

- confirm held.
- cancel activity.

No automatic confirmation should run in Version 2.

### 6. Roster Export Improvements

Improve participant exports for organizers:

- group by team.
- include preferred positions.
- identify proxy signups.
- support copy format in the mini program.
- support CSV/XLSX export in the web admin.

### 7. Notification Operations

Keep the existing notification model and add operational visibility:

- show notification log rows in web admin.
- show send status and failure reason when available.
- keep automatic pre-activity reminders deferred until manual notification behavior is stable.

### 8. Invite-Code Signup

Add invite-code signup only after the operational core is stable:

- create/edit activity can configure an invite code.
- signup requires the correct code when one is configured.
- backend validates the code.
- Home visibility rules can remain simple in Version 2: show the activity, but require code before signup.

### 9. Cover Crop UX

Replace slider-only cover crop controls with drag/zoom gestures when time allows. This is useful polish, but it is lower priority than web admin and attendance operations.

## Deferred From Version 2

- MySQL migration.
- full enterprise-grade backend/admin console.
- payment, refund, and fee settlement flows.
- automatic scheduled reminders.
- complex membership system.
- historical image thumbnail backfill.
- participant identity unification beyond signup display name.

## Implementation Order

1. Add attendance fields, update APIs/cloud functions, and add tests for the default-present attendance rules.
2. Add mini program attendance editing for confirmed activities.
3. Build the web admin foundation: login, role guard, user list, `super_admin`/`admin`/`organizer` role management, and activity list.
4. Add web admin activity detail and attendance management.
5. Add web admin attendance statistics with date range filters and export.
6. Add Home/My pagination.
7. Add overdue activity prompt.
8. Improve roster export formats.
9. Add notification-log review.
10. Add invite-code signup.
11. Improve cover-crop gestures.

## Version 2 Success Criteria

- A seeded `super_admin` can grant or revoke `admin` access without manually editing CloudBase documents.
- Admins can grant or revoke organizer access without manually editing CloudBase documents.
- Admins cannot grant or revoke `admin` or `super_admin` access.
- Organizers/admins can mark attendance from the mini program after a confirmed activity.
- Admins can review and correct attendance from the web admin.
- Admins can generate attendance statistics for a selected date range.
- Organizers can export rosters and attendance data.
- Home/My can handle more than the first activity batch.
- The system still runs on the existing CloudBase document database.
