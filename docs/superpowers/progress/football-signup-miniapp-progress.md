# Football Signup Mini Program Progress

- Date: 2026-05-01
- Status: In active MVP iteration
- Active branch: `main`
- Main workspace: `D:/workspaces/football_signup_miniapp`
- Current implementation workspace: `D:/workspaces/football_signup_miniapp`

## 1. Current Summary

The MVP is already runnable in WeChat DevTools in local mock mode and supports the full core loop:

1. create an activity
2. share the activity detail page
3. join one team
4. cancel signup before the deadline
5. manage organizer-side activity lifecycle

The project is no longer at the scaffolding stage. The main work now is product refinement, CloudBase production integration, and operator-facing improvements.

The latest CloudBase work has already:

- switched one local machine to real CloudBase runtime mode
- fixed DevTools-side `wx.cloud` runtime detection
- validated the role-gated `createActivity` flow in CloudBase after deployment
- added `updateActivity` for organizer/admin edits; deploy this function before real-device edit testing

The current focus is shifting from CloudBase bring-up to real-device validation, media performance, participant communication, and operations polish.

## 2. Completed Features

### 2.1 Core App Structure

- native WeChat mini program project created
- local mock runtime added for DevTools debugging
- local-only `env.local.js` override support added for real CloudBase wiring
- CloudBase runtime initialization now validates `CLOUD_ENV_ID` and initializes once per session
- CloudBase-style service and cloud-function boundaries established
- Jest-based test suite added

### 2.2 Identity and Signup Foundation

- `openid`-based automatic user profile creation
- no separate registration page
- one active signup per user per activity
- signup name entered manually
- signup name entry and optional avatar selection without participant phone collection

### 2.3 Activity Creation

- activity date
- start time
- end time
- signup deadline date and time
- invite code
- description
- total signup limit
- dynamic team setup
- WeChat map location selection
- one cover image with future-ready `imageList`

### 2.4 Team Model

- two default named teams
- support for adding Team 3 and Team 4
- per-team capacity
- auto-generated bench team when total capacity exceeds named-team capacity
- roster display with member list per team

### 2.5 Cover Image Flow

- shared `2:1` cover ratio across Home and Activity Detail
- dedicated cover crop page
- full-image crop stage with highlighted selection frame
- cropped output reused as the runtime cover image
- new uploads now generate both a detail cover and a smaller `coverThumbImage` for activity cards

### 2.6 Activity Detail and Signup

- cover hero on detail page
- team member list with avatar placeholder and signup name
- join sheet shows the selected team name
- once joined, all join buttons become disabled
- user must cancel before joining another team

### 2.7 Deadline and Status Rules

- signup blocked after `signupDeadlineAt`
- signup cancellation blocked after `signupDeadlineAt`
- activity cards show:
  - `Joinable`
  - `Full`
  - `Signup Closed`
  - `Cancelled`
  - `Deleted`

### 2.8 Organizer Actions

- organizer can cancel a published activity
- organizer can soft-delete an empty activity
- non-organizers cannot see `Cancel Activity`
- non-organizers cannot execute organizer actions even if they try to call the backend directly

### 2.9 My Page

- top-level tabs:
  - `Created`
  - `Joined`
- created-history filters:
  - `All`
  - `Active`
  - `Cancelled`
  - `Deleted`
- deleted activities remain visible only to the organizer in Created history
- current user ID can be copied from My page to support manual organizer role grants
- My page shows a readable role summary

### 2.10 Organizer Permission Gate

- only `organizer` or `admin` users can create activities
- Home hides the Create Activity entry for regular users
- Create Activity checks permission on page load and before submit
- `createActivity` cloud function enforces role permission before writing activity data
- early operation can grant organizer access by manually editing `users.roles` in CloudBase

### 2.11 Organizer Activity Editing

- Activity Detail shows `Edit` to the original organizer or `admin`
- `pages/activity-create` supports edit mode for existing activities
- organizers/admins can update title, date/time, signup deadline, location, description, cover image, total capacity, and invite code
- existing `activityId`, registrations, organizer, joined count, and created timestamp are preserved
- `updateActivity` enforces permission, deleted-activity, validation, and capacity rules
- total capacity cannot be reduced below joined players or below existing regular team slots
- activity update audit entries are written to `activity_logs`

### 2.12 Cover Thumbnail Generation

- new cover uploads generate `coverThumbImage` automatically during the crop/upload flow
- `createActivity` and `updateActivity` persist `coverThumbImage`
- Home/My/activity cards prefer thumbnails through `coverDisplayImage` and fall back to `coverImage`
- Activity Detail prefers the full `coverImage` and falls back to `coverThumbImage`
- historical CloudBase cover backfill is deferred; current scope is new uploads only

### 2.13 Signup Phone Removal

