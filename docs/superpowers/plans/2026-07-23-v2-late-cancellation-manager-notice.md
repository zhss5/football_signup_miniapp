# V2 Late-Cancellation Manager Notice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the activity organizer an independently subscribed WeChat notice when a real participant cancels inside the configured late-cancellation window.

**Architecture:** Keep the existing registration-threshold template contract unchanged and add a second manager notification purpose with its own stable template key and subscription document. The mini program requests both configured template IDs together, while `cancelRegistration` reads the organizer's cancellation-specific grant, builds the selected template fields, and consumes only that grant.

**Tech Stack:** WeChat Mini Program JavaScript, CloudBase cloud functions, CloudBase document database, Jest, Markdown documentation.

## Global Constraints

- Follow `AGENTS.md`, especially the future MySQL 8.x and self-hosted server compatibility constraints.
- Use stable API names and `templateKey` enum strings.
- Keep real WeChat template IDs in `miniprogram/config/env.local.js`; never commit them.
- Do not implement runtime MySQL migration, dual-write, or a self-hosted HTTP API.
- Preserve unrelated dirty worktree files and stage only files listed by each task.
- Follow TDD: add a failing test, verify the expected failure, add minimal production code, and verify green.
- Commit each task independently and do not push.

---

### Task 1: Multi-Template Manager Subscription Client

**Files:**
- Modify: `tests/miniprogram/services/notification-service.test.js`
- Modify: `tests/miniprogram/pages/activity-create-submit.test.js`
- Modify: `tests/miniprogram/config/env.test.js`
- Modify: `miniprogram/services/notification-service.js`
- Modify: `miniprogram/pages/activity-create/index.js`
- Modify: `miniprogram/config/env.js`
- Local only: `miniprogram/config/env.local.js`

**Interfaces:**
- Produces: `MANAGER_LATE_CANCELLATION_NOTICE_TEMPLATE_KEY = 'manager_late_cancellation_notice'`.
- Produces: `getManagerLateCancellationNoticeTemplateId(): string`.
- Produces: `requestManagerNotificationSubscriptionsConsent(templateKeys?): Promise<SubscriptionResult[]>`.
- Produces: `requestManagerNotificationSubscriptions(activityId, templateKeys?): Promise<SubscriptionResult[]>`.
- Keeps: existing single-registration-template functions as compatibility wrappers.

- [ ] **Step 1: Write failing service tests**

Add tests that configure two distinct manager template IDs and require one `wx.requestSubscribeMessage` call:

```js
expect(global.wx.requestSubscribeMessage).toHaveBeenCalledWith({
  tmplIds: ['tmpl_threshold', 'tmpl_late_cancel'],
  success: expect.any(Function),
  fail: expect.any(Function)
});
expect(results).toEqual([
  expect.objectContaining({
    templateKey: 'manager_registration_notice',
    templateId: 'tmpl_threshold',
    status: 'accepted'
  }),
  expect.objectContaining({
    templateKey: 'manager_late_cancellation_notice',
    templateId: 'tmpl_late_cancel',
    status: 'accepted'
  })
]);
```

Also cover one configured template, declined results, and no configured templates.

- [ ] **Step 2: Run service tests and verify red**

Run:

```powershell
.\node_modules\.bin\jest.cmd tests/miniprogram/services/notification-service.test.js --runInBand
```

Expected: FAIL because the aggregate manager subscription API and late-cancellation key do not exist.

- [ ] **Step 3: Implement aggregate consent and recording**

Represent configured manager templates as stable descriptors:

```js
const MANAGER_LATE_CANCELLATION_NOTICE_TEMPLATE_KEY =
  'manager_late_cancellation_notice';

function getConfiguredManagerNotificationTemplates(templateKeys) {
  return [
    {
      templateKey: MANAGER_REGISTRATION_NOTICE_TEMPLATE_KEY,
      templateId: getManagerRegistrationNoticeTemplateId()
    },
    {
      templateKey: MANAGER_LATE_CANCELLATION_NOTICE_TEMPLATE_KEY,
      templateId: getManagerLateCancellationNoticeTemplateId()
    }
  ].filter(item => item.templateId && (!templateKeys || templateKeys.includes(item.templateKey)));
}
```

Call `wx.requestSubscribeMessage` once with all configured IDs and map each returned status back to its template key. Record each non-skipped result through the existing `recordNotificationSubscription` cloud API.

