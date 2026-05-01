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
  - highlighted joinable status and muted unavailable status
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
  - copyable current user ID and role summary for manual organizer grants
- role-based activity creation:
  - Home hides Create Activity for regular users
  - Create Activity blocks regular users on page load and submit
  - `createActivity` rejects non-`organizer` and non-`admin` users before writing data
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

- only `organizer` or `admin` users can create activities
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

- command: `npm test`
- result: `36` test suites passed
- result: `129` tests passed

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
- keep early organizer grants as manual CloudBase edits to `users.roles`; add an admin-only authorization page only if manual edits become painful
- add Join page profile prefill and completion: load `users.preferredName/avatarUrl`, let users actively choose a WeChat-assisted nickname/avatar, save profile defaults, and keep `registrations.signupName` editable per activity
- completed signup simplification: participant phone-number collection has been removed unless a later activity-specific requirement brings it back
  - Create/Edit Activity no longer exposes `requirePhone`
  - Join Activity no longer shows phone input or WeChat phone authorization
  - `joinActivity` and the local mock no longer require or write phone fields
  - old phone fields remain as legacy data and do not need immediate migration
  - retire `resolvePhoneNumber` after the simplified signup flow is stable in CloudBase
- add activity/signup insurance-link support
- add participant preferred playing position selection; priority `P2`
- allow organizers to sign up participants on their behalf
- allow organizers to copy all active participant names in one action
- change activity creation defaults so one team is the minimum supported setup instead of always starting from two teams
- add restore flow for soft-deleted activities
- add empty states and richer status badges
- improve detail page organizer action grouping
- polish share copy and share card metadata
- add organizer activity editing:
  - allow the original organizer or `admin` to edit supported fields
  - preserve existing registrations and activity IDs
  - reject capacity reductions below existing joined counts
  - record edits in `activity_logs`
- add participant notification subscriptions:
  - request subscription after successful signup
  - implement subscription opt-in before notification sending
  - let organizers manually notify subscribed active participants
  - represent proceeding confirmation with `confirmStatus: pending/confirmed`
  - keep confirmed activities joinable until deadline, capacity, cancellation, or deletion closes signup
  - show confirmed state in-app to late joiners without backfilling the already-sent proceeding notification in the first version
  - support activity proceeding and activity cancellation notices
  - defer automatic reminders until manual sending and send logs are stable

### 8.2 Media Improvements

- implement batch cover-thumbnail generation for historical activity covers:
  - store generated list thumbnails as `activities.coverThumbImage`
  - make Home/activity cards prefer `coverThumbImage` and fall back to `coverImage`
  - add an admin-only maintenance cloud function with dry-run support
  - skip activities that already have thumbnails unless forced
  - process persistent CloudBase `fileID` covers only
  - keep Activity Detail on `coverImage` for the first pass, then evaluate a detail-optimized image if originals remain too large
- replace slider-only cropper with direct drag and pinch gestures
- upload cover images to real CloudBase storage in production mode
- upload selected user avatars to CloudBase storage in real-cloud mode and save the resulting file ID to `users.avatarUrl`
- add multi-image activity galleries while preserving the existing cover slot

### 8.3 Backend and Production Hardening

- keep CloudBase document database as the default primary store for the MVP; defer SQL until reporting, payments, complex joins, or operations tooling require it
- finalize CloudBase security rules
- finalize manual indexes
- validate real CloudBase deployment and permissions
- retire the unused `resolvePhoneNumber` cloud function after the simplified signup flow is stable in CloudBase

### 8.4 Future Expansion

- WeChat Pay and order records
- analytics dashboards
- multi-organization admin
- full operations backend for activity management, user and organizer management, signup data review, activity revocation, exports, and payment/refund operations
- export and reporting features:
  - participant roster export
  - attendance-rate calculation
  - activity-fee calculation

### 8.5 Administration Roadmap

- keep the current MVP without a full backend/admin console
- role-based activity creation is enforced in cloud functions and hidden from regular users in the UI
- current minimal organizer access management is manual CloudBase editing of `users.roles`, supported by the copyable user ID on My page
- when the operations backend begins, start with participant export, attendance rate, and activity fee calculation before broader analytics
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

- use manual CloudBase role grants for early organizer authorization
- add admin-only organizer authorization management only if needed
- add activity editing for organizers and admins
- add organizer proxy signup for participants
- add organizer one-tap copy of active participant names
- move players between teams
- promote bench players
- expose organizer stats more clearly

### Milestone B2: Activity Editing

- reuse Create Activity in edit mode where practical
- add an `updateActivity` cloud function
- allow only the original organizer or `admin`
- keep existing registrations attached to the same activity
- enforce capacity constraints against joined counts
- write `activity_logs` entries for edits
- defer player movement and registration migration to later organizer operations

### Milestone B2.5: Cover Thumbnail Backfill

- add `coverThumbImage` to activity records as the list-card image source
- make activity cards prefer thumbnails and fall back to `coverImage`
- add an admin-only batch generation cloud function with dry-run support
- skip records with existing thumbnails by default
- limit processing to persistent CloudBase `fileID` covers
- keep detail-page originals unchanged until list performance is stable

### Milestone B3: Participant Notifications

- configure WeChat subscription message template IDs in local/secure config
- implement signup-time subscription request
- add organizer-only `Confirm activity will proceed` action on Activity Detail
- add a cloud function to send to active subscribed registrations
- add `confirmStatus`, `confirmedAt`, and `confirmedByOpenId` activity metadata
- keep proceeding confirmation separate from signup closure
- record notification send logs and duplicate-prevention state
- keep automatic pre-activity reminders as a later enhancement

### Milestone B4: Signup Flow Simplification

- completed in code: participant phone-number collection has been removed from the signup flow
- completed in code: activity-level phone requirement controls have been removed
- completed in code: the signup flow no longer calls `resolvePhoneNumber`
- completed in code: signup works without any phone payload
- completed in code: legacy phone fields in old records are preserved but new signups stop writing them
- remaining cleanup: retire `resolvePhoneNumber` after the simplified signup flow is stable in CloudBase

### Milestone B5: Signup Profile Completion

- prefill Join page signup names from `users.preferredName`
- let users actively choose a WeChat-assisted nickname and avatar without blocking signup
- add preferred playing position selection as priority `P2`
- upload selected avatars to CloudBase storage in real-cloud mode
- store reusable profile defaults on `users`, while keeping activity-specific roster names on `registrations.signupName`

### Milestone B6: Signup Flow Refinements

- add an insurance link to the activity/signup experience
- support one-team activity setup as the minimum default
- keep two-team setup available as a common football default, but do not force it for every activity

### Milestone C: Monetization Readiness

- add payment-related collections
- define fee rules and refund policy fields
- connect payment state to registrations

### Milestone D: Operations Backend

- build only after activity volume or payment/refund workflows require dedicated operations tooling
- include activity moderation, user/organizer management, signup review, exports, and payment/refund operations
- first operations reports:
  - export participant rosters
  - calculate attendance rate
  - calculate activity fees

## 10. Planning Note

This document now acts as a living `implementation status + next backlog` plan.

The historical bootstrap plan has been superseded by the current codebase. For the latest behavior, the source of truth is:

- the current implementation on `main`
- the design document at `docs/superpowers/specs/football-signup-miniapp-design.md`
