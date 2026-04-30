# Real CloudBase Rollout Checklist

## Goal

Move the mini program from local mock mode to a real CloudBase environment without changing the repository default runtime.

## Preflight

Before switching the runtime:

1. Confirm you have a real WeChat mini program AppID
2. Confirm Cloud Development is enabled for that mini program
3. Confirm you know the target CloudBase environment ID
4. Confirm local mock flows already work in WeChat DevTools
5. Check WeChat account-level readiness:
   - WeChat verification can be completed while development is still in progress.
   - Verification is separate from code review and CloudBase deployment.
   - The current platform flow for this account showed a verification fee of RMB 30; always confirm the final fee on the WeChat Official Accounts Platform payment page.
   - Unverified mini programs may be blocked from using share features on real devices.
   - Experience members can test an uploaded experience version, but they do not bypass verification-only platform restrictions.
   - Filing/record registration is separate from WeChat verification and should be checked before public release.

## Local Configuration Switch

Keep the repository default file `miniprogram/config/env.js` unchanged.

Create a local-only override file:

1. Copy `miniprogram/config/env.local.js.example`
2. Save the copy as `miniprogram/config/env.local.js`
3. Fill in your real environment ID

```javascript
module.exports = {
  USE_LOCAL_MOCK: false,
  CLOUD_ENV_ID: 'your-cloud-env-id',
  LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1'
};
```

The runtime now enforces:

- `CLOUD_ENV_ID` must be present when `USE_LOCAL_MOCK` is `false`
- WeChat cloud capability must be available before cloud calls run

## WeChat DevTools Checklist

1. Import or reopen the project root: `D:/workspaces/football_signup_miniapp`
2. Switch the project to your real AppID locally in DevTools
3. Open the Cloud Development panel
4. Bind the same environment ID used in `env.local.js`

## Cloud Function Deployment

Each cloud function directory is deployed as an independent package. Keep these packaging rules in mind:

- Every cloud function directory must include its own `package.json` so CloudBase remote npm install can install `wx-server-sdk`.
- Shared server helpers live in `cloudfunctions/_shared/`, but CloudBase does not upload that folder as a global dependency for every function.
- Before deployment, copy the shared helpers into every function directory:

```bash
npm run copy:cloud-shared
```

The copy script removes stale per-function `_shared` folders and writes the shared helper files flat into each function package. The generated per-function helper files are ignored by git.

Then deploy all cloud functions under `cloudfunctions/`.

Recommended function set:

1. `ensureUserProfile`
2. `listActivities`
3. `getActivityDetail`
4. `createActivity`
5. `updateActivity`
6. `joinActivity`
7. `cancelRegistration`
8. `cancelActivity`
9. `deleteActivity`
10. `getActivityStats`

Use WeChat DevTools for manual deployment, or run the CLI deployment from PowerShell:

```powershell
$devtoolsCli = '<path-to-wechat-devtools>\cli.bat'
& $devtoolsCli cloud functions deploy `
  --env 'your-cloud-env-id' `
  --project 'D:\workspaces\football_signup_miniapp' `
  --remote-npm-install `
  --names ensureUserProfile listActivities getActivityDetail createActivity updateActivity joinActivity cancelRegistration cancelActivity deleteActivity getActivityStats `
  --lang zh
```

The deployment output should show `success: true` for each function.

## Database Setup

The runtime expects these collections:

- `users`
- `activities`
- `activity_teams`
- `registrations`
- `activity_logs`

`ensureUserProfile` attempts to create the collections during the first real CloudBase startup. For a predictable rollout, you may also create them manually in the CloudBase console before smoke testing.

Organizer access is controlled by `users.roles`:

- regular users keep `roles: ['user']`
- activity creators need `organizer` or `admin`
- for early operation, grant access manually in CloudBase by editing the target user document to include `organizer`
- the My page shows a copyable user ID so operators can identify the right `users` document

Create indexes from:

- `docs/cloudbase/indexes.md`

Apply the database rule baseline from:

- `docs/cloudbase/security-rules.json`

## Storage Permission Setup

Activity covers are stored under `activity-covers/` as CloudBase file IDs. Mini-program clients cannot render those files unless CloudBase storage rules allow client reads for that path.

Recommended storage rule:

```json
{
  "read": "/^activity-covers\\//.test(resource.path)",
  "write": "auth != null"
}
```

If the environment already has a stricter rule, merge the `activity-covers/` read condition into the existing `read` expression instead of overwriting unrelated permissions.

Notes:

- CloudBase console/server-side preview can still open files that mini-program clients cannot read.
- Storage permission changes can take 1-3 minutes to take effect.
- Expired free-trial environments can block permission changes until the environment is upgraded or renewed.

## Recommended Smoke Pass

After deployment, run these checks in DevTools and on a real device:

1. Open Home and confirm published activities load from CloudBase
2. Create an activity with:
   - date
   - start/end time
   - deadline
   - map location
   - cover image
3. Confirm both `activities` and `activity_teams` documents are created
4. Confirm the activity cover image is stored as a CloudBase `fileID`, not a temporary local path
5. Open the activity detail page and confirm the roster loads
6. Join a team from a second account
7. Confirm `registrations._id = activityId_openid`
8. Cancel the signup before the deadline
9. Confirm organizer cancel and soft delete rules still hold
10. Confirm a deleted activity disappears from Home and Joined, but remains in Created
11. Confirm sharing behavior:
   - If WeChat verification is complete, verify activity sharing on a real device.
   - If verification is not complete, expect WeChat to block sharing with a platform message.
   - For temporary testing, add testers as experience members and share the experience-version QR code instead of relying on in-app sharing.

## Failure Modes To Check First

If CloudBase mode fails, check these items first:

- `miniprogram/config/env.local.js` exists and exports the correct `CLOUD_ENV_ID`
- `USE_LOCAL_MOCK` is really `false`
- the DevTools project is using the intended AppID
- cloud functions were deployed after `npm run copy:cloud-shared`
- the target environment contains the required collections and indexes
- `FunctionName parameter could not be found`: deploy the missing cloud function.
- `Cannot find module './collections'`: shared helper files were not copied into the function package; run `npm run copy:cloud-shared`, then redeploy.
- `document.set:fail ... cannot update _id`: the cloud function is writing `_id` inside `doc(id).set({ data })`; redeploy the latest cloud functions.
- `database collection not exists`: create the missing collection manually or let `ensureUserProfile` bootstrap the required collections.
- `Error: timeout` during first launch: the first collection bootstrap may exceed the default 3-second function timeout. Increase `ensureUserProfile` to 20-60 seconds in CloudBase function settings, or create the collections manually and retry.
- Sharing is blocked with an unverified-account message: complete WeChat verification in the WeChat Official Accounts Platform. Adding experience members only grants access to the experience version; it does not replace verification.
- `STORAGE_EXCEED_AUTHORITY` when resolving an activity cover file ID: update CloudBase storage rules so mini-program clients can read `activity-covers/`. If the console says the free-trial package has expired, upgrade or renew the environment before changing permissions.

## Related Docs

- `docs/cloudbase/wechat-devtools-setup.md`
- `docs/cloudbase/manual-smoke-checklist.md`
- `docs/cloudbase/indexes.md`
- `docs/cloudbase/security-rules.json`
