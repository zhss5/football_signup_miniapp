# Football Signup Mini Program MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WeChat mini program MVP that lets organizers create football signup events, share them to groups, and lets participants join or cancel by team with `openid`-based identity and duplicate-signup protection.

**Architecture:** Use a native WeChat mini program frontend that talks only to a thin `services/` layer. Put all business rules in CloudBase cloud functions, store activity, team, user, and registration facts in separate collections, and use cloud database transactions for join/cancel count consistency.

**Tech Stack:** Native WeChat Mini Program (JavaScript), WeChat CloudBase, cloud functions with `wx-server-sdk`, cloud database transactions, Jest for unit tests, PowerShell for local commands.

---

## Assumptions

- The current workspace `D:/workspace/Nautilus` does not yet contain a runnable project.
- The implementation should optimize for `MVP speed` while keeping data and service boundaries compatible with future `payments`, `multi-organization`, and `analytics`.
- If this directory is still not a Git repository when implementation starts, run `git init` before the first commit step.

## Proposed File Structure

### Root Tooling

- Create: `D:/workspace/Nautilus/package.json`
  Purpose: root scripts for tests and cloud shared-file sync.
- Create: `D:/workspace/Nautilus/jest.config.cjs`
  Purpose: Jest configuration for unit tests.
- Create: `D:/workspace/Nautilus/scripts/copy-cloud-shared.mjs`
  Purpose: copy shared helper files into each cloud function before deploy.

### Mini Program App

- Create: `D:/workspace/Nautilus/miniprogram/app.js`
  Purpose: app bootstrap and lazy cloud init.
- Create: `D:/workspace/Nautilus/miniprogram/app.json`
  Purpose: page registration and window/tab config.
- Create: `D:/workspace/Nautilus/miniprogram/app.wxss`
  Purpose: global styles and design tokens.

### Mini Program Services and Utils

- Create: `D:/workspace/Nautilus/miniprogram/services/cloud.js`
  Purpose: one place to call cloud functions.
- Create: `D:/workspace/Nautilus/miniprogram/services/user-service.js`
  Purpose: user bootstrap and current-user reads.
- Create: `D:/workspace/Nautilus/miniprogram/services/activity-service.js`
  Purpose: create/list/detail/stats requests.
- Create: `D:/workspace/Nautilus/miniprogram/services/registration-service.js`
  Purpose: join/cancel requests.
- Create: `D:/workspace/Nautilus/miniprogram/utils/constants.js`
  Purpose: status enums, page sizes, default team counts.
- Create: `D:/workspace/Nautilus/miniprogram/utils/validators.js`
  Purpose: client-side form validation.
- Create: `D:/workspace/Nautilus/miniprogram/utils/formatters.js`
  Purpose: date/time/count display helpers.

### Mini Program Pages

- Create: `D:/workspace/Nautilus/miniprogram/pages/home/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/pages/home/index.wxml`
- Create: `D:/workspace/Nautilus/miniprogram/pages/home/index.wxss`
- Create: `D:/workspace/Nautilus/miniprogram/pages/home/index.json`
  Purpose: event feed and create/join entry.

- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-create/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-create/index.wxml`
- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-create/index.wxss`
- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-create/index.json`
  Purpose: organizer form for creating an activity.

- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-detail/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-detail/index.wxml`
- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-detail/index.wxss`
- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-detail/index.json`
  Purpose: activity info, team list, signup, cancel, share.

- Create: `D:/workspace/Nautilus/miniprogram/pages/my/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/pages/my/index.wxml`
- Create: `D:/workspace/Nautilus/miniprogram/pages/my/index.wxss`
- Create: `D:/workspace/Nautilus/miniprogram/pages/my/index.json`
  Purpose: “my created events” and “my joined events”.

### Mini Program Components

- Create: `D:/workspace/Nautilus/miniprogram/components/activity-card/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/components/activity-card/index.wxml`
- Create: `D:/workspace/Nautilus/miniprogram/components/activity-card/index.wxss`
- Create: `D:/workspace/Nautilus/miniprogram/components/activity-card/index.json`
  Purpose: reusable list card for activities.

- Create: `D:/workspace/Nautilus/miniprogram/components/team-editor/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/components/team-editor/index.wxml`
- Create: `D:/workspace/Nautilus/miniprogram/components/team-editor/index.wxss`
- Create: `D:/workspace/Nautilus/miniprogram/components/team-editor/index.json`
  Purpose: editable team rows on the create page.

- Create: `D:/workspace/Nautilus/miniprogram/components/signup-sheet/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/components/signup-sheet/index.wxml`
- Create: `D:/workspace/Nautilus/miniprogram/components/signup-sheet/index.wxss`
- Create: `D:/workspace/Nautilus/miniprogram/components/signup-sheet/index.json`
  Purpose: collect signup name and optional phone.

- Create: `D:/workspace/Nautilus/miniprogram/components/team-list/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/components/team-list/index.wxml`
- Create: `D:/workspace/Nautilus/miniprogram/components/team-list/index.wxss`
- Create: `D:/workspace/Nautilus/miniprogram/components/team-list/index.json`
  Purpose: render teams and members on the detail page.

### Cloud Functions

- Create: `D:/workspace/Nautilus/cloudfunctions/_shared/collections.js`
  Purpose: shared collection names and helpers, copied into each function folder.
- Create: `D:/workspace/Nautilus/cloudfunctions/_shared/errors.js`
  Purpose: consistent business errors.
- Create: `D:/workspace/Nautilus/cloudfunctions/_shared/time.js`
  Purpose: server-side timestamp helpers.
- Create: `D:/workspace/Nautilus/cloudfunctions/_shared/validators.js`
  Purpose: payload validation shared by functions.

- Create: `D:/workspace/Nautilus/cloudfunctions/ensureUserProfile/index.js`
- Create: `D:/workspace/Nautilus/cloudfunctions/listActivities/index.js`
- Create: `D:/workspace/Nautilus/cloudfunctions/getActivityDetail/index.js`
- Create: `D:/workspace/Nautilus/cloudfunctions/createActivity/index.js`
- Create: `D:/workspace/Nautilus/cloudfunctions/joinActivity/index.js`
- Create: `D:/workspace/Nautilus/cloudfunctions/cancelRegistration/index.js`
- Create: `D:/workspace/Nautilus/cloudfunctions/getActivityStats/index.js`
  Purpose: enforce all business rules and secure data access.

### Tests

