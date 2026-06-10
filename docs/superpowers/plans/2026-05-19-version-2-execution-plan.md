# Version 2 Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Version 2 operations release: role-managed web admin, attendance management, attendance statistics, roster export, and the minimum mini-program attendance editing surface.

**Architecture:** Keep CloudBase document database and existing cloud-function style. Add role and attendance backend capabilities first, then add mini-program attendance editing, then add a standalone `web-admin/` frontend that talks to controlled cloud functions. Keep each milestone shippable and independently testable. The project currently uses a single CloudBase environment; Version 2 testing must avoid disrupting the formal mini-program build and any build under review.

**Tech Stack:** WeChat Mini Program, CloudBase cloud functions, CloudBase document database, Jest, lightweight web-admin frontend under `web-admin/`.

---

## Scope Boundary

This plan covers V2.0 only:

- role model with `super_admin`.
- regular-user permission add/remove workflow.
- shared participant manager aliases editable from both the mini-program manager roster surface and the web admin, plus participant operation audit history.
- activity duplication for creating new activities from previous reusable settings.
- attendance fields and backend mutation.
- mini-program quick attendance editing after confirmed activities.
- web-admin foundation, user role management, activity review, attendance management, statistics, and exports.
- notification-log review.
- Home/My paginated loading and overdue unresolved activity prompts.
- SQL migration readiness documentation for a later self-hosted backend.

This plan excludes invite-code signup, automatic reminders, payments, refunds, runtime MySQL migration, full account-password login, and player technical analysis.

## File Map

- `cloudfunctions/_shared/roles.js`: canonical server-side role checks.
- `miniprogram/utils/roles.js`: client-side role display and UI checks.
- `cloudfunctions/_shared/collections.js`: add any new audit-log collection names.
- `cloudfunctions/ensureUserProfile/index.js`: keep new users on base `user` role.
- `cloudfunctions/listUsers/index.js`: new web-admin user search API.
- `cloudfunctions/updateUserRoles/index.js`: new role mutation API.
- `cloudfunctions/updateParticipantManagerAlias/index.js`: new manager-alias mutation API for real WeChat signup users.
- `cloudfunctions/listActivityLogs/index.js`: new activity operation history API for web-admin review.
- `cloudfunctions/setRegistrationAttendance/index.js`: new attendance mutation API.
- `cloudfunctions/getAttendanceStats/index.js`: new attendance statistics API.
- `cloudfunctions/exportActivityRoster/index.js`: new export-data API returning CSV/XLSX-ready rows.
- `cloudfunctions/listNotificationLogs/index.js`: new notification-log review API.
- `cloudfunctions/listActivities/index.js`: add role-aware admin filters for web-admin use without breaking mini-program scopes.
- `cloudfunctions/getActivityDetail/index.js`: expose attendance state and manager permissions.
- `miniprogram/pages/activity-detail/*`: add quick attendance editing for confirmed activities and manager-alias editing for roster managers.
- `miniprogram/pages/activity-create/*`: support copy-from-existing draft initialization.
- `miniprogram/pages/home/*`: add paginated loading and keep first page responsive.
- `miniprogram/pages/my/*`: add paginated loading for Created and Joined tabs.
- `web-admin/`: new web-admin frontend subproject, including manager-alias editing in activity or participant views.
- `tests/cloudfunctions/*.test.js`: backend red/green coverage.
- `tests/miniprogram/pages/*.test.js`: mini-program page behavior coverage.
- `tests/web-admin/*.test.js`: web-admin UI/service behavior coverage when the web-admin test harness exists.
- `docs/development-log-v2.md`: Version 2 development log.
- `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`: Version 2 progress tracker.
- `docs/superpowers/specs/2026-06-10-sql-migration-readiness.md`: target SQL schema, CloudBase-to-SQL mapping, compatibility rules, and migration validation checklist.

## Milestone 1: Shared Role Model And Role APIs

### Task 1: Extend Shared Role Helpers

**Files:**

