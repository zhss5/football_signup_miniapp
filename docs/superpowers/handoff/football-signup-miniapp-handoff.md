# Football Signup Mini Program Handoff

- Date: 2026-07-24
- Branch: `codex/version-2-web-admin`
- Workspace: `D:/workspaces/football_signup_miniapp`
- Remote: `origin` -> `git@github.com:zhss5/football_signup_miniapp.git`
- Baseline commit before the Web Admin QR-login implementation: `66b12ff Add test web admin CloudBase runtime`
- Remote sync status: this goal creates local commits only; no push was requested. Run `git status --short --branch` before rollout or publishing.

## 1. Current State

Version 2 implementation continues on `codex/version-2-web-admin`. Check the local branch status before rollout or pushing.

Version 2 adds:

- `super_admin`, `admin`, `organizer`, and regular `user` role boundaries.
- `listUsers` and `updateUserRoles` for role management.
- user role audit rows in `user_role_logs`.
- attendance mutation and date-range attendance statistics.
- roster export rows for CSV/XLSX generation on the client.
- manager aliases for real WeChat users, editable from both mini program and web admin through `updateParticipantManagerAlias`.
- global user manager aliases editable from Web Admin user management through `updateUserManagerAlias`.
- participant operation history in `activity_logs`.
- activity duplication through a reusable setup draft API.
- `web-admin/` static admin UI for roles, activities, attendance, exports, and logs.
- Web Admin WeChat QR login that maps browser sessions back to real mini-program `OPENID` roles.
- Home/My pagination and overdue unresolved activity prompts.
- explicit SQL migration readiness documentation for a future MySQL 8.x and self-hosted server migration.
- explicit V2 CloudBase collection bootstrap through `bootstrapV2Collections` and `scripts/deploy-v2-bootstrap.ps1`.
- test-environment web-admin runtime initialization and CloudBase static hosting under `/admin`.
- configurable activity-level late-cancellation organizer notice windows in mini-program create/edit/copy flows.
- separate one-time manager subscriptions for registration-threshold and late-cancellation notices, with alias-first participant naming in the cancellation template.

Version 2 still does not:

- run MySQL at runtime.
- dual-write CloudBase and MySQL.
- switch mini-program or web-admin traffic to a self-hosted HTTP API.
- migrate CloudBase data automatically.

## 2. Local Working Tree Notes

Current uncommitted local changes are intentionally left outside this handoff update:

- `cloudfunctions/updateActivityReview/manager-notifications.js` modified.
- `cloudfunctions/updateUserManagerAlias/manager-notifications.js` modified.
- `miniprogram/config/env.local.js.example` deleted.
- `project.config.json` modified.

Do not stage those files unless there is a separate explicit decision to change local configuration examples or project config.

Sensitive-file rule:

- Do not commit real CloudBase environment IDs, AppSecret values, tokens, private keys, or local `env.local.js` contents.
- Deployment examples must keep placeholders such as `your-cloud-env-id`.

## 3. CloudBase Collections

Required collections for V2:

- `users`
- `activities`
- `activity_teams`
- `registrations`
- `activity_logs`
- `user_role_logs`
- `notification_logs`
- `notification_subscriptions`
- `web_admin_sessions`

For existing V1 environments, do not delete or recreate existing data collections. Run the explicit bootstrap once to create missing V2 collections:

```powershell
npm install -g @cloudbase/cli
tcb login
npm run deploy:v2-bootstrap -- -EnvId 'your-cloud-env-id'
```

Use deploy-only mode if the function should be uploaded first and invoked manually:

```powershell
npm run deploy:v2-bootstrap -- -EnvId 'your-cloud-env-id' -DeployOnly
```

`bootstrapV2Collections` creates only these missing collections:

- `activity_logs`
- `user_role_logs`
- `notification_logs`
- `notification_subscriptions`
- `web_admin_sessions`

It returns API-shaped `created`, `existing`, and `skipped` arrays and does not delete, clear, rename, or recreate V1 data.

### V0.9.4 To Version 2 Upgrade Rehearsal

Use the dedicated runbook before upgrading an existing V0.9.4 production
environment:

- `docs/superpowers/plans/2026-07-29-v0.9.4-to-v2-upgrade-rehearsal.md`

