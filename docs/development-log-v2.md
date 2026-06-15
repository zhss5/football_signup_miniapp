# Version 2 Development Log

This file is the development log for Version 2 work on the `codex/version-2-web-admin` branch.

Use this file for Version 2 implementation entries instead of appending Version 2 work to `docs/development-log.md`.

## 2026-06-15 - Web Admin WeChat QR Login

Implemented the Web Admin login bridge through the mini program's real WeChat identity.

Delivered behavior:

- added `createWebAdminLogin`, `confirmWebAdminLogin`, and `pollWebAdminLogin` cloud functions.
- added the `web_admin_sessions` collection to the V2 bootstrap list.
- Web Admin now creates a short-lived QR login challenge instead of treating anonymous Web SDK users as admin identities.
- organizers, admins, and super admins confirm Web Admin login from the mini program `My` page by scanning the Web Admin QR payload.
- confirmed Web Admin sessions resolve back to the real mini-program `OPENID` before any role or activity operation is authorized.
- Web Admin API calls attach `webAdminSessionToken` to protected cloud-function calls.
- shared auth now supports `resolveOpenIdFromEvent` for Web Admin session tokens while keeping mini-program mutation flows on real `OPENID`.
- local mock supports the mini-program confirm action for development smoke tests.

Security decision:

- do not seed or grant roles to browser-generated `web_xxx` identities.
- keep the source of truth in `users/{OPENID}.roles`.
- ordinary `user` accounts cannot confirm Web Admin login and cannot enter the Web Admin workspace.
- do not let the browser submit an arbitrary `openid` as proof of identity; only the mini program cloud-function context can prove the scanner's real WeChat `OPENID`.

Token model:

- `confirmToken` is embedded in the QR payload and is used only by the mini program to confirm a pending login challenge.
- `pollToken` is returned only to the browser that created the challenge and is used only to ask whether that challenge has been confirmed.
- Web Admin polls because the browser cannot know when the separate mini-program scan-and-confirm action has completed; polling keeps the implementation simple without adding WebSocket or long-connection infrastructure.
- `sessionToken` is generated only after `confirmWebAdminLogin` validates the scanner's real `OPENID` and roles. The browser stores this as `webAdminSessionToken`.
- Protected Web Admin cloud-function calls send `webAdminSessionToken`; shared auth resolves it back to the confirmed `OPENID`, then applies the normal `users/{OPENID}.roles` permission checks.
- The effective binding is therefore `sessionToken -> confirmedOpenId`, created by the cloud function after real WeChat confirmation, not by trusting browser-provided identity data.

Deployment notes:

- deploy new cloud functions: `createWebAdminLogin`, `confirmWebAdminLogin`, and `pollWebAdminLogin`.
- redeploy Web Admin-facing cloud functions after `npm run copy:cloud-shared` so they can resolve `webAdminSessionToken`.
- run `bootstrapV2Collections` or manually create `web_admin_sessions` before Web Admin QR login smoke tests.
- redeploy `web-admin/` static hosting because the login page now displays the QR challenge.
- upload a new mini-program build because the `My` page now contains the scan-and-confirm action.

Verification:

- red tests first failed because Web Admin had no QR login view, the API client had no login/session methods, and the mini program had no confirm service or scan entry.
- target tests passed: `npm test -- tests/web-admin/api.test.js tests/web-admin/static.test.js tests/web-admin/app-login.test.js tests/miniprogram/pages/my-profile.test.js tests/miniprogram/pages/my-actions.test.js`.
- full regression passed with `npm test`: `79` suites and `607` tests.

## 2026-06-12 - Test Web Admin CloudBase Runtime And Hosting

Completed the test-environment runtime entry for the Version 2 web admin.

Delivered behavior:

- added `web-admin/config.test.js` for the test CloudBase environment `cloudbase-miniapp-test-dfc753877`.
- added `web-admin/src/cloudbase-runtime.js` to initialize the CloudBase Web SDK and expose the existing `cloudbaseApp.callFunction` adapter boundary.
- kept production environment IDs out of the test runtime entry.
- updated `web-admin/index.html` to load the CloudBase Web SDK, test config, runtime adapter, and web-admin modules in startup order.
- added version query strings to local static assets so CloudBase static hosting/CDN does not keep stale web-admin scripts after redeploys.
- updated web-admin startup to wait for `webAdminRuntimeReady` before calling `ensureUserProfile`.
- improved startup error rendering for structured CloudBase SDK errors.
- did not change any mini-program business flow.

Hosting:

- deployed `web-admin/` to CloudBase static website hosting under `/admin` in `cloudbase-miniapp-test-dfc753877`.
- hosted entry: `https://cloudbase-miniapp-test-dfc753877-1424891512.tcloudbaseapp.com/admin/`.
- CloudBase static hosting reported `11` uploaded files under `/admin`.
- HTTP check for `/admin/` returned `200` and confirmed the CloudBase SDK, test config, runtime, and app script tags.
- browser smoke reached the `Football Signup Admin` page after the CloudBase test-domain risk prompt.

Current blocker:

- CloudBase Web SDK loads, but web-admin cloud-function calls cannot complete yet because the test environment has no valid Web login credential.
- Browser console reported that `signInAnonymously()` requires the anonymous login method to be enabled in CloudBase identity settings.
- The visible identity panel then showed a structured SDK error: `{"error":"unauthenticated","error_description":"credentials not found",...}`.
- Next step: choose and enable the intended Web Admin login source in the test environment, then verify whether the existing `ensureUserProfile` mini-program `OPENID` identity contract needs a dedicated web-admin identity bridge.

SQL/self-hosted readiness:

- no runtime MySQL migration, CloudBase/MySQL dual-write, or self-hosted HTTP API switch was introduced.
- the browser runtime still talks through an API-shaped `callFunction` adapter so it can later be replaced by a self-hosted HTTP client without coupling web-admin views to CloudBase collections.

Verification:

- red tests first failed because `web-admin/src/cloudbase-runtime.js`, `web-admin/config.test.js`, runtime script ordering, runtime-ready startup waiting, and structured startup error rendering were missing.
- `npm test -- tests/web-admin` passed: `7` test suites, `29` tests.
- CloudBase static hosting commands passed:
  - `npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 hosting detail`
  - `npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 hosting deploy web-admin /admin`
  - `npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 hosting list /admin`

## 2026-06-10 - Explicit V2 Collection Bootstrap

Added an explicit Version 2 CloudBase collection bootstrap path for existing Version 1 environments.

Cloud function added:

- `bootstrapV2Collections`

Deployment tooling added:

- `scripts/deploy-v2-bootstrap.ps1`
- `npm run deploy:v2-bootstrap`

Delivered behavior:

- `bootstrapV2Collections` requires `confirm: "bootstrap-v2-collections"`.
- mini-program or web calls with an `OPENID` must come from a `super_admin`.
- CloudBase CLI maintenance invocation without `OPENID` is allowed only with the explicit confirmation payload.
- the function creates only missing V2 readiness collections: `activity_logs`, `user_role_logs`, `notification_logs`, and `notification_subscriptions`.
- the function returns API-shaped `created`, `existing`, and `skipped` arrays.
- the bootstrap does not delete, clear, or recreate existing V1 collections.

SQL readiness:

- no runtime MySQL migration, CloudBase/MySQL dual-write, or self-hosted HTTP API switch was introduced.
- the bootstrap result is API-shaped so it can later map to a self-hosted deployment or migration job.

Verification:

- red test first failed because `cloudfunctions/bootstrapV2Collections/index` did not exist.
- target test passed: `tests/cloudfunctions/bootstrapV2Collections.test.js` with `4` tests.
- PowerShell script parsing reached the CloudBase CLI dependency check; actual CloudBase deployment was not run locally because `tcb` is not installed on this workstation.

## 2026-06-10 - Final Version 2 Regression

Completed final Version 2 regression and documentation audit.

Verification:

- `npm test` passed.
- `npm test` also ran `pretest`, which executes `node scripts/copy-cloud-shared.mjs`.
- Jest result: `74` test suites passed, `571` tests passed.
- `web-admin/package.json` has no `test` or `build` script; it currently defines only `preview`.

