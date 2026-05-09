# Activity Experience Polish Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first shippable slice of activity experience polish: Home empty state, share-card-safe images, team color labels, and organizer/admin team color editing.

**Architecture:** Keep activity cover, thumbnail, and share image as separate purpose-built media fields. Add semantic team color keys that fall back by team sort for historical data, and isolate team color writes in a focused `updateTeamColor` cloud function instead of overloading activity editing.

**Tech Stack:** Native WeChat Mini Program JavaScript, WeChat CloudBase cloud functions, local mock client, Jest tests.

---

## Scope

This plan implements phase 1 from `docs/superpowers/specs/2026-05-09-activity-experience-polish-design.md`.

Included:

- Home empty state when no joinable activities are visible.
- `shareImage` storage, upload, resolution, and share fallback ordering.
- Team color defaults and display in Create/Edit, Activity Detail, and roster cards.
- Organizer/admin team color update from Activity Detail.

Not included in this phase:

- Detail gallery images.
- Manager registration-change subscription notifications.

## File Structure

Create:

- `miniprogram/utils/team-colors.js`: shared mini program palette, default color lookup, and option builder.
- `cloudfunctions/updateTeamColor/index.js`: permission-checked cloud function for changing one team color.
- `cloudfunctions/updateTeamColor/package.json`: function package metadata.
- `tests/miniprogram/utils/team-colors.test.js`: palette and fallback tests.
- `tests/cloudfunctions/updateTeamColor.test.js`: cloud permission and validation tests.

Modify:

- `miniprogram/utils/constants.js`: set `MAX_ACTIVITY_IMAGES` to cover-only semantics or keep at `1`; add `TEAM_COLOR_KEYS` only if shared constants remain cleaner than a new utility.
- `miniprogram/utils/activity-draft.js`: include `shareImage` and team `colorKey` in create/edit payloads.
- `miniprogram/utils/formatters.js`: expose `teamColorKey`, label text, and CSS class/style fields in `buildTeamListVm`.
- `miniprogram/utils/cover-crop.js`: add 5:4 share image output constants.
- `miniprogram/pages/activity-cover-crop/index.js`: export `shareTempFilePath` along with cover and thumb.
- `miniprogram/pages/activity-create/index.js`: upload `shareImage`, keep team color fields, and include them in payload.
- `miniprogram/pages/activity-create/index.wxml`: show team color controls through `team-editor`.
- `miniprogram/components/team-editor/index.js`: assign default color keys, update color keys from palette taps.
- `miniprogram/components/team-editor/index.wxml`: render color chip/name interaction.
- `miniprogram/components/team-editor/index.wxss`: render readable color chips.
- `miniprogram/components/team-list/index.js`: emit `teamcolortap`.
- `miniprogram/components/team-list/index.wxml`: render colored team labels and manager edit tap target.
- `miniprogram/components/team-list/index.wxss`: render team colors with contrast and borders.
- `miniprogram/pages/activity-detail/index.js`: share image fallback and organizer/admin color update flow.
- `miniprogram/pages/activity-detail/index.wxml`: bind team color update event.
- `miniprogram/pages/home/index.js`: expose empty-state visibility.
- `miniprogram/pages/home/index.wxml`: render `暂无活动安排`.
- `miniprogram/pages/home/index.wxss`: center the empty state in the available list area.
- `miniprogram/locales/en-US.js`: add English empty-state and team-color labels.
- `miniprogram/locales/zh-CN.js`: add Chinese empty-state and team-color labels.
- `miniprogram/services/activity-service.js`: expose `updateTeamColor`, resolve `shareImage` as `shareDisplayImage`.
- `miniprogram/services/cloud.js`: no interface change expected; reuse existing `call`, `uploadFile`, `resolveFileUrls`.
- `miniprogram/mocks/local-cloud.js`: persist default team colors and implement `updateTeamColor`.
- `cloudfunctions/createActivity/index.js`: store team `colorKey` and activity `shareImage`.
- `cloudfunctions/updateActivity/index.js`: keep existing team colors; store updated `shareImage`.
- `cloudfunctions/getActivityDetail/index.js`: return team `colorKey`.
- `cloudfunctions/_shared/validators.js`: validate allowed team color keys if validation is centralized.
- `docs/development-log.md`: record implementation and deployment notes.
- `docs/cloudbase/real-cloudbase-rollout.md`: add `activity-share-images/` storage rule reminder and `updateTeamColor` deployment entry.

Test:

- `tests/miniprogram/pages/home.test.js`
- `tests/miniprogram/pages/activity-detail.test.js`
- `tests/miniprogram/pages/activity-detail-cover.test.js`
- `tests/miniprogram/pages/activity-cover-crop.test.js`
- `tests/miniprogram/pages/activity-create-submit.test.js`
- `tests/miniprogram/components/team-editor.test.js`
- `tests/miniprogram/components/team-list-remove.test.js`
- `tests/miniprogram/services/activity-service.test.js`
- `tests/miniprogram/mocks/local-cloud.test.js`
- `tests/cloudfunctions/createActivity.test.js`
- `tests/cloudfunctions/updateActivity.test.js`
- `tests/cloudfunctions/getActivityDetail.test.js`

---

### Task 1: Home Empty State

**Files:**

- Modify: `miniprogram/pages/home/index.js`
- Modify: `miniprogram/pages/home/index.wxml`
- Modify: `miniprogram/pages/home/index.wxss`
- Modify: `miniprogram/locales/zh-CN.js`
- Modify: `miniprogram/locales/en-US.js`
- Test: `tests/miniprogram/pages/home.test.js`

- [ ] **Step 1: Write failing page-state test**

Add this test to `tests/miniprogram/pages/home.test.js`:

```javascript
test('shows the empty state after loading when no joinable activities are visible', async () => {
  ensureUserProfile.mockResolvedValue({
    user: {
      roles: ['user']
    }
  });
  listActivities.mockResolvedValue({
    items: [
      {
        _id: 'closed_activity',
        title: 'Closed',
        statusTone: 'disabled'
      }
    ]
  });

  const ctx = {
    ...pageConfig,
    data: {
      items: [],
      loading: false,
      emptyVisible: false,
      canCreateActivity: false
    },
    setData(update) {
      this.data = {
        ...this.data,
        ...update
      };
    }
  };

  await pageConfig.onShow.call(ctx);

  expect(ctx.data.items).toEqual([]);
  expect(ctx.data.loading).toBe(false);
  expect(ctx.data.emptyVisible).toBe(true);
});
```

