# Real CloudBase Rollout Checklist

## Goal

Move the mini program from local mock mode to a real CloudBase environment without changing the repository default runtime.

## Preflight

Before switching the runtime:

1. Confirm you have a real WeChat mini program AppID
2. Confirm Cloud Development is enabled for that mini program
3. Confirm you know the target CloudBase environment ID
4. Confirm local mock flows already work in WeChat DevTools

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

1. Import or reopen the project root: `D:/workspace/Nautilus`
2. Switch the project to your real AppID locally in DevTools
3. Open the Cloud Development panel
4. Bind the same environment ID used in `env.local.js`

## Cloud Function Deployment

Before deploying cloud functions, copy the shared helper folder into every function directory:

```bash
npm run copy:cloud-shared
```

Then deploy all cloud functions under `cloudfunctions/`.

Recommended deployment order:

1. `ensureUserProfile`
2. `listActivities`
3. `getActivityDetail`
4. `createActivity`
5. `joinActivity`
6. `cancelRegistration`
7. `cancelActivity`
8. `deleteActivity`
9. `getActivityStats`

## Database Setup

Create these collections:

- `users`
- `activities`
- `activity_teams`
- `registrations`
- `activity_logs`

Create indexes from:

- `docs/cloudbase/indexes.md`

Apply the database rule baseline from:

- `docs/cloudbase/security-rules.json`

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
4. Open the activity detail page and confirm the roster loads
5. Join a team from a second account
6. Confirm `registrations._id = activityId_openid`
7. Cancel the signup before the deadline
8. Confirm organizer cancel and soft delete rules still hold
9. Confirm a deleted activity disappears from Home and Joined, but remains in Created

## Failure Modes To Check First

If CloudBase mode fails, check these items first:

- `miniprogram/config/env.local.js` exists and exports the correct `CLOUD_ENV_ID`
- `USE_LOCAL_MOCK` is really `false`
- the DevTools project is using the intended AppID
- cloud functions were deployed after `npm run copy:cloud-shared`
- the target environment contains the required collections and indexes

## Related Docs

- `docs/cloudbase/wechat-devtools-setup.md`
- `docs/cloudbase/manual-smoke-checklist.md`
- `docs/cloudbase/indexes.md`
- `docs/cloudbase/security-rules.json`
