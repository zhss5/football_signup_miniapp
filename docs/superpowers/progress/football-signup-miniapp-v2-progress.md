# Football Signup Mini Program Version 2 Progress

## 1. Purpose

This file tracks Version 2 implementation progress separately from the Version 1 progress file.

Version 2 focuses on lightweight operations tooling, especially web-admin access, role management, participant identification, participant operation audit history, attendance management, attendance statistics, exports, operational review workflows, and SQL migration readiness for a later self-hosted backend.

## 2. Branch

- Branch: `codex/version-2-web-admin`
- Base commit: `42347b7 Document user permission management for version 2`
- Started: 2026-05-19

## 3. Current Status

Version 2 development branch has been created.

Version 2 execution planning has been completed.

Milestone 6 implementation is complete. Final Version 2 regression is next.

Implementation plan:

- `docs/superpowers/plans/2026-05-19-version-2-execution-plan.md`

Completed:

- shared cloud role helpers now support `super_admin`, role normalization, admin checks, and role-management boundary helpers.
- mini-program role helpers mirror the shared role behavior.
- role helper tests cover the `super_admin` behavior and management boundaries.
- `listUsers` cloud function supports admin/super-admin user search by keyword/openid and role.
- `updateUserRoles` cloud function enforces `super_admin` versus `admin` mutation boundaries.
- role removal keeps base `user` access.
- the last active `super_admin` is protected.
- role changes write `user_role_logs` audit records.
- `setRegistrationAttendance` cloud function lets organizers/admins mark confirmed-activity registrations present or absent.
- attendance updates write registration fields and `activity_logs` audit rows.
- `getActivityDetail` exposes attendance fields only to registration managers.
- `getActivityDetail` exposes manager-only `registrationId` values needed for attendance edits.
- mini-program Activity Detail shows confirmed-activity attendance state to registration managers.
- mini-program Activity Detail lets registration managers toggle members between present and absent.
- attendance editing remains hidden from regular users and before activity confirmation.
- `getAttendanceStats` cloud function returns date-range attendance statistics.
- admin and super admin statistics include all confirmed activities.
- organizer statistics include only their own confirmed activities.
- statistics include proxy signups, count blank attendance status as present, and exclude cancelled/deleted/pending activities.
- environment strategy decision recorded: continue with one CloudBase environment for now, avoid deploying changed existing functions during Version 1 review, and use function-name isolation such as `getActivityDetailV2` when testing changed existing behavior in a trial build.
- SQL migration readiness design documented in `docs/superpowers/specs/2026-06-10-sql-migration-readiness.md`.
- `exportActivityRoster` cloud function returns CSV/XLSX-ready roster rows for authorized organizers/admins.
- roster export rows include team, signup name, manager alias, preferred positions, proxy flag, and attendance status.
- roster export rejects regular users and keeps file generation out of the backend.
- `updateParticipantManagerAlias` cloud function lets authorized activity managers update shared manager aliases for real WeChat signup users.
- manager alias updates write `users.managerAlias`, `managerAliasUpdatedAt`, `managerAliasUpdatedBy`, and `activity_logs` audit rows with before/after values.
- manager alias edits reject ordinary users, out-of-scope organizers, proxy signups, and values longer than the future SQL `VARCHAR(128)` target.
- participant operation audit writes now cover self signup, re-signup, self cancellation, proxy signup, manager removal, team movement, attendance updates, and manager alias changes.
- `listActivityLogs` cloud function provides manager-only operation history review with admin/global and organizer/own-activity boundaries.
- SQL migration readiness mapping now documents `activity_logs.targetOpenId`, `operatorOpenId`, before/after data, and operation-specific payload fields.
- mini-program Activity Detail now shows manager aliases only to authorized registration managers.
- mini-program Activity Detail lets organizers, admins, and super admins edit real-user manager aliases through `updateParticipantManagerAlias`.
- mini-program manager alias editing remains hidden from regular users and proxy signup rows.
- `getActivityCopyDraft` cloud function returns permission-checked copy drafts for organizers, admins, and super admins.
- activity copy drafts include reusable setup fields only and exclude source IDs, registrations, attendance state, activity logs, notification logs, subscription state, confirmation state, and cancellation state.
- mini-program Activity Detail exposes the copy action only to source activity managers.
- mini-program Activity Create supports copy mode and requires the manager to choose the new activity time before publishing.
- `web-admin/` static foundation has been added without introducing a new build/runtime dependency.
- web-admin identity loading calls `ensureUserProfile`; ordinary users are denied before the workspace renders.
- web-admin user search calls `listUsers` with API-shaped keyword, role, limit, and skip parameters.
- web-admin role updates call `updateUserRoles`; super admins can manage `admin` and `organizer`, while admins can manage only `organizer`.
- web-admin activity list calls `listActivities` with `scope: web-admin` and API-shaped date, status, organizer, keyword, limit, and skip filters.
- web-admin access now allows organizers into activity operations while keeping user-role management limited to admins and super admins.
- `listActivities` enforces organizer own-activity visibility and admin/super-admin global visibility for web-admin activity review.
- web-admin activity detail shows teams, real/proxy registrations, position preferences, manager aliases, and attendance status using `getActivityDetail`.
- web-admin manager alias edits call `updateParticipantManagerAlias`; attendance edits call `setRegistrationAttendance`.
- web-admin attendance statistics call `getAttendanceStats` with date-range parameters.
- web-admin roster export calls `exportActivityRoster` and generates CSV text in the browser; the backend still returns rows only.
- `listNotificationLogs` cloud function provides notification-log review with admin/global and organizer/own-activity boundaries.
- web-admin activity-log review calls `listActivityLogs`; notification-log review calls `listNotificationLogs`.
- SQL migration readiness mapping now documents web-admin activity/log API boundaries and notification-log field mapping.
- Home activity list now loads additional pages with stable `limit` and `skip` parameters while preserving already-rendered cards.
- My Created and Joined tabs now maintain independent pagination state and load additional pages with stable `limit` and `skip` parameters.
- My Created tab now marks overdue unresolved activities when `endAt` has passed while the activity is still `published` and not `confirmed`.
- overdue unresolved prompts reuse existing confirm/cancel actions; confirmation calls `notifyActivityParticipants(activityId, 'proceeding')` and no automatic confirmation is introduced.