- [ ] **Step 4: Write failing create-flow and environment tests**

Require create mode to request aggregate consent before `createActivity`, then record both returned results after the new activity ID is known. Require `env.js` defaults to expose an empty `managerLateCancellationNotice` value.

- [ ] **Step 5: Run create-flow tests and verify red**

Run:

```powershell
.\node_modules\.bin\jest.cmd tests/miniprogram/pages/activity-create-submit.test.js tests/miniprogram/config/env.test.js --runInBand
```

Expected: FAIL because create mode still requests and records one manager template.

- [ ] **Step 6: Wire create mode and local configuration**

Create mode must:

```js
const managerSubscriptions = this.data.isEditMode
  ? []
  : await requestManagerNotificationSubscriptionsConsent().catch(() => []);

for (const subscription of managerSubscriptions) {
  await recordActivityNotificationSubscription(activityId, subscription).catch(() => null);
}
```

Add `managerLateCancellationNotice: ''` to committed defaults. Add the real selected template ID only to ignored `miniprogram/config/env.local.js`.

- [ ] **Step 7: Verify Task 1**

Run:

```powershell
.\node_modules\.bin\jest.cmd tests/miniprogram/services/notification-service.test.js tests/miniprogram/pages/activity-create-submit.test.js tests/miniprogram/config/env.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```powershell
git add tests/miniprogram/services/notification-service.test.js tests/miniprogram/pages/activity-create-submit.test.js tests/miniprogram/config/env.test.js miniprogram/services/notification-service.js miniprogram/pages/activity-create/index.js miniprogram/config/env.js
git commit -m "feat: split manager notification subscriptions"
```

---

### Task 2: Independent Activity Detail Subscription State

**Files:**
- Modify: `tests/cloudfunctions/getActivityDetail.test.js`
- Modify: `tests/miniprogram/pages/activity-detail.test.js`
- Modify: `cloudfunctions/getActivityDetail/index.js`
- Modify: `miniprogram/pages/activity-detail/index.js`
- Modify: `miniprogram/pages/activity-detail/index.wxml`
- Modify: `miniprogram/i18n/messages.js`

**Interfaces:**
- Produces viewer fields:
  - `lateCancellationNotificationSubscribed: boolean`
  - `lateCancellationNotificationSubscriptionTemplateId: string`
- Consumes the aggregate subscription functions from Task 1.
- Keeps the existing threshold subscription viewer fields for compatibility.

- [ ] **Step 1: Write failing backend state tests**

Seed accepted threshold and late-cancellation subscription rows independently and require `getActivityDetail` to return both states only to manager-capable viewers:

```js
expect(organizerResult.viewer).toMatchObject({
  registrationNotificationSubscribed: true,
  lateCancellationNotificationSubscribed: true
});
expect(regularResult.viewer).toMatchObject({
  registrationNotificationSubscribed: false,
  lateCancellationNotificationSubscribed: false
});
```

- [ ] **Step 2: Run backend state tests and verify red**

Run:

```powershell
.\node_modules\.bin\jest.cmd tests/cloudfunctions/getActivityDetail.test.js --runInBand
```

Expected: FAIL because the late-cancellation viewer fields are missing.

- [ ] **Step 3: Implement generic subscription-state lookup**

Replace the one-purpose helper with:

```js
async function getManagerNotificationSubscriptionState(
  db,
  activityId,
  openid,
  templateKey
) {
  // Query accepted row and return { subscribed, templateId }.
}
```

Query both stable keys only for manager-capable viewers and expose the additive viewer fields.

- [ ] **Step 4: Write failing Activity Detail UI tests**

Require the combined manager notification action to:

- remain enabled when either configured template is missing;
- request only the missing template key;
- become disabled only when every configured manager purpose has an accepted subscription with the expected template ID;
- retain the existing threshold template mismatch recovery.

Use:

```js
expect(requestManagerNotificationSubscriptions).toHaveBeenCalledWith(
  'activity_123',
  ['manager_late_cancellation_notice']
);
```

- [ ] **Step 5: Run Activity Detail tests and verify red**

Run:

```powershell
.\node_modules\.bin\jest.cmd tests/miniprogram/pages/activity-detail.test.js --runInBand
```

Expected: FAIL because the page only understands the threshold subscription.

- [ ] **Step 6: Implement combined renewal UI**

Normalize each saved template ID against the current local configuration. Derive a combined state from only configured manager templates. Change the visible Chinese action from `订阅报名通知` to `订阅运营通知`, request only missing purposes, and update the returned viewer state without exposing manager fields to ordinary users.

- [ ] **Step 7: Verify Task 2**

Run:

```powershell
.\node_modules\.bin\jest.cmd tests/cloudfunctions/getActivityDetail.test.js tests/miniprogram/pages/activity-detail.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```powershell
git add tests/cloudfunctions/getActivityDetail.test.js tests/miniprogram/pages/activity-detail.test.js cloudfunctions/getActivityDetail/index.js miniprogram/pages/activity-detail/index.js miniprogram/pages/activity-detail/index.wxml miniprogram/i18n/messages.js
git commit -m "feat: expose manager notification subscription states"
```

