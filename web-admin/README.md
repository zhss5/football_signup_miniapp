# Football Signup Web Admin

Version 2 web-admin foundation for operational role and activity management.

## Runtime Boundary

- Static frontend only; no runtime MySQL and no self-hosted HTTP API in V2.
- Uses a CloudBase-compatible `callFunction` adapter.
- Test hosting uses `web-admin/config.test.js` and `web-admin/src/cloudbase-runtime.js` to initialize the CloudBase Web SDK.
- The test runtime targets `cloudbase-miniapp-test-dfc753877`.
- Backend cloud functions remain the authority for permissions, mutations, and audit logs.

Current API calls include:

- `ensureUserProfile`
- `listUsers`
- `updateUserRoles`
- `listActivities`
- `getActivityDetail`
- `notifyActivityParticipants`
- `setRegistrationAttendance`
- `updateParticipantManagerAlias`
- `updateUserManagerAlias`
- `getAttendanceStats`
- `exportActivityRoster`
- `listActivityLogs`
- `listNotificationLogs`

## Local Preview

```powershell
cd web-admin
npm run preview
```

Then open `http://localhost:4173`.

The static preview can render the shell, but cloud-function calls require a configured CloudBase web runtime or an injected `window.cloudbaseApp.callFunction` adapter.

## Test Hosting

```powershell
npx -y -p @cloudbase/cli@3.5.6 tcb -e cloudbase-miniapp-test-dfc753877 hosting deploy web-admin /admin
```

Hosted test entry:

- `https://cloudbase-miniapp-test-dfc753877-1424891512.tcloudbaseapp.com/admin/`

Known current blocker:

- CloudBase Web SDK loads, but call-function smoke is blocked until the test environment has an enabled Web Admin login source.
- The current test runtime attempts anonymous login; CloudBase console must enable anonymous login, or the runtime must be switched to the chosen account/custom login flow.
- After Web credentials exist, verify whether the existing `ensureUserProfile` mini-program `OPENID` contract needs a dedicated web-admin identity bridge.
