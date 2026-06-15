# Football Signup Mini Program Handoff

- Date: 2026-06-15
- Branch: `codex/version-2-web-admin`
- Workspace: `D:/workspaces/football_signup_miniapp`
- Remote: `origin` -> `git@github.com:zhss5/football_signup_miniapp.git`
- Baseline commit before the Web Admin QR-login implementation: `66b12ff Add test web admin CloudBase runtime`
- Remote sync status before this handoff refresh: `origin/codex/version-2-web-admin...HEAD` = `0 0`

## 1. Current State

Version 2 implementation continues on `codex/version-2-web-admin`. Check the local branch status before rollout or pushing.

Version 2 adds:

- `super_admin`, `admin`, `organizer`, and regular `user` role boundaries.
- `listUsers` and `updateUserRoles` for role management.
- user role audit rows in `user_role_logs`.
- attendance mutation and date-range attendance statistics.
- roster export rows for CSV/XLSX generation on the client.
- manager aliases for real WeChat users, editable from both mini program and web admin through `updateParticipantManagerAlias`.
- participant operation history in `activity_logs`.
- activity duplication through a reusable setup draft API.
- `web-admin/` static admin UI for roles, activities, attendance, exports, and logs.
- Web Admin WeChat QR login that maps browser sessions back to real mini-program `OPENID` roles.
- Home/My pagination and overdue unresolved activity prompts.
- explicit SQL migration readiness documentation for a future MySQL 8.x and self-hosted server migration.
- explicit V2 CloudBase collection bootstrap through `bootstrapV2Collections` and `scripts/deploy-v2-bootstrap.ps1`.
- test-environment web-admin runtime initialization and CloudBase static hosting under `/admin`.

Version 2 still does not:

- run MySQL at runtime.
- dual-write CloudBase and MySQL.
- switch mini-program or web-admin traffic to a self-hosted HTTP API.
- migrate CloudBase data automatically.

## 2. Local Working Tree Notes

Current uncommitted local changes are intentionally left outside this handoff update:

- `miniprogram/config/env.local.js.example` deleted.
- `miniprogram/config/env.local.js.sample` untracked.
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

## 4. Cloud Function Deployment

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
  --names ensureUserProfile bootstrapV2Collections listActivities getActivityDetail createActivity updateActivity updateTeamColor joinActivity addProxyRegistration cancelRegistration removeRegistration moveRegistration setRegistrationAttendance getAttendanceStats exportActivityRoster updateParticipantManagerAlias listActivityLogs getActivityCopyDraft listUsers updateUserRoles listNotificationLogs createWebAdminLogin confirmWebAdminLogin pollWebAdminLogin recordNotificationSubscription notifyActivityParticipants cancelActivity deleteActivity getActivityStats `
  --lang zh
```

V2 changed some V1-existing cloud functions. If review, trial, and release builds share the same `CLOUD_ENV_ID`, deploying changed functions affects all builds that call that environment.

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

Do not grant roles to browser-generated `web_xxx` users. Roles remain attached to real `users/{OPENID}` documents.

Test environment hosting:

- CloudBase env: `cloudbase-miniapp-test-dfc753877`.
- Static hosting path: `/admin/`.
- Hosted URL: `https://cloudbase-miniapp-test-dfc753877-1424891512.tcloudbaseapp.com/admin/`.
- Test runtime config: `web-admin/config.test.js`.
- Runtime adapter: `web-admin/src/cloudbase-runtime.js`.
- The test entry does not hardcode the production CloudBase environment ID.
- Local static assets use `?v=20260612-runtime` query strings to avoid stale CloudBase static hosting/CDN scripts after redeploy.

Current hosted smoke status:

- CloudBase static hosting is online and `/admin/` returns HTTP `200`.
- `tcb hosting deploy web-admin /admin` uploaded `11` files successfully.
- the hosted entry loads the CloudBase Web SDK from `https://static.cloudbase.net/cloudbase-js-sdk/latest/cloudbase.full.js`.
- the hosted entry loads test runtime assets with `?v=20260612-runtime` cache-busting query strings.
- Browser smoke reaches the `Football Signup Admin` page after the CloudBase test-domain risk prompt.
- Previous anonymous Web SDK login was rejected as the long-term identity model because it created browser-scoped identities.
- The current target is the mini-program QR bridge described above.

Next Web Admin runtime step:

- deploy the QR login cloud functions and `web_admin_sessions` collection.
- redeploy `web-admin/` static hosting.
- upload a mini-program experience build with the `My` page Web Admin login action.
- smoke test: Web Admin displays QR, mini program organizer scans and confirms, Web Admin loads the activity workspace.

Current web-admin capabilities:

- identity loading through `ensureUserProfile`.
- user search through `listUsers`.
- role mutation through `updateUserRoles`.
- activity list filtering through `listActivities`.
- activity detail through `getActivityDetail`.
- manager alias edit through `updateParticipantManagerAlias`.
- attendance edit through `setRegistrationAttendance`.
- attendance statistics through `getAttendanceStats`.
- roster export through `exportActivityRoster`, with CSV generated in the browser.
- activity operation logs through `listActivityLogs`.
- notification logs through `listNotificationLogs`.

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

## 8. Verification Snapshot

Latest verification before this handoff refresh:

```bash
npm test
```

Result:

- `77` test suites passed.
- `587` tests passed.

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

1. Choose the intended Web Admin login source for the test CloudBase environment.
2. Enable that CloudBase Web identity source, or replace the current anonymous-login test runtime with the chosen account/custom login flow.
3. Verify whether Web SDK calls to `ensureUserProfile` can resolve an admin identity. If they still require mini-program `OPENID`, implement a dedicated web-admin identity bridge instead of weakening mini-program auth.
4. Confirm or seed the first `super_admin` in the test environment.
5. Run web-admin smoke tests for `super_admin`, `admin`, `organizer`, and ordinary `user` boundaries.
6. Decide whether to deploy V2 into the current shared CloudBase environment or wait until V1 review/release risk is acceptable.
7. Run real-device mini-program smoke tests after any shared-environment deployment.