## 4. Planned Version 2 Scope

### 4.1 Web Admin Foundation

- Add a `web-admin/` subproject inside the existing repository.
- Use WeChat identity for web-admin login or authorization.
- Verify all admin access through backend/cloud-function role checks.
- Deny web-admin access to ordinary `user` accounts.

### 4.2 Role Management

- Add Version 2 `super_admin` as the root administrative role.
- Seed the first `super_admin` manually in CloudBase.
- Allow `super_admin` to grant or revoke `admin` and `organizer`.
- Allow `admin` to grant or revoke only `organizer`.
- Keep base `user` access when elevated permissions are removed.
- Prevent removing or downgrading the last active `super_admin`.
- Audit every role change with operator, target user, previous roles, next roles, and timestamp.

### 4.3 Activity Operations

- Add web-admin activity list and filters.
- Support filtering by date range, status, organizer, and keyword.
- Add activity detail review with teams, registrations, proxy signups, preferred positions, and notification state.
- Add activity duplication so managers can create a new activity from a previous activity's reusable settings.
- Keep `admin` visibility global.
- Keep `organizer` visibility limited to activities they created.

### 4.4 Participant Identification And Operation Audit

- Add shared participant manager aliases for real WeChat signup users.
- Store the shared alias on the user record so it follows the same participant across activities even if they change nickname or avatar.
- Allow activity managers to edit the shared alias from both the mini-program roster surface and the web admin, using the same backend permission checks.
- Keep manager aliases visible only to activity managers, admins, and super admins.
- Keep proxy signup cross-activity identification deferred until a later participant-profile model exists.
- Record participant operation history separately from current registration state.
- Audit participant self signup, self cancellation, re-signup, proxy signup, manager removal, team movement, attendance change, and manager alias change.
- Capture operator, target participant, activity, registration, action type, timestamp, and before/after data where useful.

### 4.5 Attendance Management

- Track attendance on active registration records.
- After an activity is confirmed as held, count active registrations as present by default.
- Allow organizer/admin users to manually mark participants absent or present.
- Add quick attendance editing in the mini program Activity Detail page.
- Add review and correction workflows in the web admin.
- Count only confirmed activities in attendance statistics.

### 4.6 Attendance Statistics And Export

- Add date-range attendance statistics.
- Aggregate by signup display name for Version 2.
- Include proxy signups in attendance statistics.
- Show signup count, present count, absent count, and attendance rate.
- Export rosters and attendance data as CSV/XLSX, including manager aliases where visible.

### 4.7 Operational Enhancements

- Add notification-log review.
- Add Home/My paginated loading.
- Add overdue unresolved activity prompts after `endAt` for still-published pending activities.
- Add copy-activity flow that copies reusable setup data but not registrations, attendance state, participant operation logs, notification logs, or subscription state.
- Keep invite-code signup, automatic reminders, payments, refunds, runtime MySQL migration, and player technical analysis out of the first Version 2 implementation slice unless explicitly reprioritized.

### 4.8 SQL Migration Readiness

- Prepare a target MySQL 8.x schema for the current and planned Version 2 data model.
- Map CloudBase collections and fields to SQL tables and columns.
- Keep Version 2 data changes SQL-friendly with explicit IDs, stable enum values, clear timestamps, and limited nested data.
- Preserve current-state versus history separation: `registrations` for current signup state and `activity_logs`/`user_role_logs` for audit history.
- Document backward-compatible schema rollout rules: add first, keep old fields, default new fields, migrate data, and remove last.
- Define migration validation checks for users, activities, teams, registrations, operation logs, role logs, notification subscriptions, and notification logs.
- Do not dual-write to MySQL or move live runtime traffic to a self-hosted backend in the first Version 2 implementation slice.

### 4.9 Environment And Deployment Strategy

- Continue using the current single CloudBase environment until a second paid environment is justified.
- Treat formal, trial, and development builds as sharing cloud functions and data whenever they use the same `CLOUD_ENV_ID`.
- Avoid deploying changed existing cloud functions while a Version 1 build is under review.
- Prefer temporary V2 function names for changed existing behavior that must be tested before formal deployment.
- Keep self-hosted backend migration as a later option for stronger `dev` / `test` / `prod` isolation, not as an immediate Version 2 dependency.

## 5. Next Implementation Step

Continue with final Version 2 regression and documentation audit in `docs/superpowers/plans/2026-05-19-version-2-execution-plan.md`.

Recommended first coding task:

- run targeted V2 regression tests and, if feasible, the full Jest suite.
- run `git diff --check`.
- audit SQL migration readiness coverage for all V2 fields, API contracts, and log actions.
- update final Version 2 progress and development-log entries.