- [ ] **Step 2: Write failing template test**

Add this test to `tests/miniprogram/pages/home.test.js`:

```javascript
test('home template renders an empty activity message only when the empty state is visible', () => {
  const fs = require('fs');
  const path = require('path');
  const wxml = fs.readFileSync(
    path.join(process.cwd(), 'miniprogram/pages/home/index.wxml'),
    'utf8'
  );

  expect(wxml).toContain('wx:if="{{emptyVisible}}"');
  expect(wxml).toContain('{{i18n.home.emptyTitle}}');
});
```

- [ ] **Step 3: Run the targeted failing test**

Run:

```bash
node node_modules/jest/bin/jest.js tests/miniprogram/pages/home.test.js --runInBand -t "empty state"
```

Expected: FAIL because `emptyVisible` and the WXML empty block are not implemented.

- [ ] **Step 4: Implement Home empty state**

In `miniprogram/pages/home/index.js`, add `emptyVisible` to `data` and compute it after load:

```javascript
data: {
  items: [],
  loading: false,
  emptyVisible: false,
  canCreateActivity: false,
  locale: '',
  i18n: {}
}
```

Update successful load:

```javascript
this.setData({
  items: itemsWithDisplayCovers,
  loading: false,
  emptyVisible: itemsWithDisplayCovers.length === 0
});
```

Update error handling:

```javascript
this.setData({
  loading: false,
  emptyVisible: this.data.items.length === 0
});
```

In `miniprogram/pages/home/index.wxml`, add the empty block after the list:

```xml
<view wx:if="{{emptyVisible}}" class="empty-state">
  <text class="empty-title">{{i18n.home.emptyTitle}}</text>
  <text class="empty-copy">{{i18n.home.emptyCopy}}</text>
</view>
```

In `miniprogram/pages/home/index.wxss`, add:

```css
.empty-state {
  min-height: 720rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48rpx 32rpx 140rpx;
  color: #8a94a6;
  text-align: center;
}

.empty-title {
  color: #2f3542;
  font-size: 34rpx;
  font-weight: 700;
}

.empty-copy {
  margin-top: 16rpx;
  font-size: 26rpx;
}
```

Add locale keys:

```javascript
home: {
  emptyTitle: '暂无活动安排',
  emptyCopy: '有新活动时会显示在这里'
}
```

and:

```javascript
home: {
  emptyTitle: 'No activities scheduled',
  emptyCopy: 'New joinable activities will appear here.'
}
```

- [ ] **Step 5: Run targeted test and commit**

Run:

```bash
node node_modules/jest/bin/jest.js tests/miniprogram/pages/home.test.js --runInBand
```

Expected: PASS.

Commit:

```bash
git add miniprogram/pages/home/index.js miniprogram/pages/home/index.wxml miniprogram/pages/home/index.wxss miniprogram/locales/en-US.js miniprogram/locales/zh-CN.js tests/miniprogram/pages/home.test.js
git commit -m "Add home empty activity state"
```

---

### Task 2: Team Color Utilities and Persistence Defaults

**Files:**

- Create: `miniprogram/utils/team-colors.js`
- Modify: `miniprogram/utils/activity-draft.js`
- Modify: `cloudfunctions/createActivity/index.js`
- Modify: `cloudfunctions/updateActivity/index.js`
- Modify: `cloudfunctions/getActivityDetail/index.js`
- Modify: `miniprogram/mocks/local-cloud.js`
- Test: `tests/miniprogram/utils/team-colors.test.js`
- Test: `tests/miniprogram/utils/activity-draft.test.js`
- Test: `tests/cloudfunctions/createActivity.test.js`
- Test: `tests/cloudfunctions/updateActivity.test.js`
- Test: `tests/cloudfunctions/getActivityDetail.test.js`

- [ ] **Step 1: Write failing team color utility tests**

Create `tests/miniprogram/utils/team-colors.test.js`:

```javascript
const {
  TEAM_COLOR_OPTIONS,
  getDefaultTeamColorKey,
  getTeamColorOption,
  normalizeTeamColorKey
} = require('../../../miniprogram/utils/team-colors');

test('cycles team colors green white red blue black yellow', () => {
  expect(Array.from({ length: 8 }, (_, index) => getDefaultTeamColorKey(index))).toEqual([
    'green',
    'white',
    'red',
    'blue',
    'black',
    'yellow',
    'green',
    'white'
  ]);
});

test('normalizes unsupported team colors to the index default', () => {
  expect(normalizeTeamColorKey('purple', 2)).toBe('red');
  expect(normalizeTeamColorKey('blue', 2)).toBe('blue');
});

test('exposes readable palette options', () => {
  expect(TEAM_COLOR_OPTIONS).toContainEqual(
    expect.objectContaining({
      key: 'green',
      labelKey: 'teamColors.green'
    })
  );
  expect(getTeamColorOption('white')).toMatchObject({
    key: 'white',
    requiresBorder: true
  });
});
```

- [ ] **Step 2: Run failing utility test**

Run:

```bash
node node_modules/jest/bin/jest.js tests/miniprogram/utils/team-colors.test.js --runInBand
```

Expected: FAIL because `miniprogram/utils/team-colors.js` does not exist.

- [ ] **Step 3: Implement team color utility**

Create `miniprogram/utils/team-colors.js`:

