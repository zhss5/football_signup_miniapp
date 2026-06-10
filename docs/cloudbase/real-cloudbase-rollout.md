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
  LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1',
  SUBSCRIBE_MESSAGE_TEMPLATE_IDS: {
    activityNotice: 'your-activity-confirm-cancel-template-id',
    managerRegistrationNotice: 'your-manager-signup-change-template-id'
  }
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

For Version 2 rollout on an existing Version 1 environment, run the explicit bootstrap before the main smoke pass:

```powershell
npm install -g @cloudbase/cli
tcb login
npm run deploy:v2-bootstrap -- -EnvId 'your-cloud-env-id'
```

This command deploys and invokes `bootstrapV2Collections` once. The cloud function only creates missing Version 2 readiness collections:

- `activity_logs`
- `user_role_logs`
- `notification_logs`
- `notification_subscriptions`

It does not delete, clear, or recreate existing Version 1 collections. Use `-DeployOnly` if the function should be uploaded first and invoked manually from the CloudBase console.

Recommended function set:

1. `ensureUserProfile`
2. `bootstrapV2Collections`
3. `listActivities`
4. `getActivityDetail`
5. `createActivity`
6. `updateActivity`
7. `updateTeamColor`
8. `joinActivity`
9. `addProxyRegistration`
10. `cancelRegistration`
11. `removeRegistration`
12. `moveRegistration`
13. `setRegistrationAttendance`
14. `getAttendanceStats`
15. `exportActivityRoster`
16. `updateParticipantManagerAlias`
17. `listActivityLogs`
18. `getActivityCopyDraft`
19. `listUsers`
20. `updateUserRoles`
21. `listNotificationLogs`
22. `recordNotificationSubscription`
23. `notifyActivityParticipants`
24. `cancelActivity`
25. `deleteActivity`
26. `getActivityStats`

Legacy note:

- `resolvePhoneNumber` still exists in the repository, but the active signup flow no longer calls it because participant phone collection has been removed.
- The service/local-mock adapters are intentionally retained as a dormant extension point.
- Do not include `resolvePhoneNumber` in the normal deployment set unless a future feature deliberately re-enables phone authorization.

Use WeChat DevTools for manual deployment, or run the CLI deployment from PowerShell:

```powershell
$devtoolsCli = '<path-to-wechat-devtools>\cli.bat'
& $devtoolsCli cloud functions deploy `
  --env 'your-cloud-env-id' `
  --project 'D:\workspaces\football_signup_miniapp' `
  --remote-npm-install `
  --names ensureUserProfile bootstrapV2Collections listActivities getActivityDetail createActivity updateActivity updateTeamColor joinActivity addProxyRegistration cancelRegistration removeRegistration moveRegistration setRegistrationAttendance getAttendanceStats exportActivityRoster updateParticipantManagerAlias listActivityLogs getActivityCopyDraft listUsers updateUserRoles listNotificationLogs recordNotificationSubscription notifyActivityParticipants cancelActivity deleteActivity getActivityStats `
  --lang zh
