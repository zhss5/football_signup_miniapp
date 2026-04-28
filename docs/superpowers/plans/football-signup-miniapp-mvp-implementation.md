# Football Signup Mini Program MVP Implementation Plan

- Date: 2026-04-22
- Status: Updated to match the current implementation snapshot on `main`

## 1. Goal

Build a WeChat mini program MVP that lets organizers create football signup events, share them to groups, and lets participants join or cancel by team with `openid`-based identity, duplicate-signup protection, deadline enforcement, and organizer lifecycle controls.

## 2. Current Implementation Snapshot

The current implementation already includes:

- native WeChat mini program project structure
- local mock mode for WeChat DevTools
- local-only `env.local.js` override support for real CloudBase wiring
- CloudBase-style cloud functions
- one-time CloudBase runtime initialization with explicit env validation
- `openid`-based user auto-bootstrap
- activity creation with:
  - activity date
  - start time
  - end time
  - signup deadline date and time
  - WeChat map location
  - one cover image
  - `2:1` cover crop flow
  - dynamic teams
  - auto-generated bench team
  - optional phone requirement
- home list with:
  - cover image
  - start time
  - joined count vs total capacity
  - `Joinable / Full / Signup Closed / Cancelled / Deleted` state model
- activity detail with:
  - cover hero
  - team member list
  - join sheet showing the selected team name
  - one active signup per activity
  - organizer cancellation
  - participant cancellation before deadline
- `My` page with:
  - top tabs: `Created / Joined`
  - created history filters: `All / Active / Cancelled / Deleted`
  - soft-deleted activities still visible to the organizer
- cloud functions for:
  - `ensureUserProfile`
  - `listActivities`
  - `getActivityDetail`
  - `createActivity`
  - `joinActivity`
  - `cancelRegistration`
  - `cancelActivity`
  - `deleteActivity`
  - `getActivityStats`

## 3. Current File Structure

### Mini Program Pages

- `D:/workspace/Nautilus/miniprogram/pages/home/`
- `D:/workspace/Nautilus/miniprogram/pages/activity-create/`
- `D:/workspace/Nautilus/miniprogram/pages/activity-cover-crop/`
- `D:/workspace/Nautilus/miniprogram/pages/activity-detail/`
- `D:/workspace/Nautilus/miniprogram/pages/my/`

### Mini Program Components

- `D:/workspace/Nautilus/miniprogram/components/activity-card/`
- `D:/workspace/Nautilus/miniprogram/components/team-editor/`
- `D:/workspace/Nautilus/miniprogram/components/signup-sheet/`
- `D:/workspace/Nautilus/miniprogram/components/team-list/`

### Mini Program Services and Utils

- `D:/workspace/Nautilus/miniprogram/services/cloud.js`
- `D:/workspace/Nautilus/miniprogram/services/user-service.js`
- `D:/workspace/Nautilus/miniprogram/services/activity-service.js`
- `D:/workspace/Nautilus/miniprogram/services/registration-service.js`
- `D:/workspace/Nautilus/miniprogram/utils/constants.js`
- `D:/workspace/Nautilus/miniprogram/utils/validators.js`
- `D:/workspace/Nautilus/miniprogram/utils/formatters.js`
- `D:/workspace/Nautilus/miniprogram/utils/activity-draft.js`
- `D:/workspace/Nautilus/miniprogram/utils/cover-crop.js`

### Cloud Functions

- `D:/workspace/Nautilus/cloudfunctions/ensureUserProfile/`
- `D:/workspace/Nautilus/cloudfunctions/listActivities/`
- `D:/workspace/Nautilus/cloudfunctions/getActivityDetail/`
- `D:/workspace/Nautilus/cloudfunctions/createActivity/`
- `D:/workspace/Nautilus/cloudfunctions/joinActivity/`
- `D:/workspace/Nautilus/cloudfunctions/cancelRegistration/`
- `D:/workspace/Nautilus/cloudfunctions/cancelActivity/`
- `D:/workspace/Nautilus/cloudfunctions/deleteActivity/`
- `D:/workspace/Nautilus/cloudfunctions/getActivityStats/`
- `D:/workspace/Nautilus/cloudfunctions/_shared/`

## 4. Delivered Product Rules

### 4.1 Signup and Cancellation

- a user can hold only one active signup per activity
- after joining, all team join buttons become disabled
- the user must cancel first before joining again
- signup is blocked after `signupDeadlineAt`
- signup cancellation is also blocked after `signupDeadlineAt`

### 4.2 Team and Capacity Model

- named teams can grow from 2 to 4
- named teams have their own capacities
- total signup capacity may exceed named-team capacity
- the overflow becomes a system-generated bench team

### 4.3 Organizer Actions

- organizers can cancel published activities
- organizers can soft-delete only empty activities
- deleted activities disappear from Home and Joined history
- deleted activities remain visible in the organizer's Created history

### 4.4 Cover Image Behavior

- create flow supports one image
- image is cropped to `2:1`
- the same crop result is reused on Home and Activity Detail
- the data model already keeps `imageList` for future multi-image support

## 5. Current Data Model

### `activities`

Important implemented fields:

- `startAt`
- `endAt`
- `signupDeadlineAt`
- `addressText`
- `addressName`
- `location`
- `coverImage`
- `imageList`
- `signupLimitTotal`
- `joinedCount`
- `requirePhone`
- `inviteCode`
- `status`: `published/cancelled/deleted` in the main MVP paths

### `activity_teams`

Important implemented fields:

- `teamName`
- `maxMembers`
- `joinedCount`
- `teamType`
- `autoGenerated`

### `registrations`

Important implemented fields:

- `_id = activityId_openid`
- `teamId`
- `status`
- `signupName`
- `phoneSnapshot`
- `joinedAt`
- `cancelledAt`

## 6. Current API / Cloud Function Snapshot

### Delivered

- `ensureUserProfile`
  - find or create the current user by `openid`
- `listActivities`
  - support Home, Created, and Joined scopes
- `getActivityDetail`
  - return activity, team list, members, current registration, and viewer permissions
- `createActivity`
  - create activity and team documents, including bench generation
- `joinActivity`
  - enforce status, deadline, total capacity, team capacity, and duplicate rules
- `cancelRegistration`
  - enforce self-only cancellation before signup deadline
- `cancelActivity`
  - organizer-only activity cancellation
- `deleteActivity`
  - organizer-only soft delete when `joinedCount = 0`
- `getActivityStats`
  - organizer-facing aggregate counts

## 7. Current Verification Snapshot

Latest verified status:

- command: `npm test -- --runInBand`
- result: `29` test suites passed
- result: `72` tests passed

The current test surface includes:

- cloud-function behavior
- mock runtime behavior
- page template behavior
- cover-crop utility logic
- layout regressions

## 8. Remaining Backlog

The main remaining work is no longer MVP scaffolding. It is product refinement and production-hardening.

### 8.1 Product Refinements

- add organizer-driven team reassignment or bench promotion
- add role-based activity creation permission so only `organizer` or `admin` users can create activities, while regular users can only join or cancel their own signup
- add minimal admin capability for granting `organizer` roles before public launch; the first version can be manual CloudBase role editing or an admin-only authorization page
- add Join page profile prefill and completion: load `users.preferredName/avatarUrl`, let users actively choose a WeChat-assisted nickname/avatar, save profile defaults, and keep `registrations.signupName` editable per activity
- add a simple user identification aid for manual organizer grants, such as showing or copying the current user's `openid` or profile marker on the My page
- add restore flow for soft-deleted activities
- add empty states and richer status badges
- improve detail page organizer action grouping
- polish share copy and share card metadata

### 8.2 Media Improvements

- replace slider-only cropper with direct drag and pinch gestures
- upload cover images to real CloudBase storage in production mode
- upload selected user avatars to CloudBase storage in real-cloud mode and save the resulting file ID to `users.avatarUrl`
- add multi-image activity galleries while preserving the existing cover slot

### 8.3 Backend and Production Hardening

- keep CloudBase document database as the default primary store for the MVP; defer SQL until reporting, payments, complex joins, or operations tooling require it
- finalize CloudBase security rules
- finalize manual indexes
- validate real CloudBase deployment and permissions
- validate one-tap phone retrieval under a real certified mini program

### 8.4 Future Expansion

- WeChat Pay and order records
- analytics dashboards
- multi-organization admin
- full operations backend for activity management, user and organizer management, signup data review, activity revocation, exports, and payment/refund operations
- export and reporting features

### 8.5 Administration Roadmap

- keep the current MVP without a full backend/admin console
- before public launch, enforce role-based activity creation in cloud functions and hide the create entry for regular users
- before public launch, define a minimal way to grant organizer access
- after real operational demand appears, build a full backend/admin console instead of expanding ad hoc mini program controls

## 9. Suggested Next Milestones

### Milestone A: Production CloudBase Integration

- completed in code:
  - local-only runtime switching via `miniprogram/config/env.local.js`
  - explicit `CLOUD_ENV_ID` validation
  - one-time CloudBase runtime initialization
  - rollout documentation and smoke checklist
- remaining operational work:
  - switch one local environment from mock to real CloudBase
  - deploy cloud functions
  - create collections and indexes
  - validate end-to-end flow in WeChat DevTools and on-device

### Milestone B: Organizer Operations

- enforce role-based activity creation
- provide minimal organizer authorization management
- add user identification support for manual organizer grants
- move players between teams
- promote bench players
- expose organizer stats more clearly

### Milestone B2: Signup Profile Completion

- prefill Join page signup names from `users.preferredName`
- let users actively choose a WeChat-assisted nickname and avatar without blocking signup
- upload selected avatars to CloudBase storage in real-cloud mode
- store reusable profile defaults on `users`, while keeping activity-specific roster names on `registrations.signupName`

### Milestone C: Monetization Readiness

- add payment-related collections
- define fee rules and refund policy fields
- connect payment state to registrations

### Milestone D: Operations Backend

- build only after activity volume or payment/refund workflows require dedicated operations tooling
- include activity moderation, user/organizer management, signup review, exports, and payment/refund operations

## 10. Planning Note

This document now acts as a living `implementation status + next backlog` plan.

The historical bootstrap plan has been superseded by the current codebase. For the latest behavior, the source of truth is:

- the current implementation on `main`
- the design document at `docs/superpowers/specs/football-signup-miniapp-design.md`
