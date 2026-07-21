# Version 2 Development Log

This file is the development log for Version 2 work on the `codex/version-2-web-admin` branch.

Use this file for Version 2 implementation entries instead of appending Version 2 work to `docs/development-log.md`.

## 2026-07-21 - Bench Queue Excluded From Manual Team Moves

Restricted generic manager team moves to regular teams so the bench remains a system-managed queue.

Delivered behavior:

- the mini-program move target sheet excludes active bench teams.
- bench members no longer show the generic manager move action.
- `moveRegistration` rejects regular-to-bench and bench-to-regular moves with a stable business error.
- regular-to-regular manager moves remain supported.
- teams without a historical `teamType` remain compatible and are treated as regular teams.
- the local CloudBase mock and Chinese error translation match the cloud function.

Verification:

- red tests first showed the bench target in the action sheet, exposed the move action on bench members, and allowed both manual move directions through backend calls.
- targeted regression passed: `npm test -- tests/cloudfunctions/moveRegistration.test.js tests/miniprogram/pages/activity-detail.test.js tests/miniprogram/utils/view-models.test.js tests/miniprogram/utils/i18n.test.js tests/miniprogram/mocks/local-cloud.test.js --runInBand` (`5` suites, `136` tests).
- full regression passed: `npm test -- --runInBand` (`82` suites, `741` tests).

Deployment scope:

- upload a new mini-program build for the move-action and target-list changes.
- redeploy `moveRegistration` for backend enforcement.
- no Web Admin redeployment, collection migration, MySQL migration, dual-write, or HTTP API cutover is required.

## 2026-07-21 - Bench Promotion After Manager Removal

Fixed manager removal so it follows the same bench-queue vacancy rule as participant cancellation.

Delivered behavior:

- removing a joined regular-team registration through `removeRegistration` now promotes the earliest joined active bench registration.
- proxy registrations and real-user registrations use the same vacancy rule.
- promotion order remains `joinedAt` ascending, then registration id ascending.
- the activity joined count decreases once, the vacated regular-team count stays unchanged, and the bench-team count decreases once.
- the removed registration remains cancelled with removal audit fields; promotion writes `activity_logs.action = registration_auto_promoted`.
- the response adds `promotedRegistrationId`, `promotedTeamId`, and `promotedFromTeamId` without breaking old callers.
- the local CloudBase mock now matches the deployed cloud-function behavior.

Verification:

- red tests reproduced both the cloud-function and local-mock gaps before implementation.
- targeted regression passed: `npm test -- tests/cloudfunctions/removeRegistration.test.js tests/cloudfunctions/cancelRegistration.test.js tests/cloudfunctions/activityOperationLogs.test.js tests/miniprogram/mocks/local-cloud.test.js tests/miniprogram/pages/activity-detail.test.js tests/miniprogram/pages/activity-detail-actions.test.js --runInBand` (`6` suites, `114` tests).
- full regression passed: `npm test -- --runInBand` (`82` suites, `735` tests).

Deployment scope:

- redeploy `removeRegistration` to enable this behavior in a CloudBase environment.
- no mini-program upload, Web Admin redeployment, collection migration, MySQL migration, dual-write, or HTTP API cutover is required.

## 2026-07-21 - Explicit Bench Capacity Mini-Program Form

Completed the mini-program UI and API-contract follow-up for explicit bench capacity.

Delivered behavior:

- activity create, edit, and copy forms now edit `benchCapacity` instead of editing `signupLimitTotal` directly.
- the form displays a read-only total computed from active regular-team capacity plus bench capacity.
- team or bench-capacity changes recompute the total and update the default registration notice threshold.
- historical activities recover bench capacity from the active bench team, with a legacy total-minus-regular fallback.
- `getActivityCopyDraft` now returns API-only `benchCapacity` from the active bench team.
- the local CloudBase mock follows the same explicit-field contract while retaining the total-only fallback for Version 1 callers.
- invalid negative or fractional bench capacity remains visible until validation and is rejected instead of being silently normalized.

Verification:

- red tests first failed for the missing form field, editable legacy total, missing copy-draft field, and stale local-mock total handling.
- targeted regression passed: `npm test -- tests/miniprogram/utils/activity-draft.test.js tests/miniprogram/utils/validators.test.js tests/miniprogram/pages/activity-create-submit.test.js tests/cloudfunctions/getActivityCopyDraft.test.js tests/miniprogram/mocks/local-cloud.test.js --runInBand` (`5` suites, `106` tests).
- full regression passed: `npm test -- --runInBand` (`82` suites, `733` tests).

Deployment scope:

- upload a new mini-program build for the create/edit/copy form changes.
- redeploy `getActivityCopyDraft` for copied activities to receive explicit bench capacity.
- no Web Admin redeployment or database migration is required.

