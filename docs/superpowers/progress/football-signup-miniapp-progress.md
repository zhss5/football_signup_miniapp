# Football Signup Mini Program Progress

- Date: 2026-04-28
- Status: In active MVP iteration
- Active branch: `main`
- Main workspace: `D:/workspace/Nautilus`
- Current implementation workspace: `D:/workspace/Nautilus`

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

The current remaining blocker is operational, not architectural:

- cloud functions still need to be deployed to the CloudBase environment before the real runtime can complete the startup flow

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
- optional phone requirement per activity

### 2.3 Activity Creation

- activity date
- start time
- end time
- signup deadline date and time
- invite code
- description
- total signup limit
- dynamic team setup
- optional phone requirement
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

## 3. Behavior Changes From the Original MVP Draft

The current implementation differs from the original early MVP assumptions in these important ways:

- signup cancellation is based on `signupDeadlineAt`, not merely activity start time
- delete is implemented as `soft delete`, not hard delete
- My page uses tabs instead of stacked created/joined sections
- activity creation includes explicit deadline fields
- activity creation includes WeChat map selection
- the team model includes an auto-generated bench team
- cover images use a dedicated `2:1` crop flow
- activity creation is now role-gated instead of open to every user

## 4. Verification Status

Latest verified test result:

- command: `npm test`
- result: `36` test suites passed
- result: `127` tests passed

Covered areas include:

- cloud-function behavior
- local mock behavior
- view-model rules
- page template behavior
- crop utility behavior
- layout regressions

## 5. Known Gaps

The MVP still has known non-blocking gaps:

- cover crop interaction currently uses sliders rather than direct drag/pinch gestures
- production role grants still require manual CloudBase edits to `users.roles`
- a full admin capability for granting `organizer` roles is not implemented yet; defer it until manual CloudBase edits become too costly
- a full operations backend is intentionally deferred; add it later when activity volume, payment/refund handling, user management, or data export needs justify the extra surface area
- signup profile prefill is not implemented yet; the Join page should let users actively choose a WeChat-assisted nickname and avatar, save them to `users.preferredName` and `users.avatarUrl`, and prefill future signups from those fields
- organizer-driven team reassignment and bench promotion are not implemented yet
- restore-from-delete flow is not implemented yet
- one-tap phone retrieval still needs verification in a real certified mini program environment

## 6. Recommended Next Steps

### Option A: Production CloudBase Integration

- local runtime switch support is now implemented
- one real environment has already been created locally
- next action is to deploy cloud functions
- create collections and indexes
- validate permissions and end-to-end data writes

### Option B: Organizer Operations

- use the My page copyable user ID to grant `organizer` roles manually in CloudBase
- add a minimal admin path to grant organizer access only if manual CloudBase edits become painful
- move players between teams
- promote bench players into regular teams
- improve organizer action grouping on the detail page

### Option C: Media and UX Polish

- replace slider-based cropping with gesture-based dragging and zooming
- add optional Join page nickname/avatar selection and prefill from the user profile
- polish empty states and activity status presentation
- improve share metadata and visual card quality

### Option D: Full Operations Backend

- defer a full backend/admin console until there is real operational demand
- future scope should include activity management, user and organizer management, signup data review, activity revocation, exports, and payment/refund operations

## 7. Related Documents

- Design: `D:/workspace/Nautilus/docs/superpowers/specs/football-signup-miniapp-design.md`
- Plan: `D:/workspace/Nautilus/docs/superpowers/plans/football-signup-miniapp-mvp-implementation.md`
- CloudBase rollout: `D:/workspace/Nautilus/docs/cloudbase/real-cloudbase-rollout.md`
- Handoff: `D:/workspace/Nautilus/docs/superpowers/handoff/football-signup-miniapp-handoff.md`
