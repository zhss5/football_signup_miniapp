# Football Signup Mini Program Version 2 Progress

## 1. Purpose

This file tracks Version 2 implementation progress separately from the Version 1 progress file.

Version 2 focuses on lightweight operations tooling, especially web-admin access, role management, attendance management, attendance statistics, exports, and operational review workflows.

## 2. Branch

- Branch: `codex/version-2-web-admin`
- Base commit: `42347b7 Document user permission management for version 2`
- Started: 2026-05-19

## 3. Current Status

Version 2 development branch has been created.

Version 2 execution planning has been completed.

No Version 2 implementation code has been added yet.

Implementation plan:

- `docs/superpowers/plans/2026-05-19-version-2-execution-plan.md`

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
- Keep `admin` visibility global.
- Keep `organizer` visibility limited to activities they created.

### 4.4 Attendance Management

- Track attendance on active registration records.
- After an activity is confirmed as held, count active registrations as present by default.
- Allow organizer/admin users to manually mark participants absent or present.
- Add quick attendance editing in the mini program Activity Detail page.
- Add review and correction workflows in the web admin.
- Count only confirmed activities in attendance statistics.

### 4.5 Attendance Statistics And Export

- Add date-range attendance statistics.
- Aggregate by signup display name for Version 2.
- Include proxy signups in attendance statistics.
- Show signup count, present count, absent count, and attendance rate.
- Export rosters and attendance data as CSV/XLSX.

### 4.6 Operational Enhancements

- Add notification-log review.
- Add Home/My paginated loading.
- Add overdue unresolved activity prompts after `endAt` for still-published pending activities.
- Keep invite-code signup, automatic reminders, payments, refunds, MySQL migration, and player technical analysis out of the first Version 2 implementation slice unless explicitly reprioritized.

## 5. Next Implementation Step

Start implementation from Milestone 1 in `docs/superpowers/plans/2026-05-19-version-2-execution-plan.md`.

Recommended first coding task:

- extend shared role helpers for `super_admin`, `admin`, `organizer`, and base `user` behavior.
- add red/green tests before changing production code.