The existing test environment `cloudbase-miniapp-test-dfc753877` may be reused
as the isolated rehearsal environment after its current data and Cloud Storage
objects are backed up. Do not delete the CloudBase environment itself.

The test environment must first be restored to a representative V0.9.4 data
baseline. A blank database verifies only a new installation and does not prove
upgrade compatibility. Remove the five Version 2-only collections when
possible so the rehearsal exercises their creation; if they remain, record
that the rehearsal verifies bootstrap idempotency only.

The production deployment gate is compatibility-first:

1. bootstrap additive collections and create indexes;
2. deploy the Version 1-existing functions changed by Version 2;
3. run the V0.9.4 client regression against that backend;
4. deploy Version 2-only functions;
5. smoke the Version 2 mini program and Web Admin;
6. compare data integrity and counts before approving production rollout.

Prefer function/client rollback over database restore because Version 2 fields
and collections are additive. Restore data only for proven deletion,
corruption, or invalid transformation, and restore related collections from
one consistent snapshot.

## 4. Cloud Function Deployment

### Completed Web Admin Pagination And Roster-Completeness Rollout

Task 7 deployed the 2026-07-24 pagination implementation to
`cloudbase-miniapp-test-dfc753877`. The six changed Node.js 18.15 functions
were deployed:

- `listUsers`
- `listActivities`
- `getAttendanceStats`
- `listNotificationLogs`
- `getActivityDetail`
- `exportActivityRoster`

CloudBase CLI `fn list` / `fn detail` showed each function as `Deployment
completed` and `Active`. Final corrected packages were deployed from their
function directories and verified from remote source: `getActivityDetail` at
`2026-07-24 17:05:08`, `exportActivityRoster` at `17:05:44`, and
`getAttendanceStats` at `17:21:57`.

Static hosting deployed `web-admin` to `/admin/` with `29/29` uploaded files:

`https://cloudbase-miniapp-test-dfc753877-1424891512.tcloudbaseapp.com/admin/`

Hosted HTML loaded `20260724-statistics-type-pagination` for every
local asset, including `pagination.js` before `app.js`. No collection
bootstrap, data backfill, schema migration, runtime MySQL migration,
dual-write, or self-hosted API cutover was performed.

Deploy changed cloud functions from each function directory with `--dir .`.
Using a repository-root relative `--dir cloudfunctions/<name>` invocation can
upload stale source in this CLI/environment combination; always verify remote
`CodeInfo` after deployment.

Always copy shared helpers before deploying cloud functions:

```bash
npm run copy:cloud-shared
```

Recommended V2 cloud function deployment set:

```text
ensureUserProfile
bootstrapV2Collections
listActivities
getActivityDetail
createActivity
updateActivity
updateTeamColor
joinActivity
addProxyRegistration
cancelRegistration
removeRegistration
moveRegistration
setRegistrationAttendance
getAttendanceStats
exportActivityRoster
updateParticipantManagerAlias
updateUserManagerAlias
listActivityLogs
getActivityCopyDraft
listUsers
updateUserRoles
listNotificationLogs
createWebAdminLogin
confirmWebAdminLogin
pollWebAdminLogin
recordNotificationSubscription
notifyActivityParticipants
cancelActivity
deleteActivity
getActivityStats
```

PowerShell deployment template:

```powershell
$devtoolsCli = '<path-to-wechat-devtools>\cli.bat'
& $devtoolsCli cloud functions deploy `
  --env 'your-cloud-env-id' `
  --project 'D:\workspaces\football_signup_miniapp' `
  --remote-npm-install `
  --names ensureUserProfile bootstrapV2Collections listActivities getActivityDetail createActivity updateActivity updateTeamColor joinActivity addProxyRegistration cancelRegistration removeRegistration moveRegistration setRegistrationAttendance getAttendanceStats exportActivityRoster updateParticipantManagerAlias updateUserManagerAlias listActivityLogs getActivityCopyDraft listUsers updateUserRoles listNotificationLogs createWebAdminLogin confirmWebAdminLogin pollWebAdminLogin recordNotificationSubscription notifyActivityParticipants cancelActivity deleteActivity getActivityStats `
  --lang zh