- Modify: `cloudfunctions/_shared/roles.js`
- Modify: `miniprogram/utils/roles.js`
- Test: `tests/cloudfunctions/roles.test.js`
- Test: `tests/miniprogram/utils/roles.test.js`

- [ ] **Step 1: Write failing server role tests**

Create `tests/cloudfunctions/roles.test.js`:

```js
const {
  canCreateActivity,
  canEditActivity,
  canManageOrganizerRole,
  canManageAdminRole,
  getRoles,
  hasRole,
  isAdmin,
  isSuperAdmin,
  normalizeRoles
} = require('../../cloudfunctions/_shared/roles');

test('normalizeRoles always keeps base user and removes duplicates', () => {
  expect(normalizeRoles(['organizer', 'user', 'organizer'])).toEqual(['user', 'organizer']);
});

test('super_admin can create and edit activities like admin', () => {
  const user = { roles: ['user', 'super_admin'] };
  expect(canCreateActivity(user)).toBe(true);
  expect(canEditActivity({ organizerOpenId: 'openid_other' }, user, 'openid_root')).toBe(true);
});

test('admin and super_admin role management boundaries are explicit', () => {
  expect(canManageOrganizerRole({ roles: ['admin'] })).toBe(true);
  expect(canManageAdminRole({ roles: ['admin'] })).toBe(false);
  expect(canManageOrganizerRole({ roles: ['super_admin'] })).toBe(true);
  expect(canManageAdminRole({ roles: ['super_admin'] })).toBe(true);
  expect(isAdmin({ roles: ['admin'] })).toBe(true);
  expect(isSuperAdmin({ roles: ['super_admin'] })).toBe(true);
  expect(hasRole({ roles: ['user'] }, 'admin')).toBe(false);
  expect(getRoles({ roles: ['user'] })).toEqual(['user']);
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/cloudfunctions/roles.test.js
```

Expected: fail because `normalizeRoles`, `hasRole`, `isAdmin`, `isSuperAdmin`, `canManageOrganizerRole`, and `canManageAdminRole` do not exist yet.

- [ ] **Step 3: Implement server role helpers**

Update `cloudfunctions/_shared/roles.js` with these exported helpers:

```js
const ROLE_ORDER = ['user', 'organizer', 'admin', 'super_admin'];

function normalizeRoles(roles) {
  const input = Array.isArray(roles) ? roles : [];
  const unique = new Set(input.filter(role => ROLE_ORDER.includes(role)));
  unique.add('user');
  return ROLE_ORDER.filter(role => unique.has(role));
}

function getRoles(user) {
  if (Array.isArray(user)) {
    return normalizeRoles(user);
  }

  if (user && Array.isArray(user.roles)) {
    return normalizeRoles(user.roles);
  }

  return ['user'];
}

function hasRole(user, role) {
  return getRoles(user).includes(role);
}

function isSuperAdmin(user) {
  return hasRole(user, 'super_admin');
}

function isAdmin(user) {
  return hasRole(user, 'admin') || isSuperAdmin(user);
}

function canCreateActivity(user) {
  return hasRole(user, 'organizer') || isAdmin(user);
}

function canEditActivity(activity, user, openid) {
  if (isAdmin(user)) {
    return true;
  }

  return Boolean(activity && activity.organizerOpenId && activity.organizerOpenId === openid);
}

function canManageOrganizerRole(user) {
  return isAdmin(user);
}

function canManageAdminRole(user) {
  return isSuperAdmin(user);
}
```

- [ ] **Step 4: Mirror client role helper behavior**

Add matching display-safe helpers in `miniprogram/utils/roles.js`, keeping existing public functions compatible.

- [ ] **Step 5: Run target tests**