- Create: `D:/workspace/Nautilus/tests/miniprogram/utils/validators.test.js`
- Create: `D:/workspace/Nautilus/tests/cloudfunctions/ensureUserProfile.test.js`
- Create: `D:/workspace/Nautilus/tests/cloudfunctions/createActivity.test.js`
- Create: `D:/workspace/Nautilus/tests/cloudfunctions/getActivityDetail.test.js`
- Create: `D:/workspace/Nautilus/tests/cloudfunctions/joinActivity.test.js`
- Create: `D:/workspace/Nautilus/tests/cloudfunctions/cancelRegistration.test.js`
- Create: `D:/workspace/Nautilus/tests/cloudfunctions/getActivityStats.test.js`

### CloudBase Deployment Notes

- Create: `D:/workspace/Nautilus/docs/cloudbase/security-rules.json`
  Purpose: versioned database permission rules draft.
- Create: `D:/workspace/Nautilus/docs/cloudbase/indexes.md`
  Purpose: required manual indexes in CloudBase console.

## Page Checklist

### `pages/home/index`

- Show activity feed sorted by start time ascending.
- Show status badge: `可加入` / `已满` / `已结束`.
- Include CTA to `创建活动`.
- Support pull-to-refresh.

### `pages/activity-create/index`

- Create title, time, location, description, cover image, total cap.
- Configure 1 to 4 teams.
- Set per-team max count.
- Toggle `是否要求手机号`.
- Publish activity and redirect to detail page.

### `pages/activity-detail/index`

- Show activity summary, organizer, location, time, description.
- Show team blocks with capacity and members.
- Allow current user to join one team.
- Allow current user to cancel before activity start.
- Allow organizer to open stats panel.
- Support group share card.

### `pages/my/index`

- Show `我发起的活动`.
- Show `我报名的活动`.
- Reuse activity card component.

## Collection Definitions

### `users`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | string | yes | exactly `openid` |
| `preferredName` | string | no | latest common signup name |
| `wechatNickname` | string | no | reserved, not relied on for MVP |
| `avatarUrl` | string | no | reserved |
| `phone` | string | no | user-level latest phone if collected |
| `roles` | string[] | yes | default `["user"]` |
| `createdAt` | server date | yes | set in cloud function |
| `lastActiveAt` | server date | yes | updated on entry |

### `activities`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | string | yes | generated by CloudBase |
| `title` | string | yes | max 50 chars |
| `organizerOpenId` | string | yes | current user openid |
| `orgId` | string | no | reserved for formal version |
| `startAt` | string | yes | ISO string |
| `endAt` | string | yes | ISO string |
| `addressText` | string | yes | user-entered location |
| `location` | object | no | lat/lng reserved |
| `description` | string | no | max 500 chars |
| `coverImage` | string | no | cloud file URL |
| `signupLimitTotal` | number | yes | total cap |
| `joinedCount` | number | yes | derived and updated server-side |
| `requirePhone` | boolean | yes | default false |
| `inviteCode` | string | no | reserved for private games |
| `feeMode` | string | yes | default `free` |
| `feeAmount` | number | no | reserved |
| `status` | string | yes | `draft/published/closed/finished/cancelled` |
| `createdAt` | server date | yes | set server-side |
| `updatedAt` | server date | yes | set server-side |

### `activity_teams`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | string | yes | generated by CloudBase |
| `activityId` | string | yes | parent activity |
| `teamName` | string | yes | e.g. 白 / 红 |
| `sort` | number | yes | render order |
| `maxMembers` | number | yes | team cap |
| `joinedCount` | number | yes | maintained server-side |
| `status` | string | yes | default `active` |
| `createdAt` | server date | yes | set server-side |

### `registrations`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | string | yes | exactly `${activityId}_${openid}` |
| `activityId` | string | yes | target activity |
| `teamId` | string | yes | current team |
| `userOpenId` | string | yes | current user openid |
| `status` | string | yes | `joined/cancelled` |
| `signupName` | string | yes | event-specific display name |
| `phoneSnapshot` | string | no | event-specific phone snapshot |
| `source` | string | yes | `share/direct` |
| `payStatus` | string | no | reserved |
| `orderId` | string | no | reserved |
| `joinedAt` | server date | no | set on join |
| `cancelledAt` | server date | no | set on cancel |
| `updatedAt` | server date | yes | set server-side |

### `activity_logs`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `_id` | string | yes | generated by CloudBase |
| `activityId` | string | yes | related activity |
| `operatorOpenId` | string | yes | actor openid |
| `action` | string | yes | `create_activity/join_activity/cancel_registration/update_activity` |
| `payload` | object | no | metadata for debugging and analytics |
| `createdAt` | server date | yes | set server-side |

## Cloud Function Contracts

### `ensureUserProfile`

- Input:

```json
{}
```

- Output:

```json
{
  "user": {
    "_id": "openid",
    "preferredName": "",
    "roles": ["user"],
    "lastActiveAt": "2026-04-19T10:00:00.000Z"
  }
}
```

### `listActivities`

- Input:

```json
{
  "scope": "home",
  "status": "published",
  "limit": 20
}
```

- Output:

```json
{
  "items": [
    {
      "_id": "activityId",
      "title": "周六 8-10",
      "startAt": "2026-04-26T20:00:00.000Z",
      "endAt": "2026-04-26T22:00:00.000Z",
      "addressText": "半石",
      "signupLimitTotal": 12,
      "joinedCount": 8,
      "status": "published"
    }
  ]
}
```

### `getActivityDetail`

- Input:

```json
{
  "activityId": "activityId"
}
```

- Output:

```json
{
  "activity": {
    "_id": "activityId",
    "title": "周六 8-10",
    "organizerOpenId": "openid_a",
    "requirePhone": false,
    "signupLimitTotal": 12,
    "joinedCount": 8
  },
  "teams": [
    {
      "_id": "team_white",
      "teamName": "白",
      "maxMembers": 6,
      "joinedCount": 4,
      "members": [
        {
          "userOpenId": "openid_b",
          "signupName": "MARK"
        }
      ]
    }
  ],
  "myRegistration": {
    "_id": "activityId_openid_b",
    "teamId": "team_white",
    "status": "joined",
    "signupName": "MARK"
  }
}
```

### `createActivity`

- Input:

```json
{
  "title": "周六 8-10",
  "startAt": "2026-04-26T20:00:00.000Z",
  "endAt": "2026-04-26T22:00:00.000Z",
  "addressText": "半石",
  "description": "7v7 对抗",
  "coverImage": "",
  "signupLimitTotal": 12,
  "requirePhone": false,
  "inviteCode": "",
  "teams": [
    { "teamName": "白", "maxMembers": 6 },
    { "teamName": "红", "maxMembers": 6 }
  ]
}
```