```

V2 changed some V1-existing cloud functions. If review, trial, and release builds share the same `CLOUD_ENV_ID`, deploying changed functions affects all builds that call that environment.

Latest test-environment function deployment:

- `createActivity`, `updateActivity`, and `getActivityCopyDraft` were redeployed to `cloudbase-miniapp-test-dfc753877` for the configurable late-cancellation notice window.
- remote function details confirm each deployed code package contains `lateCancellationNoticeWindowHours` and the `168` validation boundary.
- the dedicated late-cancellation template split is committed locally but not deployed by this goal.
- redeploy `getActivityDetail` and `cancelRegistration`, then upload a new mini-program experience build before testing the split manager subscriptions and cancellation template on device.
- `recordNotificationSubscription` remains API-compatible and does not require a code redeployment if the target environment already has the current V2 version.
- no Web Admin static redeployment or collection migration is required for this notification change.
- full local regression for the dedicated template split passed with `83` suites and `810` tests.

## 5. First Admin Setup

Seed the first `super_admin` manually in CloudBase before using role management:

```json
{
  "roles": ["user", "super_admin"]
}
```

After that, use web-admin role management:

- `super_admin` can manage `admin` and `organizer`.
- `admin` can manage only `organizer`.
- the last active `super_admin` cannot be removed.
- removing elevated roles keeps base `user`.

## 6. Web Admin

The web admin is a static subproject under:

- `web-admin/`

It calls CloudBase cloud functions through API-shaped adapters. Ordinary `user` accounts are denied before the workspace renders.

Web Admin login now uses the real mini-program WeChat identity:

1. Web Admin creates a short-lived QR login challenge with `createWebAdminLogin`.
2. An organizer, admin, or super admin opens the mini program `My` page and scans the QR code with the Web Admin login action.
3. `confirmWebAdminLogin` confirms the challenge with the scanner's real `OPENID`.
4. Web Admin polls `pollWebAdminLogin`, stores `webAdminSessionToken`, and attaches it to protected cloud-function calls.
5. Shared cloud auth resolves that token back to the confirmed `OPENID` before checking `users.roles`.

The browser never proves identity by submitting an `openid`. It receives a session only after mini-program confirmation, and the effective cloud-side binding is `sessionToken -> confirmedOpenId`.

Do not grant roles to browser-generated `web_xxx` users. Roles remain attached to real `users/{OPENID}` documents.

Test environment hosting:

- CloudBase env: `cloudbase-miniapp-test-dfc753877`.
- Static hosting path: `/admin/`.
- Hosted URL: `https://cloudbase-miniapp-test-dfc753877-1424891512.tcloudbaseapp.com/admin/`.
- Test runtime config: `web-admin/config.test.js`.
- Runtime adapter: `web-admin/src/cloudbase-runtime.js`.
- The test entry does not hardcode the production CloudBase environment ID.
- Local static assets use `?v=20260724-statistics-type-pagination` query strings to avoid stale CloudBase static hosting/CDN scripts after redeploy.

Current hosted smoke status:

- CloudBase static hosting is online at `/admin/`; the final deploy uploaded `29/29` files successfully in the test environment.
- hosted HTML loads `20260724-statistics-type-pagination` for every local asset, including `pagination.js` before `app.js`.
- the hosted entry loads the CloudBase Web SDK from `https://static.cloudbase.net/cloudbase-js-sdk/latest/cloudbase.full.js`.
- the hosted entry and every local static asset load `?v=20260724-statistics-type-pagination`; hosted `app.js` and `styles.css` include the pagination, split-statistics, and existing user-row action feedback hooks.
- the hosted entry contains the common Web Admin layout with `data-admin-sidebar`, `data-admin-content`, and role-aware sidebar targets.
- the Web Admin default visible interface is Chinese; API names, role enums, status enums, and `data-*` hooks remain stable.
- the shared statistics workspace is named `统计分析` and separates `出勤统计` from `取消统计` while reusing one date/activity-type query. The client sends stable `statisticsType=attendance|cancellation` requests so each tab has its own exact total, fixed 20-row pages, and full multi-page export.

Task 7 authenticated admin smoke:

- an existing admin session opened the workspace and kept the QR/login view hidden;
- activities: exact total `13`, page `1/1`, and `13` rows; current data has no activity second page;
- users: exact total `102`, page `1/6` with `20` rows, then page `2/6` with `20` rows and previous enabled;
- attendance statistics: exact total `19`, page `1/1`, and `19` rows;
- cancellation statistics: exact total `22`, page `1/2` with `20` rows, then page `2/2` with `2` rows;
- notification logs: exact total `7`, page `1/1`, and `7` rows;
- activity `测试07221933`: `3` roster rows and `22` activity-log rows;
- roster CSV: resulting download inspected locally with `3` data rows and the expected eight columns;
- browser console had only unrelated extension warnings, with no pagination-metadata or cloud-function application error.

Residual live-smoke gaps: no activity/log second page exists in current data;
ordinary-user and organizer-only sessions were not available, while unit and
role tests cover those boundaries. The browser download event was not exposed,
but the resulting CSV artifact was located and inspected.
- cancellation-rate tones are lower-is-better: `0%-20%` green, above `20%-50%` yellow, and above `50%` red; attendance-rate tones remain higher-is-better.
- the test environment `getAttendanceStats` deployment was verified from remote `CodeInfo` to include additive `cancellationDetails` rows.
- hosted `api.js` contains `createWebAdminLogin`, `pollWebAdminLogin`, and `webAdminSessionToken` support.
- hosted `app.js` contains QR payload handling and admin view navigation state.
- `bootstrapV2Collections` has been deployed and invoked in `cloudbase-miniapp-test-dfc753877`; `web_admin_sessions` exists, and a repeat invocation returned all V2 collections under `existing`.
- QR login cloud functions have been deployed: `createWebAdminLogin`, `confirmWebAdminLogin`, and `pollWebAdminLogin`.
- Web Admin-facing functions affected by `webAdminSessionToken` auth have been redeployed in the test environment: `ensureUserProfile`, `listUsers`, `updateUserRoles`, `updateUserManagerAlias`, `listActivities`, `getActivityDetail`, `setRegistrationAttendance`, `updateParticipantManagerAlias`, `getAttendanceStats`, `exportActivityRoster`, `listActivityLogs`, `listNotificationLogs`, and `getActivityCopyDraft`.
- the test environment's custom CloudBase function permission rule explicitly allows the Web SDK bootstrap credential (`auth != null`) to invoke Web Admin-facing functions, including `updateUserRoles` and `updateUserManagerAlias`; the default `*` rule still rejects anonymous Web SDK identities for functions outside that allowlist.
- direct CloudBase invocation of `createWebAdminLogin` returned a pending challenge with `loginId`, `pollToken`, `qrPayload`, and `expiresAt`.
- direct CloudBase invocation of `pollWebAdminLogin` with that `loginId` and `pollToken` returned `{"status":"pending"}`.

Current Web Admin smoke notes:

- Anonymous Web SDK identity is only a browser bootstrap credential for creating and polling the QR challenge; it must not be granted admin roles. The real Web Admin identity still comes from the mini-program QR confirmation and the server-issued `webAdminSessionToken`.
- CloudBase function safety rules must allow the Web SDK bootstrap credential to invoke Web Admin entry and protected functions; backend role checks still use `webAdminSessionToken`. Keep the permission allowlist in sync whenever a new Web Admin-facing function is added.
- After each Web Admin static redeploy, rerun a real-device smoke pass for QR confirmation, role-specific workspace entry, ordinary-user denial, and live `listUsers` / `listActivities` calls.

Current web-admin capabilities:

- identity loading through `ensureUserProfile`.
- role-aware sidebar navigation after QR login.
- current account display with display name, roles, and OpenID.
- logout that clears the local Web Admin session and returns to QR login.
- user search through `listUsers`.
- toolbar submit buttons show spinner loading feedback while search/statistics requests are pending.
- role mutation through `updateUserRoles`.
- activity list filtering through `listActivities`.
- activity detail through `getActivityDetail`.
- activity roster manager alias edit through `updateParticipantManagerAlias`.
- user management manager alias edit through `updateUserManagerAlias`.
- attendance edit through `setRegistrationAttendance`.
- attendance statistics through `getAttendanceStats`.
- separate attendance and final-outcome cancellation tables, detail dialogs, and CSV exports inside `统计分析`.
- roster export through `exportActivityRoster`, with CSV generated in the browser.
- activity operation logs through `listActivityLogs`.
- notification logs through `listNotificationLogs`.
- fixed 20-row pagination for user management, activity management, attendance statistics, cancellation statistics, and notification logs. List APIs return `{ items, total, limit, skip, hasMore }`; the client rejects malformed metadata without replacing the visible page.
- complete activity detail and roster-export reads for every joined registration in the selected activity. Roster detail remains unpaginated and uses the exact flattened order shared with roster export: numeric team `sort`, team ID, `joinedAt`, participant display-name fallback (`signupName`, `displayName`, `preferredName`, `userOpenId`), then registration ID. Attendance/cancellation CSV/XLSX exports read all validated pages for the active filters and fail rather than emit partial results.
- role boundaries remain server enforced: admins/super admins list users and have global review scope; organizers have own-activity scope for activities, statistics, and notification logs; ordinary users cannot use these management reads or roster export.

## 7. SQL And Self-Hosted Readiness

The target future SQL engine is MySQL 8.x.

Read first:

- `docs/superpowers/specs/2026-06-10-sql-migration-readiness.md`

Important rules:

- keep current business state separate from audit/history logs.
- use explicit IDs, stable enum strings, and clear timestamp fields.
- keep cloud function inputs/outputs API-shaped.
- do not couple backend contracts directly to mini-program or web-admin UI structure.
- V2 prepares schema compatibility only; it does not run MySQL, dual-write, or cut over to a self-hosted API.
- The pagination response remains API-shaped for a future SQL implementation: `{ items, total, limit, skip, hasMore }`. CloudBase uses complete `_id` cursor reads and final stable `_id` tie-breakers before filtering, aggregation, and public offset pagination. Future SQL validation must prove identical filtered totals, terminal-page `hasMore`, complete multi-page export behavior, and the shared flattened roster order: numeric team `sort`, team ID, `joinedAt`, participant display-name fallback (`signupName`, `displayName`, `preferredName`, `userOpenId`), then registration ID. `limit`/`skip` map to SQL `LIMIT/OFFSET` today but do not commit the future implementation to permanent offset pagination.

## 8. Verification Snapshot

### 2026-07-24 Task 7 Deployment And Smoke Evidence

- final pre-deployment direct Jest regression passed before integration corrections: focused `10` suites / `141` tests and full `85` suites / `860` tests;
- final post-correction direct Jest regression passed with `85` suites / `873` tests;
- six Node.js 18.15 functions were deployed and remotely verified active in `cloudbase-miniapp-test-dfc753877`;
- Web Admin static hosting deployed `29/29` files to `/admin/` and served the current asset version;
- authenticated admin smoke covered user second-page navigation, independently filtered and paged statistics tabs, activity detail, notification logs, and roster export with no observed application error;
- limitations are recorded above rather than treated as passed coverage: no activity/log second page in current data and no live ordinary-user or organizer-only session. The CSV download event was not exposed, but the resulting file was located and inspected.

### 2026-07-24 Web Admin Pagination Documentation Milestone

Commands run without the `npm test` pretest copy hook:

```powershell
npx jest --runInBand tests/cloudfunctions/getActivityDetail.test.js tests/cloudfunctions/exportActivityRoster.test.js tests/cloudfunctions/listUsers.test.js tests/cloudfunctions/listActivities.test.js tests/cloudfunctions/getAttendanceStats.test.js tests/cloudfunctions/listNotificationLogs.test.js tests/web-admin/pagination.test.js tests/web-admin/app-layout.test.js tests/web-admin/api.test.js tests/web-admin/export-files.test.js
npx jest --runInBand
git diff --check
```

Results, including test-only follow-up `31f1a95` and roster-order follow-up `580fe15`:

- focused direct Jest passed with `10` suites and `141` tests.
- the targeted direct Jest run for `tests/web-admin/app-login.test.js` passed with `1` suite and `3` tests after its pagination mocks were updated to return valid `{ items, total, limit, skip, hasMore }` metadata.
- `580fe15` passed independent review and proves flattened `getActivityDetail` roster order exactly matches `exportActivityRoster`.
- final direct Jest passed with `85` suites and `860` tests.
- `git diff --check` must be rerun after the documentation edits and before staging.