---

### Task 3: Cancellation-Specific Organizer Message

**Files:**
- Modify: `tests/cloudfunctions/cancelRegistration.test.js`
- Modify: `cloudfunctions/cancelRegistration/index.js`

**Interfaces:**
- Produces: `buildLateCancellationMessageData(activity, payload, managerAlias)`.
- Consumes: `users.managerAlias`, falling back to `payload.actorName`.
- Consumes only `manager_late_cancellation_notice` subscriptions.

- [ ] **Step 1: Write failing template-contract tests**

Require the actual send payload:

```js
expect(sendSubscribeMessage).toHaveBeenCalledWith({
  touser: 'openid_owner',
  templateId: 'tmpl_late_cancel',
  page: 'pages/activity-detail/index?activityId=activity_1',
  data: {
    time2: { value: '2026-05-10 04:00' },
    thing3: { value: 'May 9 training' },
    thing6: { value: '取消后剩余 0/12 人' },
    thing8: { value: '老张-左后卫' }
  },
  miniprogramState: 'formal',
  lang: 'zh_CN'
});
```

The timestamp expectation uses the existing stored UTC instant formatted as China time. Add a second test with an empty/missing `users.managerAlias` and require `thing8` to use `signupName`.

- [ ] **Step 2: Write failing subscription-isolation tests**

Seed both accepted template keys. Require cancellation to consume only `manager_late_cancellation_notice`, leave `manager_registration_notice` accepted, and log:

```js
expect.objectContaining({
  notificationType: 'registration_cancelled',
  templateKey: 'manager_late_cancellation_notice',
  templateId: 'tmpl_late_cancel',
  status: 'sent'
});
```

- [ ] **Step 3: Run cancellation tests and verify red**

Run:

```powershell
.\node_modules\.bin\jest.cmd tests/cloudfunctions/cancelRegistration.test.js --runInBand
```

Expected: FAIL because cancellation still reads and consumes `manager_registration_notice` and uses the threshold-template fields.

- [ ] **Step 4: Implement cancellation template mapping**

Add deterministic helpers:

```js
function formatChinaDateTime(value) {
  const parsed = Date.parse(value || '');
  if (!Number.isFinite(parsed)) return '';
  const date = new Date(parsed + 8 * 60 * 60 * 1000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function buildLateCancellationMessageData(activity, payload, managerAlias) {
  return {
    time2: { value: formatChinaDateTime(activity.startAt) },
    thing3: { value: clip(activity.title || '足球活动', 20) },
    thing6: {
      value: clip(
        `取消后剩余 ${normalizeCount(payload.joinedCountAfter)}/${normalizeCount(
          payload.signupLimitTotal
        )} 人`,
        20
      )
    },
    thing8: { value: clip(managerAlias || payload.actorName || '队员', 20) }
  };
}
```

Read the cancelling real user's current `managerAlias` from `users`, query only the new template key, send the cancellation-specific data, and consume/log only that subscription.

- [ ] **Step 5: Verify Task 3**

Run:

```powershell
.\node_modules\.bin\jest.cmd tests/cloudfunctions/cancelRegistration.test.js tests/cloudfunctions/joinActivity.test.js tests/cloudfunctions/manager-notifications.test.js --runInBand
```

Expected: PASS, including the unchanged threshold path.

- [ ] **Step 6: Commit Task 3**

```powershell
git add tests/cloudfunctions/cancelRegistration.test.js cloudfunctions/cancelRegistration/index.js
git commit -m "feat: send dedicated late cancellation notices"
```

---

### Task 4: Local CloudBase Mock Parity

