# Football Signup Mini-Program V2 Known Issues

This document records confirmed Version 2 defects that are intentionally
deferred for a coordinated stabilization pass. An issue remains open until its
implementation, regression coverage, deployment requirements, and production
validation have all been completed.

## Open Issues

### V2-BENCH-001: Activity capacity expansion does not promote bench registrations

- Status: Open
- First confirmed: 2026-08-05
- Priority: P1 for the V2 stabilization pass
- Affected flow: Mini-program activity edit -> `updateActivity`
- Affected runtime: CloudBase document database
- Data migration required: No

#### Reproduction

1. Create or use an activity whose regular team is full.
2. Add at least one joined registration to the generated bench team.
3. Edit the activity and increase an existing regular team's `maxMembers`, or
   add a new regular team with available capacity.
4. Save the activity and reopen its detail page.

Example starting state:

```text
Regular team: 2 / 2
Bench team:   1 / 2
```

After changing the regular-team capacity from `2` to `3`, the observed state
is:

```text
Regular team: 2 / 3
Bench team:   1 / 2
```

#### Expected Behavior

The earliest active bench registration should be promoted into the new regular
slot. The example should become:

```text
Regular team: 3 / 3
Bench team:   0 / 2
```

If multiple regular slots become available, promotions should continue until
either all regular vacancies are filled or the active bench queue is empty.
Bench ordering remains `joinedAt` ascending and then registration document ID
ascending. When multiple regular teams have vacancies, the recommended target
order is active regular-team `sort` ascending and then team ID ascending.

#### Root Cause

`cloudfunctions/updateActivity/index.js` currently reconciles the bench-team
capacity, regular-team definitions, activity fields, and the `update_activity`
audit log. It does not query joined bench registrations and does not invoke the
ordered promotion behavior used by `cancelRegistration` and
`removeRegistration`.

The V2 bench design states that the bench is a real waitlist that fills regular
vacancies, but its detailed implementation tests covered vacancies created by
participant cancellation and manager removal only. Capacity expansion was
omitted from both the acceptance matrix and the implementation.

#### Current Data Impact

- `activities.joinedCount` remains correct because no participant joins or
  leaves the activity.
- Existing regular-team and bench-team `joinedCount` values remain internally
  consistent with their current registrations.
- The queue invariant is violated: a regular vacancy can coexist with joined
  bench registrations.
- Previously affected activities will not repair themselves until a future
  reconciliation operation is explicitly run.

#### Planned Repair Scope

1. Add failing `updateActivity` tests before changing implementation.
2. Reconcile active regular vacancies against the global active bench queue
   when an activity update creates or exposes regular capacity.
3. Promote up to `min(total regular vacancies, active bench registrations)`.
4. Update each promoted registration's `teamId` without changing its
   `joinedAt` or registration ID.
5. Increment target regular-team `joinedCount` and decrement bench-team
   `joinedCount`; keep `activities.joinedCount` unchanged.
6. Write one `activity_logs` row with
   `action = registration_auto_promoted` for each promotion.
7. Perform capacity reconciliation and promotion in a transaction so a
   concurrent join, cancellation, removal, or edit cannot double-promote a
   registration or leave counters partially updated.
8. Keep the existing mini-program edit UI and API fields unchanged.

#### Required Tests

- Expanding one existing regular team promotes the earliest bench member.
- Expanding by multiple slots promotes multiple bench members in queue order.
- Expanding multiple teams fills teams in deterministic team order.
- Adding a new regular team promotes bench members into its vacancies.
- No promotion occurs when the bench queue is empty.
- Activity and team counts remain correct after every promotion.
- Promotion logs contain the registration, source bench team, target regular
  team, operator, activity, and timestamp.
- A transaction failure leaves capacities, registrations, counts, and logs
  unchanged.
- Existing V0.9.4-compatible activity-update payloads remain accepted.

#### Deployment And Architecture Notes

- Expected deployment scope: `updateActivity` only, unless promotion logic is
  extracted into a new shared helper copied into related cloud functions.