```javascript
const TEAM_COLOR_OPTIONS = [
  { key: 'green', labelKey: 'teamColors.green', className: 'team-color-green', requiresBorder: false },
  { key: 'white', labelKey: 'teamColors.white', className: 'team-color-white', requiresBorder: true },
  { key: 'red', labelKey: 'teamColors.red', className: 'team-color-red', requiresBorder: false },
  { key: 'blue', labelKey: 'teamColors.blue', className: 'team-color-blue', requiresBorder: false },
  { key: 'black', labelKey: 'teamColors.black', className: 'team-color-black', requiresBorder: false },
  { key: 'yellow', labelKey: 'teamColors.yellow', className: 'team-color-yellow', requiresBorder: true }
];

const TEAM_COLOR_KEYS = TEAM_COLOR_OPTIONS.map(item => item.key);

function getDefaultTeamColorKey(index = 0) {
  const safeIndex = Math.max(Number(index) || 0, 0);
  return TEAM_COLOR_KEYS[safeIndex % TEAM_COLOR_KEYS.length];
}

function isTeamColorKey(value) {
  return TEAM_COLOR_KEYS.includes(String(value || '').trim());
}

function normalizeTeamColorKey(value, index = 0) {
  const key = String(value || '').trim();
  return isTeamColorKey(key) ? key : getDefaultTeamColorKey(index);
}

function getTeamColorOption(value, index = 0) {
  const key = normalizeTeamColorKey(value, index);
  return TEAM_COLOR_OPTIONS.find(item => item.key === key) || TEAM_COLOR_OPTIONS[0];
}

module.exports = {
  TEAM_COLOR_KEYS,
  TEAM_COLOR_OPTIONS,
  getDefaultTeamColorKey,
  getTeamColorOption,
  isTeamColorKey,
  normalizeTeamColorKey
};
```

- [ ] **Step 4: Write failing default/persistence tests**

Extend `tests/miniprogram/utils/activity-draft.test.js`:

```javascript
test('default teams include default color keys', () => {
  const form = createDefaultActivityForm();

  expect(form.teams[0]).toMatchObject({
    colorKey: 'green'
  });
});

test('buildActivityPayload preserves team color keys', () => {
  const payload = buildActivityPayload({
    ...createDefaultActivityForm(),
    teams: [
      {
        teamName: '队伍1',
        maxMembers: 12,
        colorKey: 'blue'
      }
    ]
  });

  expect(payload.teams[0]).toMatchObject({
    colorKey: 'blue'
  });
});
```

Extend `tests/cloudfunctions/createActivity.test.js` in the `createActivity stores activity and teams` case:

```javascript
teams: [
  { teamName: 'White', maxMembers: 6, colorKey: 'green' },
  { teamName: 'Red', maxMembers: 6, colorKey: 'red' }
]
```

and assert:

```javascript
expect(writes.filter(item => item.name === 'activity_teams').map(item => item.data.colorKey)).toEqual([
  'green',
  'red'
]);
```

- [ ] **Step 5: Run failing default/persistence tests**

Run:

```bash
node node_modules/jest/bin/jest.js tests/miniprogram/utils/activity-draft.test.js tests/cloudfunctions/createActivity.test.js --runInBand -t "color"
```

Expected: FAIL because teams do not carry `colorKey`.

- [ ] **Step 6: Implement team color defaults and persistence**

In `miniprogram/utils/activity-draft.js`, import:

```javascript
const { normalizeTeamColorKey } = require('./team-colors');
```

When building default teams:

```javascript
{ teamName: '队伍1', maxMembers: 12, colorKey: 'green' }
```

Normalize teams in `buildActivityPayload`:

```javascript
const teams = form.teams.map((team, index) => ({
  ...team,
  teamName: String(team.teamName || '').trim(),
  maxMembers: Number(team.maxMembers) || 0,
  colorKey: normalizeTeamColorKey(team.colorKey, index)
}));
```

Return `teams` in the payload:

```javascript
return {
  ...payloadBase,
  teams,
  startAt: combineDateAndTime(form.activityDate, form.startTime),
  ...
};
```

In `buildActivityEditForm`, include color:

```javascript
.map((team, index) => ({
  teamName: team.teamName,
  maxMembers: Number(team.maxMembers) || 0,
  colorKey: normalizeTeamColorKey(team.colorKey, index)
}));
```

In `cloudfunctions/createActivity/index.js`, store normalized colors:

```javascript
colorKey: normalizeTeamColorKey(team.colorKey, index)
```

inside each regular team draft and bench team draft should use:

```javascript
colorKey: 'neutral'
```

If `neutral` is not part of the selectable palette, render it only as a view-model fallback and do not accept it from user input.

In `cloudfunctions/updateActivity/index.js`, keep existing team color values by not replacing regular team documents from the edit payload. This phase only persists colors on create; manual updates are handled by `updateTeamColor`.

In `cloudfunctions/getActivityDetail/index.js`, ensure returned teams include `colorKey` by preserving the field from `activity_teams`.

In `miniprogram/mocks/local-cloud.js`, add `colorKey` to created team records using `normalizeTeamColorKey(team.colorKey, index)`.

- [ ] **Step 7: Run targeted tests and commit**

Run:

```bash
node node_modules/jest/bin/jest.js tests/miniprogram/utils/team-colors.test.js tests/miniprogram/utils/activity-draft.test.js tests/cloudfunctions/createActivity.test.js --runInBand
```

Expected: PASS.

Commit:

```bash
git add miniprogram/utils/team-colors.js miniprogram/utils/activity-draft.js miniprogram/mocks/local-cloud.js cloudfunctions/createActivity/index.js cloudfunctions/updateActivity/index.js cloudfunctions/getActivityDetail/index.js tests/miniprogram/utils/team-colors.test.js tests/miniprogram/utils/activity-draft.test.js tests/cloudfunctions/createActivity.test.js tests/cloudfunctions/updateActivity.test.js tests/cloudfunctions/getActivityDetail.test.js
git commit -m "Add default team color persistence"
```

---

### Task 3: Team Color Rendering in Editor and Roster

**Files:**

- Modify: `miniprogram/components/team-editor/index.js`
- Modify: `miniprogram/components/team-editor/index.wxml`
- Modify: `miniprogram/components/team-editor/index.wxss`
- Modify: `miniprogram/components/team-list/index.js`
- Modify: `miniprogram/components/team-list/index.wxml`
- Modify: `miniprogram/components/team-list/index.wxss`
- Modify: `miniprogram/utils/formatters.js`
- Modify: `miniprogram/locales/en-US.js`
- Modify: `miniprogram/locales/zh-CN.js`
- Test: `tests/miniprogram/components/team-editor.test.js`
- Test: `tests/miniprogram/components/team-list-remove.test.js`
- Test: `tests/miniprogram/utils/view-models.test.js`

