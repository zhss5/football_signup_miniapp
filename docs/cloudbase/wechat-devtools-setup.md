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
   `D:/workspace/Nautilus/.worktrees/football-signup-mvp`
4. Keep the default project configuration from `project.config.json`
5. Open the simulator

The project includes:

- `project.config.json`
- `miniprogramRoot = miniprogram/`
- `cloudfunctionRoot = cloudfunctions/`
- `appid = touristappid`

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
   - optional phone requirement
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

1. Replace `touristappid` in `project.config.json` with your real mini program AppID
2. Update `miniprogram/config/env.js`

```javascript
module.exports = {
  USE_LOCAL_MOCK: false,
  CLOUD_ENV_ID: 'your-cloud-env-id',
  LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1'
};
```

3. In WeChat DevTools, enable cloud development for the project
4. Deploy the cloud functions under `cloudfunctions/`
5. Create database collections:
   - `users`
   - `activities`
   - `activity_teams`
   - `registrations`
   - `activity_logs`
6. Add the indexes from:
   - `docs/cloudbase/indexes.md`
7. Apply database write restrictions based on:
   - `docs/cloudbase/security-rules.json`

## Notes

- Local mock mode is only for UI and interaction testing
- Real multi-user tests should be verified again in CloudBase mode
- `project.private.config.json` is intentionally ignored so local DevTools preferences stay untracked