Latest verification before this handoff refresh:

```powershell
.\node_modules\.bin\jest.cmd --runInBand
```

Result:

- `83` test suites passed.
- `805` tests passed.

Additional checks run for the configurable late-cancellation window:

```powershell
.\node_modules\.bin\jest.cmd --runInBand tests/cloudfunctions/createActivity.test.js tests/cloudfunctions/updateActivity.test.js tests/cloudfunctions/getActivityCopyDraft.test.js
.\node_modules\.bin\jest.cmd --runInBand tests/miniprogram/utils/activity-draft.test.js tests/miniprogram/utils/validators.test.js tests/miniprogram/pages/activity-create-submit.test.js tests/miniprogram/pages/activity-create-default-teams.test.js tests/miniprogram/styles/activity-create-validation-style.test.js tests/miniprogram/styles/activity-create-layout.test.js tests/miniprogram/utils/i18n.test.js tests/miniprogram/mocks/local-cloud.test.js
'' | npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 fn deploy <function-name> --dir . --force --deployMode zip --json
git diff --check
```

Results:

- backend create/update/copy regression passed, including V1 update omission compatibility.
- mini-program target regression passed with `8` suites and `135` tests.
- full regression passed with `83` suites and `805` tests.
- deployed functions: `createActivity`, `updateActivity`, `getActivityCopyDraft`.
- remote `CodeInfo` for all three functions contains the new field and range boundary.
- `npm test` was not used because its pretest shared-file copy would overwrite unrelated uncommitted helper changes; direct Jest ran the complete suite without altering them.

Additional checks run for the split statistics deployment:

```bash
npm test -- tests/cloudfunctions/getAttendanceStats.test.js tests/web-admin/activity-management.test.js --runInBand
npm test -- tests/web-admin --runInBand
npm test -- --runInBand
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 fn deploy getAttendanceStats --dir . --force --deployMode zip --json
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 fn detail getAttendanceStats --json
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 hosting deploy web-admin /admin
git diff --check
```

Results:

- backend target regression passed with `2` suites and `24` tests.
- Web Admin regression passed with `9` suites and `96` tests.
- full regression passed with `83` suites and `774` tests.
- remote `CodeInfo` contains `cancellationDetails`; deployment from the function directory replaced the stale package successfully.
- static hosting uploaded `24` files under `/admin/`.
- authenticated browser smoke loaded `15` attendance rows and `18` cancellation rows; the cancellation detail dialog rendered `8` final-outcome rows, including one cancellation timestamp.

Additional checks run for the test web-admin runtime and hosting work:

```bash
npm test -- tests/web-admin
git diff --check
git diff --cached --check
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 hosting detail
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 hosting deploy web-admin /admin
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 hosting list /admin
```

Results:

- `npm test -- tests/web-admin` passed with `7` test suites and `29` tests.
- `git diff --check` passed.
- `git diff --cached --check` passed.
- CloudBase static hosting was online.
- `/admin/` returned HTTP `200`.
- `web-admin/` deployed to `/admin` with `11` uploaded files.
- browser smoke reached the web-admin page but stopped at the expected Web SDK credential blocker.

Additional checks run for the explicit bootstrap work:

```bash
node node_modules/jest/bin/jest.js tests/cloudfunctions/bootstrapV2Collections.test.js tests/cloudfunctions/database.test.js --runInBand
git diff --check
git diff --cached --check
```

The PowerShell bootstrap script was also exercised with a fake `tcb` executable to verify the local copy/deploy/invoke command path. Actual CloudBase deployment was not run locally because `tcb` is not installed on this workstation.

Additional checks run for the test Web Admin QR-login deployment smoke:

```bash
npm test -- tests/cloudfunctions/webAdminLogin.test.js tests/cloudfunctions/ensureUserProfile.test.js tests/cloudfunctions/listUsers.test.js tests/web-admin/api.test.js tests/web-admin/static.test.js tests/web-admin/app-login.test.js tests/miniprogram/pages/my-profile.test.js tests/miniprogram/pages/my-actions.test.js
npm test -- tests/web-admin/static.test.js tests/web-admin/api.test.js tests/web-admin/app-login.test.js
npm test
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 fn invoke bootstrapV2Collections -d "@<payload-file>"
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 fn invoke createWebAdminLogin --json
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 fn invoke pollWebAdminLogin -d "@<payload-file>"
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 hosting deploy web-admin /admin
```

