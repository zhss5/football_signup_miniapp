# Development Log

This file records meaningful development steps, product decisions, operational milestones, and follow-up decisions for the football signup mini program.

Use this log for events that help future maintainers understand why the project changed, not for every small edit. Good entries include architecture decisions, feature milestones, deployment issues, production rollout notes, and changes to product direction.

## How To Update

For each meaningful step, add:

- date
- summary
- why it mattered
- related commits, docs, or follow-up work

Keep entries concise. Detailed requirements and plans should still live in the design, implementation plan, progress, and CloudBase rollout documents.

## 2026-04-22 - MVP Implementation Plan Updated

The MVP implementation plan was updated to reflect the actual codebase rather than the early scaffold assumptions.

Why it mattered:

- established the current product scope as a runnable WeChat mini program MVP
- documented the main pages, components, services, cloud functions, and data model
- shifted the project from bootstrap planning to product refinement and production hardening

Related:

- `docs/superpowers/plans/football-signup-miniapp-mvp-implementation.md`
- commits around `2c81d3c` and `3f3b13b`

## 2026-04-26 - MVP Progress Snapshot

The progress document recorded that local mock mode already supports the core user loop:

- create an activity
- share an activity detail page
- join one team
- cancel signup before the deadline
- manage organizer-side activity lifecycle

Why it mattered:

- confirmed the project is no longer at scaffolding stage
- made CloudBase rollout, operator tooling, and UX polish the next focus areas

Related:

- `docs/superpowers/progress/football-signup-miniapp-progress.md`

## 2026-04-27 - CloudBase Rollout and Handoff

CloudBase deployment work stabilized real-cloud runtime support.

Notable resolved issues:

- missing cloud functions in the target environment
- shared helper files not being uploaded with each function package
- CloudBase packaging problems with nested `_shared` folders
- empty `context.OPENID` in some real-cloud calls
- writes that incorrectly included `_id` inside `doc(id).set({ data })`
- cover images needing persistent CloudBase file IDs instead of temporary local paths
- missing database collections during first real-cloud startup

Why it mattered:

- moved the app from local mock only toward real CloudBase operation
- documented the deployment workflow and current operational watch items

Related:

- `docs/superpowers/handoff/football-signup-miniapp-handoff.md`
- `docs/cloudbase/real-cloudbase-rollout.md`
- commits `9936376`, `e0df585`, `171033b`, `5587bf0`, `9a7971a`

## 2026-04-28 - Role-Based Activity Creation Backlog

The project added a backlog item for role-based activity creation.

Decision:

- regular users should be able to join activities and cancel their own signup
- only `organizer` or `admin` users should be able to create activities before public launch
- current code still allows any user to create activities, so this is a future implementation item

Why it mattered:

- clarified the difference between the current MVP rule and the intended public-launch permission model
- aligned the data model with the existing `users.roles` field

Related:

- `docs/superpowers/progress/football-signup-miniapp-progress.md`
- `docs/superpowers/plans/football-signup-miniapp-mvp-implementation.md`
- commit `2b56ffa`

## 2026-04-28 - Role-Based Activity Creation Implemented

The organizer permission loop was implemented for activity creation.

Delivered behavior:

- only users with `organizer` or `admin` in `users.roles` can create activities in real CloudBase mode
- the Home page hides the Create Activity entry for regular users
- the Create Activity page checks permission again and blocks direct navigation for regular users
- the `createActivity` cloud function enforces the same rule before writing activity data
- the My page shows a copyable current user ID and readable role summary to support manual CloudBase role grants
- local mock mode defaults to an organizer-capable test user, while tests can opt into `defaultRoles: ['user']` to verify the restricted path

Why it mattered:

- closed the main pre-launch permission gap without building a full admin backend
- kept early organizer authorization operationally simple through manual `users.roles` edits
- protected the backend from clients bypassing hidden UI controls

Related:

- `cloudfunctions/createActivity/index.js`
- `cloudfunctions/_shared/roles.js`
- `miniprogram/pages/home/index.js`
- `miniprogram/pages/activity-create/index.js`
- `miniprogram/pages/my/index.js`
- `miniprogram/utils/roles.js`

## 2026-04-28 - Subscription Notification Direction

The project documented the notification direction for activity reminders and cancellation notices.

Decision:

- notification subscriptions require code; WeChat provides the subscription-message capability but does not automatically subscribe users or send activity messages
- first implementation should request subscription after a successful signup
- first sender flow should be organizer-triggered from Activity Detail, not fully automatic
- recipients should be active registrations that have granted the relevant subscription permission
- prefer one generic activity-notification template if the WeChat template library supports the needed fields
- if a generic template is unavailable, use separate templates for activity reminders and cancellation notices
- automatic pre-activity reminders should be deferred until manual sending, send-result tracking, and duplicate prevention are stable