Run:

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/cloudfunctions/roles.test.js tests/miniprogram/utils/roles.test.js
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add -- cloudfunctions/_shared/roles.js miniprogram/utils/roles.js tests/cloudfunctions/roles.test.js tests/miniprogram/utils/roles.test.js
git commit -m "Add version 2 role helpers"
```

### Task 2: Add User Search And Role Mutation Cloud Functions

**Files:**

- Modify: `cloudfunctions/_shared/collections.js`
- Create: `cloudfunctions/listUsers/index.js`
- Create: `cloudfunctions/listUsers/package.json`
- Create: `cloudfunctions/updateUserRoles/index.js`
- Create: `cloudfunctions/updateUserRoles/package.json`
- Test: `tests/cloudfunctions/listUsers.test.js`
- Test: `tests/cloudfunctions/updateUserRoles.test.js`
- Modify: `docs/development-log-v2.md`
- Modify: `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`

- [ ] **Step 1: Write failing `listUsers` tests**

Cover these cases:

```js
test('listUsers rejects regular users', async () => {});
test('listUsers lets admin search users by keyword and role', async () => {});
test('listUsers lets organizer access get rejected', async () => {});
```

Expected API:

```js
await listUsers.main(
  { keyword: 'zhang', role: 'organizer', limit: 20, skip: 0 },
  { OPENID: 'openid_admin' },
  { db: fakeDb }
);
```

Expected response:

```js
{
  items: [
    {
      _id: 'openid_target',
      preferredName: 'Zhang',
      avatarUrl: '',
      roles: ['user', 'organizer'],
      createdAt: '2026-05-01T00:00:00.000Z',
      lastActiveAt: '2026-05-19T00:00:00.000Z'
    }
  ],
  hasMore: false
}
```

- [ ] **Step 2: Write failing `updateUserRoles` tests**

Cover these cases:

```js
test('super_admin can grant admin to a regular user', async () => {});
test('admin can grant organizer but cannot grant admin', async () => {});
test('role removal keeps base user role', async () => {});
test('cannot remove the last super_admin', async () => {});
test('role changes write an audit log', async () => {});
```

Expected API:

```js
await updateUserRoles.main(
  { targetOpenId: 'openid_target', roles: ['user', 'organizer'] },
  { OPENID: 'openid_root' },
  { db: fakeDb, now: () => new Date('2026-05-19T00:00:00.000Z') }
);
```

- [ ] **Step 3: Run failing tests**

Run:

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/cloudfunctions/listUsers.test.js tests/cloudfunctions/updateUserRoles.test.js
```

Expected: fail because cloud functions do not exist.

- [ ] **Step 4: Add audit collection name**

Update `cloudfunctions/_shared/collections.js`:

```js
USER_ROLE_LOGS: 'user_role_logs'
```

- [ ] **Step 5: Implement `listUsers`**

Rules:

- Caller must be `admin` or `super_admin`.
- `organizer` and `user` are rejected.
- Support `keyword`, `role`, `limit`, and `skip`.
- Cap `limit` at 50.
- Return safe user fields only.

- [ ] **Step 6: Implement `updateUserRoles`**

Rules:

- Caller must be `admin` or `super_admin`.
- `super_admin` can change `admin` and `organizer`.
- `admin` can change only `organizer`.
- Always normalize target roles with base `user`.
- Do not remove or downgrade the last active `super_admin`.
- Write audit log to `user_role_logs`.

- [ ] **Step 7: Run target tests**