## 2026-07-20 - Post-V2 Change Request Regression Closure

Completed the implementation pass for the four confirmed post-V2 change-request areas.

Closed scope:

- late cancellation notices to the activity creator.
- final-outcome participant cancellation statistics and cancellation rates.
- roster export activity type rows and Web Admin CSV column.
- explicit bench capacity, stale bench signup reassignment, and automatic bench promotion after regular cancellations.

Regression:

- full regression passed: `npm test -- --runInBand` (`82` suites, `721` tests).
- `git diff --check` passed with line-ending warnings only.

Runtime boundary:

- no runtime MySQL migration was added.
- no CloudBase/MySQL dual-write was added.
- no self-hosted HTTP API switch was added.

## 2026-07-20 - Bench Auto Promotion After Cancellation

Implemented the fifth post-V2 change-request milestone.

Delivered behavior:

- `cancelRegistration` now promotes the earliest joined active bench registration when a regular-team participant cancels.
- promotion order is `joinedAt` ascending, then registration id ascending.
- the promoted participant keeps the same registration id and `joinedAt`; only `teamId` and `updatedAt` change.
- the cancelled participant still records `status: cancelled`, `cancelledAt`, `cancelCount`, and `updatedAt`.
- activity `joinedCount` decreases by one because the promoted bench participant was already counted.
- regular-team `joinedCount` stays unchanged when promotion fills the slot; bench-team `joinedCount` decreases by one.
- promotion writes an `activity_logs` row with `action: registration_auto_promoted`.
- cancellation responses include additive promotion fields when a promotion occurs.

Verification:

- red test first failed because the earliest bench registration stayed on the bench team.
- targeted test passed: `npm test -- tests/cloudfunctions/cancelRegistration.test.js --runInBand` (`1` suite, `10` tests).

## 2026-07-20 - Bench Capacity and Stale Bench Signup Enforcement

Implemented the fourth post-V2 change-request milestone.

Delivered behavior:

- `createActivity` and `updateActivity` now accept explicit API `benchCapacity`.
- when `benchCapacity` is present, stored `signupLimitTotal` is computed as regular-team capacity plus bench capacity.
- the generated or updated bench team uses the explicit bench capacity.
- old clients remain compatible because missing `benchCapacity` keeps the previous total-capacity based behavior.
- `joinActivity` now handles stale bench signup requests inside the backend transaction.
- if a user submits a bench `teamId` while a regular slot is available, the backend assigns the user to the first active regular team by `sort` and returns additive assignment metadata.

Verification:

- red tests first failed because create/update persisted the provided `signupLimitTotal` and `joinActivity` kept the stale bench team.
- targeted tests passed: `npm test -- tests/cloudfunctions/createActivity.test.js tests/cloudfunctions/updateActivity.test.js tests/cloudfunctions/joinActivity.test.js --runInBand` (`3` suites, `33` tests).

## 2026-07-20 - Late Cancellation Organizer Notice

Implemented the third post-V2 change-request milestone.

Delivered behavior:

- `cancelRegistration` now checks `lateCancellationNoticeWindowHours` after a successful cancellation.
- missing `lateCancellationNoticeWindowHours` defaults to `6` hours before `startAt`.
- `0` disables the late cancellation notice for an activity.
- the notification is sent only to the activity creator (`activities.organizerOpenId`), not all managers.
- notification sending happens after the cancellation transaction and is best-effort; notification failure does not roll back cancellation.
- notification attempts write `notification_logs` with `notificationType: registration_cancelled` and `templateKey: manager_registration_notice`.
- accepted organizer subscriptions are consumed after send attempts so the organizer can re-subscribe later.

Verification:

- red tests first failed because `cancelRegistration` did not call the organizer notice and the helper was not exported.
- targeted test passed: `npm test -- tests/cloudfunctions/cancelRegistration.test.js --runInBand` (`1` suite, `9` tests).

## 2026-07-20 - Participant Cancellation Statistics

Implemented the second post-V2 change-request milestone.

Delivered behavior:

- `getAttendanceStats` now returns `effectiveSignupActivityCount`, `cancelledActivityCount`, and `cancelRate`.
- cancellation statistics use the confirmed final-outcome-per-participant-per-activity rule.
- cancellation-only participants appear in statistics with zero attendance counts.
- future non-cancelled activities can contribute to cancellation-rate denominator for rows that have attendance or cancellation data, while future-only joined rows remain hidden from the attendance view.
- Web Admin statistics rows show cancellation count and cancellation rate.
- Web Admin statistics CSV exports `取消次数` and `取消率`.
- Web Admin static asset query strings were bumped to `20260720-cancel-stats`.

Verification:

- red tests first failed for missing cancellation fields, missing table/CSV columns, and missing static table headers.
- targeted tests passed: `npm test -- tests/cloudfunctions/getAttendanceStats.test.js tests/web-admin/activity-management.test.js tests/web-admin/app-layout.test.js tests/web-admin/static.test.js --runInBand` (`4` suites, `78` tests).

## 2026-07-20 - Roster Export Activity Type

Implemented the first post-V2 change-request milestone.

Delivered behavior:

- `exportActivityRoster` rows now include stable `activityType` plus `activityTypeLabel`.
- historical activities without `activityType` export as `internal` / `内战`.
- Web Admin roster rows carry the activity type from activity detail.
- Web Admin roster CSV adds the `活动类型` column and displays `内战` / `外战`.
- backend still returns rows only; CSV generation remains in the browser.

Verification:

- red tests first failed for missing roster activity type fields and CSV column.
- targeted tests passed: `npm test -- tests/cloudfunctions/exportActivityRoster.test.js tests/web-admin/activity-management.test.js tests/web-admin/app-layout.test.js --runInBand` (`3` suites, `55` tests).

## 2026-07-20 - Post-V2 Cancellation, Statistics, Roster, and Bench Design

Documented the next post-Version 2 change request before implementation.

Delivered documentation:

- added `docs/superpowers/specs/2026-07-20-v2-cancellation-stats-roster-bench-design.md`.
- recorded configurable late cancellation notices to the activity creator, with a default `6` hour window and `0` as disabled.
- defined participant cancellation statistics as one final outcome per participant per activity.
- added the roster export `activityType` row contract and Web Admin CSV `活动类型` column expectation.
- defined bench capacity as explicit manager input and total capacity as regular-team capacity plus bench capacity.
- defined stale bench signup auto-assignment to a regular slot and automatic bench promotion after regular self-cancellation.
- updated SQL migration readiness for `activity_type`, `late_cancellation_notice_window_hours`, `registration_cancelled`, `registration_auto_promoted`, compatibility rules, and migration validation checks.

Runtime scope:

- no business code changed.
- no runtime MySQL migration, CloudBase/MySQL dual-write, or self-hosted HTTP API switch.

Recommended implementation order:

1. add `activityType` to `exportActivityRoster` rows and Web Admin CSV.
2. add cancellation counts/rates to `getAttendanceStats`.
3. add late cancellation notice from `cancelRegistration`.
4. add computed total capacity and backend bench signup enforcement.
5. add bench auto-promotion inside `cancelRegistration`.

Verification:

- `git diff --check` passed.

## 2026-06-28 - Version 2 Acceptance Closure

Formally closed Version 2 for acceptance.

Closure statement:

- the committed Version 2 scope and all Version 2 success criteria are complete and pass full regression (`82` suites, `709` tests).
- invite-code signup, gesture-based (drag/zoom) cover crop, and XLSX roster export are confirmed deferred beyond Version 2.
- these three items were optional/conditional in the plan, are not part of the Version 2 success criteria, and are not required for Version 2 acceptance.

## 2026-06-28 - Post-V2 UI Modernization Pass

Ran a styling-only modernization pass across the mini-program and the Web Admin after the Version 2 functional scope was already complete. No cloud functions or business logic were changed in this pass except the proxy attendance fix logged separately below.

Delivered behavior (mini-program, style only):

- My page, Home, Activity Detail (immersive hero + grid action panel), Activity Create (section cards), Join page, participant/proxy/team bottom sheets, notification settings card, and cover-crop controls were restyled to the shared visual language.
- Replaced glyph icons with inline vector (base64 SVG) icons and added PNG `tabBar` icons for 首页 / 我的, plus 内战 / 外战 activity-type icons.
- `内战` / `外战` is presented as a segmented control for managers; ordinary participants still do not see activity type.
- Kept the activity cover at a 5:4 ratio and the My-page delete button right-aligned per product direction.
- Unified the Home and My "加载更多" buttons into a single pill style.

Delivered behavior (Web Admin, style only):

- Login screen, sidebar navigation (active pill, no left bar), data tables, and the activity-detail modal were modernized to match the agreed mockups.
- Roles, statuses, activity type, and attendance rate now render as coloured pills; the role toggle saves instantly.
- Attendance is edited through a segmented present/absent control; the inline text editor uses an icon-only edit button; modals use a round icon close button; the alias edit dialog is compact.
- The activity context menu no longer offers 确认举行 and was restyled.
- Fixed toolbar/date input icons (search icon only on `input[type="search"]`, no redundant calendar glyph on `input[type="date"]`).
- Static asset cache-busting query strings end this pass at `20260628-context-menu`; `tests/web-admin/static.test.js` is kept in sync with that value.