Why it mattered:

- reduced the risk of sending an incorrect "activity will proceed" message when weather, venue, or attendance has changed
- kept the first notification feature testable on real devices
- made the WeChat template and subscription-permission constraints explicit before implementation

Related:

- `docs/superpowers/specs/2026-04-28-subscription-notifications-design.md`
- `docs/superpowers/progress/football-signup-miniapp-progress.md`
- `docs/superpowers/handoff/football-signup-miniapp-handoff.md`

## 2026-04-28 - Organizer Activity Editing Direction

The project documented the next organizer workflow: editing an existing activity without rebuilding it from scratch.

Decision:

- organizers should be able to modify activities they created
- `admin` users should also be allowed to edit activities
- regular users must not see or execute edit actions
- first version should reuse the Create Activity page in edit mode where practical
- first version editable fields are title, activity time, signup deadline, location, description, cover image, and total capacity
- existing registrations must be preserved; editing must not recreate the activity
- when users have already joined, capacity cannot be reduced below the joined count
- record edits in `activity_logs`
- do not include complex team reassignment, registration migration, or broad admin tooling in the first version

Why it mattered:

- organizers need a way to fix real-world mistakes such as time, venue, image, or capacity changes
- deleting and recreating an activity would lose signups and break shared links
- the edit workflow closes a core organizer operations gap while keeping the first version bounded

Related:

- `docs/superpowers/specs/2026-04-28-activity-editing-design.md`
- `docs/superpowers/progress/football-signup-miniapp-progress.md`
- `docs/superpowers/handoff/football-signup-miniapp-handoff.md`

## 2026-04-28 - Administration Roadmap

The project documented that a full admin backend should be deferred.

Decision:

- do not build a full web admin console during the current MVP phase
- before public launch, implement the minimal permission loop:
  - role-gated activity creation
  - a simple way to grant `organizer` roles
  - manual CloudBase role edits are acceptable for early operation
- build a full operations backend only when activity volume, payments, refunds, exports, or multi-admin workflows require it

Why it mattered:

- avoided expanding the MVP into a larger operations platform too early
- kept the next implementation focus on permissions rather than admin UI

Related:

- `docs/superpowers/progress/football-signup-miniapp-progress.md`
- `docs/superpowers/plans/football-signup-miniapp-mvp-implementation.md`
- commit `15bfaae`

## 2026-04-28 - Signup Profile and User Identification Backlog

The project documented future signup profile behavior.

Decision:

- do not rely on silent WeChat nickname/avatar access
- Join page should let users actively choose a WeChat-assisted nickname and avatar
- nickname should prefill from `users.preferredName` on later signups
- avatar should upload to CloudBase storage in real-cloud mode and save to `users.avatarUrl`
- `registrations.signupName` remains the activity-specific roster name and stays editable
- add a future user identification aid, such as showing or copying the current user's `openid`, to make manual organizer grants less error-prone

Why it mattered:

- clarified the correct WeChat user-info model
- separated reusable user profile data from activity-specific signup records
- reduced the risk of relying on `lastActiveAt` alone to identify users in CloudBase

Related:

- `docs/superpowers/specs/football-signup-miniapp-design.md`
- `docs/superpowers/progress/football-signup-miniapp-progress.md`
- `docs/superpowers/plans/football-signup-miniapp-mvp-implementation.md`
- commit `dfa218a`

## 2026-04-28 - Database Direction Confirmed

The project confirmed CloudBase document database remains the default primary store for the MVP.

Decision:

- keep using CloudBase document collections for `users`, `activities`, `activity_teams`, `registrations`, and `activity_logs`
- defer SQL until reporting, payment/order workflows, complex joins, or dedicated operations tooling require it
- continue routing business writes through cloud functions instead of direct unrestricted client database writes

Why it mattered:

- kept the MVP aligned with WeChat CloudBase conventions
- avoided introducing SQL migration and operations overhead before the product needs it

Related:

- `docs/superpowers/specs/football-signup-miniapp-design.md`
- `docs/superpowers/plans/football-signup-miniapp-mvp-implementation.md`
- commit `dfa218a`

## 2026-04-29 - Organizer Activity Editing MVP

The first organizer activity editing flow was implemented.

Change:

- added the `updateActivity` cloud function
- added organizer/admin edit permission checks shared by client and cloud code
- reused `pages/activity-create` in edit mode
- added an Activity Detail `Edit` action for viewers with edit permission
- preserved existing activity IDs, registrations, organizer ownership, joined counts, and created timestamps during edits
- enforced capacity safety so total capacity cannot drop below joined players or existing regular team slots
- wrote `activity_logs` entries for activity updates
- extended local mock mode to mirror update permissions and capacity rules

Why it mattered:

- organizers can now correct routine mistakes without deleting and recreating an activity
- existing shared links and participant registrations stay valid after edits
- the backend, local mock, and UI now all enforce the same edit boundary

Verification:

- `node scripts/copy-cloud-shared.mjs`
- `node node_modules/jest/bin/jest.js --runInBand`
- result: `37` test suites passed, `144` tests passed

Follow-up:

- deploy `updateActivity` to CloudBase before real-device edit testing
- verify edit mode with an organizer/admin account on a real device

Related:

- `cloudfunctions/updateActivity/index.js`
- `miniprogram/pages/activity-create/index.js`
- `miniprogram/pages/activity-detail/index.js`
- `tests/cloudfunctions/updateActivity.test.js`

## 2026-04-29 - DevTools Simulator Map Preview Flicker

Real-device testing confirmed the Activity Detail map preview behaves correctly, but the WeChat DevTools simulator can flicker when opening Activity Detail.

Decision:

- Treat this as a WeChat DevTools simulator issue related to the native `map` component.
- Do not block release or real-device smoke testing on this simulator-only flicker.
- Revisit only if the same flicker appears on real devices or begins blocking local debugging.

Why it mattered:

- prevents repeated debugging of a simulator-only rendering artifact
- keeps validation focused on real-device behavior for native mini program components
- documents why no further layout workaround is planned after the map preview was constrained

Related:

- `miniprogram/pages/activity-detail/index.wxml`
- `miniprogram/pages/activity-detail/index.wxss`
- commits `d527855`, `77476bc`, and `e2d09dc`

## 2026-04-28 - WeChat Verification Blocks Real-Device Sharing

Real-device testing showed that activity sharing is blocked while the mini program account is not verified.

Decision:

- WeChat verification can be started during development; it does not require the code to be complete.
- Verification is separate from filing/record registration, CloudBase deployment, code upload, code review, and public release.
- Adding experience members is useful for temporary tester access to an experience version, but it does not bypass verification-only platform restrictions such as sharing.
- The current platform flow for this account showed a verification fee of RMB 30; the final fee should still be confirmed on the WeChat Official Accounts Platform payment page before paying.

Why it mattered:

- explained why in-app sharing fails even when the code path is present
- set the temporary testing path as experience members plus experience-version QR code
- prevented future debugging from treating this as an application bug

Related:

- `docs/cloudbase/wechat-devtools-setup.md`
- `docs/cloudbase/real-cloudbase-rollout.md`
- `docs/superpowers/handoff/football-signup-miniapp-handoff.md`
- commits `dddf625` and `53f629f`

## 2026-04-28 - CloudBase Collection Bootstrap ResourceExist Error

During real-device CloudBase startup, `ensureUserProfile` failed while bootstrapping collections.

Problem:

- `ensureUserProfile` calls `db.createCollection` for required collections.
- Existing collections should be treated as a successful no-op.
- CloudBase returned `ResourceUnavailable.ResourceExist` and `Table exist.`
- The existing detector only recognized `already exist` and Chinese `已存在` variants, so it rethrew the error.

Fix:

- updated `isCollectionAlreadyExistsError` to recognize `ResourceExist`, `resource exist`, and `table exist`
- added a regression test for the real CloudBase error shape
- copied shared cloud helpers into function packages again with `npm run copy:cloud-shared`

Why it mattered:

- real-cloud startup must be idempotent when collections already exist
- first launch and repeated launches should not fail just because collection bootstrap has already run

Related:

- `cloudfunctions/_shared/database.js`
- `tests/cloudfunctions/database.test.js`

## 2026-04-28 - CloudBase Startup Timeout From Collection Bootstrap

During real-device testing, the app could load but DevTools still reported `Error: timeout`.

Problem:

- `ensureUserProfile` ran collection bootstrap before every normal user profile read on a cold cloud function instance.
- Bootstrap calls `createCollection` for all required collections.
- Even when collections already exist, those calls can consume enough time to hit the default cloud function timeout.

Fix:

- changed `ensureUserProfile` to read the `users` collection first on the normal path
- collection bootstrap now runs only if the `users` collection is actually missing
- after bootstrap, `ensureUserProfile` retries the user read/create flow
- added regression tests for both paths:
  - no bootstrap when `users` already exists
  - bootstrap and retry only when `users` is missing

Why it mattered:

- normal app launches should avoid slow administrative collection checks
- collection bootstrap remains available for first-time environments without penalizing every cold start

Related:

- `cloudfunctions/ensureUserProfile/index.js`
- `tests/cloudfunctions/ensureUserProfile.test.js`

## 2026-04-29 - Signup Contact Profile, Phone Source Tracking, and Roster Avatars

The Join page was updated so signups can use WeChat-assisted profile data while still allowing manual entry.