- [ ] **Step 1: Write failing view-model test**

Add to `tests/miniprogram/utils/view-models.test.js`:

```javascript
test('buildTeamListVm exposes team color display fields with fallback by sort order', () => {
  const teams = buildTeamListVm(
    [
      {
        _id: 'team_one',
        teamName: '队伍1',
        sort: 0,
        colorKey: 'green',
        joinedCount: 0,
        maxMembers: 12,
        members: []
      },
      {
        _id: 'team_two',
        teamName: '队伍2',
        sort: 1,
        joinedCount: 0,
        maxMembers: 12,
        members: []
      }
    ],
    null,
    { status: 'published' }
  );

  expect(teams[0]).toMatchObject({
    teamColorKey: 'green',
    teamColorClass: 'team-color-green'
  });
  expect(teams[1]).toMatchObject({
    teamColorKey: 'white',
    teamColorClass: 'team-color-white'
  });
});
```

- [ ] **Step 2: Write failing component template tests**

Add to `tests/miniprogram/components/team-editor.test.js`:

```javascript
test('renders a team color chip in the team editor row', () => {
  const wxml = fs.readFileSync(
    path.join(__dirname, '../../../miniprogram/components/team-editor/index.wxml'),
    'utf8'
  );

  expect(wxml).toContain('class="team-color-chip');
  expect(wxml).toContain('data-field="colorKey"');
});
```

Add to `tests/miniprogram/components/team-list-remove.test.js`:

```javascript
test('team list renders team names with color styling', () => {
  const fs = require('fs');
  const path = require('path');
  const wxml = fs.readFileSync(
    path.join(process.cwd(), 'miniprogram/components/team-list/index.wxml'),
    'utf8'
  );

  expect(wxml).toContain('team-color-chip');
  expect(wxml).toContain('{{item.teamColorClass}}');
});
```

- [ ] **Step 3: Run targeted failing tests**

Run:

```bash
node node_modules/jest/bin/jest.js tests/miniprogram/utils/view-models.test.js tests/miniprogram/components/team-editor.test.js tests/miniprogram/components/team-list-remove.test.js --runInBand -t "color"
```

Expected: FAIL because color VM/template support is missing.

- [ ] **Step 4: Implement team color view fields**

In `miniprogram/utils/formatters.js`, import:

```javascript
const { getTeamColorOption } = require('./team-colors');
```

Inside `buildTeamListVm`, add to each team VM:

```javascript
const colorOption = getTeamColorOption(team.colorKey, index);

return {
  ...team,
  teamColorKey: colorOption.key,
  teamColorClass: colorOption.className,
  teamColorRequiresBorder: colorOption.requiresBorder,
  ...
};
```

In `miniprogram/components/team-editor/index.js`, import color helpers and expose palette options:

```javascript
const { TEAM_COLOR_OPTIONS, normalizeTeamColorKey } = require('../../utils/team-colors');
```

Add a method:

```javascript
onTeamColorTap(event) {
  const index = Number(event.currentTarget.dataset.index);
  const currentKey = this.properties.teams[index]
    ? normalizeTeamColorKey(this.properties.teams[index].colorKey, index)
    : 'green';
  const currentOptionIndex = TEAM_COLOR_OPTIONS.findIndex(item => item.key === currentKey);
  const nextOption = TEAM_COLOR_OPTIONS[(currentOptionIndex + 1) % TEAM_COLOR_OPTIONS.length];
  const teams = this.properties.teams.map((team, currentIndex) =>
    currentIndex === index
      ? {
          ...team,
          colorKey: nextOption.key
        }
      : team
  );

  this.emitTeams(teams);
}
```

In `onAddTeam`, include `colorKey: normalizeTeamColorKey('', this.properties.teams.length)`.

In `miniprogram/components/team-editor/index.wxml`, add before the team name input:

```xml
<button
  class="team-color-chip team-color-{{item.colorKey || 'green'}}"
  data-index="{{index}}"
  data-field="colorKey"
  bindtap="onTeamColorTap"
></button>
```

In `miniprogram/components/team-list/index.wxml`, render a chip before name:

```xml
<view
  class="team-color-chip {{item.teamColorClass}}"
  data-team-id="{{item._id}}"
  bindtap="onTeamColorTap"
></view>
<text
  class="team-name {{item.teamColorClass}}-text"
  data-team-id="{{item._id}}"
  bindtap="onTeamColorTap"
>{{item.teamName}}</text>
```

In `miniprogram/components/team-list/index.js`, add:

```javascript
onTeamColorTap(event) {
  this.triggerEvent('teamcolortap', {
    teamId: event.currentTarget.dataset.teamId
  });
}
```

Add color CSS classes to both team editor and team list wxss:

```css
.team-color-chip {
  width: 28rpx;
  height: 28rpx;
  flex: 0 0 28rpx;
  border-radius: 50%;
  border: 2rpx solid transparent;
  padding: 0;
  margin: 0 12rpx 0 0;
}

.team-color-green { background: #16a34a; }
.team-color-white { background: #ffffff; border-color: #cbd5e1; }
.team-color-red { background: #dc2626; }
.team-color-blue { background: #2563eb; }
.team-color-black { background: #111827; }
.team-color-yellow { background: #facc15; border-color: #d97706; }

.team-color-green-text { color: #166534; }
.team-color-white-text { color: #334155; }
.team-color-red-text { color: #991b1b; }
.team-color-blue-text { color: #1d4ed8; }
.team-color-black-text { color: #111827; }
.team-color-yellow-text { color: #92400e; }
```

- [ ] **Step 5: Run targeted tests and commit**

Run:

```bash
node node_modules/jest/bin/jest.js tests/miniprogram/utils/view-models.test.js tests/miniprogram/components/team-editor.test.js tests/miniprogram/components/team-list-remove.test.js --runInBand
```

Expected: PASS.

Commit:

```bash
git add miniprogram/components/team-editor/index.js miniprogram/components/team-editor/index.wxml miniprogram/components/team-editor/index.wxss miniprogram/components/team-list/index.js miniprogram/components/team-list/index.wxml miniprogram/components/team-list/index.wxss miniprogram/utils/formatters.js miniprogram/locales/en-US.js miniprogram/locales/zh-CN.js tests/miniprogram/components/team-editor.test.js tests/miniprogram/components/team-list-remove.test.js tests/miniprogram/utils/view-models.test.js
git commit -m "Render team color labels"
```

