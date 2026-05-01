# WeChat DevTools Setup

## Goal

Open the project directly in WeChat DevTools and manually exercise:

- create activity
- open activity detail
- join a team
- cancel signup
- inspect organizer stats through the service layer

## Current Development Mode

The project now supports two runtime modes:

1. `Local mock mode`
   This is the default mode for fast UI and flow testing in WeChat DevTools.
2. `CloudBase mode`
   Use this after you have a real WeChat mini program AppID and a CloudBase environment.

The default file is:

- `miniprogram/config/env.js`

Current default values:

- `USE_LOCAL_MOCK: true`
- `CLOUD_ENV_ID: ''`

## Open in WeChat DevTools

1. Open WeChat DevTools
2. Choose `Import Project`
3. Select the repository root:
   `D:/workspaces/football_signup_miniapp`
4. Keep the default project configuration from `project.config.json`
5. Open the simulator

The project includes:

- `project.config.json`
- `miniprogramRoot = miniprogram/`
- `cloudfunctionRoot = cloudfunctions/`
- the AppID configured in `project.config.json`

This is enough to open the project without wiring a real AppID on day one.

## Manual Test Flow in Local Mock Mode

Because `USE_LOCAL_MOCK` defaults to `true`, the mini program can run without a real cloud environment.

Recommended manual checks:

1. Open `Home`
2. Tap `Create Activity`
3. Enter:
   - title
   - address
   - description
   - total signup limit
4. Adjust team names and team limits
5. Tap `Publish Activity`
6. Confirm redirect to the activity detail page
7. Tap `Join` on a team
8. Enter a signup name in the signup sheet
9. Confirm that team counts increase
10. Tap `Cancel Signup`
11. Confirm that counts decrease again
12. Return to `Home` and `My` to verify lists update

## Switch to Real CloudBase Mode

When you are ready to use CloudBase:

1. Keep the repository default file `miniprogram/config/env.js` unchanged
2. Copy `miniprogram/config/env.local.js.example` to:
   - `miniprogram/config/env.local.js`
3. Update the local override file:

```javascript
module.exports = {
  USE_LOCAL_MOCK: false,
  CLOUD_ENV_ID: 'your-cloud-env-id',
  LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1'
};
```

4. Use your real mini program AppID in WeChat DevTools
   - keep that change local unless you intentionally want to share it with the repository
5. In WeChat DevTools, enable cloud development for the project
6. Run the shared helper copy before deploying functions:

```bash
npm run copy:cloud-shared
```

The copy step is required because CloudBase packages each cloud function directory independently. Shared server helpers from `cloudfunctions/_shared/` must exist inside each uploaded function directory.

7. Deploy the cloud functions under `cloudfunctions/`.

   In WeChat DevTools, right-click each cloud function folder and deploy it, or use the CLI for a one-shot deployment:

```powershell
$devtoolsCli = '<path-to-wechat-devtools>\cli.bat'
& $devtoolsCli cloud functions deploy `
  --env 'your-cloud-env-id' `
  --project 'D:\workspaces\football_signup_miniapp' `
  --remote-npm-install `
  --names ensureUserProfile listActivities getActivityDetail createActivity updateActivity joinActivity addProxyRegistration cancelRegistration removeRegistration moveRegistration cancelActivity deleteActivity getActivityStats `
  --lang zh
```

8. Confirm database collections exist:
   - `users`
   - `activities`
   - `activity_teams`
   - `registrations`
   - `activity_logs`

   `ensureUserProfile` attempts to create these collections on the first real CloudBase launch. You can still create them manually in the CloudBase console if you prefer a fully prepared environment before testing.

9. Add the indexes from:
   - `docs/cloudbase/indexes.md`
10. Apply database write restrictions based on:
   - `docs/cloudbase/security-rules.json`
11. Run the manual checklist from:
   - `docs/cloudbase/manual-smoke-checklist.md`

## WeChat Verification And Test Access

WeChat verification is an account-level process in the WeChat Official Accounts Platform. It does not require the mini program code to be complete, and it can be started during development.

Keep these platform rules in mind:

- Verification is separate from CloudBase deployment, code upload, code review, and filing/record registration.
- The current platform flow for this account showed a verification fee of RMB 30; always confirm the final fee on the WeChat Official Accounts Platform payment page.
- Some real-device capabilities, including sharing, may be blocked until WeChat verification is complete.
- Adding experience members lets selected users open the uploaded experience version, but it does not bypass verification-only restrictions.

Temporary testing flow before verification:

1. Add testers in the WeChat Official Accounts Platform under member or experience-member management.
2. Upload a build from WeChat DevTools.
3. In version management, set the uploaded build as the experience version.
4. Share the experience-version QR code with the added experience members.
5. Use this QR-code flow for testing until verification unlocks normal sharing.

## CloudBase Troubleshooting

- `FunctionName parameter could not be found`: deploy the missing cloud function.
- `Cannot find module './collections'` or another shared helper: run `npm run copy:cloud-shared`, then redeploy the affected cloud function.
- `database collection not exists`: create the required collection manually, or redeploy `ensureUserProfile` and let it bootstrap the collections.
- `document.set:fail ... invalid parameters ... _id`: do not include `_id` in the `data` object passed to `doc(id).set({ data })`.
- `Error: timeout` on first real-cloud launch: increase the `ensureUserProfile` cloud function timeout from the default 3 seconds to 20-60 seconds, or manually create the collections and retry.
- Sharing is blocked because the mini program is unverified: complete WeChat verification, or use experience-version QR codes for temporary tester access.

## Notes

- Local mock mode is only for UI and interaction testing
- Real multi-user tests should be verified again in CloudBase mode
- `project.private.config.json` is intentionally ignored so local DevTools preferences stay untracked
- `miniprogram/config/env.local.js` is intentionally ignored so local CloudBase wiring stays untracked
- Each cloud function directory has its own `package.json` for CloudBase remote npm install.
