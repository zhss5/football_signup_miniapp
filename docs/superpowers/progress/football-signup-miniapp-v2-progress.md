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

Version 2 implementation scope is complete on the `codex/version-2-web-admin` branch. Final regression has passed.

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
- `setRegistrationAttendance` cloud function lets organizers/admins mark registrations present or absent.
- attendance updates write registration fields and `activity_logs` audit rows.
- `getActivityDetail` exposes attendance fields only to registration managers.
- `getActivityDetail` exposes manager-only `registrationId` values needed for attendance edits.
- mini-program Activity Detail shows attendance state to registration managers.
- mini-program Activity Detail lets registration managers toggle members between present and absent.
- attendance editing remains hidden from regular users.
- `getAttendanceStats` cloud function returns date-range attendance statistics.
- admin and super admin statistics include all started, non-cancelled, non-deleted activities.
- organizer statistics include only their own started, non-cancelled, non-deleted activities.
- statistics include proxy signups, count blank attendance status as present, and exclude future, cancelled, or deleted activities.
- proxy signup statistics use the proxy signup name as the Version 2 unique identity.
- environment strategy decision recorded: continue with one CloudBase environment for now, avoid deploying changed existing functions during Version 1 review, and use function-name isolation such as `getActivityDetailV2` when testing changed existing behavior in a trial build.
- SQL migration readiness design documented in `docs/superpowers/specs/2026-06-10-sql-migration-readiness.md`.
- `exportActivityRoster` cloud function returns CSV/XLSX-ready roster rows for authorized organizers/admins.
- roster export rows include team, signup name, manager alias, preferred positions, proxy flag, and attendance status.
- roster export rejects regular users and keeps file generation out of the backend.
- `updateParticipantManagerAlias` cloud function lets authorized activity managers update shared manager aliases for real WeChat signup users.
- `updateUserManagerAlias` lets admins update the same user-level manager alias from Web Admin user management.
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
- mini-program Activity Create supports copy mode, reuses source start/end/deadline time-of-day, and requires the manager to choose the new activity date before publishing.
- `web-admin/` static foundation has been added without introducing a new build/runtime dependency.
- web-admin login uses a mini-program QR confirmation bridge so browser sessions resolve back to a real WeChat `OPENID`.
- `createWebAdminLogin`, `confirmWebAdminLogin`, and `pollWebAdminLogin` provide short-lived Web Admin login challenges and session tokens.
- Web Admin protected calls attach `webAdminSessionToken`; shared cloud auth resolves it to `users/{OPENID}` before checking roles.
- ordinary users cannot confirm Web Admin login or enter the workspace.
- roles are not granted to browser-generated anonymous identities.
- web-admin identity loading calls `ensureUserProfile` after a confirmed Web Admin session exists.
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
- My Created tab no longer shows an overdue unresolved activity prompt.
- confirmation still calls `notifyActivityParticipants(activityId, 'proceeding')`; no automatic confirmation is introduced.
- Web Admin static asset query versions must be bumped before every Web Admin upload/deployment to avoid CloudBase/CDN serving stale JS or CSS.
- full regression passed after Web Admin QR login work with `npm test`: `79` suites and `607` tests.
- final SQL migration readiness audit confirms V2 fields, stable enum strings, API contracts, log actions, CloudBase-to-SQL mappings, compatibility rules, and validation checks are documented.
- Version 2 still does not introduce runtime MySQL migration, CloudBase/MySQL dual-write, or a self-hosted HTTP API switch.
- `bootstrapV2Collections` cloud function now provides an explicit, idempotent CloudBase readiness step for missing V2 collections.
- `scripts/deploy-v2-bootstrap.ps1` and `npm run deploy:v2-bootstrap` deploy and invoke the bootstrap step through CloudBase CLI without deleting or recreating existing V1 data collections.
- final V2 product rules confirmed on 2026-06-27:
  - proxy attendance statistics use proxy signup name as the proxy identity.
  - attendance statistics include only started, non-cancelled, non-deleted activities and do not require `confirmStatus: confirmed`.
  - copy activity preserves source start/end/signup-deadline time-of-day but requires a new calendar date.
  - ordinary participants do not see `内战` / `外战`; activity type is manager-facing for create/edit and Web Admin statistics.
