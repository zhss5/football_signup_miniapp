# Football Signup Mini Program Handoff

- Date: 2026-04-26
- Branch: `main`
- Workspace: `D:/workspace/Nautilus`

## 1. Current State

The repository is on `main` and is already pushed to `origin/main` through commit `fb869d4`.

The codebase supports:

- local mock mode in WeChat DevTools
- real CloudBase runtime switching via local-only `env.local.js`
- dedicated join page flow
- organizer cancellation and soft delete
- multi-language UI support
- cover crop flow

## 2. Current Blocker

The mini program is no longer blocked on `wx.cloud` detection.

That runtime issue was fixed in:

- `fb869d4` `fix: detect CloudBase runtime in DevTools`

The current CloudBase-side blocker is:

- `FunctionName parameter could not be found`

This means the mini program can now reach CloudBase, but the cloud functions have not been deployed to the target environment yet.

The first failing function call is:

- `ensureUserProfile`

## 3. Local-Only State

These files are intentionally local-only and should not be committed unless there is a deliberate decision to share them:

- `D:/workspace/Nautilus/project.config.json`
- `D:/workspace/Nautilus/miniprogram/config/env.local.js`

The current workstation already has:

- a real mini program AppID configured in local DevTools
- a real CloudBase environment created
- `env.local.js` switched to `USE_LOCAL_MOCK: false`

The local override file is ignored by git and should be recreated from:

- `D:/workspace/Nautilus/miniprogram/config/env.local.js.example`

## 4. CloudBase Status

CloudBase has already been enabled for the mini program.

The next operational step is to deploy cloud functions from:

- `D:/workspace/Nautilus/cloudfunctions`

Before deployment, the shared helper copy command has already been introduced and should be run whenever cloud functions are prepared for upload:

```bash
npm run copy:cloud-shared
```

The `_shared` folder is not an independent cloud function. It is copied into each deployable function directory.

## 5. Next Steps

The next session should continue in this order:

1. Deploy `ensureUserProfile` from WeChat DevTools using cloud-side dependency installation
2. Recompile and confirm the error moves to the next undeployed function
3. Deploy the remaining functions:
   - `listActivities`
   - `getActivityDetail`
   - `createActivity`
   - `joinActivity`
   - `cancelRegistration`
   - `cancelActivity`
   - `deleteActivity`
   - `getActivityStats`
4. Create collections:
   - `users`
   - `activities`
   - `activity_teams`
   - `registrations`
   - `activity_logs`
5. Create indexes from:
   - `D:/workspace/Nautilus/docs/cloudbase/indexes.md`
6. Run the smoke checklist:
   - `D:/workspace/Nautilus/docs/cloudbase/manual-smoke-checklist.md`

## 6. Verification Snapshot

Latest verified command:

```bash
npm test -- --runInBand
```

Latest result:

- `29` test suites passed
- `73` tests passed

## 7. Key Files To Read First

For the next session, these files are the fastest orientation points:

- `D:/workspace/Nautilus/miniprogram/services/cloud.js`
- `D:/workspace/Nautilus/miniprogram/config/env.js`
- `D:/workspace/Nautilus/docs/cloudbase/real-cloudbase-rollout.md`
- `D:/workspace/Nautilus/docs/cloudbase/wechat-devtools-setup.md`
- `D:/workspace/Nautilus/docs/superpowers/progress/football-signup-miniapp-progress.md`

## 8. Important Notes

- `project.config.json` is still modified locally and intentionally uncommitted
- the repository remote is up to date as of this handoff
- the next work is operational CloudBase deployment, not product feature design