Deferred (still not implemented after this pass):

- invite-code signup (planned only after the operational core is stable).
- gesture-based (drag/zoom) cover crop; the crop page remains slider-based.
- web-admin roster export remains CSV-only in the browser; XLSX output is not implemented.

Verification:

- full regression passed: `npm test -- --runInBand` (`82` suites, `709` tests).

## 2026-06-28 - Proxy Member Attendance Fix

Fixed a mini-program bug where opening the settings sheet for a 代报名 (proxy) member did not expose the present/absent controls, even though the backend already supports proxy attendance.

Delivered behavior:

- removed the manager-alias-editability precondition from the attendance action gating in `miniprogram/pages/activity-detail/index.js`; the attendance toggle now shows whenever the detail exposes `registrationId` and an attendance action status, independent of whether the alias is editable.
- `miniprogram/utils/formatters.js` keeps `attendanceActionVisible` driven only by `canManageAttendance` and `registrationId`, so proxy registrations are no longer excluded.
- no cloud function change was required; `setRegistrationAttendance` already accepts proxy registration IDs.

Verification:

- updated the activity-detail attendance test to use a realistic regular-user case and added a proxy-member attendance case.
- full regression passed: `npm test -- --runInBand` (`82` suites, `709` tests).

## 2026-06-27 - Final V2 Product Rule Confirmation

Confirmed the remaining Version 2 product rules after implementation review.

Confirmed rules:

- Proxy attendance statistics use the proxy signup name as the Version 2 unique identity. The same proxy name across activities is counted as the same proxy participant.
- Attendance statistics include only activities whose start time has passed and whose activity state is neither cancelled nor deleted. `confirmStatus` is not an inclusion condition.
- Copy Activity preserves the source start/end/signup-deadline time-of-day, but not the source calendar date. Managers must choose the new date before publishing.
- Ordinary participants do not see `内战` / `外战`. Activity type remains available to organizers/admins in create/edit flows and in Web Admin attendance statistics.

## 2026-06-27 - Copy Activity Time-Of-Day Preservation

Adjusted the copy-activity flow so recurring activities keep their usual time slots without copying the old calendar date.

Delivered behavior:

- `getActivityCopyDraft` still leaves `startAt`, `endAt`, and `signupDeadlineAt` empty so a copied draft cannot be published with the source date by accident.
- copy drafts now include API-only `sourceStartAt`, `sourceEndAt`, and `sourceSignupDeadlineAt` values.
- the mini-program copy form extracts only the local `HH:mm` time from those source fields.
- Activity date and signup deadline date stay blank until the manager reviews/selects the new date.

Verification:

- red tests first failed because the backend did not return source time fields and the copy form still cleared all time fields.
- target tests passed: `npm test -- tests/cloudfunctions/getActivityCopyDraft.test.js tests/miniprogram/utils/activity-draft.test.js tests/miniprogram/pages/activity-create-submit.test.js --runInBand`.

## 2026-06-27 - Started-Activity Attendance Statistics

Aligned Version 2 attendance statistics with the final inclusion rule.

Delivered behavior:

- attendance statistics include activities only when the activity start time has passed and the activity is not cancelled or deleted.
- `confirmStatus` no longer decides whether an activity is included in attendance statistics.
- proxy registrations remain grouped by proxy signup name for attendance statistics.
- the mini-program My page remains free of overdue unresolved activity prompts.
- Web Admin static assets now use `20260627-started-stats` cache-busting query strings.

Documentation:

- updated Version 2 progress, activity type/review field spec, SQL migration readiness notes, and Web Admin deployment notes.
- recorded that the mini-program does not show `internal` / `external` activity labels to ordinary participants.
- recorded that future Web Admin uploads should bump static asset query versions before CloudBase hosting deployment.

Verification:

- red attendance test first failed because a future confirmed activity was still included.
- targeted tests passed: `npm test -- tests/cloudfunctions/getAttendanceStats.test.js --runInBand`.
- targeted Web Admin tests passed: `npm test -- tests/web-admin/static.test.js tests/web-admin/app-layout.test.js --runInBand`.
- targeted mini-program My page tests passed: `npm test -- tests/miniprogram/pages/my-actions.test.js tests/miniprogram/pages/my-profile.test.js --runInBand`.
- full regression passed: `npm test -- --runInBand` (`82` suites, `700` tests).

## 2026-06-27 - Proxy Attendance Statistics Identity

Clarified and implemented the attendance statistics identity rule for proxy signups.

Delivered behavior:

- proxy registrations are grouped by their proxy signup name in attendance statistics, even when each proxy registration has a different generated proxy `userOpenId`.
- real user registrations are grouped by real `userOpenId`, so two different users who happen to use the same signup name do not get merged.
- the visible statistics payload shape is unchanged: rows still expose `participantName`, `managerAlias`, counts, rate, and per-activity details.

