# Football Signup Web Admin

Version 2 web-admin foundation for operational role management.

## Runtime Boundary

- Static frontend only; no runtime MySQL and no self-hosted HTTP API in V2.
- Uses a CloudBase-compatible `callFunction` adapter.
- Current API calls are `ensureUserProfile`, `listUsers`, and `updateUserRoles`.
- Backend cloud functions remain the authority for role permissions and audit logs.

## Local Preview

```powershell
cd web-admin
npm run preview
```

Then open `http://localhost:4173`.

The static preview can render the shell, but cloud-function calls require a configured CloudBase web runtime or an injected `window.cloudbaseApp.callFunction` adapter.