Run:

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/cloudfunctions/listUsers.test.js tests/cloudfunctions/updateUserRoles.test.js
```

Expected: pass.

- [ ] **Step 8: Update V2 docs**

Append a short entry to `docs/development-log-v2.md` and mark role-management backend progress in `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`.

- [ ] **Step 9: Commit**

```powershell
git add -- cloudfunctions/_shared/collections.js cloudfunctions/listUsers cloudfunctions/updateUserRoles tests/cloudfunctions/listUsers.test.js tests/cloudfunctions/updateUserRoles.test.js docs/development-log-v2.md docs/superpowers/progress/football-signup-miniapp-v2-progress.md
git commit -m "Add version 2 user role management APIs"
```

## Milestone 2: Attendance Backend And Mini-Program Editing

### Task 3: Add Attendance Mutation API

**Files:**

- Create: `cloudfunctions/setRegistrationAttendance/index.js`
- Create: `cloudfunctions/setRegistrationAttendance/package.json`
- Modify: `cloudfunctions/getActivityDetail/index.js`
- Test: `tests/cloudfunctions/setRegistrationAttendance.test.js`
- Test: `tests/cloudfunctions/getActivityDetail.test.js`

- [ ] **Step 1: Write failing attendance mutation tests**

Cover:

```js
test('organizer can mark an active registration absent on a confirmed activity', async () => {});
test('admin can mark attendance on another organizer activity', async () => {});
test('regular user cannot mark attendance', async () => {});
test('attendance cannot be changed before the activity is confirmed', async () => {});
test('attendance status only accepts present or absent', async () => {});
```

Expected API:

```js
await setRegistrationAttendance.main(
  {
    activityId: 'activity_1',
    registrationId: 'registration_1',
    attendanceStatus: 'absent'
  },
  { OPENID: 'openid_owner' },
  { db: fakeDb, now: () => new Date('2026-05-19T10:00:00.000Z') }
);
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/cloudfunctions/setRegistrationAttendance.test.js
```

Expected: fail because the function does not exist.

- [ ] **Step 3: Implement `setRegistrationAttendance`**

Rules:

- Load caller user, activity, and registration.
- Require `canEditActivity(activity, user, openid)`.
- Require `activity.confirmStatus === 'confirmed'`.
- Require registration belongs to the activity and has active status.
- Accept only `present` or `absent`.
- Update `attendanceStatus`, `attendanceMarkedAt`, and `attendanceMarkedBy`.
- Write an `activity_logs` row with action `attendance_update`.

- [ ] **Step 4: Expose attendance state in activity detail**

Update `getActivityDetail` roster member mapping so managers can see:

```js
attendanceStatus: member.attendanceStatus || 'present',
attendanceMarkedAt: member.attendanceMarkedAt || '',
attendanceMarkedBy: member.attendanceMarkedBy || ''
```

Regular users should not receive attendance management controls.

- [ ] **Step 5: Run target tests**

Run:

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/cloudfunctions/setRegistrationAttendance.test.js tests/cloudfunctions/getActivityDetail.test.js
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add -- cloudfunctions/setRegistrationAttendance cloudfunctions/getActivityDetail/index.js tests/cloudfunctions/setRegistrationAttendance.test.js tests/cloudfunctions/getActivityDetail.test.js
git commit -m "Add attendance mutation API"
```

### Task 4: Add Mini-Program Attendance Editing

**Files:**

- Modify: `miniprogram/services/activity-service.js`
- Modify: `miniprogram/pages/activity-detail/index.js`
- Modify: `miniprogram/pages/activity-detail/index.wxml`
- Modify: `miniprogram/pages/activity-detail/index.wxss`
- Modify: `miniprogram/utils/i18n.js`
- Test: `tests/miniprogram/pages/activity-detail.test.js`

- [ ] **Step 1: Write failing page tests**

Cover:

```js
test('confirmed activity managers see attendance toggle actions', async () => {});
test('regular users do not see attendance toggle actions', async () => {});
test('attendance toggle calls setRegistrationAttendance and refreshes detail', async () => {});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/miniprogram/pages/activity-detail.test.js
```

Expected: fail because the frontend service and action are not implemented.

- [ ] **Step 3: Add service wrapper**

Add to `miniprogram/services/activity-service.js`:

```js
function setRegistrationAttendance(activityId, registrationId, attendanceStatus) {
  return call('setRegistrationAttendance', {
    activityId,
    registrationId,
    attendanceStatus
  });
}
```

- [ ] **Step 4: Add manager-only UI behavior**

Rules:

- Show attendance controls only when viewer can manage registrations and `activity.confirmStatus === 'confirmed'`.
- Default blank attendance status to `present`.
- Show a compact `Present` / `Absent` segmented action near each roster member.
- Keep the existing move/remove controls available.

- [ ] **Step 5: Run target tests**

