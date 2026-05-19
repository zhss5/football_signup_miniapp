# Version 2 Development Log

This file is the development log for Version 2 work on the `codex/version-2-web-admin` branch.

Use this file for Version 2 implementation entries instead of appending Version 2 work to `docs/development-log.md`.

## 2026-05-19 - Version 2 Branch Start

Branch:

- `codex/version-2-web-admin`

Starting baseline:

- Based on `main` at `42347b7 Document user permission management for version 2`.
- Remote `origin/main` was checked before branch creation and was already up to date.

Version 2 documentation policy:

- Record Version 2 development notes in this file.
- Record Version 2 implementation progress in `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`.
- Keep Version 1 progress and general historical notes in their existing files unless a change explicitly affects the released Version 1 baseline.

Initial Version 2 scope:

- lightweight web admin in the existing repository.
- WeChat identity based web-admin access with server-side role checks.
- `super_admin` seeded manually before web-admin role management.
- regular-user permission add/remove workflow for `admin` and `organizer`.
- activity review, attendance management, attendance statistics, roster export, and notification-log review.
- CloudBase document database remains the data store for Version 2.

## 2026-05-19 - Version 2 Execution Plan Prepared

The Version 2 requirements were converted into an execution plan for V2.0 development.

Plan:

- `docs/superpowers/plans/2026-05-19-version-2-execution-plan.md`

The plan keeps V2.0 focused on:

- shared `super_admin` role model.
- user search and elevated-permission management.
- attendance backend and mini-program attendance editing.
- web-admin foundation.
- activity review, attendance statistics, roster export, and notification-log review.
- Home/My pagination and overdue unresolved activity prompts.

Deferred out of V2.0:

- invite-code signup.
- automatic scheduled reminders.
- payments, refunds, and fee settlement.
- MySQL migration.
- account-password login.
- player technical analysis.

## 2026-05-19 - Shared Version 2 Role Helpers

Implemented the first Version 2 execution-plan task: shared role helpers for `super_admin`.

Delivered behavior:

- `normalizeRoles` keeps the base `user` role, removes duplicates, drops unknown roles, and returns roles in a stable order.
- `super_admin` is treated as an admin for activity creation and activity management.
- `isAdmin`, `isSuperAdmin`, `hasRole`, `canManageOrganizerRole`, and `canManageAdminRole` are available in shared cloud helpers.
- `admin` can manage organizer permissions but cannot manage admin permissions.
- `super_admin` can manage both organizer and admin permissions.
- mini-program role helpers mirror the shared server-side behavior for UI gating and display.

Verification:

- red/green tests added for cloud shared roles and mini-program role helpers.
- full regression passed: `59` test suites, `442` tests.

## 2026-05-19 - User Search And Role Mutation APIs

Implemented the Version 2 user permission backend.

New cloud functions:

- `listUsers`
- `updateUserRoles`

Delivered behavior:

- admins and super admins can search users by keyword, copied openid/user ID, and role.
- ordinary users and organizers cannot list users.
- `super_admin` can grant or revoke `admin` and `organizer`.
- `admin` can grant or revoke only `organizer`.
- elevated-role removal keeps the base `user` role.
- the last active `super_admin` cannot be removed.
- users cannot remove their own highest administrative role in a way that could lock out role management.
- every role change writes a `user_role_logs` audit row with operator, target, previous roles, next roles, and timestamp.

Deployment note:

- deploy `listUsers` and `updateUserRoles` after running `copy-cloud-shared`.
- ensure or create the `user_role_logs` collection before production role-change testing.
- seed the first `super_admin` manually in CloudBase before using the web-admin role-management workflow.

Verification:

- red/green tests added for user search, role mutation boundaries, last-super-admin protection, and role-change audit logs.
- full regression passed: `61` test suites, `457` tests.

## 2026-05-19 - Attendance Mutation Backend

Implemented the Version 2 attendance mutation backend.

New cloud function:

- `setRegistrationAttendance`

Delivered behavior:

- activity organizers can mark active registrations as `present` or `absent` after the activity is confirmed.
- admins and super admins can mark attendance for any confirmed activity.
- regular users cannot update attendance.
- attendance cannot be changed before `confirmStatus: confirmed`.
- attendance updates write `attendanceStatus`, `attendanceMarkedAt`, and `attendanceMarkedBy` on the registration.
- attendance updates write an `activity_logs` row with action `attendance_update`.
- `getActivityDetail` now returns attendance fields on roster members only to viewers who can manage registrations.
- regular viewers do not receive member attendance fields.

Deployment note:

- deploy `setRegistrationAttendance`.
- redeploy `getActivityDetail`.
- run `copy-cloud-shared` before CloudBase deployment.

Verification:

- red/green tests added for organizer/admin permission, confirmed-activity guard, status validation, activity-log writes, and manager-only Activity Detail attendance fields.
- full regression passed: `62` test suites, `466` tests.