---

### Task 4: Organizer/Admin Team Color Editing on Activity Detail

**Files:**

- Create: `cloudfunctions/updateTeamColor/index.js`
- Create: `cloudfunctions/updateTeamColor/package.json`
- Modify: `miniprogram/services/activity-service.js`
- Modify: `miniprogram/pages/activity-detail/index.js`
- Modify: `miniprogram/pages/activity-detail/index.wxml`
- Modify: `miniprogram/components/team-list/index.js`
- Modify: `miniprogram/locales/en-US.js`
- Modify: `miniprogram/locales/zh-CN.js`
- Modify: `miniprogram/mocks/local-cloud.js`
- Test: `tests/cloudfunctions/updateTeamColor.test.js`
- Test: `tests/miniprogram/pages/activity-detail.test.js`
- Test: `tests/miniprogram/services/activity-service.test.js`
- Test: `tests/miniprogram/mocks/local-cloud.test.js`

- [ ] **Step 1: Write failing cloud function tests**

Create `tests/cloudfunctions/updateTeamColor.test.js`:

```javascript
const updateTeamColor = require('../../cloudfunctions/updateTeamColor/index');

function createFakeDb({ activity, team, user }) {
  const update = jest.fn().mockResolvedValue({});
  return {
    update,
    collection: jest.fn(name => ({
      doc: jest.fn(id => ({
        get: jest.fn().mockResolvedValue({
          data:
            name === 'activities'
              ? activity
              : name === 'activity_teams'
                ? team
                : name === 'users'
                  ? user
                  : null
        }),
        update
      }))
    }))
  };
}

test('updateTeamColor lets the organizer update one active team color', async () => {
  const db = createFakeDb({
    activity: { _id: 'activity_1', organizerOpenId: 'openid_owner', status: 'published' },
    team: { _id: 'team_1', activityId: 'activity_1', status: 'active' },
    user: { roles: ['user'] }
  });

  await expect(
    updateTeamColor.main(
      { activityId: 'activity_1', teamId: 'team_1', colorKey: 'blue' },
      { OPENID: 'openid_owner' },
      { db, now: '2026-05-09T10:00:00.000Z' }
    )
  ).resolves.toEqual({
    activityId: 'activity_1',
    teamId: 'team_1',
    colorKey: 'blue',
    updated: true
  });

  expect(db.update).toHaveBeenCalledWith({
    data: {
      colorKey: 'blue',
      updatedAt: '2026-05-09T10:00:00.000Z'
    }
  });
});

test('updateTeamColor rejects unsupported colors', async () => {
  const db = createFakeDb({
    activity: { _id: 'activity_1', organizerOpenId: 'openid_owner', status: 'published' },
    team: { _id: 'team_1', activityId: 'activity_1', status: 'active' },
    user: { roles: ['user'] }
  });

  await expect(
    updateTeamColor.main(
      { activityId: 'activity_1', teamId: 'team_1', colorKey: 'purple' },
      { OPENID: 'openid_owner' },
      { db }
    )
  ).rejects.toThrow('Unsupported team color');
});

test('updateTeamColor rejects regular non-owner users', async () => {
  const db = createFakeDb({
    activity: { _id: 'activity_1', organizerOpenId: 'openid_owner', status: 'published' },
    team: { _id: 'team_1', activityId: 'activity_1', status: 'active' },
    user: { roles: ['user'] }
  });

  await expect(
    updateTeamColor.main(
      { activityId: 'activity_1', teamId: 'team_1', colorKey: 'blue' },
      { OPENID: 'openid_other' },
      { db }
    )
  ).rejects.toThrow('Only the organizer or an admin can update team colors');
});
```

- [ ] **Step 2: Run failing cloud tests**

Run:

```bash
node node_modules/jest/bin/jest.js tests/cloudfunctions/updateTeamColor.test.js --runInBand
```

Expected: FAIL because `cloudfunctions/updateTeamColor/index.js` does not exist.

- [ ] **Step 3: Implement `updateTeamColor` cloud function**

Create `cloudfunctions/updateTeamColor/package.json`:

```json
{
  "name": "updateTeamColor",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "^3.0.1"
  }
}
```

Create `cloudfunctions/updateTeamColor/index.js`:

```javascript
const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const TEAM_COLOR_KEYS = ['green', 'white', 'red', 'blue', 'black', 'yellow'];

async function getCurrentUser(db, openid) {
  const result = await db
    .collection(COLLECTIONS.USERS)
    .doc(openid)
    .get()
    .catch(() => ({ data: null }));

  return result.data || null;
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const activityId = String(event.activityId || '').trim();
  const teamId = String(event.teamId || '').trim();
  const colorKey = String(event.colorKey || '').trim();

  if (!activityId) {
    throw businessError('activityId is required');
  }

  if (!teamId) {
    throw businessError('teamId is required');
  }

  if (!TEAM_COLOR_KEYS.includes(colorKey)) {
    throw businessError('Unsupported team color');
  }

  const db = deps.db || cloud.database();
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));
  const activityRes = await db.collection(COLLECTIONS.ACTIVITIES).doc(activityId).get();
  const activity = activityRes.data;

  if (!activity) {
    throw businessError('Activity not found');
  }

  const user = await getCurrentUser(db, openid);
  if (!canEditActivity(activity, user, openid)) {
    throw businessError('Only the organizer or an admin can update team colors');
  }

  const teamRes = await db.collection(COLLECTIONS.ACTIVITY_TEAMS).doc(teamId).get();
  const team = teamRes.data;

  if (!team || team.activityId !== activityId || team.status === 'inactive') {
    throw businessError('Team not found');
  }

  await db.collection(COLLECTIONS.ACTIVITY_TEAMS).doc(teamId).update({
    data: {
      colorKey,
      updatedAt: nowIso(deps.now)
    }
  });

  return {
    activityId,
    teamId,
    colorKey,
    updated: true
  };
}

module.exports = { main };
```

- [ ] **Step 4: Add service and Activity Detail tests**