Verification:

- red test first failed because two real users with the same signup name were merged into one statistics row.
- target attendance statistics test passed: `npm test -- tests/cloudfunctions/getAttendanceStats.test.js`.

## 2026-06-17 - Web Admin Default Chinese UI

Changed the Web Admin default visible interface to Chinese while preserving the existing API contracts and CloudBase function behavior.

Delivered behavior:

- default document language is now `zh-CN`.
- hosted page title, login instructions, forbidden message, sidebar navigation, forms, table headers, action buttons, and runtime login statuses now render in Chinese.
- role labels, activity status labels, attendance status labels, proxy markers, and roster operation buttons render in Chinese.
- machine-facing values remain stable: role enums, activity status enums, attendance status enums, cloud-function names, `data-*` hooks, and API payloads were not renamed.
- static assets now use `20260617-zh-cn` cache-busting query strings.

Deployment:

- redeployed `web-admin/` to CloudBase static hosting under `/admin` in `cloudbase-miniapp-test-dfc753877`.
- CloudBase CLI uploaded `12` files successfully.
- hosted check for `https://cloudbase-miniapp-test-dfc753877-1424891512.tcloudbaseapp.com/admin/?verify=20260617-zh-cn-utf8` returned the `20260617-zh-cn` asset version and Chinese page title through UTF-8 content verification.

Verification:

- red tests first failed because the Web Admin still rendered English copy and the old asset version.
- target Chinese UI tests passed: `npm test -- tests/web-admin/static.test.js tests/web-admin/app-login.test.js tests/web-admin/app-layout.test.js --runInBand`.
- Web Admin regression passed: `npm test -- tests/web-admin --runInBand`.

## 2026-06-17 - Web Admin Common Layout Refactor

Refactored the hosted Web Admin from a single scrolling workspace into a common admin layout with role-aware sidebar navigation and independent content views.

Delivered behavior:

- Web Admin now renders a left sidebar and right content area after QR login succeeds.
- QR login, identity checking, and forbidden access views remain outside the workspace; the login view is hidden after a confirmed `webAdminSessionToken` loads the workspace.
- sidebar navigation is derived from the confirmed user's roles.
- admins and super admins can see user management, activity management, attendance stats, roster export, and logs.
- organizers can see activity management, attendance stats, roster export, and logs, but not user management.
- ordinary users remain blocked by the existing forbidden view.
- user management, activity management, attendance stats, roster export, and logs are now independent `data-admin-view` regions.
- existing API calls and CloudBase cloud-function contracts were preserved; no cloud-function business logic was changed.
- static assets now use `20260617-admin-layout` cache-busting query strings.

Deployment:

- redeployed `web-admin/` to CloudBase static hosting under `/admin` in `cloudbase-miniapp-test-dfc753877`.
- CloudBase CLI uploaded `12` files successfully.
- hosted check for `https://cloudbase-miniapp-test-dfc753877-1424891512.tcloudbaseapp.com/admin/?verify=20260617-admin-layout` returned HTTP `200` and confirmed the hosted entry includes `20260617-admin-layout`, `data-admin-sidebar`, and `data-nav-target="activities"`.

Verification:

- red layout tests first failed because the sidebar, independent admin views, active navigation state, and new asset version did not exist.
- target layout tests passed: `npm test -- tests/web-admin/static.test.js tests/web-admin/app-layout.test.js tests/web-admin/app-login.test.js --runInBand`.
- Web Admin regression passed: `npm test -- tests/web-admin --runInBand`.
- whitespace check passed: `git diff --check`.

## 2026-06-17 - Test Web Admin QR Login Deployment Smoke

Deployed and smoke-tested the Web Admin QR login backend in the test CloudBase environment `cloudbase-miniapp-test-dfc753877`.

Deployment completed:

- deployed `bootstrapV2Collections` and confirmed it is active.
- invoked `bootstrapV2Collections` successfully; `web_admin_sessions` now exists and a repeat invocation returned it under `existing`.
- deployed QR login cloud functions: `createWebAdminLogin`, `confirmWebAdminLogin`, and `pollWebAdminLogin`.
- redeployed Web Admin-facing cloud functions affected by `webAdminSessionToken` auth: `ensureUserProfile`, `listUsers`, `updateUserRoles`, `listActivities`, `getActivityDetail`, `setRegistrationAttendance`, `updateParticipantManagerAlias`, `getAttendanceStats`, `exportActivityRoster`, `listActivityLogs`, `listNotificationLogs`, and `getActivityCopyDraft`.
- redeployed `web-admin/` to CloudBase static hosting under `/admin`.
- updated the Web Admin static asset query string to `20260617-qr-login` because the previous `20260612-runtime` URLs were still served from CloudBase static hosting/CDN cache after redeploy.