Run:

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/miniprogram/pages/activity-detail.test.js
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add -- miniprogram/services/activity-service.js miniprogram/pages/activity-detail/index.js miniprogram/pages/activity-detail/index.wxml miniprogram/pages/activity-detail/index.wxss miniprogram/utils/i18n.js tests/miniprogram/pages/activity-detail.test.js
git commit -m "Add mini program attendance editing"
```

## Milestone 3: Attendance Statistics And Export APIs

### Task 5: Add Attendance Statistics API

**Files:**

- Create: `cloudfunctions/getAttendanceStats/index.js`
- Create: `cloudfunctions/getAttendanceStats/package.json`
- Test: `tests/cloudfunctions/getAttendanceStats.test.js`

- [ ] **Step 1: Write failing statistics tests**

Cover:

```js
test('admin can get date-range attendance stats for confirmed activities', async () => {});
test('organizer stats include only their own activities', async () => {});
test('blank attendanceStatus counts as present', async () => {});
test('cancelled, deleted, and pending activities are excluded', async () => {});
test('proxy signups are included by display name', async () => {});
```

Expected row:

```js
{
  participantName: 'Player A',
  signupCount: 3,
  presentCount: 2,
  absentCount: 1,
  attendanceRate: 0.6667
}
```

- [ ] **Step 2: Implement `getAttendanceStats`**

Rules:

- Caller must be `organizer`, `admin`, or `super_admin`.
- `admin` and `super_admin` can query all activities.
- `organizer` can query only own activities.
- Date range filters use activity `startAt`.
- Only `confirmStatus: 'confirmed'` activities count.
- Only active registrations count.
- Empty `attendanceStatus` means `present`.
- Aggregate by registration display name for V2.0.

- [ ] **Step 3: Run target tests and commit**

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/cloudfunctions/getAttendanceStats.test.js
git add -- cloudfunctions/getAttendanceStats tests/cloudfunctions/getAttendanceStats.test.js
git commit -m "Add attendance statistics API"
```

### Task 6: Add Roster Export Data API

**Files:**

- Create: `cloudfunctions/exportActivityRoster/index.js`
- Create: `cloudfunctions/exportActivityRoster/package.json`
- Test: `tests/cloudfunctions/exportActivityRoster.test.js`

- [ ] **Step 1: Write failing export tests**

Cover:

```js
test('organizer can export roster rows grouped by team', async () => {});
test('admin can export another organizer activity roster', async () => {});
test('regular user cannot export roster rows', async () => {});
test('export rows include manager alias, preferred positions, proxy flag, and attendance status', async () => {});
```

- [ ] **Step 2: Implement export row generation**

Return JSON rows first. Let the web admin convert rows to CSV/XLSX client-side in V2.0:

```js
{
  activityTitle: 'Match',
  teamName: 'Green',
  participantName: 'Player A',
  managerAlias: 'Zhang San',
  preferredPositions: ['Forward', 'Midfield'],
  proxyRegistration: false,
  attendanceStatus: 'present'
}
```