- 2026-06-28 post-V2 UI modernization pass (style only): restyled the mini-program (My/Home/Detail/Create/Join/sheets/cover-crop), added vector + tabBar/activity-type icons, unified the "加载更多" pill, and modernized the Web Admin (login, sidebar, tables, detail modal, coloured pills, segmented attendance, icon edit/close buttons, restyled context menu without 确认举行). Web Admin static assets end this pass at `20260628-context-menu`.
- 2026-06-28 functional fix: the mini-program proxy (代报名) member settings sheet now exposes present/absent controls; no cloud function change was required (`setRegistrationAttendance` already accepts proxy registration IDs).
- full regression after the post-V2 UI pass and proxy attendance fix: `82` suites and `709` tests.
- still deferred after the post-V2 pass (NOT implemented): invite-code signup; gesture-based (drag/zoom) cover crop, which remains slider-based; XLSX roster export, where the Web Admin still generates CSV only.
- 2026-07-20 post-V2 change-request design completed in `docs/superpowers/specs/2026-07-20-v2-cancellation-stats-roster-bench-design.md`; implementation is proceeding milestone by milestone.
- SQL migration readiness now covers activity type in roster export, late cancellation notice windows, final-outcome cancellation statistics, computed regular-plus-bench capacity, and bench auto-promotion logging.
- 2026-07-20 milestone 1 implemented: `exportActivityRoster` rows and Web Admin roster CSV now include activity type, with missing historical values defaulting to `internal`.
- 2026-07-20 milestone 2 implemented: `getAttendanceStats` now returns final-outcome cancellation counts/rates, and Web Admin statistics table/CSV show cancellation count and cancellation rate.
- 2026-07-20 milestone 3 implemented: `cancelRegistration` now sends best-effort late cancellation notices to the activity creator inside the configurable cancellation window.
- 2026-07-20 milestone 4 implemented: create/update activity flows now support explicit API `benchCapacity`, compute `signupLimitTotal` from regular plus bench capacity for new clients, keep old total-capacity behavior for old clients, and backend `joinActivity` auto-assigns stale bench signup requests to the first available regular team.
- 2026-07-20 milestone 5 implemented: `cancelRegistration` now auto-promotes the earliest joined active bench registration into a cancelled regular slot, keeps activity and team counts consistent, and writes `registration_auto_promoted` activity logs.
- 2026-07-20 post-V2 change-request implementation closure: full regression passed with `npm test -- --runInBand` (`82` suites, `721` tests), `git diff --check` passed with line-ending warnings only, and the runtime remains CloudBase-only with no MySQL migration, no dual-write, and no self-hosted HTTP API switch.
- 2026-07-21 explicit bench-capacity UI follow-up implemented: mini-program create/edit/copy now edits `benchCapacity`, displays computed read-only `signupLimitTotal`, recovers historical bench capacity compatibly, and `getActivityCopyDraft` returns the API-only capacity field. Full regression passed (`82` suites, `733` tests). Deployment requires a mini-program upload and `getActivityCopyDraft` redeployment; no database migration is required.

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
- Keep activity type manager-facing: organizers/admins use it in create/edit flows and Web Admin statistics; ordinary participants do not see `内战` / `外战`.
- Add activity duplication so managers can create a new activity from a previous activity's reusable settings.
- Keep `admin` visibility global.
- Keep `organizer` visibility limited to activities they created.

### 4.4 Participant Identification And Operation Audit

- Add shared participant manager aliases for real WeChat signup users.
- Store the shared alias on the user record so it follows the same participant across activities even if they change nickname or avatar.
- Allow activity managers to edit the shared alias from both the mini-program roster surface and the web admin, using the same backend permission checks.
- Keep manager aliases visible only to activity managers, admins, and super admins.
- Use proxy signup name as the Version 2 proxy identity for attendance statistics; keep richer proxy participant profiles deferred.
- Record participant operation history separately from current registration state.
- Audit participant self signup, self cancellation, re-signup, proxy signup, manager removal, team movement, attendance change, and manager alias change.
- Capture operator, target participant, activity, registration, action type, timestamp, and before/after data where useful.

### 4.5 Attendance Management

- Track attendance on active registration records.
- After an activity has started, count active registrations as present by default.
- Allow organizer/admin users to manually mark participants absent or present.
- Add quick attendance editing in the mini program Activity Detail page.
- Add review and correction workflows in the web admin.
- Count only started activities that are not cancelled or deleted in attendance statistics.

### 4.6 Attendance Statistics And Export

- Add date-range attendance statistics.
- Aggregate real WeChat signups by openid and proxy signups by proxy signup name for Version 2.
- Include proxy signups in attendance statistics.
- Show signup count, present count, absent count, and attendance rate.
- Export rosters and attendance data as CSV/XLSX, including manager aliases where visible.

### 4.7 Operational Enhancements

- Add notification-log review.
- Add Home/My paginated loading.
- Keep overdue unresolved activity prompts out of the mini-program My page.
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

Version 2 is formally closed for acceptance as of 2026-06-28: the committed Version 2 scope and all Version 2 success criteria are complete and pass full regression (`82` suites, `709` tests). Invite-code signup, gesture-based (drag/zoom) cover crop, and XLSX roster export are confirmed deferred beyond Version 2; they were optional/conditional items in the plan, are not part of the Version 2 success criteria, and are not required for Version 2 acceptance.

Prepare Version 2 deployment and acceptance using the deployment notes in `docs/superpowers/plans/2026-05-19-version-2-execution-plan.md`.

Post-V2 change-request implementation should start from the 2026-07-20 design spec and stay TDD. Recommended coding order:

- add `activityType` to `exportActivityRoster` rows and Web Admin CSV. Completed 2026-07-20.
- add final-outcome participant cancellation counts and rates to `getAttendanceStats`. Completed 2026-07-20.
- add configurable late-cancellation notice from `cancelRegistration` to the activity creator. Completed 2026-07-20.
- add computed total capacity and backend bench signup enforcement. Completed 2026-07-20; mini-program form follow-up completed 2026-07-21.
- add bench auto-promotion inside `cancelRegistration`. Completed 2026-07-20.

Deployment readiness tasks remain:

- run `npm run deploy:v2-bootstrap -- -EnvId '<target-cloud-env-id>'` for existing CloudBase environments before V2 smoke testing, or use `-DeployOnly` and invoke `bootstrapV2Collections` manually.
- review the CloudBase deployment set and deploy only when ready.
- seed the first `super_admin` manually in CloudBase before using role management.
- upload the mini-program build and host `web-admin/` after CloudBase function deployment.
- keep invite-code signup, automatic reminders, payments/refunds, and runtime MySQL/self-hosted migration deferred.