```

The deployment output should show `success: true` for each function.

Current deployment notes:

- Deploy `listActivities` for the preview-build first-batch performance fix. The mini program already sends `limit: 20`, so this cloud-function deployment is enough for the first-batch speedup.
- `createActivity`, `updateActivity`, and `updateTeamColor` must be deployed together after running `npm run copy:cloud-shared`; they share the ten-color team palette: green, white, red, blue, black, yellow, orange, purple, gray, and pink.
- The mini program now crops and displays activity covers in a shared `5:4` frame so the same image works for Home, Activity Detail, thumbnails, and WeChat share cards.
- Notification configuration uses two template IDs: `activityNotice` for participant proceeding/cancellation notices, and `managerRegistrationNotice` for organizer/admin signup-change notices.

## Subscription Template Verification

Before trusting an uploaded experience build, verify both subscription templates from the real mini program runtime instead of only checking local config.

Participant proceeding/cancellation notices:

- the frontend requests `SUBSCRIBE_MESSAGE_TEMPLATE_IDS.activityNotice`
- cloud sends use `templateKey: activity_notice`
- `notification_logs.notificationType` should be `proceeding` or `cancelled`

Organizer/admin signup-change notices:

- the Activity Detail manager action requests `SUBSCRIBE_MESSAGE_TEMPLATE_IDS.managerRegistrationNotice`
- cloud sends use `templateKey: manager_registration_notice`
- `notification_logs.notificationType` should be `registration_joined`
- activity documents store `registrationNoticeThreshold`; regular participant self-join sends only when the post-join total reaches that threshold
- participant self-cancel, organizer/admin removal, and organizer/admin proxy signup do not send manager signup-change notices

Real-device verification steps:

1. Open the uploaded experience build as the activity organizer or an admin.
2. Tap the signup-notification subscribe action on Activity Detail.
3. Confirm the WeChat consent prompt shows the manager signup-change template, not the participant activity confirmation/cancellation template.
4. In CloudBase, inspect `notification_subscriptions` for the current activity and manager user. The row should use `templateKey: manager_registration_notice` and a `templateId` matching the local-only `SUBSCRIBE_MESSAGE_TEMPLATE_IDS.managerRegistrationNotice` value.
5. Have regular participants join until the post-join total reaches the activity's `registrationNoticeThreshold`.
6. Inspect `notification_logs`; the manager notification row should use `templateKey: manager_registration_notice`, `notificationType: registration_joined`, and the same manager template ID.
7. Have a regular participant cancel their signup and confirm no new manager signup-change row is created.

Do not commit real template IDs. Keep them in `miniprogram/config/env.local.js` or other local/secret deployment configuration only.

If an organizer previously subscribed with the wrong template, deploy the latest `getActivityDetail`, upload the latest mini program frontend build, then have that organizer tap the signup-notification subscribe action again. The current frontend re-enables the action when the stored manager subscription template ID does not match the configured manager template ID.

## Database Setup

The runtime expects these collections:

- `users`
- `activities`
- `activity_teams`
- `registrations`
- `activity_logs`
- `user_role_logs`
- `notification_logs`
- `notification_subscriptions`

`ensureUserProfile` attempts to create baseline collections during the first real CloudBase startup. Existing Version 1 environments usually already have `users`, so `ensureUserProfile` will not necessarily run the full bootstrap path again. For Version 2, run `bootstrapV2Collections` or create the missing Version 2 collections manually before smoke testing.

Organizer access is controlled by `users.roles`:

- regular users keep `roles: ['user']`
- activity creators need `organizer` or `admin`
- for early operation, grant access manually in CloudBase by editing the target user document to include `organizer`
- the My page shows a copyable user ID so operators can identify the right `users` document

Create indexes from:

- `docs/cloudbase/indexes.md`

The first-batch list performance fix expects these indexes to exist before activity volume grows:

- `activities`: `status + startAt`
- `activities`: `organizerOpenId + startAt`
- `registrations`: `userOpenId + status`

Apply the database rule baseline from:

- `docs/cloudbase/security-rules.json`

## Storage Permission Setup

Activity covers are stored under `activity-covers/`, generated thumbnails are stored under `activity-cover-thumbs/`, share-card-safe images are stored under `activity-share-images/`, and activity detail gallery images are stored under `activity-detail-images/` as CloudBase file IDs. Mini-program clients cannot render those files unless CloudBase storage rules allow client reads for those paths.

Database permissions and storage permissions are intentionally different:

- Database collections can stay restricted, for example `creator-only read/write`, because the mini program reads business data through cloud functions such as `listActivities` and `getActivityDetail`.
- Cloud storage must allow client reads for activity cover paths because the image rendering path resolves a file ID into a temporary HTTPS URL and the mini program `<image>` component loads that URL directly.
- If storage read is blocked, activities can still load from the database while covers fail with `403` or `STORAGE_EXCEED_AUTHORITY`.

Recommended storage rule:

```json
{
  "read": "/^activity-covers\\//.test(resource.path) || /^activity-cover-thumbs\\//.test(resource.path) || /^activity-share-images\\//.test(resource.path) || /^activity-detail-images\\//.test(resource.path)",
  "write": "auth != null"
}
```

If the environment already has a stricter rule, merge the `activity-covers/`, `activity-cover-thumbs/`, `activity-share-images/`, and `activity-detail-images/` read conditions into the existing `read` expression instead of overwriting unrelated permissions.

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
5. Confirm the activity record also has `coverThumbImage` and `shareImage` for newly uploaded covers
6. Open the activity detail page and confirm the roster loads
7. Join a team from a second account
8. Confirm the join page does not show phone input or WeChat phone authorization
9. Confirm `registrations._id = activityId_openid`
10. Confirm normal signup records created from the current UI do not contain `phoneSnapshot`
11. Cancel the signup before the deadline
12. Confirm organizer cancel and soft delete rules still hold
13. Confirm a deleted activity disappears from Home and Joined, but remains in Created
14. Confirm sharing behavior:
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
- `STORAGE_EXCEED_AUTHORITY` when resolving an activity cover, thumbnail, share image, or detail image file ID: update CloudBase storage rules so mini-program clients can read `activity-covers/`, `activity-cover-thumbs/`, `activity-share-images/`, and `activity-detail-images/`. If the console says the free-trial package has expired, upgrade or renew the environment before changing permissions.

## Related Docs

- `docs/cloudbase/wechat-devtools-setup.md`
- `docs/cloudbase/manual-smoke-checklist.md`
- `docs/cloudbase/indexes.md`
- `docs/cloudbase/security-rules.json`