- No mini-program UI or Web Admin static redeployment should be required if the
  existing API contract remains unchanged.
- No new collection, stored field, enum, or SQL mapping is required. The
  existing `registration_auto_promoted` action and registration/team fields
  remain authoritative.
- This repair must not introduce runtime MySQL migration, dual-write, or a
  self-hosted HTTP API cutover.

### V2-ATTENDANCE-001: Proxy attendance can be selected but not saved

- Status: Open
- First confirmed: 2026-08-05
- Priority: P1 for the V2 stabilization pass
- Affected flow: Mini-program activity detail -> proxy participant dialog
- Affected runtime: Mini-program client only
- Data migration required: No

#### Reproduction

1. Open an activity as its organizer, an admin, or a super admin.
2. Tap a joined proxy registration.
3. Select `present` or `absent` in the participant dialog.
4. Observe that the dialog exposes only the Close action and no Save action.
5. Close and reopen the dialog.

The selected attendance value is discarded and the
`setRegistrationAttendance` cloud function is not called.

#### Expected Behavior

Managers should be able to save `present` or `absent` for both real-user and
proxy registrations. A proxy registration does not need a real WeChat
`userOpenId`; its stable registration document ID is sufficient for attendance
mutation.

#### Root Cause

The participant dialog correctly exposes attendance controls for a proxy
registration when `attendanceActionVisible`, `registrationId`, and
`attendanceActionStatus` are present. However, the Save button is rendered only
when `participantDialogAliasEditable` is true. The shared save handler also
returns early unless alias editing is enabled and the participant has a real
`userOpenId`.

Proxy registrations intentionally have no real-user `userOpenId` and cannot
have a user-level manager alias, so they can change the pending attendance
selection but cannot enter the save path.

The backend is not the blocker. `setRegistrationAttendance` validates and
updates by `activityId + registrationId`, accepts joined proxy registrations,
and already writes an `attendance_update` activity log with an empty
`userOpenId` when appropriate.

#### Current Data Impact

- No incorrect attendance value is written; the pending UI selection is simply
  lost when the dialog closes.
- Real-user attendance editing remains functional because managers can also
  edit those users' manager aliases and therefore receive the Save action.
- Web Admin attendance mutation is not affected because it calls
  `setRegistrationAttendance` directly by registration ID.
- Proxy attendance statistics remain incomplete when operators rely only on
  the mini-program activity-detail workflow.

#### Planned Repair Scope

1. Add failing mini-program activity-detail tests before changing behavior.
2. Show the Save action when either manager-alias editing or attendance editing
   is available.
3. Allow the save handler to persist an attendance-only change without a real
   `userOpenId`.
4. Keep the `userOpenId` requirement only around the manager-alias update path.
5. Call `setRegistrationAttendance(activityId, registrationId, status)` for a
   changed proxy attendance selection.
6. Preserve the current staged interaction: selecting a status changes local
   dialog state, and Save performs the backend mutation.
7. Keep ordinary users in the existing read-only participant dialog without
   attendance controls.

#### Required Tests

- A manager opening a proxy participant sees the attendance selector and Save
  action.
- Changing proxy attendance and pressing Save calls
  `setRegistrationAttendance` with the proxy registration ID.
- Proxy attendance save does not call `updateParticipantManagerAlias`.
- Closing without saving does not call either mutation API.
- The dialog reloads activity details after a successful proxy attendance
  update.
- Existing combined real-user alias and attendance save behavior remains
  unchanged.
- Ordinary users cannot mutate proxy or real-user attendance.

#### Deployment And Architecture Notes

- Expected deployment scope: upload a new mini-program build only.
- No cloud-function redeployment, Web Admin static deployment, collection,
  index, stored field, enum, or SQL mapping change is required.
- The existing `attendanceStatus`, `attendanceMarkedAt`,
  `attendanceMarkedBy`, and `attendance_update` contracts remain authoritative.
- This repair must not introduce runtime MySQL migration, dual-write, or a
  self-hosted HTTP API cutover.