- Create/Edit Activity no longer exposes a phone requirement control
- new or edited activities are stored with `requirePhone: false`
- Join Activity no longer renders phone input or WeChat phone authorization
- `joinActivity` and the local mock accept signups without `phone`
- current UI-created registrations and user-profile updates do not send phone fields
- `joinActivity` and the local mock still preserve optional phone fields when a future flow provides them

### 2.14 Signup Profile Prefill

- Activity Join loads `ensureUserProfile` when the page opens
- saved `users.preferredName` prefills the signup name
- saved `users.avatarUrl` prefills the avatar preview without re-uploading an existing CloudBase file
- manual name/avatar changes made while profile loading is still pending are preserved
- `joinActivity` continues to update `users.preferredName`, `users.avatarUrl`, and the activity registration snapshot after signup

### 2.15 Organizer Participant Name Copy

- Activity Detail shows a copy action to organizers/admins who can manage registrations
- copied roster text is one participant name per line
- participant names follow the current team/member order shown on the detail page
- empty rosters show a hint and do not write an empty clipboard value

### 2.16 Organizer Proxy Signup

- Activity Detail lets organizers/admins add a participant directly to a selected team
- proxy signups use the new `addProxyRegistration` cloud function
- proxy registrations use generated `proxy_...` user IDs so one organizer can add multiple people
- proxy registrations are marked with `proxyRegistration: true`, `source: proxy`, and `createdByOpenId`
- proxy signup follows the same activity/team open, deadline, and capacity rules as normal signup
- existing organizer/admin removal can remove proxy participants
- organizer/admin roster views mark proxy participants with a manager-only badge
- regular users do not see whether a participant was added by proxy signup

## 3. Behavior Changes From the Original MVP Draft

The current implementation differs from the original early MVP assumptions in these important ways:

- signup cancellation is based on `signupDeadlineAt`, not merely activity start time
- delete is implemented as `soft delete`, not hard delete
- My page uses tabs instead of stacked created/joined sections
- activity creation includes explicit deadline fields
- activity creation includes WeChat map selection
- the team model includes an auto-generated bench team
- cover images use a dedicated `2:1` crop flow
- cover images now have a separate thumbnail field for card/list performance
- activity creation is now role-gated instead of open to every user
- published activities can now be edited in place instead of recreated for routine corrections
- participant phone collection was removed from the current signup flow
- organizers/admins can copy all active participant names from Activity Detail
- organizers/admins can add proxy participants from Activity Detail
- organizers/admins can distinguish proxy participants on Activity Detail, while regular users cannot

## 4. Verification Status

Latest verified test result:

- command: `node scripts/copy-cloud-shared.mjs` followed by `node node_modules/jest/bin/jest.js --runInBand`
- result: `43` test suites passed
- result: `220` tests passed

Covered areas include:

- cloud-function behavior
- local mock behavior, including signup without phone fields
- view-model rules
- page template behavior
- crop utility behavior
- layout regressions
- organizer/admin activity edit permissions and update behavior
- signup phone-removal behavior across frontend, mock, and cloud functions
- cover display source preference and fallback behavior
- signup profile prefill from saved user profile data
- organizer participant-name copy behavior
- organizer proxy signup behavior
- manager-only proxy participant badge behavior

## 4.1 Current Media Progress

Cover display and thumbnail behavior now includes:

- Home, My, and Activity Detail now render activity covers through `coverDisplayImage` instead of passing raw CloudBase `cloud://` file IDs directly to `<image>`
- CloudBase file IDs are resolved with `wx.cloud.getTempFileURL`, with fallback diagnostics and `wx.cloud.downloadFile` as a secondary path
- activity card and detail templates show placeholders when a CloudBase file cannot be resolved for display
- new uploads store a separate `coverThumbImage` for list/card display
- Home/My list cards resolve thumbnails first and fall back to the original cover when needed
- Activity Detail resolves the original cover first and falls back to the thumbnail when needed
- CloudBase rollout and handoff docs record the storage permission, new-upload thumbnail behavior, cost checkpoint, and deployment order

Issues found while testing cover display:

- the mini-program renderer treats raw `cloud://` image values as invalid local component paths
- a top-level `cloud.getTempFileURL:ok` result can still contain a per-file failure
- the current failing cover file returns `STORAGE_EXCEED_AUTHORITY`, so the mini-program client cannot read it under the current CloudBase storage rule
- local-only project configuration changes remain intentionally uncommitted and should not be pushed

## 5. Known Gaps

The MVP still has known non-blocking gaps:

- cover crop interaction currently uses sliders rather than direct drag/pinch gestures
- production role grants still require manual CloudBase edits to `users.roles`
- a full admin capability for granting `organizer` roles is not implemented yet; defer it until manual CloudBase edits become too costly
- a full operations backend is intentionally deferred; add it later when activity volume, payment/refund handling, user management, or data export needs justify the extra surface area
- organizer-driven team reassignment and bench promotion are not implemented yet
- participant subscription notifications are not implemented yet; first version should request subscription after signup and let organizers manually notify subscribed participants
- restore-from-delete flow is not implemented yet
- historical activity cover thumbnails are deferred; older activities can keep falling back to `coverImage`
- CloudBase storage permissions have been a previous blocker; if covers return 403 again, verify `activity-covers/` and `activity-cover-thumbs/` client read rules first
- CloudBase cost should be reviewed after the first real usage period; keep CloudBase for MVP unless cost, lock-in, or backend-control requirements outweigh the integrated WeChat deployment benefit
- insurance-link support is not implemented yet
- participant preferred playing position selection is not implemented yet; priority `P2`
- the default team setup still starts from two teams; the future requirement is to allow a one-team minimum
- operations/admin reporting is not implemented yet: participant export, attendance rate, and activity fee calculation

## 6. Recommended Next Steps

### Option A: Production CloudBase Integration

- local runtime switch support is now implemented
- one real environment has already been created locally
- target CloudBase has been upgraded to the personal plan
- verify storage read rules for both `activity-covers/` and `activity-cover-thumbs/`
- deploy all currently changed cloud functions after `npm run copy:cloud-shared`, including `createActivity`, `updateActivity`, `removeRegistration`, `addProxyRegistration`, `joinActivity`, `getActivityDetail`, and any functions not yet uploaded in the target environment
- validate permissions, cover image loading, sharing, signup, organizer/admin removal, organizer proxy signup, and end-to-end data writes on a real device

### Option B: Organizer Operations

- use the My page copyable user ID to grant `organizer` roles manually in CloudBase
- add a minimal admin path to grant organizer access only if manual CloudBase edits become painful
- validate activity editing on a real device after deploying `updateActivity`
- completed in code: let organizers sign up participants on their behalf
- completed in code: let organizers copy active participant names in one action
- move players between teams
- promote bench players into regular teams
- improve organizer action grouping on the detail page

### Option B1: Simplify Signup Contact Fields

- completed in code: participant phone-number collection is removed from signup
- completed in code: the create/edit activity `requirePhone` control is removed
- completed in code: the signup flow no longer calls `resolvePhoneNumber`
- completed in code: `joinActivity` and the local mock no longer require phone fields, but preserve optional phone fields when provided
- extension point: `resolvePhoneNumber` remains available in the cloud function, service adapter, and local mock, but stays disconnected from the active signup flow

### Option B2: Participant Notifications

- implement WeChat subscription request after successful signup before notification sending
- prefer one generic activity-notification template if the WeChat template library supports it
- use separate reminder and cancellation templates only if a generic template is unavailable
- add organizer-triggered `Confirm activity will proceed` before automatic reminders
- store confirmation as `confirmStatus: pending/confirmed` while keeping `status: published/cancelled/deleted`
- keep confirmed activities joinable until normal signup rules close them
- show an in-app confirmed state to participants who join after confirmation
- do not backfill the already-sent proceeding notification to late joiners in the first version
- send cancellation notices when an organizer cancels an activity and closes signup
- send only to active registrations that accepted the relevant subscription
- log per-recipient send results and prevent duplicate sends for the same notification type
- defer automatic pre-activity reminders until manual sending is stable

### Option C: Media and UX Polish

- keep historical cover-thumbnail backfill deferred until CloudBase image processing is available or a non-CloudInfinite implementation is chosen
- replace slider-based cropping with gesture-based dragging and zooming
- add optional Join page nickname/avatar selection and prefill from the user profile
- add activity/signup insurance-link display
- add preferred playing position selection as a `P2` participant profile/signup refinement
- allow one-team activity setup as the minimum default instead of always creating two teams
- polish empty states and activity status presentation
- improve share metadata and visual card quality

### Option D: Full Operations Backend

- defer a full backend/admin console until there is real operational demand
- future scope should include activity management, user and organizer management, signup data review, activity revocation, exports, and payment/refund operations
- first reporting needs are participant roster export, attendance-rate calculation, and activity-fee calculation

## 7. Related Documents

- Design: `D:/workspaces/football_signup_miniapp/docs/superpowers/specs/football-signup-miniapp-design.md`
- Activity editing design: `D:/workspaces/football_signup_miniapp/docs/superpowers/specs/2026-04-28-activity-editing-design.md`
- Notification design: `D:/workspaces/football_signup_miniapp/docs/superpowers/specs/2026-04-28-subscription-notifications-design.md`
- Plan: `D:/workspaces/football_signup_miniapp/docs/superpowers/plans/football-signup-miniapp-mvp-implementation.md`
- CloudBase rollout: `D:/workspaces/football_signup_miniapp/docs/cloudbase/real-cloudbase-rollout.md`
- Handoff: `D:/workspaces/football_signup_miniapp/docs/superpowers/handoff/football-signup-miniapp-handoff.md`