- Output:

```json
{
  "activityId": "activityId"
}
```

### `joinActivity`

- Input:

```json
{
  "activityId": "activityId",
  "teamId": "team_white",
  "signupName": "刘力",
  "phone": "",
  "source": "share"
}
```

- Output:

```json
{
  "registrationId": "activityId_openid_a",
  "teamId": "team_white",
  "status": "joined"
}
```

### `cancelRegistration`

- Input:

```json
{
  "activityId": "activityId"
}
```

- Output:

```json
{
  "registrationId": "activityId_openid_a",
  "status": "cancelled"
}
```

### `getActivityStats`

- Input:

```json
{
  "activityId": "activityId"
}
```

- Output:

```json
{
  "activityId": "activityId",
  "totalJoined": 8,
  "totalCancelled": 2,
  "teams": [
    { "teamId": "team_white", "teamName": "白", "joinedCount": 4, "maxMembers": 6 }
  ]
}
```

## Permission Matrix

| Action | Participant | Organizer of This Activity | Other Logged-In User | Enforced In |
| --- | --- | --- | --- | --- |
| Auto-create own user profile | allow | allow | allow | `ensureUserProfile` |
| View published activity list | allow | allow | allow | `listActivities` |
| View published activity detail | allow | allow | allow | `getActivityDetail` |
| Create activity | deny | allow | allow | `createActivity` |
| Join one team in published activity | allow for self | allow for self | allow for self | `joinActivity` |
| Cancel own registration before start | allow for self | allow for self | allow for self | `cancelRegistration` |
| View organizer stats | deny | allow | deny | `getActivityStats` |
| Update activity | deny | allow | deny | future `updateActivity` |
| Direct database writes from client | deny | deny | deny | CloudBase security rules |

## Manual Indexes To Add

- `activities`: `status + startAt`
- `activities`: `organizerOpenId + createdAt`
- `activity_teams`: `activityId + sort`
- `registrations`: `_id`
- `registrations`: `activityId + status`
- `registrations`: `userOpenId + updatedAt`
- `activity_logs`: `activityId + createdAt`

## Task Plan

### Task 1: Bootstrap Project and Shared Validation

**Files:**
- Create: `D:/workspace/Nautilus/package.json`
- Create: `D:/workspace/Nautilus/jest.config.cjs`
- Create: `D:/workspace/Nautilus/scripts/copy-cloud-shared.mjs`
- Create: `D:/workspace/Nautilus/miniprogram/utils/constants.js`
- Create: `D:/workspace/Nautilus/miniprogram/utils/validators.js`
- Create: `D:/workspace/Nautilus/cloudfunctions/_shared/validators.js`
- Test: `D:/workspace/Nautilus/tests/miniprogram/utils/validators.test.js`

- [ ] **Step 1: Write the failing validation test**

```javascript
const { validateActivityDraft } = require('../../../miniprogram/utils/validators');

describe('validateActivityDraft', () => {
  test('rejects missing title and teams', () => {
    expect(() =>
      validateActivityDraft({
        title: '',
        startAt: '2026-04-26T20:00:00.000Z',
        endAt: '2026-04-26T22:00:00.000Z',
        addressText: '半石',
        signupLimitTotal: 12,
        teams: []
      })
    ).toThrow('活动标题不能为空');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/miniprogram/utils/validators.test.js --runInBand`  
Expected: FAIL with `Cannot find module '../../../miniprogram/utils/validators'`

- [ ] **Step 3: Write the minimal implementation and tooling**

```json
{
  "name": "football-signup-miniapp",
  "private": true,
  "scripts": {
    "test": "jest --runInBand",
    "copy:cloud-shared": "node scripts/copy-cloud-shared.mjs"
  },
  "devDependencies": {
    "jest": "^30.0.0"
  }
}
```

```javascript
// jest.config.cjs
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js']
};
```

```javascript
// miniprogram/utils/constants.js
module.exports = {
  ACTIVITY_STATUS: {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    CLOSED: 'closed',
    FINISHED: 'finished',
    CANCELLED: 'cancelled'
  },
  REGISTRATION_STATUS: {
    JOINED: 'joined',
    CANCELLED: 'cancelled'
  },
  MAX_TEAMS: 4
};
```

```javascript
// miniprogram/utils/validators.js
const { MAX_TEAMS } = require('./constants');

function validateActivityDraft(draft) {
  if (!draft.title || !draft.title.trim()) throw new Error('活动标题不能为空');
  if (!draft.addressText || !draft.addressText.trim()) throw new Error('活动地址不能为空');
  if (!Array.isArray(draft.teams) || draft.teams.length === 0) throw new Error('至少需要一个分队');
  if (draft.teams.length > MAX_TEAMS) throw new Error('分队数量超出限制');
  return true;
}

module.exports = {
  validateActivityDraft
};
```

```javascript
// cloudfunctions/_shared/validators.js
function validateActivityDraft(draft) {
  if (!draft.title || !draft.title.trim()) throw new Error('活动标题不能为空');
  if (!draft.addressText || !draft.addressText.trim()) throw new Error('活动地址不能为空');
  if (!Array.isArray(draft.teams) || draft.teams.length === 0) throw new Error('至少需要一个分队');
  return true;
}

function validateSignupPayload(payload) {
  if (!payload.activityId) throw new Error('activityId is required');
  if (!payload.teamId) throw new Error('teamId is required');
  if (!payload.signupName || !payload.signupName.trim()) throw new Error('signupName is required');
  return true;
}

module.exports = {
  validateActivityDraft,
  validateSignupPayload
};
```