Results:

- QR/Web Admin target regression passed with `8` test suites and `36` tests.
- static cache-bust regression passed with `3` test suites and `11` tests.
- full regression passed with `79` test suites and `607` tests.
- `bootstrapV2Collections` returned `created: []` and `existing: ["activity_logs","user_role_logs","notification_logs","notification_subscriptions","web_admin_sessions"]` on the repeat check.
- direct QR backend smoke returned a pending challenge and then `{"status":"pending"}` from `pollWebAdminLogin`.
- hosted `/admin/` returned HTTP `200` and loaded the `20260617-qr-login` asset version.
- browser smoke loaded the Web Admin page but stopped at the CloudBase Web SDK anonymous-login configuration blocker before live QR confirmation.

Additional checks run for the Web Admin common layout refactor:

```bash
npm test -- tests/web-admin/static.test.js tests/web-admin/app-layout.test.js tests/web-admin/app-login.test.js --runInBand
npm test -- tests/web-admin --runInBand
git diff --check
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 hosting deploy web-admin /admin
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 hosting list /admin
```

Results:

- Web Admin layout target tests passed with `3` test suites and `13` tests.
- Web Admin regression passed with `9` test suites and `41` tests.
- `git diff --check` passed.
- CloudBase static hosting uploaded `12` files under `/admin`.
- hosted `/admin/?verify=20260617-admin-layout` returned HTTP `200` and loaded the `20260617-admin-layout` asset version with the new sidebar layout.

Additional checks run for the Web Admin default Chinese UI:

```bash
npm test -- tests/web-admin/static.test.js tests/web-admin/app-login.test.js tests/web-admin/app-layout.test.js --runInBand
npm test -- tests/web-admin --runInBand
```

Results:

- Chinese UI target tests passed with `3` test suites and `15` tests.
- Web Admin regression passed with `9` test suites and `43` tests.
- CloudBase static hosting uploaded `12` files under `/admin`.
- hosted `/admin/?verify=20260617-zh-cn-utf8` returned HTTP `200` and UTF-8 verification confirmed `20260617-zh-cn`, `足球报名后台`, `用户管理`, and `后台管理登录`.

Additional checks run for the Web Admin user-action feedback and function permission repair:

```bash
node node_modules/jest/bin/jest.js tests/web-admin --runInBand
npm test -- --runInBand
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 hosting deploy web-admin /admin --json
npx -y -p @cloudbase/cli@3.5.6 tcb permission get function -e cloudbase-miniapp-test-dfc753877 --json
npx -y -p @cloudbase/cli@3.5.6 tcb fn log updateUserRoles -e cloudbase-miniapp-test-dfc753877 --limit 20 --json
npx -y -p @cloudbase/cli@3.5.6 tcb fn log updateUserManagerAlias -e cloudbase-miniapp-test-dfc753877 --limit 20 --json
```

Results:

- Web Admin regression passed with `9` test suites and `51` tests.
- full regression passed with `81` test suites and `631` tests.
- CloudBase static hosting uploaded `12` files under `/admin` and the hosted entry loaded `20260618-user-actions`.
- the CloudBase function permission rule now includes `updateUserRoles` and `updateUserManagerAlias` with `invoke: auth != null`.
- recent `updateUserRoles` and `updateUserManagerAlias` function logs were empty before the permission repair, confirming the live `EXCEED_AUTHORITY` save failure was blocked at the CloudBase gateway before function execution.

## 9. Deployment Order

Recommended V2 rollout order:

1. Back up CloudBase database.
2. Confirm the target `CLOUD_ENV_ID` and whether trial/review/release share the same environment.
3. Install and log into CloudBase CLI if using the bootstrap script.
4. Run `npm run deploy:v2-bootstrap -- -EnvId 'your-cloud-env-id'`, or create missing V2 collections manually.
5. Apply indexes from `docs/cloudbase/indexes.md`.
6. Apply database rules from `docs/cloudbase/security-rules.json`.
7. Seed the first `super_admin` in `users`.
8. Run `npm run copy:cloud-shared`.
9. Deploy the V2 cloud function set.
10. Upload the mini-program build.
11. Host or serve the `web-admin/` static files with the CloudBase adapter configured. For the test environment, deploy `web-admin/` to `/admin`.
12. Run smoke tests with a regular user, organizer, admin, and super admin.