Smoke results:

- hosted entry: `https://cloudbase-miniapp-test-dfc753877-1424891512.tcloudbaseapp.com/admin/`.
- HTTP check for `/admin/` returned `200` and confirmed the hosted entry references the `20260617-qr-login` assets.
- hosted `api.js` contains `createWebAdminLogin`, `pollWebAdminLogin`, and `webAdminSessionToken` support.
- hosted `app.js` contains QR payload handling.
- direct CloudBase invocation of `createWebAdminLogin` returned a pending challenge with `loginId`, `pollToken`, `qrPayload`, and `expiresAt`.
- direct CloudBase invocation of `pollWebAdminLogin` with that `loginId` and `pollToken` returned `{"status":"pending"}`.

Current blockers:

- browser-side Web Admin smoke is blocked before real QR confirmation because the test CloudBase environment has not enabled the Web SDK anonymous login method used by `web-admin/config.test.js`; browser console reports that `signInAnonymously()` requires anonymous login to be enabled, and cloud-function calls return `unauthenticated` / `credentials not found`.
- the workstation does not have the WeChat DevTools CLI on `PATH` or in the checked common install locations, so the mini-program experience build could not be uploaded from this environment.
- because the Web Admin browser callFunction path and mini-program experience upload are blocked, real-device QR confirmation, role-specific workspace entry, ordinary-user denial, and live `listUsers` / `listActivities` calls still require the next manual smoke pass after enabling the CloudBase Web identity source and uploading the mini-program build.

SQL/self-hosted readiness:

- no runtime MySQL migration, CloudBase/MySQL dual-write, or self-hosted HTTP API switch was introduced.
- the deployed QR login path keeps browser identity separated from real mini-program `OPENID`; Web Admin operations still resolve a server-issued `webAdminSessionToken` before applying the existing role checks.

Verification:

- target QR/Web Admin tests passed: `npm test -- tests/cloudfunctions/webAdminLogin.test.js tests/cloudfunctions/ensureUserProfile.test.js tests/cloudfunctions/listUsers.test.js tests/web-admin/api.test.js tests/web-admin/static.test.js tests/web-admin/app-login.test.js tests/miniprogram/pages/my-profile.test.js tests/miniprogram/pages/my-actions.test.js`.
- cache-bust regression passed after the static asset version update: `npm test -- tests/web-admin/static.test.js tests/web-admin/api.test.js tests/web-admin/app-login.test.js`.
- full regression passed with `npm test`: `79` test suites and `607` tests.

Follow-up QR render fix:

- the hosted Web Admin page could create a login challenge and display the `qrPayload`, but the QR canvas stayed blank.
- root cause: the external QR script URL `https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js` returned `404`, so `window.QRCode.toCanvas` was unavailable.
- vendored the QR renderer at `web-admin/vendor/qrcode.min.js`.
- updated Web Admin static assets to `20260617-qr-local` and redeployed `/admin/` with `12` files including `/admin/vendor/qrcode.min.js`.
- HTTP verification confirmed `/admin/` now references the local QR renderer, no longer references jsdelivr for QR rendering, and the local vendor file contains `toCanvas`.

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

## 2026-06-17 - Web Admin User Manager Alias Editing

Implemented user-level manager alias editing in Web Admin user management.

Delivered behavior:

- `listUsers` now returns `managerAlias`.
- admin user search can match `managerAlias`, so admins can find users by operational notes.
- Web Admin user management renders a manager-alias input for each user row.
- Web Admin can save the user-level alias through the new `updateUserManagerAlias` cloud function.
- `updateUserManagerAlias` updates `users.managerAlias`, `managerAliasUpdatedAt`, and `managerAliasUpdatedBy`.
- regular users and organizers cannot update global user aliases.
- activity roster alias editing still uses `updateParticipantManagerAlias`; both APIs write the same `users.managerAlias` field.

Deployment note:

- run `npm run copy:cloud-shared`.
- deploy the new `updateUserManagerAlias` cloud function.
- redeploy `listUsers`.
- redeploy Web Admin static hosting.

Verification:

- red/green tests covered alias search and return shape, the new alias mutation function, Web Admin API delegation, user-row view models, table rendering, and the save action.
- target regression passed: `5` test suites, `25` tests.

## 2026-06-17 - Web Admin Account Display And Logout

Implemented a clearer signed-in account display and logout control for Web Admin.

Delivered behavior:

- Web Admin topbar now shows the current account display name, role labels, and OpenID.
- The existing sidebar identity copy uses the same readable account summary.
- Web Admin now has a `logout` action that clears the local `webAdminSessionToken`, resets in-memory workspace state, and returns to the QR login flow.
- static asset query strings were bumped to `20260617-account` to avoid stale hosted scripts after redeploy.

Deployment note:

- redeploy Web Admin static hosting.
- no cloud function redeploy is required for this UI-only change.

Verification:

- red/green tests covered topbar account rendering and logout session clearing.
- Web Admin regression passed: `9` test suites, `46` tests.

## 2026-06-17 - Web Admin Search Loading Feedback

Added visible loading feedback for Web Admin search-style toolbar actions.

Delivered behavior:

- User Management search disables the submit button while `listUsers` is pending.
- Activity Management search disables the submit button while `listActivities` is pending.
- Attendance Statistics loading disables the submit button while `getAttendanceStats` is pending.
- toolbar loading buttons show a small spinner, `aria-busy="true"`, and temporary Chinese loading text.
- static asset query strings were bumped to `20260617-loading` to avoid stale hosted scripts and CSS after redeploy.

Deployment note:

- redeploy Web Admin static hosting.
- no cloud function redeploy is required for this UI-only change.

Verification:

- red/green tests covered pending search button loading state, static button hooks, spinner CSS, and asset-version cache busting.
- target Web Admin tests passed: `2` test suites, `18` tests.
- Web Admin regression passed: `9` test suites, `48` tests.
- full regression passed: `81` test suites, `628` tests.

## 2026-06-18 - Web Admin User Action Feedback

Tightened the Web Admin user-management row actions after live smoke feedback.

Delivered behavior:

- user-management row actions now render inside a spaced `table-actions` group, so `Save` and `Save remark` no longer touch visually.
- role checkboxes now have clearer accessible labels and disabled-state titles; admin users can toggle organizer, while only super admins can toggle admin.
- saving roles and saving remarks now disable the clicked button, show a temporary loading label, and write a visible completion or error status.
- static asset query strings were bumped to `20260618-user-actions` to avoid stale hosted scripts and CSS after redeploy.

Deployment note:

- redeploy Web Admin static hosting.
- no cloud function redeploy is required for this UI-only change.

Verification:

- red/green tests covered separated user-row action controls, role/remark save loading feedback, completion status, and static CSS hooks.
- target Web Admin tests passed: `2` test suites, `21` tests.
- Web Admin regression passed: `9` test suites, `51` tests.
- full regression passed: `81` test suites, `631` tests.

## 2026-06-18 - Web Admin Function Permission Repair

Repaired the test CloudBase function permission rule after live Web Admin saves returned `EXCEED_AUTHORITY`.

Root cause:

- `listUsers` was explicitly allowed for the Web SDK bootstrap identity, so the user-management table could load.
- `updateUserRoles` and `updateUserManagerAlias` were missing from the explicit function allowlist and fell through to the default rule that rejects anonymous Web SDK identities.
- the failed save requests were blocked by the CloudBase gateway before cloud-function code ran; recent logs for `updateUserRoles` and `updateUserManagerAlias` were empty.
- backend role safety was not relaxed: protected functions still resolve `webAdminSessionToken` to the confirmed mini-program `OPENID` before applying admin checks.

Operational fix:

- updated the `cloudbase-miniapp-test-dfc753877` custom function permission rule to allow the Web SDK bootstrap credential (`auth != null`) to invoke all Web Admin-facing functions, including `updateUserRoles` and `updateUserManagerAlias`.
- kept the default `*` rule at `auth != null && auth.loginType != 'ANONYMOUS'` for functions that are not explicitly part of the Web Admin surface.
- used the CloudBase `ModifyResourcePermission` API after `tcb permission set function --level custom` reported success but did not change the stored rule.

Verification:

- `tcb permission get function -e cloudbase-miniapp-test-dfc753877 --json` now shows `updateUserRoles` and `updateUserManagerAlias` with `invoke: auth != null`.
- `tcb fn log updateUserRoles` and `tcb fn log updateUserManagerAlias` returned empty recent logs before the permission repair, matching a gateway-level block rather than an in-function authorization failure.
- no Web Admin static redeploy or cloud-function code redeploy was required for this permission-only repair.

## 2026-06-18 - Mini-Program Participant Detail Dialog

Moved activity-detail participant remark editing into the participant row itself.

Delivered behavior:

- tapping the participant profile area in the team list now opens a participant dialog.
- the dialog always shows the participant avatar or fallback avatar and signup name.
- organizers and admins can edit the existing manager remark from the dialog.
- regular users see only the avatar and signup name; the remark value and input are not exposed.
- the separate row-level `备注` / alias button was removed, so the participant row does not gain an extra remark action.
- the save path still uses the existing `updateParticipantManagerAlias` API and `users.managerAlias` field; no new remark field or cloud function was added.