- [ ] **Step 3: Run target tests and commit**

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/cloudfunctions/exportActivityRoster.test.js
git add -- cloudfunctions/exportActivityRoster tests/cloudfunctions/exportActivityRoster.test.js
git commit -m "Add roster export data API"
```

## Milestone 4: Web Admin Foundation

### Task 7: Scaffold Web Admin

**Files:**

- Create: `web-admin/package.json`
- Create: `web-admin/src/main.js`
- Create: `web-admin/src/api.js`
- Create: `web-admin/src/state.js`
- Create: `web-admin/src/styles.css`
- Create: `web-admin/index.html`
- Create: `web-admin/README.md`

- [x] **Step 1: Create a minimal no-build frontend first**

Use native browser modules and keep V2.0 setup lightweight. `web-admin/package.json` should include only scripts needed for local preview and test once a test harness is added.

- [x] **Step 2: Add API adapter**

`web-admin/src/api.js` should centralize cloud-function calls:

```js
export async function callFunction(name, data = {}) {
  if (!window.wx || !window.wx.cloud) {
    throw new Error('CloudBase web runtime is not initialized');
  }

  const result = await window.wx.cloud.callFunction({ name, data });
  return result && result.result ? result.result : result;
}
```

- [x] **Step 3: Add initial shell**

Initial views:

- login/status panel.
- left navigation: Users, Activities, Attendance, Notifications.
- main content area.
- denied state for non-admin users.

- [x] **Step 4: Commit scaffold**

```powershell
git add -- web-admin
git commit -m "Scaffold version 2 web admin"
```

### Task 8: Add Web Admin User Role Management View

**Files:**

- Modify: `web-admin/src/main.js`
- Modify: `web-admin/src/api.js`
- Modify: `web-admin/src/styles.css`
- Test: `tests/web-admin/user-role-management.test.js`

- [x] **Step 1: Write UI behavior tests after choosing the web-admin test harness**

Cover:

```js
test('renders user search results with roles', async () => {});
test('super_admin can see admin and organizer role toggles', async () => {});
test('admin can see organizer toggle but not admin toggle', async () => {});
test('saving role changes calls updateUserRoles', async () => {});
```

- [x] **Step 2: Implement user management view**

Rules:

- Search by keyword and role.
- Display roles plainly.
- Disable unauthorized role toggles.
- Show save progress and cloud-function error messages.
- Refresh the selected row after save.

- [x] **Step 3: Run tests and commit**

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/web-admin/user-role-management.test.js
git add -- web-admin tests/web-admin/user-role-management.test.js
git commit -m "Add web admin role management view"
```

## Milestone 5: Web Admin Activity, Attendance, Statistics, And Logs

### Task 9: Add Web Admin Activity Review And Attendance Editing

**Files:**

- Modify: `cloudfunctions/listActivities/index.js`
- Modify: `web-admin/src/main.js`
- Modify: `web-admin/src/api.js`
- Modify: `web-admin/src/styles.css`
- Test: `tests/cloudfunctions/listActivities.test.js`
- Test: `tests/web-admin/activity-review.test.js`

- [ ] **Step 1: Extend `listActivities` tests for web-admin filters**

Cover admin global list, organizer own-list restriction, date range, status, organizer, and keyword filters.

- [ ] **Step 2: Add web-admin activity list/detail views**

Rules:

- Show activity list with filters.
- Open detail panel with teams and members.
- Show proxy and preferred-position metadata.
- Allow attendance edits only for confirmed activities.
- Use `setRegistrationAttendance`.

- [ ] **Step 3: Run tests and commit**

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/cloudfunctions/listActivities.test.js tests/web-admin/activity-review.test.js
git add -- cloudfunctions/listActivities/index.js web-admin tests/cloudfunctions/listActivities.test.js tests/web-admin/activity-review.test.js
git commit -m "Add web admin activity attendance review"
```

### Task 9A: Add Activity Duplication Flow

**Files:**

- Modify: `miniprogram/pages/activity-detail/index.js`
- Modify: `miniprogram/pages/activity-detail/index.wxml`
- Modify: `miniprogram/pages/activity-create/index.js`
- Modify: `miniprogram/pages/activity-create/index.wxml`
- Modify: `miniprogram/services/activity-service.js`
- Modify: `miniprogram/utils/i18n.js`
- Test: `tests/miniprogram/pages/activity-detail.test.js`
- Test: `tests/miniprogram/pages/activity-create.test.js`

- [x] **Step 1: Write failing copy-activity tests**

Cover:

```js
test('organizer can start a copied activity draft from an activity they manage', async () => {});
test('regular users cannot see the copy activity action', async () => {});
test('copied draft includes reusable setup fields but no registrations or attendance state', async () => {});
test('copied draft requires a new activity time before save', async () => {});
```

- [x] **Step 2: Implement copy draft initialization**

Rules:

- Show the copy action only to users who can manage the source activity.
- Copy reusable setup fields: title, description, venue, location, cover/detail images, team names, team colors, team capacities, signup limits, registration notice threshold, and activity notice prompt.
- Do not copy registrations, attendance state, participant operation logs, notification logs, notification subscription state, confirm status, or cancellation state.
- Initialize the create page in copy mode with a clear draft state and a new activity ID generated only when the manager saves.
- Require the manager to review or change `startAt` and `endAt` before saving the copied activity.

- [x] **Step 3: Run tests and commit**

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/miniprogram/pages/activity-detail.test.js tests/miniprogram/pages/activity-create.test.js
git add -- miniprogram/pages/activity-detail miniprogram/pages/activity-create miniprogram/services/activity-service.js miniprogram/utils/i18n.js tests/miniprogram/pages/activity-detail.test.js tests/miniprogram/pages/activity-create.test.js
git commit -m "Add activity duplication flow"
```

