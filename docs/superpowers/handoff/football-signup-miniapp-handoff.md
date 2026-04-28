# Football Signup Mini Program Handoff

- Date: 2026-04-27
- Branch: `main`
- Workspace: `D:/workspace/Nautilus`
- Remote: `origin` -> `git@github.com:zhss5/football_signup_miniapp.git`

## 1. Current State

The repository is on `main`.

`origin/main` is up to date through:

- `1c892b3` `Validate activity detail sharing`

The local branch has local documentation updates for WeChat verification notes.

The codebase supports:

- local mock mode in WeChat DevTools
- real CloudBase runtime switching via local-only `env.local.js`
- cloud function packages with per-function `package.json`
- shared cloud helper copying through `npm run copy:cloud-shared`
- cover image upload to CloudBase storage with persistent `fileID`
- automatic CloudBase collection bootstrap from `ensureUserProfile`
- organizer cancellation and soft delete
- dedicated activity creation, detail, signup, and `My` page flows
- multi-language UI support

## 2. CloudBase Deployment Status

All deployable cloud functions were deployed successfully to the configured CloudBase environment:

- `ensureUserProfile`
- `listActivities`
- `getActivityDetail`
- `createActivity`
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

## 4. Current Watch Item

The latest visible client-side issues were:

- `Error: timeout`
- sharing blocked on real devices because the mini program account is not verified

Most likely timeout cause:

- first real-cloud launch may spend more than the default 3 seconds creating database collections from `ensureUserProfile`

Recommended actions:

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
- Adding experience members allows selected users to open an experience version, but it does not bypass verification-only restrictions such as real-device sharing.
- Before verification is complete, use the experience-version QR code for tester access instead of relying on in-app sharing.

## 5. Local-Only State

The following local state should not be committed unless there is a deliberate decision:

- `D:/workspace/Nautilus/project.config.json`
- `D:/workspace/Nautilus/miniprogram/config/env.local.js`

Current git status includes:

- `project.config.json` modified locally and intentionally uncommitted

The local override file is ignored by git and should be recreated from:

- `D:/workspace/Nautilus/miniprogram/config/env.local.js.example`

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
  --project 'D:\workspace\Nautilus' `
  --remote-npm-install `
  --names ensureUserProfile listActivities getActivityDetail createActivity joinActivity cancelRegistration cancelActivity deleteActivity getActivityStats `
  --lang zh
```

Check one function:

```powershell
$devtoolsCli = '<path-to-wechat-devtools>\cli.bat'
& $devtoolsCli cloud functions info `
  --env 'your-cloud-env-id' `
  --project 'D:\workspace\Nautilus' `
  --names ensureUserProfile `
  --lang zh
```

## 7. Verification Snapshot

Latest verified command:

```bash
npm test
```

Latest result:

- `31` test suites passed
- `108` tests passed

The latest documentation-only updates are not test-relevant, but `git diff --check` passed for this handoff file.

## 8. Next Steps

Continue in this order:

1. Increase `ensureUserProfile` timeout in CloudBase if first launch still reports `Error: timeout`.
2. Confirm all five database collections exist.
3. Apply indexes from:
   - `D:/workspace/Nautilus/docs/cloudbase/indexes.md`
4. Apply database rules from:
   - `D:/workspace/Nautilus/docs/cloudbase/security-rules.json`
5. Run the smoke checklist on DevTools and a real device:
   - `D:/workspace/Nautilus/docs/cloudbase/manual-smoke-checklist.md`
6. Start WeChat verification in the WeChat Official Accounts Platform when the administrator account is available.
7. Add experience members and distribute the experience-version QR code for temporary tester access.
8. Push the local documentation commits if they should be shared:
   - `git push origin main`

## 9. Key Files To Read First

For the next session, these files are the fastest orientation points:

- `D:/workspace/Nautilus/README.md`
- `D:/workspace/Nautilus/miniprogram/services/cloud.js`
- `D:/workspace/Nautilus/miniprogram/config/env.js`
- `D:/workspace/Nautilus/cloudfunctions/ensureUserProfile/index.js`
- `D:/workspace/Nautilus/cloudfunctions/_shared/database.js`
- `D:/workspace/Nautilus/scripts/copy-cloud-shared.mjs`
- `D:/workspace/Nautilus/docs/cloudbase/real-cloudbase-rollout.md`
- `D:/workspace/Nautilus/docs/cloudbase/wechat-devtools-setup.md`

## 10. Important Notes

- Do not commit real CloudBase environment IDs, AppSecret values, tokens, or local `env.local.js` contents.
- The documented deployment commands use placeholders such as `your-cloud-env-id`.
- `project.config.json` is still modified locally and intentionally uncommitted.
- The repo's committed docs do not contain known secrets or tokens as of this handoff.