**Files:**
- Modify: `tests/miniprogram/mocks/local-cloud.test.js`
- Modify: `miniprogram/mocks/local-cloud.js`

**Interfaces:**
- Mirrors the two stable manager template keys.
- Exposes both subscription states in local `getActivityDetail`.
- Consumes only the late-cancellation grant for eligible self-cancellation.

- [ ] **Step 1: Write failing local mock tests**

Cover:

- independent accepted state for both manager template keys;
- threshold join consumes only `manager_registration_notice`;
- eligible late self-cancellation consumes only `manager_late_cancellation_notice`;
- the local cancellation log contains `取消后剩余 12/15 人` and the current `managerAlias`;
- disabled/outside-window cancellation does not consume the late-cancellation grant.

- [ ] **Step 2: Run local mock tests and verify red**

Run:

```powershell
.\node_modules\.bin\jest.cmd tests/miniprogram/mocks/local-cloud.test.js --runInBand
```

Expected: FAIL because the local mock has only one manager key and no late-cancellation send.

- [ ] **Step 3: Implement local mock parity**

Add `MANAGER_LATE_CANCELLATION_NOTICE_TEMPLATE_KEY`, generic accepted-subscription helpers, late-window evaluation, cancellation-specific log data, alias fallback, and independent consumption. Keep proxy removal and organizer actions outside this self-cancellation notification path.

- [ ] **Step 4: Verify Task 4**

Run:

```powershell
.\node_modules\.bin\jest.cmd tests/miniprogram/mocks/local-cloud.test.js tests/miniprogram/pages/activity-detail.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```powershell
git add tests/miniprogram/mocks/local-cloud.test.js miniprogram/mocks/local-cloud.js
git commit -m "test: align local late cancellation notices"
```

---

### Task 5: SQL Readiness, Rollout Documentation, and Final Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-06-10-sql-migration-readiness.md`
- Modify: `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`
- Modify: `docs/development-log-v2.md`
- Modify: `docs/superpowers/handoff/football-signup-miniapp-handoff.md`
- Modify: `docs/cloudbase/real-cloudbase-rollout.md`
- Modify: `docs/cloudbase/manual-smoke-checklist.md`

**Interfaces:**
- Documents `manager_late_cancellation_notice` as a stable template-key enum.
- Documents the additive viewer subscription fields and notification log contract.
- Records deployment scope without committing real template IDs.

- [ ] **Step 1: Update SQL and API compatibility documentation**

Record:

- no new SQL column or table;
- notification-subscription uniqueness remains `(activity_id, user_open_id, template_key)`;
- `manager_late_cancellation_notice` is a new stable enum value;
- `notification_logs.notification_type = registration_cancelled`;
- manager alias is read from the user row and is not copied into the notification log as a new database column.

- [ ] **Step 2: Update progress, development log, handoff, and smoke checklist**

Document the new local config key, mini-program upload requirement, cloud-function deployment scope, accepted/consumed checks, and the expected rendered message fields.

- [ ] **Step 3: Run targeted regression**

Run:

```powershell
.\node_modules\.bin\jest.cmd tests/miniprogram/services/notification-service.test.js tests/miniprogram/pages/activity-create-submit.test.js tests/miniprogram/pages/activity-detail.test.js tests/miniprogram/mocks/local-cloud.test.js tests/cloudfunctions/getActivityDetail.test.js tests/cloudfunctions/cancelRegistration.test.js tests/cloudfunctions/joinActivity.test.js tests/cloudfunctions/manager-notifications.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 4: Run full regression**

Use direct Jest to avoid the repository pretest copy step overwriting unrelated dirty copied helper files:

```powershell
.\node_modules\.bin\jest.cmd --runInBand
```

Expected: all suites pass.

- [ ] **Step 5: Run final diff validation**

Run:

```powershell
git diff --check
git status --short --branch
```

Expected: no whitespace errors in goal files; only the pre-existing unrelated dirty files remain outside the goal commits.

- [ ] **Step 6: Commit Task 5**

```powershell
git add docs/superpowers/specs/2026-06-10-sql-migration-readiness.md docs/superpowers/progress/football-signup-miniapp-v2-progress.md docs/development-log-v2.md docs/superpowers/handoff/football-signup-miniapp-handoff.md docs/cloudbase/real-cloudbase-rollout.md docs/cloudbase/manual-smoke-checklist.md
git commit -m "docs: record late cancellation notification rollout"
```