SQL readiness audit:

- target MySQL 8.x tables cover users, roles, activities, teams, registrations, activity logs, role logs, notification subscriptions, and notification logs.
- CloudBase-to-SQL mapping covers Version 2 fields including `users.managerAlias`, manager alias metadata, registration attendance fields, activity log payloads, notification log fields, and list/export/log API contracts.
- expected V2 activity log actions are documented: `signup_joined`, `signup_cancelled`, `signup_rejoined`, `proxy_signup_created`, `registration_removed`, `registration_moved`, `attendance_update`, and `manager_alias_update`.
- compatibility rules cover manager-only field filtering, same-backend alias mutation, API-shaped web-admin calls, row-based exports, mini-program pagination, and derived overdue prompts.

Boundary confirmation:

- no runtime MySQL migration was implemented.
- no CloudBase/MySQL dual-write was implemented.
- no self-hosted HTTP API switch was implemented.

## 2026-06-10 - Mini-Program Pagination And Overdue Prompts

Implemented the Version 2 mini-program operational enhancements.

Delivered behavior:

- Home now requests activities with API-shaped `scope`, `limit`, and `skip` parameters.
- Home keeps the first page visible and appends additional pages through `onReachBottom` or the load-more button.
- My Created and Joined tabs now maintain independent `nextSkip`, `hasMore`, and loading-more state.
- My Created and Joined pagination preserves existing rows while fetching the next page.
- My Created marks activities as overdue unresolved when `endAt` is in the past, `status` is `published`, and `confirmStatus` is not `confirmed`.
- overdue unresolved prompts offer the existing confirm-held and cancel actions.
- confirm-held prompts call `notifyActivityParticipants(activityId, 'proceeding')`, which keeps the existing CloudBase function as the only writer for confirmation state and notifications.
- no automatic activity confirmation was added.

SQL readiness:

- no new persistent CloudBase fields, collections, log actions, MySQL writes, dual-write behavior, or self-hosted HTTP APIs were introduced.
- pagination uses stable API parameters (`limit`, `skip`) that can map directly to a future SQL-backed HTTP API.
- overdue unresolved prompts are derived from existing `activities.status`, `activities.confirmStatus`, and `activities.endAt` fields.
- confirmation continues through the existing notification API boundary instead of page-level direct writes.

Deployment note:

- upload a new mini-program build for Home/My pagination and My overdue prompts.
- keep the existing `listActivities` and `notifyActivityParticipants` cloud functions as the runtime API boundary.

Verification:

- red tests first failed because Home/My did not send `skip`, had no reach-bottom loaders, and did not mark overdue unresolved activities.
- target tests passed: `3` test suites, `17` tests.
- related regression passed: `4` test suites, `24` tests.

## 2026-06-10 - Web Admin Activity Operations, Export, And Logs

Implemented the Version 2 web-admin activity operations slice.

Cloud function added:

- `listNotificationLogs`

Delivered behavior:

- web-admin activity search calls `listActivities` with `scope: web-admin` and API-shaped keyword, status, organizer, date range, limit, and skip filters.
- organizers can review only activities they manage.
- admins and super admins can review all activities.
- ordinary users are rejected before web-admin activity data is returned.
- web-admin activity detail uses `getActivityDetail` to show teams, registrations, proxy signup markers, position preferences, notification subscription state, manager aliases, and attendance state.
- web-admin manager alias edits call `updateParticipantManagerAlias`.
- web-admin attendance edits call `setRegistrationAttendance`.
- web-admin attendance statistics call `getAttendanceStats` with date-range parameters.
- web-admin roster export calls `exportActivityRoster` and generates CSV text in the browser; the backend still returns CSV/XLSX-ready rows only.
- activity operation history review calls `listActivityLogs`.
- notification-log review calls `listNotificationLogs`, with admin/global and organizer/own-activity permission boundaries.
- organizer accounts can access the web-admin workspace for activity operations; user role management remains hidden from non-admin organizers and remains backend-protected.