## 10. Key Files To Read First

- `AGENTS.md`
- `docs/development-log-v2.md`
- `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`
- `docs/superpowers/plans/2026-05-18-version-2-lightweight-web-admin.md`
- `docs/superpowers/plans/2026-05-19-version-2-execution-plan.md`
- `docs/superpowers/specs/2026-06-10-sql-migration-readiness.md`
- `docs/cloudbase/real-cloudbase-rollout.md`
- `docs/cloudbase/wechat-devtools-setup.md`
- `docs/cloudbase/indexes.md`
- `docs/cloudbase/security-rules.json`
- `scripts/deploy-v2-bootstrap.ps1`
- `cloudfunctions/bootstrapV2Collections/index.js`
- `cloudfunctions/_shared/collections.js`
- `cloudfunctions/_shared/database.js`
- `cloudfunctions/_shared/roles.js`
- `web-admin/`

## 11. Next Steps

1. Rerun the real-device Web Admin user-management smoke pass and confirm `保存` and `保存备注` no longer return `EXCEED_AUTHORITY`.
2. Keep browser bootstrap identities role-less; do not grant roles to anonymous or browser-generated users.
3. Upload a mini-program experience build that includes the `My` page Web Admin login scan-and-confirm action if the tester is not already on a V2-capable build.
4. Confirm or seed the first `super_admin` in the test environment.
5. Run real-device Web Admin QR smoke tests for `super_admin`, `admin`, `organizer`, and ordinary `user` boundaries.
6. Verify live Web Admin `listUsers`, `listActivities`, `updateUserRoles`, and `updateUserManagerAlias` calls after QR confirmation issues `webAdminSessionToken`.
7. Decide whether to deploy V2 into the current shared CloudBase environment or wait until V1 review/release risk is acceptable.
8. Run real-device mini-program smoke tests after any shared-environment deployment.

## 12. 2026-07-24 Statistics Loading Repair

The test Web Admin statistics page no longer starts two concurrent full statistics scans for one filter submission.

- implementation commit: `0d79ae9`
- API: `getAttendanceStats` accepts additive `statisticsType = both` and returns `projections.attendance` plus `projections.cancellation`, each with independent `{ items, total, limit, skip, hasMore }`.
- frontend: filter loading uses the combined response; later pagination and export continue to use typed projection calls.
- resilience: Web Admin restores the loading button after a 20-second statistics timeout and shows `统计请求超时，请重试。`.
- tests: `85` suites, `874` tests passed; `git diff --check` passed.
- cloud function: deployed to `cloudbase-miniapp-test-dfc753877`, remote `ModTime` `2026-07-24 18:27:11`.
- static hosting: deployed `29/29` files to `/admin/` with asset version `20260724-statistics-single-request`.
- live smoke: the previously affected `内战统计` load completed in about 6 seconds with `14` attendance rows; switching tabs immediately showed `17` cancellation rows.
- runtime boundary: no MySQL migration, dual-write, or self-hosted HTTP API switch.

## 13. 2026-07-24 Activity Detail Loading Repair

The activity detail no longer waits on table-wide activity-log enrichment reads without a bounded failure state.

- implementation commit: `9e26c65`
- backend: when `activityId` is present, `listActivityLogs` reads that activity directly, filters registrations and teams by `activityId`, and fetches only referenced user documents.
- frontend: activity-detail loading has a 20-second timeout; timeout state shows `活动详情加载超时，请重试。` and a retry action.
- tests: `85` suites, `875` tests passed; `git diff --check` passed.
- cloud function: deployed to `cloudbase-miniapp-test-dfc753877`, remote `ModTime` `2026-07-24 18:42:46`.
- static hosting: deployed `29/29` files to `/admin/` with asset version `20260724-activity-detail-timeout`.
- live smoke: `测试07221933` improved from about 29 seconds to about 4.9 seconds and rendered `3` roster rows plus `22` activity-log rows.
- runtime boundary: no MySQL migration, dual-write, or self-hosted HTTP API switch.
