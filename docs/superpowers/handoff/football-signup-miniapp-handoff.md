# Football Signup Mini Program Handoff

- Date: 2026-04-29
- Branch: `main`
- Workspace: `D:/workspaces/football_signup_miniapp`
- Remote: `origin` -> `git@github.com:zhss5/football_signup_miniapp.git`

## 1. Current State

The repository is on `main`.

`origin/main` may be behind the local branch. Push local commits when they are ready to share.

Recent local work includes role-gated activity creation, dynamic default activity dates, highlighted activity signup status, notification roadmap documentation, activity editing roadmap documentation, and the first organizer/admin activity editing implementation.

The codebase supports:

- local mock mode in WeChat DevTools
- real CloudBase runtime switching via local-only `env.local.js`
- cloud function packages with per-function `package.json`
- shared cloud helper copying through `npm run copy:cloud-shared`
- cover image upload to CloudBase storage with persistent `fileID`
- automatic CloudBase collection bootstrap from `ensureUserProfile`
- organizer cancellation and soft delete
- role-gated activity creation for `organizer` and `admin` users
- organizer/admin activity editing through the `updateActivity` cloud function
- copyable user ID on My page for manual CloudBase role grants
- highlighted activity signup status on activity cards
- dedicated activity creation, detail, signup, and `My` page flows
- multi-language UI support

## 2. CloudBase Deployment Status

All deployable cloud functions were deployed successfully to the configured CloudBase environment:

- `ensureUserProfile`
- `listActivities`
- `getActivityDetail`
- `createActivity`
- `updateActivity`
- `joinActivity`
- `cancelRegistration`
- `cancelActivity`
- `deleteActivity`
- `getActivityStats`

The last code deployment that changed runtime behavior was:

- `5587bf0` `Bootstrap CloudBase collections on startup`

`ensureUserProfile` was redeployed after that change and reported:

- `success: true`
- `filesCount: 8`
- runtime status: `Active`

The current CloudBase environment ID is intentionally not recorded in this handoff. It should stay in local configuration only.

## 3. Issues Fixed During Rollout

The following CloudBase rollout issues were fixed:

- Missing cloud functions caused `FunctionName parameter could not be found`.
- Shared helper imports failed because each cloud function package is uploaded independently.
- CloudBase deployment with nested `_shared` folders caused packaging problems, so shared helpers are now copied flat into each function package.
- `context.OPENID` was empty in some real CloudBase calls, so functions now resolve openid from the wx cloud context fallback.
- CloudBase rejected writes that included `_id` inside `doc(id).set({ data })`; `_id` is now used only as the document id.
- Cover images are uploaded to CloudBase storage before activity creation, so shared activity cards do not depend on temporary local file paths.
- Missing database collections are now bootstrapped by `ensureUserProfile`.

## 4. Current Watch Items

The latest visible client-side issues were:

- WeChat DevTools simulator may flicker when opening Activity Detail with the native `map` preview; real-device testing passed, so this is recorded as a non-blocking simulator issue.

Resolved/mitigated:

- WeChat verification has been completed, so real-device sharing should be validated through an uploaded experience version and experience members.
- the role-gated `createActivity` flow has been reported working in CloudBase after deployment
- local mock testing confirmed `organizer` can create activities and `user` cannot
- local automated tests cover organizer/admin `updateActivity`, edit-mode form loading, and capacity safeguards

If startup timeout appears again, recommended actions:

1. Recompile once and retry, because the first call may already have created some collections.
2. In CloudBase function settings, increase `ensureUserProfile` timeout from `3` seconds to `20-60` seconds.
3. Alternatively, create these collections manually in the CloudBase console:
   - `users`
   - `activities`
   - `activity_teams`
   - `registrations`
   - `activity_logs`

WeChat verification note:

- Verification can be completed during development; it does not require the code to be finished.
- Verification is separate from CloudBase deployment, code review, public release, and filing/record registration.
- The current platform flow for this account showed a verification fee of RMB 30; confirm the final fee on the WeChat Official Accounts Platform payment page before paying.
- Adding experience members allows selected users to open an experience version, but it does not bypass verification-only restrictions such as real-device sharing.
- Before verification is complete, use the experience-version QR code for tester access instead of relying on in-app sharing.

## 5. Local-Only State

The following local state should not be committed unless there is a deliberate decision:

- `D:/workspaces/football_signup_miniapp/project.config.json`
- `D:/workspaces/football_signup_miniapp/miniprogram/config/env.local.js`

Current git status includes:

- `project.config.json` modified locally and intentionally uncommitted
- `miniprogram/config/env.local.js.example` deleted locally and intentionally uncommitted
- `miniprogram/config/env.local.js.cloud` untracked locally and intentionally uncommitted

The local override file is ignored by git and should be recreated from:

- `D:/workspaces/football_signup_miniapp/miniprogram/config/env.local.js.example`

## 6. Deployment Commands

Before deploying cloud functions, always run:

```bash
npm run copy:cloud-shared
```

Deploy all cloud functions from PowerShell:

```powershell
$devtoolsCli = '<path-to-wechat-devtools>\cli.bat'
& $devtoolsCli cloud functions deploy `
  --env 'your-cloud-env-id' `
  --project 'D:\workspaces\football_signup_miniapp' `
  --remote-npm-install `
  --names ensureUserProfile listActivities getActivityDetail createActivity updateActivity joinActivity cancelRegistration cancelActivity deleteActivity getActivityStats `
  --lang zh
```

Check one function:

```powershell
$devtoolsCli = '<path-to-wechat-devtools>\cli.bat'
& $devtoolsCli cloud functions info `
  --env 'your-cloud-env-id' `
  --project 'D:\workspaces\football_signup_miniapp' `
  --names updateActivity `
  --lang zh
```

## 7. Verification Snapshot

Latest verified command:

```bash
npm test
```

Latest result:

- `37` test suites passed
- `144` tests passed

The latest verification includes the role-gated create flow, default-tomorrow activity dates, highlighted signup status view models, local mock behavior, `createActivity` authorization, and `updateActivity` organizer/admin editing behavior.

## 8. Next Steps

Continue in this order:

1. Confirm all five database collections exist.
2. Grant organizer access manually by editing the target `users.roles` array in CloudBase to include `organizer`.
3. Run `npm run copy:cloud-shared`, then deploy the new `updateActivity` cloud function.
4. Apply indexes from:
   - `D:/workspaces/football_signup_miniapp/docs/cloudbase/indexes.md`
5. Apply database rules from:
   - `D:/workspaces/football_signup_miniapp/docs/cloudbase/security-rules.json`
6. Run the smoke checklist on DevTools and a real device:
   - `D:/workspaces/football_signup_miniapp/docs/cloudbase/manual-smoke-checklist.md`
7. Start WeChat verification in the WeChat Official Accounts Platform when the administrator account is available.
8. Add experience members and distribute the experience-version QR code for temporary tester access.
9. Validate organizer/admin activity editing after CloudBase deployment.
10. Implement participant notification subscriptions first, then organizer-triggered notifications using:
   - `D:/workspaces/football_signup_miniapp/docs/superpowers/specs/2026-04-28-subscription-notifications-design.md`
   - first version keeps `status: published/cancelled/deleted`
   - first version adds `confirmStatus: pending/confirmed`
   - confirming an activity will proceed does not close signup
   - late joiners see the confirmed state in-app but do not receive the already-sent proceeding notification
11. Push local commits if they should be shared:
   - `git push origin main`

## 9. Key Files To Read First

For the next session, these files are the fastest orientation points:

- `D:/workspaces/football_signup_miniapp/README.md`
- `D:/workspaces/football_signup_miniapp/miniprogram/services/cloud.js`
- `D:/workspaces/football_signup_miniapp/miniprogram/services/activity-service.js`
- `D:/workspaces/football_signup_miniapp/miniprogram/pages/activity-create/index.js`
- `D:/workspaces/football_signup_miniapp/miniprogram/pages/activity-detail/index.js`
- `D:/workspaces/football_signup_miniapp/miniprogram/config/env.js`
- `D:/workspaces/football_signup_miniapp/cloudfunctions/ensureUserProfile/index.js`
- `D:/workspaces/football_signup_miniapp/cloudfunctions/createActivity/index.js`
- `D:/workspaces/football_signup_miniapp/cloudfunctions/updateActivity/index.js`
- `D:/workspaces/football_signup_miniapp/cloudfunctions/_shared/database.js`
- `D:/workspaces/football_signup_miniapp/cloudfunctions/_shared/roles.js`
- `D:/workspaces/football_signup_miniapp/miniprogram/utils/roles.js`
- `D:/workspaces/football_signup_miniapp/scripts/copy-cloud-shared.mjs`
- `D:/workspaces/football_signup_miniapp/docs/cloudbase/real-cloudbase-rollout.md`
- `D:/workspaces/football_signup_miniapp/docs/cloudbase/wechat-devtools-setup.md`
- `D:/workspaces/football_signup_miniapp/docs/superpowers/specs/2026-04-28-activity-editing-design.md`
- `D:/workspaces/football_signup_miniapp/docs/superpowers/specs/2026-04-28-subscription-notifications-design.md`

## 10. Important Notes

- Do not commit real CloudBase environment IDs, AppSecret values, tokens, or local `env.local.js` contents.
- The documented deployment commands use placeholders such as `your-cloud-env-id`.
- `project.config.json` is still modified locally and intentionally uncommitted.
- The repo's committed docs do not contain known secrets or tokens as of this handoff.