Deployment note:

- upload a new mini-program build for the updated Activity Detail UI.
- no cloud function redeploy is required for this UI-only wiring change.

Verification:

- red tests first failed because the team list still emitted `manageraliasedit`, still rendered the standalone alias button, and Activity Detail had no participant dialog state.
- target regression passed: `6` miniprogram suites, `118` tests.
- full regression passed: `81` suites, `633` tests.

## 2026-06-18 - Web Admin Remark Copy Unification

Unified the Web Admin activity roster wording around participant remarks.

Delivered behavior:

- the activity detail roster header now shows `备注` instead of `管理识别名`.
- the activity detail roster save button now shows `保存备注` instead of `保存识别名`.
- existing internal action names, APIs, and the `users.managerAlias` field remain unchanged; no data migration or cloud function redeploy is required.

Deployment note:

- redeploy Web Admin static hosting.

Verification:

- red tests first failed while the static header still had only one `备注` column and the rendered activity roster still showed `保存识别名`.
- target Web Admin tests passed: `2` test suites, `21` tests.
- Web Admin regression passed: `9` test suites, `51` tests.
- full regression passed: `81` test suites, `633` tests.

## 2026-06-18 - Web Admin Activity Action Spacing

Separated the activity detail roster operation buttons after live UI feedback showed adjacent buttons touching.

Delivered behavior:

- activity detail roster action buttons now render inside the shared `.table-actions` button group.
- the existing `标记出勤` / `标记缺勤` and `保存备注` actions keep the same data attributes and behavior.

Deployment note:

- redeploy Web Admin static hosting.

Verification:

- red test first failed because roster rows rendered adjacent bare buttons without a `.table-actions` wrapper.
- target Web Admin layout test passed: `1` test suite, `12` tests.
- Web Admin regression passed: `9` test suites, `51` tests.
- full regression passed: `81` test suites, `633` tests.

## 2026-06-18 - Web Admin Attendance Stats Empty State

Clarified why the attendance statistics table can be empty.

Root cause:

- `getAttendanceStats` intentionally counts only activities whose `confirmStatus` is `confirmed`.
- activities still shown as `已发布 / 待处理` are excluded from statistics, even when they have joined registrations in the selected date range.

Delivered behavior:

- when the selected range returns no statistics rows, Web Admin now shows `仅统计已确认举行活动；当前范围内没有出勤记录。`.
- when statistics rows are returned, the empty-state message is hidden and the table renders normally.
- static asset query strings were bumped to `20260618-stats-empty` so hosted browsers fetch the updated Web Admin script.
- no cloud function, data model, or statistics eligibility change was made.

Deployment note:

- redeploy Web Admin static hosting.

Verification:

- red tests first failed because empty attendance results left only a blank table and never surfaced the confirmed-activity rule.
- target Web Admin tests passed: `2` test suites, `23` tests.
- Web Admin regression passed: `9` test suites, `53` tests.
- full regression passed: `81` test suites, `635` tests.

## 2026-06-18 - Shared Activity Confirmation Entry

Extended the existing activity proceeding notification function so Web Admin can reuse the same confirmation path as the mini-program.

Delivered behavior:

- `notifyActivityParticipants` keeps its public cloud function name for backward compatibility.
- `notifyActivityParticipants` now accepts `webAdminSessionToken` and resolves it to the confirmed Web Admin user before applying the existing organizer/admin permission checks.
- `notificationType: proceeding` still writes `confirmStatus: confirmed`, `confirmedAt`, `confirmedByOpenId`, and `updatedAt`.
- proceeding notifications are sent only before the activity start time; after the activity starts, confirmation still succeeds and accepted recipients get skipped logs with `reason: activity-already-started`.
- Web Admin now wraps the shared function as `confirmActivity(activityId)` and renders a `确认举行` action only for `published / pending` activities.
- static asset query strings were bumped to `20260618-confirm-activity` so hosted browsers fetch the updated Web Admin scripts.

Deployment note:

- redeploy `notifyActivityParticipants` after running `npm test` or `node scripts/copy-cloud-shared.mjs`.
- redeploy Web Admin static hosting.
- update the test CloudBase function permission rule so the Web SDK bootstrap credential can invoke `notifyActivityParticipants`; the cloud function still enforces the Web Admin session and organizer/admin authorization internally.

Verification:

- red tests first failed because `notifyActivityParticipants` required mini-program `OPENID`, still sent proceeding notices after activity start, and Web Admin had no confirm wrapper or activity-row button.
- target confirmation tests passed: `5` test suites, `45` tests.
- Web Admin regression passed: `9` test suites, `55` tests.
- full regression passed: `81` test suites, `639` tests.