### Task 10: Add Web Admin Statistics, Export, And Notification Logs

**Files:**

- Create: `cloudfunctions/listNotificationLogs/index.js`
- Create: `cloudfunctions/listNotificationLogs/package.json`
- Modify: `web-admin/src/main.js`
- Modify: `web-admin/src/api.js`
- Test: `tests/cloudfunctions/listNotificationLogs.test.js`
- Test: `tests/web-admin/attendance-statistics.test.js`

- [ ] **Step 1: Add notification-log API tests**

Cover admin global visibility, organizer own-activity visibility, date filters, and failure reason display fields.

- [ ] **Step 2: Implement statistics and export views**

Rules:

- Date range picker feeds `getAttendanceStats`.
- Show signup, present, absent, and attendance-rate columns.
- Export roster rows from `exportActivityRoster` to CSV in browser.
- Notification log view shows activity, recipient, notification type, status, and failure reason.

- [ ] **Step 3: Run tests and commit**

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/cloudfunctions/listNotificationLogs.test.js tests/web-admin/attendance-statistics.test.js
git add -- cloudfunctions/listNotificationLogs web-admin tests/cloudfunctions/listNotificationLogs.test.js tests/web-admin/attendance-statistics.test.js
git commit -m "Add web admin statistics export and logs"
```

## Milestone 6: List Pagination And Overdue Prompts

### Task 11: Add Home/My Paginated Loading

**Files:**

- Modify: `miniprogram/pages/home/index.js`
- Modify: `miniprogram/pages/home/index.wxml`
- Modify: `miniprogram/pages/my/index.js`
- Modify: `miniprogram/pages/my/index.wxml`
- Test: `tests/miniprogram/pages/home.test.js`
- Test: `tests/miniprogram/pages/my-profile.test.js`

- [ ] **Step 1: Write failing pagination tests**

Cover:

```js
test('home loads the next page with skip while preserving existing rows', async () => {});
test('my created tab loads the next created page independently', async () => {});
test('my joined tab loads the next joined page independently', async () => {});
```

- [ ] **Step 2: Implement page state**

Track per-list values:

```js
pageSize: 20,
createdSkip: 0,
joinedSkip: 0,
hasMoreCreated: true,
hasMoreJoined: true,
loadingMoreCreated: false,
loadingMoreJoined: false
```

- [ ] **Step 3: Run tests and commit**

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/miniprogram/pages/home.test.js tests/miniprogram/pages/my-profile.test.js
git add -- miniprogram/pages/home miniprogram/pages/my tests/miniprogram/pages/home.test.js tests/miniprogram/pages/my-profile.test.js
git commit -m "Add home and my pagination"
```

### Task 12: Add Overdue Unresolved Activity Prompt

**Files:**

- Modify: `miniprogram/utils/formatters.js`
- Modify: `miniprogram/pages/activity-detail/index.js`
- Modify: `miniprogram/pages/activity-detail/index.wxml`
- Modify: `miniprogram/utils/i18n.js`
- Test: `tests/miniprogram/utils/formatters.test.js`
- Test: `tests/miniprogram/pages/activity-detail.test.js`

- [ ] **Step 1: Write failing overdue tests**

Cover published, pending-confirmation activities whose `endAt` is in the past.

- [ ] **Step 2: Implement overdue prompt**

Rules:

- Show only to organizer/admin viewers.
- Offer existing confirm and cancel actions.
- Do not auto-confirm.
- Do not show for cancelled, deleted, or already confirmed activities.