SQL readiness:

- no runtime MySQL migration, CloudBase/MySQL dual-write, or self-hosted HTTP API switch was introduced.
- new web-admin contracts stay API-shaped and are not coupled to page-specific UI structures.
- `listNotificationLogs` returns stable scalar fields that map to the existing `notification_logs` SQL target table.
- current registration and activity state remain separate from `activity_logs` and `notification_logs` history.

Deployment note:

- deploy changed function: `listActivities`.
- deploy new function: `listNotificationLogs`.
- keep using existing deployed functions: `getActivityDetail`, `setRegistrationAttendance`, `updateParticipantManagerAlias`, `getAttendanceStats`, `exportActivityRoster`, and `listActivityLogs`.
- run `copy-cloud-shared` before CloudBase deployment.
- host the updated `web-admin/` static files after configuring the CloudBase call-function adapter.

Verification:

- red tests first failed because web-admin activity helpers, static activity views, API delegates, `listActivities` web-admin filtering, and `listNotificationLogs` were missing.
- target tests passed: `6` test suites, `25` tests.
- related backend regression passed: `8` test suites, `119` tests.

## 2026-06-10 - Web Admin Foundation And Role Management

Implemented the initial Version 2 web-admin foundation.

Subproject added:

- `web-admin/`

Delivered behavior:

- the web admin is a no-build static frontend that can be hosted as static files.
- identity loading calls `ensureUserProfile`.
- ordinary `user` accounts are denied before the workspace renders.
- admin and super-admin accounts can access the workspace.
- user search calls `listUsers` with keyword, role, limit, and skip parameters.
- role changes call `updateUserRoles`.
- super admins can manage `admin` and `organizer` roles from the UI model.
- admins can manage only `organizer`; `admin` toggles are disabled for them.
- role boundary checks are mirrored in frontend view-model code but remain enforced by cloud functions.

SQL readiness:

- no new persistent CloudBase fields were added.
- the web-admin API adapter keeps cloud-function payloads API-shaped so the same contracts can later be served by self-hosted HTTP endpoints backed by MySQL.
- role history remains in `user_role_logs`; the web admin does not write role history directly.

Deployment note:

- host `web-admin/` as static files after configuring a CloudBase-compatible `callFunction` runtime.
- keep using the existing `ensureUserProfile`, `listUsers`, and `updateUserRoles` cloud functions.

Verification:

- red tests first failed because `web-admin/` and its API, role, and user-management modules did not exist.
- target and related backend regression passed: `6` test suites, `22` tests.

## 2026-06-10 - Activity Copy Draft Flow

Implemented the Version 2 activity duplication flow.

Cloud function added:

- `getActivityCopyDraft`

Delivered behavior:

- organizers can copy activities they manage.
- admins and super admins can copy any activity.
- regular users and out-of-scope organizers are rejected.
- deleted activities cannot be copied.
- the backend returns an API-shaped copy draft and does not create or update any activity records.
- copy drafts include reusable setup fields: title, description, venue, location, cover/detail images, team names, team colors, team capacities, signup limit, registration notice threshold, activity notice prompt, and insurance link.
- copy drafts exclude source IDs, registrations, attendance state, participant operation logs, notification logs, notification subscription state, confirmation metadata, cancellation state, and dormant invite-code state.
- mini-program Activity Detail shows the copy action only to activity managers.
- mini-program Activity Create loads copy drafts through `getActivityCopyDraft` and requires the manager to choose the new activity time before publishing.

SQL readiness:

- no new persistent CloudBase fields were added.
- `getActivityCopyDraft` is a read API contract and can map cleanly to a future HTTP API backed by SQL.
- copied drafts use `status: draft`, `confirmStatus: pending`, and `requiresTimeReview: true` as API state, but V2 still does not introduce runtime MySQL writes or dual-write behavior.

Deployment note:

- deploy `getActivityCopyDraft`.
- run `copy-cloud-shared` before CloudBase deployment.
- upload a new mini-program build for the Activity Detail copy action and Activity Create copy mode.

Verification:

- red tests first failed because `getActivityCopyDraft`, mini-program service delegation, copy draft form mapping, Activity Detail copy navigation, and Activity Create copy mode did not exist.
- target regression passed: `6` test suites, `193` tests.

## 2026-06-10 - Mini-Program Manager Alias Editing

Implemented the mini-program manager alias editing surface for Activity Detail.

Delivered behavior:

- `getActivityDetail` includes `managerAlias` only in manager-visible roster member payloads for real WeChat signup users.
- regular users continue to receive no manager-only alias field.
- proxy signup rows do not expose or edit shared manager aliases because V2 has no proxy participant identity model.
- Activity Detail team lists render manager aliases and alias edit controls only from manager-visible view-model fields.
- alias edits call the shared `updateParticipantManagerAlias` backend API instead of writing `users.managerAlias` from the client.
- successful edits show a toast and reload Activity Detail.

SQL readiness:

- no new storage fields were added in this milestone.
- the existing `users.managerAlias` mapping and compatibility rule for routing both mini-program and web-admin edits through the same backend permission checks remain authoritative.

Deployment note:

- redeploy `getActivityDetail` because manager roster payloads now include `managerAlias`.
- keep `updateParticipantManagerAlias` deployed from the backend milestone.
- upload a new mini-program build for the Activity Detail alias controls.

Verification:

- red tests first failed because the mini-program service, Activity Detail binding/handler, team-list view model/event, and manager-visible detail payload were missing.
- target regression passed: `5` test suites, `99` tests.

## 2026-06-10 - Participant Operation Logs

Implemented the Version 2 participant operation history backend.

Cloud function added:

- `listActivityLogs`

Delivered behavior:

- participant operation audit writes now cover `signup_joined`, `signup_rejoined`, `signup_cancelled`, `proxy_signup_created`, `registration_removed`, `registration_moved`, `attendance_update`, and `manager_alias_update`.
- operation logs keep current registration state separate from historical trace data.
- `listActivityLogs` lets admins and super admins review logs across activities.
- organizers can review only logs for activities they manage.
- ordinary users are rejected.
- log rows expose API-shaped fields and keep before/after data under structured objects for later SQL JSON payload migration.

SQL readiness:

- updated the SQL migration readiness mapping for `activity_logs.targetOpenId`, `operatorOpenId`, before/after data, and operation-specific payload fields.

Deployment note:

- deploy changed functions: `joinActivity`, `cancelRegistration`, `addProxyRegistration`, `removeRegistration`, `moveRegistration`.
- deploy new function: `listActivityLogs`.
- run `copy-cloud-shared` before CloudBase deployment.

Verification:

- red operation-log tests first failed because existing operations did not write `activity_logs`.
- red `listActivityLogs` test first failed because `cloudfunctions/listActivityLogs/index` did not exist.
- target and affected regression tests passed: `activityOperationLogs`, `joinActivity`, `cancelRegistration`, `addProxyRegistration`, `removeRegistration`, `moveRegistration`, `listActivityLogs`, and `package-json`, with `112` tests.

## 2026-06-10 - Participant Manager Alias Backend

Implemented the Version 2 manager-facing participant alias mutation API.

Cloud function added:

- `updateParticipantManagerAlias`

Delivered behavior:

- organizers can update manager aliases only for real WeChat signup users in activities they manage.
- admins and super admins can update manager aliases for real WeChat signup users in any activity.
- ordinary users are rejected.
- proxy signups are rejected because Version 2 does not create a cross-activity identity model for proxy participants.
- aliases are trimmed, can be cleared with an empty string, and are capped at `128` characters to match the future SQL target column size.
- updates write `users.managerAlias`, `users.managerAliasUpdatedAt`, and `users.managerAliasUpdatedBy`.
- updates write `activity_logs` rows with action `manager_alias_update`, operator, target user, activity, registration, before value, after value, and timestamp.

Deployment note:

- deploy `updateParticipantManagerAlias`.
- run `copy-cloud-shared` before CloudBase deployment.

Verification:

- red test first failed because `cloudfunctions/updateParticipantManagerAlias/index` did not exist.
- target test passed: `tests/cloudfunctions/updateParticipantManagerAlias.test.js` with `8` tests.

## 2026-06-10 - Participant Manager Alias Editing Surface Clarified

Updated the Version 2 participant identification requirements.

Requirement decision:

- management-facing participant aliases can be edited from both the mini-program manager roster surface and the web admin.
- both clients must call the same backend API and permission checks; neither client should write `users.managerAlias` directly.
- ordinary users still cannot see or edit management aliases.
- proxy signup cross-activity aliasing remains deferred until a later participant-profile model exists.

## 2026-06-10 - Roster Export Backend

Implemented the Version 2 roster export data API.

Cloud function added:

- `exportActivityRoster`

Delivered behavior:

- organizers can export roster rows for activities they created.
- admins and super admins can export roster rows for any activity.
- regular users cannot export roster rows.
- the cloud function returns CSV/XLSX-ready JSON rows only; file generation remains a frontend/web-admin responsibility.
- export rows include activity title, team name, registration ID, user openid, signup name, manager alias, preferred positions, proxy signup flag, and attendance status.
- cancelled registrations are excluded.
- blank attendance status is normalized to `present` for export.

Deployment note:

- deploy `exportActivityRoster`.
- run `copy-cloud-shared` before CloudBase deployment.

Verification:

- red test first failed because `cloudfunctions/exportActivityRoster/index` did not exist.
- target test passed: `tests/cloudfunctions/exportActivityRoster.test.js` with `5` tests.

## 2026-06-10 - SQL Migration Readiness Added To Version 2 Scope

Version 2 requirements now include SQL migration readiness for a later self-hosted backend.

Requirement decisions:

- Version 2 still keeps CloudBase document database as the live runtime store.
- Version 2 should prepare a MySQL 8.x target schema, CloudBase-to-SQL field mapping, backward-compatible schema rules, and migration validation checklist.
- New Version 2 data fields should stay SQL-friendly where practical: explicit IDs, stable enum values, clear timestamps, and limited nested data.
- Current state and history remain separate so future SQL tables can preserve the same model: `registrations` for current signup state, and audit logs for participant and role history.
- Runtime migration, MySQL dual-write, self-hosted auth/storage/notification rewrites, and HTTP API replacement remain deferred.

Updated docs:

- `docs/superpowers/specs/2026-06-10-sql-migration-readiness.md`
- `docs/superpowers/plans/2026-05-18-version-2-lightweight-web-admin.md`
- `docs/superpowers/plans/2026-05-19-version-2-execution-plan.md`
- `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`

## 2026-06-09 - Activity Duplication Added To Version 2 Scope

Version 2 requirements now include copying an existing activity to create a new activity draft.

Requirement decisions:

- organizers often create recurring activities with similar setup, so the copy action should reuse previous activity settings.
- activity creators can copy their own activities; admins and super admins can copy any activity.
- the copied draft can reuse title, description, venue, location, images, team names, team colors, team capacities, signup limits, and notification settings.
- registrations, attendance state, participant operation logs, notification logs, and subscription state must not be copied.
- the copied activity is a new activity, and the manager must review or update the activity time before saving.

Updated docs:

- `docs/superpowers/plans/2026-05-18-version-2-lightweight-web-admin.md`
- `docs/superpowers/plans/2026-05-19-version-2-execution-plan.md`
- `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`

## 2026-06-09 - Participant Identification And Operation Audit Added To Version 2

Version 2 requirements now include shared participant manager aliases and participant operation audit history.

Requirement decisions:

- organizers/admins need a stable management-facing alias for real WeChat signup users because participants can change nickname and avatar between activities.
- the alias is shared by organizers, admins, and super admins, and is hidden from ordinary users.
- the alias follows the real WeChat user across activities.
- proxy signup cross-activity identification remains deferred until a later participant-profile model exists.
- current registration state and historical participant operations must stay separate.
- participant self signup, self cancellation, re-signup, proxy signup, manager removal, team movement, attendance change, and manager alias changes should leave audit history.

Updated docs:

- `docs/superpowers/plans/2026-05-18-version-2-lightweight-web-admin.md`
- `docs/superpowers/plans/2026-05-19-version-2-execution-plan.md`
- `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`

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
- runtime MySQL migration.
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

## 2026-05-19 - Mini-Program Attendance Editing

Implemented the Version 2 mini-program quick attendance editing surface.

Delivered behavior:

- `getActivityDetail` returns `registrationId` on roster members only to viewers who can manage registrations.
- mini-program activity service can call `setRegistrationAttendance`.
- confirmed activity managers see each roster member's attendance state in Activity Detail.
- confirmed activity managers can toggle a member between `present` and `absent` from the team list.
- attendance controls stay hidden before activity confirmation and for regular users.
- attendance updates show a success toast and refresh Activity Detail after the cloud function returns.

Deployment note:

- redeploy `getActivityDetail` because the manager roster payload now includes `registrationId`.
- keep `setRegistrationAttendance` deployed from the attendance backend task.
- upload a new mini-program build for the Activity Detail attendance controls.

Verification:

- red/green tests added for service delegation, manager-only view-model state, team-list event wiring, Activity Detail handler behavior, and manager-only registration IDs.
- target regression passed: `5` test suites, `92` tests.

## 2026-05-19 - Attendance Statistics API

Implemented the Version 2 attendance statistics backend.

New cloud function:

- `getAttendanceStats`

Delivered behavior:

- admins and super admins can query attendance statistics across all confirmed activities in a date range.
- organizers can query attendance statistics only for activities they created.
- regular users cannot query attendance statistics.
- only `confirmStatus: confirmed` activities count.
- cancelled, deleted, pending, out-of-range, and invalid-start-time activities are excluded.
- only active joined registrations count.
- blank attendance status counts as `present`.
- proxy signups are included by their signup display name.
- rows include `participantName`, `signupCount`, `presentCount`, `absentCount`, and `attendanceRate`.

Deployment note:

- deploy `getAttendanceStats` after running `copy-cloud-shared`.
- the first web-admin attendance statistics view should call this function with `startAt` and `endAt`.

Verification:

- red/green tests added for admin global visibility, organizer scope, blank attendance defaults, excluded activity states, proxy signups, and regular-user rejection.
- target regression passed: `1` test suite, `6` tests.

## 2026-05-19 - Environment And Deployment Strategy Decision

Recorded the Version 2 environment strategy after reviewing CloudBase environment isolation costs and the current Version 1 review status.

Decision:

- keep using the existing single CloudBase environment for now.
- do not create a second paid CloudBase environment immediately.
- while a Version 1 mini-program build is under review, avoid deploying changed existing cloud functions that the review build calls.
- new cloud functions that no released or under-review frontend calls are lower risk, but can still wait until the review window closes if they are not needed immediately.
- when testing Version 2 against the same CloudBase environment, prefer function-name isolation for changed existing functions, for example `getActivityDetailV2`, so the formal build can continue calling `getActivityDetail`.
- keep test data separated by test users and test activities when sharing one database.
- do not rely on one CloudBase environment for strong isolation between formal, trial, and development builds.

Deployment guidance:

- uploading a mini-program trial build uploads frontend code only; it does not deploy cloud functions.
- formal, trial, and development builds call the cloud environment configured by `CLOUD_ENV_ID`.
- if formal and trial builds use the same `CLOUD_ENV_ID`, they share the same cloud functions, database, storage, and subscription configuration.
- cloud functions must be deployed separately to the target CloudBase environment.
- if a paid second environment is created later, deploy cloud functions and seed required data separately in both environments.

Longer-term note:

- self-hosted backend services would make standard `dev` / `test` / `prod` isolation, database separation, rollout, and rollback easier.
- do not migrate away from CloudBase only to avoid the second-environment fee; migration would require replacing cloud-function calls, database access, openid-based auth wiring, storage handling, subscription-message sending, request-domain configuration, and operational hosting.
- reconsider a self-hosted backend when the web admin, statistics, permission workflows, or release-management needs become complex enough to justify the migration cost.