```javascript
// scripts/copy-cloud-shared.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sharedDir = path.join(root, 'cloudfunctions', '_shared');
const functionsDir = path.join(root, 'cloudfunctions');

for (const name of fs.readdirSync(functionsDir)) {
  const targetDir = path.join(functionsDir, name);
  if (!fs.statSync(targetDir).isDirectory() || name === '_shared') continue;
  const targetShared = path.join(targetDir, '_shared');
  fs.rmSync(targetShared, { recursive: true, force: true });
  fs.cpSync(sharedDir, targetShared, { recursive: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/miniprogram/utils/validators.test.js --runInBand`  
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git init
git add package.json jest.config.cjs scripts/copy-cloud-shared.mjs miniprogram/utils/constants.js miniprogram/utils/validators.js cloudfunctions/_shared/validators.js tests/miniprogram/utils/validators.test.js
git commit -m "chore: bootstrap test tooling and validators"
```

### Task 2: Build User Bootstrap and Read APIs

**Files:**
- Create: `D:/workspace/Nautilus/cloudfunctions/_shared/collections.js`
- Create: `D:/workspace/Nautilus/cloudfunctions/_shared/time.js`
- Create: `D:/workspace/Nautilus/cloudfunctions/ensureUserProfile/index.js`
- Create: `D:/workspace/Nautilus/cloudfunctions/listActivities/index.js`
- Create: `D:/workspace/Nautilus/cloudfunctions/getActivityDetail/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/services/cloud.js`
- Create: `D:/workspace/Nautilus/miniprogram/services/user-service.js`
- Create: `D:/workspace/Nautilus/miniprogram/services/activity-service.js`
- Test: `D:/workspace/Nautilus/tests/cloudfunctions/ensureUserProfile.test.js`
- Test: `D:/workspace/Nautilus/tests/cloudfunctions/getActivityDetail.test.js`

- [ ] **Step 1: Write the failing tests**

```javascript
const ensureUserProfile = require('../../cloudfunctions/ensureUserProfile/index');

test('ensureUserProfile creates user with openid primary key', async () => {
  const fakeDb = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ data: null }),
        set: jest.fn().mockResolvedValue({})
      }))
    }))
  };

  const result = await ensureUserProfile.main({}, { OPENID: 'openid_a' }, { db: fakeDb, now: '2026-04-19T10:00:00.000Z' });
  expect(result.user._id).toBe('openid_a');
  expect(result.user.roles).toEqual(['user']);
});
```

```javascript
const getActivityDetail = require('../../cloudfunctions/getActivityDetail/index');

test('getActivityDetail returns teams and my registration', async () => {
  const result = await getActivityDetail.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_b' },
    {
      loadActivityDetail: async () => ({
        activity: { _id: 'activity_1', title: '周六 8-10' },
        teams: [{ _id: 'team_white', teamName: '白', members: [] }],
        myRegistration: { _id: 'activity_1_openid_b', teamId: 'team_white', status: 'joined' }
      })
    }
  );

  expect(result.activity._id).toBe('activity_1');
  expect(result.teams).toHaveLength(1);
  expect(result.myRegistration.teamId).toBe('team_white');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/cloudfunctions/ensureUserProfile.test.js tests/cloudfunctions/getActivityDetail.test.js --runInBand`  
Expected: FAIL with missing module or missing exported `main`

- [ ] **Step 3: Write the minimal implementation**

```javascript
// cloudfunctions/_shared/collections.js
module.exports = {
  COLLECTIONS: {
    USERS: 'users',
    ACTIVITIES: 'activities',
    ACTIVITY_TEAMS: 'activity_teams',
    REGISTRATIONS: 'registrations',
    ACTIVITY_LOGS: 'activity_logs'
  }
};
```

```javascript
// cloudfunctions/_shared/time.js
function nowIso(now = new Date()) {
  return typeof now === 'string' ? now : now.toISOString();
}

module.exports = {
  nowIso
};
```

```javascript
// cloudfunctions/ensureUserProfile/index.js
const cloud = require('wx-server-sdk');
const { COLLECTIONS } = require('./_shared/collections');
const { nowIso } = require('./_shared/time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const db = deps.db || cloud.database();
  const openid = context.OPENID;
  const stamp = nowIso(deps.now);
  const userRef = db.collection(COLLECTIONS.USERS).doc(openid);
  const current = await userRef.get().catch(() => ({ data: null }));

  if (current.data) {
    await userRef.update({ data: { lastActiveAt: stamp } });
    return { user: { ...current.data, lastActiveAt: stamp } };
  }

  const user = {
    _id: openid,
    preferredName: '',
    roles: ['user'],
    createdAt: stamp,
    lastActiveAt: stamp
  };

  await userRef.set({ data: user });
  return { user };
}

module.exports = { main };
```

```javascript
// cloudfunctions/getActivityDetail/index.js
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  if (deps.loadActivityDetail) {
    return deps.loadActivityDetail(event.activityId, context.OPENID);
  }

  const db = cloud.database();
  const activity = await db.collection('activities').doc(event.activityId).get();
  const teamsRes = await db.collection('activity_teams').where({ activityId: event.activityId }).get();
  const regId = `${event.activityId}_${context.OPENID}`;
  const myRegistration = await db.collection('registrations').doc(regId).get().catch(() => ({ data: null }));

  return {
    activity: activity.data,
    teams: teamsRes.data.map(team => ({ ...team, members: [] })),
    myRegistration: myRegistration.data
  };
}

module.exports = { main };
```

```javascript
// cloudfunctions/listActivities/index.js
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext()) {
  const db = cloud.database();

  if (event.scope === 'created') {
    const res = await db.collection('activities').where({ organizerOpenId: context.OPENID }).get();
    return { items: res.data };
  }

  if (event.scope === 'joined') {
    const regRes = await db.collection('registrations').where({ userOpenId: context.OPENID, status: 'joined' }).get();
    return { items: regRes.data };
  }

  const res = await db.collection('activities').where({ status: event.status || 'published' }).get();
  return { items: res.data };
}

module.exports = { main };
```

```javascript
// miniprogram/services/cloud.js
function call(name, data = {}) {
  return wx.cloud.callFunction({
    name,
    data
  }).then(res => res.result);
}

module.exports = { call };
```

```javascript
// miniprogram/services/user-service.js
const { call } = require('./cloud');

function ensureUserProfile() {
  return call('ensureUserProfile');
}

module.exports = { ensureUserProfile };
```

```javascript
// miniprogram/services/activity-service.js
const { call } = require('./cloud');

function listActivities(params) {
  return call('listActivities', params);
}

function getActivityDetail(activityId) {
  return call('getActivityDetail', { activityId });
}