- [ ] **Step 3: Run tests and commit**

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand tests/miniprogram/utils/formatters.test.js tests/miniprogram/pages/activity-detail.test.js
git add -- miniprogram/utils/formatters.js miniprogram/pages/activity-detail miniprogram/utils/i18n.js tests/miniprogram/utils/formatters.test.js tests/miniprogram/pages/activity-detail.test.js
git commit -m "Add overdue unresolved activity prompt"
```

## Final Verification

- [ ] **Step 1: Copy shared cloud helpers**

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts\copy-cloud-shared.mjs
```

Expected: exit code 0.

- [ ] **Step 2: Run full Jest suite**

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\jest\bin\jest.js --runInBand
```

Expected: all test suites pass.

- [ ] **Step 3: Run web-admin verification**

If `web-admin/package.json` exists and defines test/build scripts:

```powershell
Push-Location .\web-admin
npm test
npm run build
Pop-Location
```

Expected: both scripts pass.

- [ ] **Step 4: Update Version 2 docs**

Update:

- `docs/development-log-v2.md`
- `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`

Record completed functions, required CloudBase deployments, mini-program upload requirements, and any manual CloudBase seeding for the first `super_admin`.

- [ ] **Step 5: Commit final documentation update**

```powershell
git add -- docs/development-log-v2.md docs/superpowers/progress/football-signup-miniapp-v2-progress.md
git commit -m "Document version 2 implementation status"
```

## Deployment Notes

New or changed cloud functions from this plan require CloudBase deployment after:

```powershell
& 'C:\Users\zhang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts\copy-cloud-shared.mjs
```

Expected deploy set after V2.0 implementation:

```text
ensureUserProfile
listActivities
getActivityDetail
listUsers
updateUserRoles
updateParticipantManagerAlias
listActivityLogs
setRegistrationAttendance
getAttendanceStats
exportActivityRoster
listNotificationLogs
```

Manual production setup:

- Seed the first `super_admin` by editing the target user document in CloudBase.
- Confirm `user_role_logs` exists or is bootstrapped before testing web-admin role changes.
- Upload a mini-program frontend build for mini-program attendance editing, pagination, and overdue prompts.
- Upload a mini-program frontend build for the copy-activity flow.
- Deploy or host `web-admin/` according to the chosen CloudBase hosting path.

### Single-Environment Testing Policy

Current decision:

- Use the existing single CloudBase environment for now.
- Do not create a second paid CloudBase environment until live testing or release risk justifies the cost.
- Do not deploy changed existing functions during an active Version 1 review window unless the deployment is needed to fix the review build.

Testing rules while sharing one CloudBase environment:

- Trial and formal mini-program builds are separated by frontend code package only.
- They are not separated at the cloud-function or database layer when they use the same `CLOUD_ENV_ID`.
- Uploading a trial build does not deploy cloud functions.
- Cloud functions are deployed separately and affect every frontend build that calls the same function in that environment.
- New functions are lower risk because existing formal builds do not call them.
- Changed existing functions, especially `getActivityDetail`, can affect formal users and the review build.
- For Version 2 testing of changed existing behavior, prefer temporary function-name isolation, such as calling `getActivityDetailV2` from a trial build while the formal build keeps calling `getActivityDetail`.
- Keep test users and test activities clearly separated from production activity data.

Future option:

- A self-hosted backend can provide cleaner `dev` / `test` / `prod` separation, independent databases, safer rollback, and standard CI/CD release controls.
- Defer self-hosted migration until the operational complexity of the web admin, analytics, permissions, or release management outweighs CloudBase's lower early-stage operating cost.

## Self-Review

- Spec coverage: V2.0 role management, attendance, web-admin foundation, activity review, statistics/export, notification logs, pagination, and overdue prompts are mapped to tasks.
- Deferred scope is explicit: invite code, automatic reminders, payments/refunds, runtime MySQL migration, account-password login, and player technical analysis are not part of this plan.
- Placeholders avoided: each task lists files, expected tests, commands, and concrete behavior.