Delivered behavior:

- users can choose a WeChat avatar with `open-type="chooseAvatar"`
- the signup name input uses the WeChat nickname input capability while remaining manually editable
- users can tap `用微信手机号` / `Use WeChat` to authorize a phone number
- users can still skip phone authorization and manually enter a phone number
- nickname and phone are required for signup; avatar is optional
- `joinActivity` now records `phoneSource`, `profileSource`, and `avatarUrl`
- `resolvePhoneNumber` was added to exchange the phone authorization `code` for a WeChat phone number
- `getActivityDetail` now prefers `registrations.avatarUrl` before falling back to `users.avatarUrl`

Bugs and issues found:

- real-device testing showed a member could choose a WeChat avatar but still appear as a text fallback on Activity Detail
- root cause: Activity Detail only read `users.avatarUrl`, while the signup record already had the selected avatar
- fix: roster members now use the registration avatar first, so the chosen signup avatar is not lost if the user profile document is stale or missing the avatar field
- old registrations that were created before this feature may still lack `avatarUrl`; those records need re-signup or a manual database backfill to show avatars

Unresolved:

- on preview builds, tapping the WeChat phone button can show `已跳过手机号授权`
- this means the frontend did not receive a successful `getPhoneNumber` `code`, so `resolvePhoneNumber` is not called
- likely causes still to verify in the WeChat platform console: privacy guide declaration for phone number, phone-number open capability availability, preview package freshness, and account configuration
- manual phone entry remains the fallback path and is required before submission

Operational notes:

- after this change, upload `joinActivity`, `resolvePhoneNumber`, and `getActivityDetail` before real-device verification
- update and publish the mini program privacy guide for phone number, nickname, and avatar usage before relying on WeChat phone authorization

Related:

- `cloudfunctions/joinActivity/index.js`
- `cloudfunctions/resolvePhoneNumber/index.js`
- `cloudfunctions/getActivityDetail/index.js`
- `miniprogram/pages/activity-join/index.js`
- commits `f5576e7` and `3e5e3be`

## 2026-04-29 - Organizer/Admin Registration Removal

Organizer-side member removal was implemented for Activity Detail.

Delivered behavior:

- viewers with `viewer.canManageRegistrations` can remove joined members from the roster
- `organizer` and `admin` users are allowed to remove members
- regular users cannot remove other members
- removal is a soft delete: the registration is marked `cancelled`, not physically deleted
- the removed member disappears from the team list immediately after reload
- `activities.joinedCount` and `activity_teams.joinedCount` decrement by one
- the registration records `removedByOpenId`, `removedAt`, `cancelledAt`, and `updatedAt`
- removed users are allowed to rejoin later because the active registration status is no longer `joined`

Bugs and issues found:

- this feature required a separate cloud function instead of reusing `cancelRegistration`, because `cancelRegistration` only operates on the current user's own registration
- Activity Detail needed an explicit management permission field instead of inferring permissions from the existing edit/cancel buttons in the UI
- the member-row remove button uses a contained `catchtap` handler so tapping `移除` does not trigger unrelated row or team actions

Operational notes:

- upload `removeRegistration` and `getActivityDetail` before real-device testing this feature
- test with both organizer and admin users because the UI and cloud function both enforce permissions

Verification:

- `node scripts/copy-cloud-shared.mjs`
- `node node_modules/jest/bin/jest.js --runInBand`
- result: `40` test suites passed, `178` tests passed

Related:

- `cloudfunctions/removeRegistration/index.js`
- `cloudfunctions/getActivityDetail/index.js`
- `miniprogram/components/team-list/index.wxml`
- `miniprogram/pages/activity-detail/index.js`
- commit `20166dd`

## 2026-04-29 - Notification V1 Scope Clarified

The first notification implementation scope was clarified before coding.

Decision:

- implement subscription opt-in before implementing organizer notification sending
- keep the existing activity lifecycle status as `published/cancelled/deleted`
- add confirmation metadata instead of replacing `published`:
  - `confirmStatus: pending/confirmed`
  - `confirmedAt`
  - `confirmedByOpenId`
- confirming that an activity will proceed does not close signup
- confirmed activities remain joinable until normal signup rules close them: deadline, capacity, cancellation, or deletion
- participants who join after the proceeding notification do not receive that already-sent proceeding notification in the first version
- late joiners should see an in-app confirmed state and can still subscribe for later cancellation notices
- cancelling an activity closes signup and should offer/send cancellation notifications to active subscribed registrations

Why it mattered:

- separates notification consent from notification sending
- avoids accidental signup closure when the organizer only wants to say the activity will proceed
- keeps the first version simple by deferring automatic backfill notifications for late joiners

Related:

- `docs/superpowers/specs/2026-04-28-subscription-notifications-design.md`
