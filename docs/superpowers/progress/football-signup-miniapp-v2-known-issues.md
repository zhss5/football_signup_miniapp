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