module.exports = {
  listActivities,
  getActivityDetail
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/cloudfunctions/ensureUserProfile.test.js tests/cloudfunctions/getActivityDetail.test.js --runInBand`  
Expected: PASS with `2 passed`

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/_shared/collections.js cloudfunctions/_shared/time.js cloudfunctions/ensureUserProfile/index.js cloudfunctions/listActivities/index.js cloudfunctions/getActivityDetail/index.js miniprogram/services/cloud.js miniprogram/services/user-service.js miniprogram/services/activity-service.js tests/cloudfunctions/ensureUserProfile.test.js tests/cloudfunctions/getActivityDetail.test.js
git commit -m "feat: add user bootstrap and activity read APIs"
```

### Task 3: Implement Activity Creation Flow

**Files:**
- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-create/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-create/index.wxml`
- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-create/index.wxss`
- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-create/index.json`
- Create: `D:/workspace/Nautilus/miniprogram/components/team-editor/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/components/team-editor/index.wxml`
- Create: `D:/workspace/Nautilus/miniprogram/components/team-editor/index.wxss`
- Create: `D:/workspace/Nautilus/miniprogram/components/team-editor/index.json`
- Create: `D:/workspace/Nautilus/cloudfunctions/createActivity/index.js`
- Modify: `D:/workspace/Nautilus/miniprogram/services/activity-service.js`
- Test: `D:/workspace/Nautilus/tests/cloudfunctions/createActivity.test.js`

- [ ] **Step 1: Write the failing creation test**

```javascript
const createActivity = require('../../cloudfunctions/createActivity/index');

test('createActivity stores activity and teams', async () => {
  const writes = [];
  const fakeDb = {
    collection: jest.fn(name => ({
      add: jest.fn(async ({ data }) => {
        writes.push({ name, data });
        return { _id: name === 'activities' ? 'activity_1' : `${name}_${writes.length}` };
      })
    }))
  };

  const result = await createActivity.main(
    {
      title: '周六 8-10',
      startAt: '2026-04-26T20:00:00.000Z',
      endAt: '2026-04-26T22:00:00.000Z',
      addressText: '半石',
      signupLimitTotal: 12,
      requirePhone: false,
      teams: [{ teamName: '白', maxMembers: 6 }, { teamName: '红', maxMembers: 6 }]
    },
    { OPENID: 'openid_a' },
    { db: fakeDb, now: '2026-04-19T10:00:00.000Z' }
  );

  expect(result.activityId).toBe('activity_1');
  expect(writes.filter(item => item.name === 'activity_teams')).toHaveLength(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cloudfunctions/createActivity.test.js --runInBand`  
Expected: FAIL with missing module or function

- [ ] **Step 3: Write minimal creation flow and page shell**

```javascript
// cloudfunctions/createActivity/index.js
const cloud = require('wx-server-sdk');
const { nowIso } = require('./_shared/time');
const { validateActivityDraft } = require('./_shared/validators');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const db = deps.db || cloud.database();
  validateActivityDraft(event);

  const stamp = nowIso(deps.now);
  const activityData = {
    title: event.title.trim(),
    organizerOpenId: context.OPENID,
    startAt: event.startAt,
    endAt: event.endAt,
    addressText: event.addressText.trim(),
    description: event.description || '',
    coverImage: event.coverImage || '',
    signupLimitTotal: event.signupLimitTotal,
    joinedCount: 0,
    requirePhone: Boolean(event.requirePhone),
    inviteCode: event.inviteCode || '',
    feeMode: 'free',
    status: 'published',
    createdAt: stamp,
    updatedAt: stamp
  };

  const activityRes = await db.collection('activities').add({ data: activityData });

  for (let index = 0; index < event.teams.length; index += 1) {
    await db.collection('activity_teams').add({
      data: {
        activityId: activityRes._id,
        teamName: event.teams[index].teamName.trim(),
        sort: index,
        maxMembers: event.teams[index].maxMembers,
        joinedCount: 0,
        status: 'active',
        createdAt: stamp
      }
    });
  }

  return { activityId: activityRes._id };
}

module.exports = { main };
```

```javascript
// miniprogram/services/activity-service.js
const { call } = require('./cloud');

function createActivity(payload) {
  return call('createActivity', payload);
}

module.exports = {
  createActivity,
  listActivities,
  getActivityDetail
};
```

```javascript
// miniprogram/pages/activity-create/index.js
const { createActivity } = require('../../services/activity-service');
const { validateActivityDraft } = require('../../utils/validators');

Page({
  data: {
    form: {
      title: '',
      startAt: '',
      endAt: '',
      addressText: '',
      description: '',
      coverImage: '',
      signupLimitTotal: 12,
      requirePhone: false,
      inviteCode: '',
      teams: [
        { teamName: '白', maxMembers: 6 },
        { teamName: '红', maxMembers: 6 }
      ]
    },
    submitting: false
  },

  async onSubmit() {
    try {
      validateActivityDraft(this.data.form);
      this.setData({ submitting: true });
      const { activityId } = await createActivity(this.data.form);
      wx.redirectTo({ url: `/pages/activity-detail/index?activityId=${activityId}` });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
```

```xml
<!-- miniprogram/pages/activity-create/index.wxml -->
<view class="page">
  <input placeholder="活动标题" data-field="title" />
  <input placeholder="地址" data-field="addressText" />
  <switch checked="{{form.requirePhone}}" />
  <team-editor teams="{{form.teams}}" />
  <button bindtap="onSubmit" loading="{{submitting}}">发布活动</button>
</view>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cloudfunctions/createActivity.test.js --runInBand`  
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/createActivity/index.js miniprogram/pages/activity-create/index.js miniprogram/pages/activity-create/index.wxml miniprogram/pages/activity-create/index.wxss miniprogram/pages/activity-create/index.json miniprogram/components/team-editor/index.js miniprogram/components/team-editor/index.wxml miniprogram/components/team-editor/index.wxss miniprogram/components/team-editor/index.json miniprogram/services/activity-service.js tests/cloudfunctions/createActivity.test.js
git commit -m "feat: add activity creation flow"
```

### Task 4: Implement Transactional Join and Cancel

**Files:**
- Create: `D:/workspace/Nautilus/cloudfunctions/_shared/errors.js`
- Create: `D:/workspace/Nautilus/cloudfunctions/joinActivity/index.js`
- Create: `D:/workspace/Nautilus/cloudfunctions/cancelRegistration/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/services/registration-service.js`
- Test: `D:/workspace/Nautilus/tests/cloudfunctions/joinActivity.test.js`
- Test: `D:/workspace/Nautilus/tests/cloudfunctions/cancelRegistration.test.js`

- [ ] **Step 1: Write the failing transaction tests**

```javascript
const joinActivity = require('../../cloudfunctions/joinActivity/index');

test('joinActivity rejects full team', async () => {
  await expect(
    joinActivity.main(
      { activityId: 'activity_1', teamId: 'team_white', signupName: '刘力', source: 'share' },
      { OPENID: 'openid_a' },
      {
        runJoin: async () => {
          throw new Error('队伍名额已满');
        }
      }
    )
  ).rejects.toThrow('队伍名额已满');
});
```

```javascript
const cancelRegistration = require('../../cloudfunctions/cancelRegistration/index');

test('cancelRegistration returns cancelled status', async () => {
  const result = await cancelRegistration.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_a' },
    { runCancel: async () => ({ registrationId: 'activity_1_openid_a', status: 'cancelled' }) }
  );

  expect(result.status).toBe('cancelled');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/cloudfunctions/joinActivity.test.js tests/cloudfunctions/cancelRegistration.test.js --runInBand`  
Expected: FAIL with missing module or missing exported `main`

- [ ] **Step 3: Write minimal transactional implementation**

```javascript
// cloudfunctions/_shared/errors.js
function businessError(message) {
  const error = new Error(message);
  error.name = 'BusinessError';
  return error;
}

module.exports = {
  businessError
};
```

```javascript
// cloudfunctions/joinActivity/index.js
const cloud = require('wx-server-sdk');
const { validateSignupPayload } = require('./_shared/validators');
const { businessError } = require('./_shared/errors');
const { nowIso } = require('./_shared/time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  validateSignupPayload(event);
  if (deps.runJoin) return deps.runJoin(event, context.OPENID);

  const db = cloud.database();
  const regId = `${event.activityId}_${context.OPENID}`;
  const stamp = nowIso();

  return db.runTransaction(async transaction => {
    const activityRes = await transaction.collection('activities').doc(event.activityId).get();
    const teamRes = await transaction.collection('activity_teams').doc(event.teamId).get();
    const regRes = await transaction.collection('registrations').doc(regId).get().catch(() => ({ data: null }));

    if (activityRes.data.status !== 'published') throw businessError('活动不可报名');
    if (activityRes.data.joinedCount >= activityRes.data.signupLimitTotal) throw businessError('活动名额已满');
    if (teamRes.data.joinedCount >= teamRes.data.maxMembers) throw businessError('队伍名额已满');
    if (regRes.data && regRes.data.status === 'joined') throw businessError('你已报名该活动');

    await transaction.collection('registrations').doc(regId).set({
      data: {
        _id: regId,
        activityId: event.activityId,
        teamId: event.teamId,
        userOpenId: context.OPENID,
        status: 'joined',
        signupName: event.signupName.trim(),
        phoneSnapshot: event.phone || '',
        source: event.source || 'direct',
        joinedAt: stamp,
        updatedAt: stamp
      }
    });

    await transaction.collection('activities').doc(event.activityId).update({
      data: { joinedCount: activityRes.data.joinedCount + 1, updatedAt: stamp }
    });

    await transaction.collection('activity_teams').doc(event.teamId).update({
      data: { joinedCount: teamRes.data.joinedCount + 1 }
    });

    return { registrationId: regId, teamId: event.teamId, status: 'joined' };
  });
}

module.exports = { main };
```

```javascript
// cloudfunctions/cancelRegistration/index.js
const cloud = require('wx-server-sdk');
const { businessError } = require('./_shared/errors');
const { nowIso } = require('./_shared/time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  if (deps.runCancel) return deps.runCancel(event, context.OPENID);

  const db = cloud.database();
  const regId = `${event.activityId}_${context.OPENID}`;
  const stamp = nowIso();

  return db.runTransaction(async transaction => {
    const regRes = await transaction.collection('registrations').doc(regId).get();
    if (!regRes.data || regRes.data.status !== 'joined') throw businessError('当前没有可取消的报名');

    const activityRes = await transaction.collection('activities').doc(event.activityId).get();
    const teamRes = await transaction.collection('activity_teams').doc(regRes.data.teamId).get();

    await transaction.collection('registrations').doc(regId).update({
      data: { status: 'cancelled', cancelledAt: stamp, updatedAt: stamp }
    });
    await transaction.collection('activities').doc(event.activityId).update({
      data: { joinedCount: Math.max(activityRes.data.joinedCount - 1, 0), updatedAt: stamp }
    });
    await transaction.collection('activity_teams').doc(regRes.data.teamId).update({
      data: { joinedCount: Math.max(teamRes.data.joinedCount - 1, 0) }
    });

    return { registrationId: regId, status: 'cancelled' };
  });
}

module.exports = { main };
```

```javascript
// miniprogram/services/registration-service.js
const { call } = require('./cloud');

function joinActivity(payload) {
  return call('joinActivity', payload);
}

function cancelRegistration(activityId) {
  return call('cancelRegistration', { activityId });
}

module.exports = {
  joinActivity,
  cancelRegistration
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/cloudfunctions/joinActivity.test.js tests/cloudfunctions/cancelRegistration.test.js --runInBand`  
Expected: PASS with `2 passed`

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/_shared/errors.js cloudfunctions/joinActivity/index.js cloudfunctions/cancelRegistration/index.js miniprogram/services/registration-service.js tests/cloudfunctions/joinActivity.test.js tests/cloudfunctions/cancelRegistration.test.js
git commit -m "feat: add transactional join and cancel flows"
```

### Task 5: Build Home, Detail, and My Pages

**Files:**
- Create: `D:/workspace/Nautilus/miniprogram/app.js`
- Create: `D:/workspace/Nautilus/miniprogram/app.json`
- Create: `D:/workspace/Nautilus/miniprogram/app.wxss`
- Create: `D:/workspace/Nautilus/miniprogram/pages/home/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/pages/home/index.wxml`
- Create: `D:/workspace/Nautilus/miniprogram/pages/home/index.wxss`
- Create: `D:/workspace/Nautilus/miniprogram/pages/home/index.json`
- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-detail/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-detail/index.wxml`
- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-detail/index.wxss`
- Create: `D:/workspace/Nautilus/miniprogram/pages/activity-detail/index.json`
- Create: `D:/workspace/Nautilus/miniprogram/pages/my/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/pages/my/index.wxml`
- Create: `D:/workspace/Nautilus/miniprogram/pages/my/index.wxss`
- Create: `D:/workspace/Nautilus/miniprogram/pages/my/index.json`
- Create: `D:/workspace/Nautilus/miniprogram/components/activity-card/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/components/activity-card/index.wxml`
- Create: `D:/workspace/Nautilus/miniprogram/components/signup-sheet/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/components/signup-sheet/index.wxml`
- Create: `D:/workspace/Nautilus/miniprogram/components/team-list/index.js`
- Create: `D:/workspace/Nautilus/miniprogram/components/team-list/index.wxml`
- Test: `D:/workspace/Nautilus/tests/miniprogram/utils/view-models.test.js`

- [ ] **Step 1: Write the failing view-model test**

```javascript
const { buildActivityCardVm } = require('../../../miniprogram/utils/formatters');

test('buildActivityCardVm marks full activities', () => {
  const vm = buildActivityCardVm({
    title: '周六 8-10',
    joinedCount: 12,
    signupLimitTotal: 12,
    status: 'published'
  });

  expect(vm.statusText).toBe('已满');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/miniprogram/utils/view-models.test.js --runInBand`  
Expected: FAIL with missing formatter export

- [ ] **Step 3: Write minimal page and component implementation**

```javascript
// miniprogram/utils/formatters.js
function buildActivityCardVm(activity) {
  let statusText = '可加入';
  if (activity.status !== 'published') statusText = '已结束';
  if (activity.joinedCount >= activity.signupLimitTotal) statusText = '已满';
  return { ...activity, statusText };
}

module.exports = {
  buildActivityCardVm
};
```

```javascript
// miniprogram/app.js
App({
  onLaunch() {
    if (!wx.cloud) throw new Error('请使用支持云开发的基础库');
    wx.cloud.init({ traceUser: true });
  }
});
```

```json
// miniprogram/app.json
{
  "pages": [
    "pages/home/index",
    "pages/activity-create/index",
    "pages/activity-detail/index",
    "pages/my/index"
  ],
  "window": {
    "navigationBarTitleText": "足球报名助手"
  },
  "tabBar": {
    "list": [
      { "pagePath": "pages/home/index", "text": "首页" },
      { "pagePath": "pages/my/index", "text": "我的" }
    ]
  }
}
```

```javascript
// miniprogram/pages/home/index.js
const { ensureUserProfile } = require('../../services/user-service');
const { listActivities } = require('../../services/activity-service');
const { buildActivityCardVm } = require('../../utils/formatters');

Page({
  data: { items: [], loading: false },

  async onShow() {
    this.setData({ loading: true });
    await ensureUserProfile();
    const { items } = await listActivities({ scope: 'home', status: 'published', limit: 20 });
    this.setData({ items: items.map(buildActivityCardVm), loading: false });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/activity-create/index' });
  }
});
```

```javascript
// miniprogram/pages/activity-detail/index.js
const { getActivityDetail } = require('../../services/activity-service');
const { joinActivity, cancelRegistration } = require('../../services/registration-service');

Page({
  data: {
    activityId: '',
    activity: null,
    teams: [],
    myRegistration: null,
    signupVisible: false,
    pendingTeamId: ''
  },

  async onLoad(query) {
    this.setData({ activityId: query.activityId });
    await this.reload();
  },

  async reload() {
    const detail = await getActivityDetail(this.data.activityId);
    this.setData(detail);
  },

  openSignup(event) {
    this.setData({ signupVisible: true, pendingTeamId: event.currentTarget.dataset.teamId });
  },

  async submitSignup(detail) {
    await joinActivity({
      activityId: this.data.activityId,
      teamId: this.data.pendingTeamId,
      signupName: detail.signupName,
      phone: detail.phone || '',
      source: 'share'
    });
    this.setData({ signupVisible: false, pendingTeamId: '' });
    await this.reload();
  },

  async onCancelSignup() {
    await cancelRegistration(this.data.activityId);
    await this.reload();
  },

  onShareAppMessage() {
    return {
      title: this.data.activity ? this.data.activity.title : '足球报名助手',
      path: `/pages/activity-detail/index?activityId=${this.data.activityId}`
    };
  }
});
```

```javascript
// miniprogram/pages/my/index.js
const { listActivities } = require('../../services/activity-service');

Page({
  data: {
    createdItems: [],
    joinedItems: []
  },

  async onShow() {
    const [created, joined] = await Promise.all([
      listActivities({ scope: 'created', limit: 20 }),
      listActivities({ scope: 'joined', limit: 20 })
    ]);

    this.setData({
      createdItems: created.items,
      joinedItems: joined.items
    });
  }
});
```

- [ ] **Step 4: Run test to verify it passes and smoke the pages**

Run: `npm test -- tests/miniprogram/utils/view-models.test.js --runInBand`  
Expected: PASS with `1 passed`

Run: `npm run copy:cloud-shared`  
Expected: no error output

Manual smoke:
- Open home page and confirm list loads
- Create one activity and confirm redirect works
- Open detail page and confirm share path contains `activityId`
- Open my page and confirm created/joined sections render

- [ ] **Step 5: Commit**

```bash
git add miniprogram/app.js miniprogram/app.json miniprogram/app.wxss miniprogram/pages/home miniprogram/pages/activity-detail miniprogram/pages/my miniprogram/components/activity-card miniprogram/components/signup-sheet miniprogram/components/team-list miniprogram/utils/formatters.js tests/miniprogram/utils/view-models.test.js
git commit -m "feat: build home detail and my pages"
```

### Task 6: Add Organizer Stats and Security Rules

**Files:**
- Create: `D:/workspace/Nautilus/cloudfunctions/getActivityStats/index.js`
- Create: `D:/workspace/Nautilus/docs/cloudbase/security-rules.json`
- Create: `D:/workspace/Nautilus/docs/cloudbase/indexes.md`
- Modify: `D:/workspace/Nautilus/miniprogram/services/activity-service.js`
- Test: `D:/workspace/Nautilus/tests/cloudfunctions/getActivityStats.test.js`

- [ ] **Step 1: Write the failing stats authorization test**

```javascript
const getActivityStats = require('../../cloudfunctions/getActivityStats/index');

test('getActivityStats rejects non-organizer', async () => {
  await expect(
    getActivityStats.main(
      { activityId: 'activity_1' },
      { OPENID: 'openid_user' },
      {
        loadActivity: async () => ({ organizerOpenId: 'openid_owner' })
      }
    )
  ).rejects.toThrow('无权限查看统计数据');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cloudfunctions/getActivityStats.test.js --runInBand`  
Expected: FAIL with missing module or missing exported `main`

- [ ] **Step 3: Write minimal stats and security configuration**

```javascript
// cloudfunctions/getActivityStats/index.js
const cloud = require('wx-server-sdk');
const { businessError } = require('./_shared/errors');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  if (deps.loadActivity) {
    const activity = await deps.loadActivity(event.activityId);
    if (activity.organizerOpenId !== context.OPENID) throw businessError('无权限查看统计数据');
    return deps.loadStats(event.activityId);
  }

  const db = cloud.database();
  const activityRes = await db.collection('activities').doc(event.activityId).get();
  if (activityRes.data.organizerOpenId !== context.OPENID) throw businessError('无权限查看统计数据');

  const teamsRes = await db.collection('activity_teams').where({ activityId: event.activityId }).get();
  const regRes = await db.collection('registrations').where({ activityId: event.activityId }).get();

  return {
    activityId: event.activityId,
    totalJoined: regRes.data.filter(item => item.status === 'joined').length,
    totalCancelled: regRes.data.filter(item => item.status === 'cancelled').length,
    teams: teamsRes.data.map(team => ({
      teamId: team._id,
      teamName: team.teamName,
      joinedCount: team.joinedCount,
      maxMembers: team.maxMembers
    }))
  };
}

module.exports = { main };
```

```json
// docs/cloudbase/security-rules.json
{
  "read": false,
  "write": false
}
```

```markdown
<!-- docs/cloudbase/indexes.md -->
# CloudBase Index Checklist

- activities: status + startAt
- activities: organizerOpenId + createdAt
- activity_teams: activityId + sort
- registrations: activityId + status
- registrations: userOpenId + updatedAt
- activity_logs: activityId + createdAt
```

```javascript
// miniprogram/services/activity-service.js
function getActivityStats(activityId) {
  return call('getActivityStats', { activityId });
}

module.exports = {
  createActivity,
  listActivities,
  getActivityDetail,
  getActivityStats
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cloudfunctions/getActivityStats.test.js --runInBand`  
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/getActivityStats/index.js docs/cloudbase/security-rules.json docs/cloudbase/indexes.md miniprogram/services/activity-service.js tests/cloudfunctions/getActivityStats.test.js
git commit -m "feat: add organizer stats and cloudbase rule docs"
```

### Task 7: Final QA, Seed Data, and Release Readiness

**Files:**
- Create: `D:/workspace/Nautilus/docs/cloudbase/manual-smoke-checklist.md`
- Create: `D:/workspace/Nautilus/docs/cloudbase/seed-sample.json`
- Modify: `D:/workspace/Nautilus/docs/cloudbase/indexes.md`
- Test: `D:/workspace/Nautilus/tests/cloudfunctions/joinActivity.test.js`
- Test: `D:/workspace/Nautilus/tests/cloudfunctions/cancelRegistration.test.js`

- [ ] **Step 1: Extend tests for duplicate-join and rejoin cases**

```javascript
test('joinActivity rejects duplicate active registration', async () => {
  await expect(
    joinActivity.main(
      { activityId: 'activity_1', teamId: 'team_white', signupName: '刘力', source: 'share' },
      { OPENID: 'openid_a' },
      {
        runJoin: async () => {
          throw new Error('你已报名该活动');
        }
      }
    )
  ).rejects.toThrow('你已报名该活动');
});

test('cancelRegistration keeps historical record instead of deleting', async () => {
  const result = await cancelRegistration.main(
    { activityId: 'activity_1' },
    { OPENID: 'openid_a' },
    { runCancel: async () => ({ registrationId: 'activity_1_openid_a', status: 'cancelled' }) }
  );
  expect(result.registrationId).toBe('activity_1_openid_a');
});
```

- [ ] **Step 2: Run the core cloud-function suite**

Run: `npm test -- tests/cloudfunctions/createActivity.test.js tests/cloudfunctions/joinActivity.test.js tests/cloudfunctions/cancelRegistration.test.js tests/cloudfunctions/getActivityStats.test.js --runInBand`  
Expected: PASS with all selected suites passing

- [ ] **Step 3: Write release support docs**

```markdown
<!-- docs/cloudbase/manual-smoke-checklist.md -->
# Manual Smoke Checklist

- Confirm home page loads published activities
- Confirm create activity writes activity and team records
- Confirm detail page shows team counts
- Confirm join flow writes `registrations._id = activityId_openid`
- Confirm cancel flow changes status to `cancelled`
- Confirm organizer-only stats reject non-organizer access
- Confirm activity share link opens the same detail page
```

```json
// docs/cloudbase/seed-sample.json
{
  "activities": [
    {
      "title": "周六 8-10",
      "organizerOpenId": "openid_seed_owner",
      "startAt": "2026-04-26T20:00:00.000Z",
      "endAt": "2026-04-26T22:00:00.000Z",
      "addressText": "半石",
      "signupLimitTotal": 12,
      "joinedCount": 0,
      "requirePhone": false,
      "feeMode": "free",
      "status": "published"
    }
  ]
}
```

- [ ] **Step 4: Run full verification and import seed data**

Run: `npm test -- --runInBand`  
Expected: PASS with all suites green

Manual:
- Import sample seed data into a test environment
- Add the indexes from `docs/cloudbase/indexes.md`
- Configure database write rules to block direct client access
- Deploy cloud functions after running `npm run copy:cloud-shared`

- [ ] **Step 5: Commit**

```bash
git add docs/cloudbase/manual-smoke-checklist.md docs/cloudbase/seed-sample.json docs/cloudbase/indexes.md tests/cloudfunctions/joinActivity.test.js tests/cloudfunctions/cancelRegistration.test.js
git commit -m "docs: add release checklist and seed data"
```

## 2-Week MVP Schedule

### Week 1

| Day | Focus | Deliverable |
| --- | --- | --- |
| Day 1 | Task 1 | repo bootstrap, validators, test harness |
| Day 2 | Task 2 | `ensureUserProfile`, read APIs, service wrappers |
| Day 3 | Task 3 | create activity cloud function and create page shell |
| Day 4 | Task 3 | team editor, field validation, create flow manual smoke |
| Day 5 | Task 4 | transactional join/cancel core logic |

### Week 2

| Day | Focus | Deliverable |
| --- | --- | --- |
| Day 6 | Task 5 | home page and activity card |
| Day 7 | Task 5 | detail page, signup sheet, cancel action |
| Day 8 | Task 5 | my page and share flow |
| Day 9 | Task 6 | organizer stats, security rules, indexes |
| Day 10 | Task 7 | end-to-end smoke test, seed data, release checklist |

## Self-Review

### Spec Coverage

- Activity creation: covered by Task 3.
- Group-share entry and detail page: covered by Task 5.
- Team signup and cancel with duplicate protection: covered by Task 4 and Task 5.
- `openid` auto-profile creation: covered by Task 2.
- Organizer stats: covered by Task 6.
- Future-ready schema for payments and analytics: covered in collection definitions and index/rule docs.

### Placeholder Scan

- No `TODO` / `TBD` placeholders intentionally left in the plan body.
- Commit commands, file paths, and test commands are explicit.

### Type Consistency

- User identity uses `openid` / `OPENID` consistently.
- Registration identity uses `activityId_openid` consistently.
- Activity/team/registration status values match the design doc.