Add to `tests/miniprogram/services/activity-service.test.js`:

```javascript
test('updateTeamColor delegates to the CloudBase service', async () => {
  const cloud = require('../../../miniprogram/services/cloud');
  cloud.call.mockResolvedValue({
    updated: true
  });

  const activityService = require('../../../miniprogram/services/activity-service');

  await expect(activityService.updateTeamColor('activity_1', 'team_1', 'red')).resolves.toEqual({
    updated: true
  });

  expect(cloud.call).toHaveBeenCalledWith('updateTeamColor', {
    activityId: 'activity_1',
    teamId: 'team_1',
    colorKey: 'red'
  });
});
```

Add to `tests/miniprogram/pages/activity-detail.test.js`:

```javascript
test('onTeamColorTap lets managers choose a color and reloads detail', async () => {
  const { updateTeamColor } = require('../../../miniprogram/services/activity-service');
  updateTeamColor.mockResolvedValue({ updated: true });
  global.wx.showActionSheet = jest.fn(({ success }) => success({ tapIndex: 2 }));

  const ctx = {
    data: {
      activityId: 'activity_123',
      locale: 'en-US',
      viewer: {
        canEditActivity: true
      },
      teams: [
        {
          _id: 'team_white',
          teamName: 'White'
        }
      ]
    },
    reload: jest.fn().mockResolvedValue()
  };

  await pageConfig.onTeamColorTap.call(ctx, {
    detail: {
      teamId: 'team_white'
    }
  });

  expect(updateTeamColor).toHaveBeenCalledWith('activity_123', 'team_white', 'red');
  expect(ctx.reload).toHaveBeenCalled();
});
```

- [ ] **Step 5: Implement service and page flow**

In `miniprogram/services/activity-service.js`, add:

```javascript
function updateTeamColor(activityId, teamId, colorKey) {
  return call('updateTeamColor', {
    activityId,
    teamId,
    colorKey
  });
}
```

Export `updateTeamColor`.

In `miniprogram/pages/activity-detail/index.js`, import:

```javascript
const { TEAM_COLOR_OPTIONS } = require('../../utils/team-colors');
```

and include `updateTeamColor` from `activity-service`.

Add method:

```javascript
async onTeamColorTap(event) {
  const translate = makeTranslator(this.data.locale || getAppLocale());
  const viewer = this.data.viewer || {};

  if (!viewer.canEditActivity) {
    return;
  }

  const teamId = event.detail && event.detail.teamId;
  if (!teamId) {
    return;
  }

  const itemList = TEAM_COLOR_OPTIONS.map(option => translate(option.labelKey));
  const tapIndex = await new Promise(resolve => {
    wx.showActionSheet({
      itemList,
      success: result => resolve(result.tapIndex),
      fail: () => resolve(-1)
    });
  });

  if (tapIndex < 0 || !TEAM_COLOR_OPTIONS[tapIndex]) {
    return;
  }

  try {
    await updateTeamColor(this.data.activityId, teamId, TEAM_COLOR_OPTIONS[tapIndex].key);
    await this.reload();
  } catch (error) {
    wx.showToast({
      title: translateErrorMessage(error, translate),
      icon: 'none'
    });
  }
}
```

In `miniprogram/pages/activity-detail/index.wxml`, wire:

```xml
bind:teamcolortap="onTeamColorTap"
```

on the `team-list` component.

In local mock `miniprogram/mocks/local-cloud.js`, add a handler:

```javascript
updateTeamColor(payload) {
  const state = readState();
  const team = state.activity_teams.find(item => item._id === payload.teamId);
  if (!team || team.activityId !== payload.activityId) {
    throw new Error('Team not found');
  }
  team.colorKey = normalizeTeamColorKey(payload.colorKey, Number(team.sort || 0));
  writeState(state);
  return {
    activityId: payload.activityId,
    teamId: payload.teamId,
    colorKey: team.colorKey,
    updated: true
  };
}
```

- [ ] **Step 6: Run targeted tests and commit**

Run:

```bash
node node_modules/jest/bin/jest.js tests/cloudfunctions/updateTeamColor.test.js tests/miniprogram/services/activity-service.test.js tests/miniprogram/pages/activity-detail.test.js tests/miniprogram/mocks/local-cloud.test.js --runInBand
```

Expected: PASS.

Run copy script before committing generated cloud shared helper copies if the repo expects deployable function packages during tests:

```bash
node scripts/copy-cloud-shared.mjs
```

Commit:

```bash
git add cloudfunctions/updateTeamColor miniprogram/services/activity-service.js miniprogram/pages/activity-detail/index.js miniprogram/pages/activity-detail/index.wxml miniprogram/mocks/local-cloud.js tests/cloudfunctions/updateTeamColor.test.js tests/miniprogram/services/activity-service.test.js tests/miniprogram/pages/activity-detail.test.js tests/miniprogram/mocks/local-cloud.test.js
git commit -m "Allow managers to update team colors"
```

---

### Task 5: Share-Card-Safe Image Pipeline

**Files:**

- Modify: `miniprogram/utils/cover-crop.js`
- Modify: `miniprogram/pages/activity-cover-crop/index.js`
- Modify: `miniprogram/pages/activity-create/index.js`
- Modify: `miniprogram/utils/activity-draft.js`
- Modify: `miniprogram/services/activity-service.js`
- Modify: `miniprogram/pages/activity-detail/index.js`
- Modify: `cloudfunctions/createActivity/index.js`
- Modify: `cloudfunctions/updateActivity/index.js`
- Modify: `miniprogram/mocks/local-cloud.js`
- Test: `tests/miniprogram/pages/activity-cover-crop.test.js`
- Test: `tests/miniprogram/pages/activity-create-submit.test.js`
- Test: `tests/miniprogram/utils/activity-draft.test.js`
- Test: `tests/miniprogram/services/activity-service.test.js`
- Test: `tests/miniprogram/pages/activity-detail.test.js`
- Test: `tests/cloudfunctions/createActivity.test.js`
- Test: `tests/cloudfunctions/updateActivity.test.js`

- [ ] **Step 1: Write failing activity draft and cloud persistence tests**

Add to `tests/miniprogram/utils/activity-draft.test.js`:

```javascript
test('buildActivityPayload preserves a generated share image separately from the cover', () => {
  const payload = buildActivityPayload({
    ...createDefaultActivityForm(),
    coverImage: 'wxfile://cover-1.jpg',
    coverThumbImage: 'wxfile://cover-1-thumb.jpg',
    shareImage: 'wxfile://cover-1-share.jpg',
    imageList: ['wxfile://cover-1.jpg']
  });

  expect(payload.coverImage).toBe('wxfile://cover-1.jpg');
  expect(payload.coverThumbImage).toBe('wxfile://cover-1-thumb.jpg');
  expect(payload.shareImage).toBe('wxfile://cover-1-share.jpg');
});
```

Add to `tests/cloudfunctions/createActivity.test.js`:

```javascript
shareImage: 'cloud://football/share-1.jpg',
```

and assert:

```javascript
expect(writes[0].data.shareImage).toBe('cloud://football/share-1.jpg');
```

- [ ] **Step 2: Run failing persistence tests**

Run:

```bash
node node_modules/jest/bin/jest.js tests/miniprogram/utils/activity-draft.test.js tests/cloudfunctions/createActivity.test.js --runInBand -t "share image"
```

Expected: FAIL because `shareImage` is not in the form/payload/cloud data.

- [ ] **Step 3: Implement share image payload fields**

In `createDefaultActivityForm`, add:

```javascript
shareImage: '',
```

In `buildActivityPayload`, add:

```javascript
shareImage: coverImage ? form.shareImage || '' : '',
```

In `buildActivityEditForm`, add:

```javascript
shareImage: activity.shareImage || '',
```

In `cloudfunctions/createActivity/index.js`, store:

```javascript
shareImage: event.shareImage || '',
```

In `cloudfunctions/updateActivity/index.js`, update:

```javascript
shareImage: event.shareImage || '',
```

In `miniprogram/mocks/local-cloud.js`, persist `shareImage` in create and update paths.

- [ ] **Step 4: Write failing crop export test**

Add to `tests/miniprogram/pages/activity-cover-crop.test.js`:

```javascript
test('confirm emits a share image path with the cropped cover result', async () => {
  const emitted = {};
  const ctx = {
    ...pageConfig,
    data: {
      ready: true,
      processing: false
    },
    openerEventChannel: {
      emit: jest.fn((name, payload) => {
        emitted[name] = payload;
      })
    },
    exportCroppedImages: jest.fn().mockResolvedValue({
      tempFilePath: 'wxfile://cover.jpg',
      thumbTempFilePath: 'wxfile://thumb.jpg',
      shareTempFilePath: 'wxfile://share.jpg'
    }),
    setData(update) {
      this.data = {
        ...this.data,
        ...update
      };
    }
  };

  await pageConfig.onConfirm.call(ctx);

  expect(emitted.coverCropped).toMatchObject({
    tempFilePath: 'wxfile://cover.jpg',
    thumbTempFilePath: 'wxfile://thumb.jpg',
    shareTempFilePath: 'wxfile://share.jpg',
    imageList: ['wxfile://cover.jpg']
  });
});
```

- [ ] **Step 5: Implement 5:4 share image export**

In `miniprogram/utils/cover-crop.js`, add:

```javascript
const SHARE_OUTPUT_WIDTH = 1000;
const SHARE_OUTPUT_HEIGHT = 800;
const SHARE_OUTPUT_QUALITY = 0.78;
```

Export these constants.

In `miniprogram/pages/activity-cover-crop/index.js`, import the share constants and update `onConfirm`:

```javascript
const { tempFilePath, thumbTempFilePath, shareTempFilePath } = await this.exportCroppedImages();
...
this.openerEventChannel.emit('coverCropped', {
  tempFilePath,
  thumbTempFilePath,
  shareTempFilePath,
  imageList: [tempFilePath]
});
```

Update `exportCroppedImages()` to draw the 2:1 cover centered inside the 5:4 canvas:

```javascript
context.setFillStyle('#f3f6fa');
context.fillRect(0, 0, SHARE_OUTPUT_WIDTH, SHARE_OUTPUT_HEIGHT);
const shareCoverWidth = SHARE_OUTPUT_WIDTH;
const shareCoverHeight = SHARE_OUTPUT_WIDTH / 2;
const shareCoverTop = Math.round((SHARE_OUTPUT_HEIGHT - shareCoverHeight) / 2);
context.drawImage(
  imagePath,
  cropRect.x,
  cropRect.y,
  cropRect.width,
  cropRect.height,
  0,
  shareCoverTop,
  shareCoverWidth,
  shareCoverHeight
);
```

Then call:

```javascript
const shareTempFilePath = await this.exportCanvasImage({
  destWidth: SHARE_OUTPUT_WIDTH,
  destHeight: SHARE_OUTPUT_HEIGHT,
  quality: SHARE_OUTPUT_QUALITY
});
```

Return `shareTempFilePath`.

- [ ] **Step 6: Implement share image upload**

In `miniprogram/pages/activity-create/index.js`, add:

```javascript
function buildShareImageCloudPath(filePath) {
  const extension = getCoverFileExtension(filePath);
  const suffix = Math.random().toString(36).slice(2, 10);

  return `activity-share-images/${Date.now()}-${suffix}${extension}`;
}
```

Update `uploadActivityCover(payload)`:

```javascript
const shareImage = payload.shareImage || '';
const shareFileId = shareImage && !isCloudFileId(shareImage)
  ? await uploadFile(shareImage, buildShareImageCloudPath(shareImage))
  : shareImage;
```

Return:

```javascript
shareImage: shareFileId || '',
```

When crop result is received:

```javascript
shareImage: cropResult.shareTempFilePath || '',
```

When image is removed:

```javascript
shareImage: '',
```

- [ ] **Step 7: Write failing share fallback test**

Update the existing Activity Detail share tests in `tests/miniprogram/pages/activity-detail.test.js`:

```javascript
test('onShareAppMessage prefers the share display image over the cover image', () => {
  const ctx = {
    data: {
      activityId: 'activity_123',
      activity: {
        title: 'Thursday Match',
        shareDisplayImage: 'https://tmp.example.com/share.jpg',
        coverDisplayImage: 'https://tmp.example.com/cover.jpg',
        coverImage: 'cloud://cover-image'
      },
      locale: 'en'
    }
  };

  expect(pageConfig.onShareAppMessage.call(ctx)).toEqual({
    title: 'Thursday Match',
    imageUrl: 'https://tmp.example.com/share.jpg',
    path: '/pages/activity-detail/index?activityId=activity_123'
  });
});
```

- [ ] **Step 8: Implement share display resolution and fallback**

In `miniprogram/services/activity-service.js`, include `shareImage` in file URL resolution:

```javascript
function getActivityMediaSources(activity = {}) {
  return [
    activity.coverThumbImage,
    activity.coverImage,
    activity.shareImage
  ].filter(Boolean);
}
```

Add:

```javascript
shareDisplayImage: getResolvedDisplayImage(activity.shareImage, urlByFileId)
```

using the same raw-CloudBase guard as cover display.

In `miniprogram/pages/activity-detail/index.js`, create:

```javascript
function getShareImageUrl(activity = {}) {
  return activity.shareDisplayImage || activity.coverDisplayImage || undefined;
}
```

Use it in both share handlers:

```javascript
imageUrl: getShareImageUrl(activity),
```

- [ ] **Step 9: Run targeted tests and commit**

Run:

```bash
node node_modules/jest/bin/jest.js tests/miniprogram/pages/activity-cover-crop.test.js tests/miniprogram/pages/activity-create-submit.test.js tests/miniprogram/utils/activity-draft.test.js tests/miniprogram/services/activity-service.test.js tests/miniprogram/pages/activity-detail.test.js tests/cloudfunctions/createActivity.test.js tests/cloudfunctions/updateActivity.test.js --runInBand
```

Expected: PASS.

Commit:

```bash
git add miniprogram/utils/cover-crop.js miniprogram/pages/activity-cover-crop/index.js miniprogram/pages/activity-create/index.js miniprogram/utils/activity-draft.js miniprogram/services/activity-service.js miniprogram/pages/activity-detail/index.js miniprogram/mocks/local-cloud.js cloudfunctions/createActivity/index.js cloudfunctions/updateActivity/index.js tests/miniprogram/pages/activity-cover-crop.test.js tests/miniprogram/pages/activity-create-submit.test.js tests/miniprogram/utils/activity-draft.test.js tests/miniprogram/services/activity-service.test.js tests/miniprogram/pages/activity-detail.test.js tests/cloudfunctions/createActivity.test.js tests/cloudfunctions/updateActivity.test.js
git commit -m "Add share-safe activity images"
```

---

### Task 6: Documentation, Deployment Notes, and Full Verification

**Files:**

- Modify: `docs/development-log.md`
- Modify: `docs/cloudbase/real-cloudbase-rollout.md`
- Modify: `docs/superpowers/handoff/football-signup-miniapp-handoff.md`

- [ ] **Step 1: Update deployment documentation**

In `docs/cloudbase/real-cloudbase-rollout.md`, add `updateTeamColor` to the cloud function list and add storage rule notes for:

```text
activity-share-images/
```

The storage permission section should list:

```text
activity-covers/
activity-cover-thumbs/
activity-share-images/
```

- [ ] **Step 2: Update handoff**

In `docs/superpowers/handoff/football-signup-miniapp-handoff.md`, add the current phase 1 summary:

```markdown
Current activity experience polish:

- Home shows an empty state when there are no joinable activities.
- Activity sharing uses `shareImage` / `shareDisplayImage` before falling back to cover display images.
- Teams have semantic color keys and historical fallback colors by sort order.
- Organizers/admins can update team colors from Activity Detail through `updateTeamColor`.
```

- [ ] **Step 3: Update development log**

Add a dated entry:

```markdown
## 2026-05-09 - Activity Experience Polish Phase 1

Delivered behavior:

- Home empty state for no joinable activities.
- Share-card-safe activity image generation and storage.
- Team color labels using green, white, red, blue, black, yellow.
- Organizer/admin team color editing from Activity Detail.

Deployment notes:

- Deploy `updateTeamColor`, `createActivity`, `updateActivity`, and `getActivityDetail` after `npm run copy:cloud-shared`.
- Ensure CloudBase storage rules allow client reads for `activity-share-images/`.
```

- [ ] **Step 4: Run full verification**

Run:

```bash
node scripts/copy-cloud-shared.mjs
node node_modules/jest/bin/jest.js --runInBand
```

Expected: all suites pass.

- [ ] **Step 5: Commit documentation**

Commit:

```bash
git add docs/development-log.md docs/cloudbase/real-cloudbase-rollout.md docs/superpowers/handoff/football-signup-miniapp-handoff.md
git commit -m "Document activity experience polish phase 1"
```

- [ ] **Step 6: Final manual smoke checklist**

Use WeChat DevTools and then a real device:

```text
1. Open Home with no joinable activities; confirm 暂无活动安排 appears.
2. Create an activity with one cover image; confirm cover, thumb, and share image file IDs are stored.
3. Forward the activity; confirm the share image shows the whole 2:1 cover without awkward crop.
4. Create an activity with teams 1-4; confirm colors are green, white, red, blue.
5. Add teams beyond the first cycle in local/mock data; confirm colors continue black, yellow, then green.
6. Open Activity Detail as organizer/admin; tap a team color/name; change color; confirm it persists after reload.
7. Open Activity Detail as regular user; confirm color labels are visible but color editing does not open.
```

## Plan Self-Review

Spec coverage:

- Home empty state: Task 1.
- Share-card-safe images: Task 5.
- Team colors and defaults: Tasks 2 and 3.
- Organizer/admin manual color editing: Task 4.
- Documentation and deployment notes: Task 6.

Requirements intentionally outside phase 1:

- Detail gallery images are covered by phase 2 of the design spec.
- Organizer/admin registration-change notifications are covered by phase 3 of the design spec.

Placeholder scan:

- This plan uses concrete file paths, commands, expected test outcomes, and code snippets for each implementation task.

Type consistency:

- Team colors use `colorKey`.
- Share images use `shareImage` for durable storage and `shareDisplayImage` for resolved display URLs.
- Team color update API is `updateTeamColor(activityId, teamId, colorKey)`.
