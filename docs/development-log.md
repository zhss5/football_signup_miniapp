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

Superseded note: participant phone collection was removed on 2026-05-01. The avatar and nickname parts of this entry remain relevant, while the phone authorization behavior is now legacy context only.

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

## 2026-04-29 - Cover Thumbnail Backfill Requirement

Large historical cover images in CloudBase storage can make the Home activity list feel slow, especially in uploaded preview builds and on real devices.

Decision:

- implement a batch thumbnail-generation step for existing activity cover images before optimizing the Activity Detail original image
- store generated list thumbnails on activity documents as `coverThumbImage`
- make Home/activity cards prefer `coverThumbImage` and fall back to `coverImage` when no thumbnail exists
- keep Activity Detail rendering `coverImage` in the first pass so the detail hero still has the best available image
- add an admin-only maintenance cloud function for batch generation
- support a dry-run mode before writing database changes
- skip activities that already have `coverThumbImage` unless an explicit force option is used
- only process persistent CloudBase `fileID` cover images; temporary local paths should be ignored

Why it matters:

- protects list performance for existing uploaded covers without requiring organizers to re-upload images
- keeps the data model backward-compatible because older activities can continue to use `coverImage`
- separates list-thumbnail optimization from a later detail-page image strategy

Follow-up:

- after the list thumbnail path is stable, evaluate whether Activity Detail also needs a medium-size display image instead of always loading the original `coverImage`

## 2026-04-29 - Future Product Backlog Captured

Additional post-MVP requirements were captured for the mini program and the future operations backend.

Mini program backlog:

- improve image loading performance for large activity cover images
- remove participant phone-number collection from the signup flow unless a later activity-specific need reappears
- add an insurance link that can be shown from the relevant activity/signup flow
- let participants choose their preferred playing position; priority `P2`
- let organizers sign up participants on their behalf
- let organizers copy all active participant names in one action
- change the default activity team setup so the minimum is one team instead of always two teams

Operations/admin backlog:

- export participant rosters
- calculate attendance rate
- calculate activity fees

Notes:

- image-loading performance is already partially covered by the planned `coverThumbImage` backfill
- removing phone collection must be reconciled with existing optional phone fields and any old activities that still require phone numbers
- the operations/admin backlog should remain deferred until the mini program core flow and CloudBase data model are stable enough to support reporting reliably

## 2026-04-30 - CloudBase Cover FileID Display URL Resolution

Real-device and DevTools testing showed that an existing CloudBase cover image could still fail to render in an activity card.

Problem:

- the activity document had a valid `coverImage` CloudBase fileID
- the CloudBase console could preview the file
- the mini program image loader attempted to load the raw `cloud://...` value as a component-relative resource, for example `/components/activity-card/cloud://...`
- the card then fell back to its placeholder after the image load failed

Fix:

- keep the stored `coverImage` value unchanged as the durable CloudBase fileID
- resolve CloudBase fileIDs to temporary HTTPS display URLs with `wx.cloud.getTempFileURL`
- if a temporary HTTPS URL is unavailable, fall back to `wx.cloud.downloadFile` and render the returned local temporary file path
- add `coverDisplayImage` for Home, My, and Activity Detail rendering
- make activity cards and the detail hero use only `coverDisplayImage` as the `<image>` source, so raw CloudBase fileIDs are not passed to `<image>`
- keep existing edit/save behavior based on the original `coverImage`, so temporary URLs are not written back to activity documents

Why it mattered:

- fixes rendering for valid CloudBase files that are not reliably loadable as raw `cloud://` image sources
- prepares the same display path for future `coverThumbImage` list thumbnails
- avoids mixing persistent storage IDs with temporary render URLs

Follow-up:

- Activity Detail map preview was also adjusted so the native `map` is wrapped by a normal `view`, with only the tap `cover-view` nested inside the map component.
- This avoids the DevTools/native-component warning that a `cover-view` can only contain specific native child nodes.

## 2026-04-30 - CloudBase Storage Permission and Cost TODO

Real-device/DevTools CloudBase testing isolated a cover-image rendering failure to CloudBase storage permissions rather than the mini program image component.

Findings:

- `wx.cloud.getTempFileURL` returned a per-file result with `status: 1` and `errMsg: STORAGE_EXCEED_AUTHORITY`
- `wx.cloud.downloadFile` then failed with `-403003 internal server error: empty download url`
- the same file could still be previewed from the CloudBase console because console/server-side access is not the same as mini-program client access
- the target environment was a free trial environment whose package had expired, so the console blocked storage permission changes until the environment is upgraded

Operational TODO:

- before relying on CloudBase storage for public activity covers, upgrade or renew the target CloudBase environment and set storage read rules for `activity-covers/`
- preferred storage rule: allow public/client read for `activity-covers/`, while keeping writes restricted to authenticated users or a stricter organizer/admin upload path
- after changing storage permissions, wait 1-3 minutes and rerun the real-device cover-image smoke test
- track monthly CloudBase cost after the first real usage period; keep WeChat CloudBase for MVP if usage stays within the low-cost personal-tier range
- add a migration checkpoint only if monthly CloudBase cost, platform lock-in, or required backend control becomes materially higher than the MVP benefit of integrated WeChat hosting

Current decision:

- do not migrate away from WeChat CloudBase now
- continue the MVP on CloudBase, but keep the service layer boundaries intact so a later HTTP API adapter remains possible

## 2026-04-30 - Local Progress Snapshot Before Push

Current local progress:

- local `main` is ahead of `origin/main` by two commits
- `ba30c4c Resolve CloudBase cover URLs for display` resolves CloudBase file IDs into display-safe URLs and keeps raw `cloud://` values out of `<image>` `src`
- `82e9b06 Document CloudBase storage permission TODO` records the CloudBase storage permission blocker, CloudBase cost checkpoint, and updated rollout order
- latest automated verification result: `41` test suites passed and `193` tests passed
- local-only configuration changes remain uncommitted and should not be pushed

Issues encountered in the local changes:

- raw CloudBase file IDs were treated by the mini-program image loader as component-relative local paths, causing 500-style render failures
- `wx.cloud.getTempFileURL` can return a top-level `ok` while a specific file item still has no usable URL
- diagnostics showed the real per-file failure: `STORAGE_EXCEED_AUTHORITY`
- `wx.cloud.downloadFile` also failed with `-403003 internal server error: empty download url` for the same file, confirming this was a storage permission issue rather than a component rendering issue
- CloudBase console could preview the object because console/server-side access is different from mini-program client access
- the target free-trial CloudBase environment had expired, so the console blocked storage permission updates until the environment is upgraded or renewed

Next execution plan:

1. Upgrade or renew the target CloudBase environment so storage permission changes are allowed.
2. Configure CloudBase storage permissions so `activity-covers/` can be read by mini-program clients while writes remain restricted.
3. Recompile/preview and verify the failing activity cover loads without `STORAGE_EXCEED_AUTHORITY`.
4. Run `npm run copy:cloud-shared`, then deploy all current cloud functions.
5. Run the real-device smoke pass for cover loading, sharing, signup profile entry, organizer/admin member removal, activity editing, and cancellation flows.
6. If the smoke pass is clean, implement the `coverThumbImage` batch backfill next to improve Home/My list image performance.

Safety notes before push:

- the pending commits do not include `project.config.json`, `env.local.js`, AppSecret values, tokens, private keys, or the real CloudBase environment ID
- test-only placeholder values such as `prod-env-123` are not production secrets

## 2026-05-01 - New Upload Cover Thumbnail Generation Implemented

Activity cover thumbnail support was implemented for newly uploaded covers. Historical cover backfill is deferred because the current CloudBase console does not expose the required image processing/CloudInfinite capability.

Delivered behavior:

- the cover crop page now exports two files:
  - `coverImage`: `1200x600` compressed JPEG for detail display
  - `coverThumbImage`: `480x240` compressed JPEG for list/card display
- new activity creation uploads both files:
  - original cover path: `activity-covers/`
  - thumbnail path: `activity-cover-thumbs/`
- activity editing preserves existing `coverThumbImage` and uploads a new thumbnail when the organizer selects a new cover
- `createActivity`, `updateActivity`, and the local mock now store `coverThumbImage`

Operational notes:

- deploy `createActivity` and `updateActivity` after running `npm run copy:cloud-shared`
- keep storage read rules covering both `activity-covers/` and `activity-cover-thumbs/`
- do not deploy or run a historical thumbnail backfill function for now

Verification:

- target thumbnail tests passed locally before the full suite:
  - create/update activity thumbnail persistence
  - crop page thumbnail export
  - activity create submit thumbnail upload
  - local mock thumbnail storage

## 2026-05-01 - Permission Model and Next Implementation Target

The CloudBase permission model and next implementation target were clarified after real-device image testing.

Permission conclusion:

- database collection permissions do not need to be opened for normal mini program reads
- business data reads go through cloud functions, and cloud functions have server-side database access
- storage permissions are different because activity covers are ultimately loaded by the client `<image>` component through a resolved HTTPS URL
- storage read rules must allow client reads for `activity-covers/` and `activity-cover-thumbs/`
- if storage read is blocked, the app can still read activity documents while cover images fail with `403` or `STORAGE_EXCEED_AUTHORITY`

Next implementation target:

- prioritize removing participant phone-number collection from signup
- remove the create/edit activity phone requirement control
- simplify the signup page so participants no longer enter or authorize a phone number
- update `joinActivity` and the local mock so phone is no longer required
- keep phone fields as optional extension fields rather than migrating or deleting them
- pause `resolvePhoneNumber` usage in the active signup flow while keeping the authorization interface as a future extension point

Why this is next:

- the product no longer needs participant phone numbers
- removing phone reduces privacy/compliance surface area
- signup becomes shorter and easier to test on real devices

## 2026-05-01 - Participant Phone Collection Removed

The signup flow was simplified so participants no longer enter or authorize a phone number.

Delivered behavior:

- Create/Edit Activity no longer exposes a `requirePhone` switch.
- `createActivity`, `updateActivity`, and the local mock now force `requirePhone: false` even if an older client sends the legacy field.
- Activity Detail no longer passes `requirePhone` into the join page route.
- Join Activity now asks only for signup name plus optional avatar selection.
- The join page no longer calls `resolvePhoneNumber` and no longer renders `open-type="getPhoneNumber"`.
- `joinActivity` no longer requires `phone`, but it preserves optional `phoneSnapshot`, `phoneSource`, `phoneNumber`, and `phoneSource` fields when a future signup flow deliberately sends a phone payload.
- Existing phone fields remain compatible; no migration is required for this change.

Operational notes:

- Deploy at least `createActivity`, `updateActivity`, and `joinActivity` after running `npm run copy:cloud-shared`.
- `resolvePhoneNumber` is no longer part of the normal signup runtime, but the cloud function plus frontend/local-mock adapters are kept as a dormant extension point for future phone-number requirements.
- Privacy and certification work is simpler because the core signup path no longer collects participant phone numbers.

Follow-up:

- keep automated coverage for the dormant phone authorization adapter so the interface does not disappear accidentally while the signup flow remains phone-free.

Verification:

- targeted red/green tests covered the join page, create page, activity detail route, signup-sheet component, activity draft helper, `createActivity`, `updateActivity`, `joinActivity`, and the local mock.

## 2026-05-01 - Cover Display Source Fallback Improved

The cover display resolver now uses different source priorities for list cards and the activity detail page.

Delivered behavior:

- Home/My list cards prefer `coverThumbImage` for faster card rendering.
- Home/My list cards fall back to `coverImage` when the thumbnail cannot be resolved to a display URL.
- Activity Detail prefers the full `coverImage` so the hero image keeps the best available resolution.
- Activity Detail falls back to `coverThumbImage` if the full cover cannot be resolved.
- Raw CloudBase `cloud://` file IDs are still filtered out before rendering, so `<image>` receives only display-safe URLs or local temporary file paths.

Why it matters:

- keeps list pages fast while avoiding blank images when a thumbnail is missing or unreadable
- keeps the detail page sharper than a `480x240` thumbnail
- makes older activities and newly uploaded activities share the same fallback path

Verification:

- targeted red/green coverage was added for list thumbnail preference, list fallback to original cover, detail original-cover preference, and detail fallback to thumbnail.
- full regression suite passed: `42` test suites, `201` tests.

## 2026-05-01 - Signup Profile Prefill Closed the Loop

The signup flow now reuses the saved user profile when a participant joins another activity.

Delivered behavior:

- Activity Join loads the current user profile with `ensureUserProfile`.
- If the participant has a saved `preferredName`, the signup name field is prefilled.
- If the participant has a saved `avatarUrl`, the avatar preview is prefilled without re-uploading the existing CloudBase file.
- If the participant starts typing or chooses an avatar before profile loading finishes, the async profile result does not overwrite their manual input.
- Existing `joinActivity` behavior continues to write `signupName`, `avatarUrl`, and `profileSource` into the registration and update `users.preferredName/avatarUrl`.

Why it matters:

- participants do not need to re-enter the same signup name and avatar for every activity
- registration records still keep the activity-specific snapshot used by team rosters
- the user profile remains the source for future signup prefill

Verification:

- targeted red/green coverage was added for profile prefill and delayed-profile non-overwrite behavior.
- related Activity Join, `joinActivity`, and local mock tests passed together.
- full regression suite passed: `42` test suites, `203` tests.

## 2026-05-01 - Organizer Participant Name Copy Implemented

Organizers and admins can now copy the active participant names from Activity Detail in one action.

Delivered behavior:

- Activity Detail shows `Copy participant names` when the viewer can manage registrations.
- copied text contains one participant name per line, preserving the current team/member order.
- empty or unnamed member entries are skipped.
- if no participant names are available, the page shows a non-blocking hint instead of writing an empty clipboard value.

Why it matters:

- organizers can quickly paste the roster into WeChat group messages, spreadsheets, or payment/attendance notes
- the feature uses the already-loaded team list and does not require a new cloud function

Verification:

- targeted red/green coverage was added for copying joined names, handling empty rosters, and rendering the organizer action entry point.
- full regression suite passed: `42` test suites, `205` tests.

## 2026-05-01 - Organizer Proxy Signup Implemented

Organizers and admins can now add participants on someone else's behalf from Activity Detail.

Delivered behavior:

- each team card shows `Add participant` when the viewer can manage registrations and that team can still accept signups
- tapping the action opens an editable modal for the participant name
- proxy signups create independent registration records with generated `proxy_...` user IDs, so one organizer can add multiple people
- proxy registrations are marked with `proxyRegistration: true`, `source: proxy`, and `createdByOpenId`
- existing organizer/admin removal can remove proxy registrations because they still have a stable `userOpenId`
- regular users cannot call the proxy signup cloud function

Operational notes:

- deploy the new `addProxyRegistration` cloud function after running `npm run copy:cloud-shared`
- no database permission change is required because the write goes through a cloud function

Verification:

- targeted red/green coverage was added for the cloud function, local mock, team-list entry point, detail-page modal flow, and view-model enable/disable rules.
- full regression suite passed: `43` test suites, `218` tests.

## 2026-05-01 - Manager-Only Proxy Signup Badge Implemented

Proxy participants are now visually distinguished from self-signup participants for organizers and admins only.

Delivered behavior:

- `getActivityDetail` includes `proxyRegistration` on roster members only for viewers with registration-management permission.
- the local mock returns the same permission-gated member flag for local DevTools testing.
- `buildTeamListVm` derives `proxyBadgeVisible` and `proxyBadgeText` only when the viewer can manage registrations.
- Activity Detail team rows show a small `Proxy` / `代报名` badge beside proxy participant names for organizers/admins.
- regular users still see the same roster names, without receiving or rendering the proxy badge flag.

Operational notes:

- deploy `getActivityDetail` after running `npm run copy:cloud-shared`.
- upload a new mini program frontend build so the `team-list` template and styles are included.

Verification:

- targeted red/green coverage was added for CloudBase detail output, local mock output, view-model visibility rules, and team-list rendering.
- full regression suite passed: `43` test suites, `220` tests.

## 2026-05-01 - Organizer Team Reassignment Implemented

Organizers and admins can now move an active participant from one team to another from Activity Detail.

Delivered behavior:

- Activity Detail roster rows show a `Move` / `换队` action for viewers with registration-management permission.
- tapping the action opens a target-team picker that excludes the current team and full teams.
- the new `moveRegistration` cloud function validates organizer/admin permission, published activity state, active registration state, target team ownership, and target capacity.
- moving a participant updates the registration `teamId`, records `movedByOpenId` and `movedAt`, decrements the source team count, and increments the target team count.
- activity `joinedCount` is unchanged because the participant remains signed up.
- regular users cannot see the action or call the cloud function successfully.
- the local mock implements the same behavior for DevTools local testing.

Operational notes:

- deploy the new `moveRegistration` cloud function after running `npm run copy:cloud-shared`.
- upload a new mini program frontend build so the roster `Move` action is available.

Verification:

- targeted red/green coverage was added for the cloud function, local mock, service adapter, view model, team-list event, and Activity Detail picker flow.
- full regression suite passed: `44` test suites, `232` tests.

## 2026-05-01 - One-Team Activity Default Implemented

Activity creation now starts from one editable team instead of forcing two teams.

Delivered behavior:

- new activity forms default to one `White` team with `12` slots.
- organizers can still add more teams up to the existing four-team maximum.
- team rows show remove controls whenever there is more than one team.
- the team editor refuses to remove the final remaining team.
- the create-page team hint now says the default is one team.
- existing cloud validation already allowed one-team activities, so no cloud function behavior change was required.

Why it matters:

- organizers can create simple one-list signup activities without managing an unnecessary second team.
- two-team and multi-team football setups remain available by adding teams.

Verification:

- targeted red/green coverage was added for the default draft form, create-page initialization, and team-editor one-team minimum behavior.
- full regression suite passed: `46` test suites, `235` tests.

## 2026-05-01 - Activity Insurance Link Implemented

Activities can now include an optional insurance signup link.

Delivered behavior:

- Create/Edit Activity shows an optional insurance link field.
- the frontend draft helper trims `insuranceLink` before submit.
- `createActivity`, `updateActivity`, and local mock mode persist the trimmed link.
- Activity Detail shows `Insurance purchase link` / `保险购买链接` at the top of the share card when a link exists.
- tapping the insurance purchase link opens the configured URL in a dedicated mini program `web-view` page.

Why it matters:

- organizers can include the insurance workflow in the activity setup without collecting extra participant phone data.
- participants can open the insurance page directly after the insurance domain is configured as a mini program business domain.

Operational notes:

- deploy `createActivity` and `updateActivity` after running `npm run copy:cloud-shared`.
- upload a new mini program frontend build so the Create/Edit field and Activity Detail web-view action are available.
- configure the insurance website domain in the mini program business-domain settings before expecting real devices to load the external page.

Verification:

- targeted red/green coverage was added for draft payloads, create/update cloud functions, local mock storage, Create page rendering, Activity Detail rendering, and web-view opening.
- full regression suite passed: `47` test suites, `241` tests after adding the dedicated insurance web-view page.

## 2026-05-02 - Activity Confirmation and Notification V1 Implemented

The first activity notification loop is now implemented in code.

Delivered behavior:

- new activities start with `confirmStatus: pending`, `confirmedAt: ''`, and `confirmedByOpenId: ''`
- successful signup requests the configured activity-notice subscription template and records the user's accepted or declined choice
- subscriptions are stored in `notification_subscriptions` through the new `recordNotificationSubscription` cloud function
- Activity Detail shows `Confirm Activity` to organizers/admins while a published activity is still unconfirmed
- confirming an activity sets `confirmStatus: confirmed`, stores confirmation metadata, and sends proceeding notices to subscribed active participants
- confirmed activities remain joinable until the normal signup rules close them
- cancelling an activity sends cancellation notices to subscribed active participants and logs results
- notification send results are stored in `notification_logs` and duplicate sends for the same notification type and recipient are skipped
- local mock mode implements the same subscription, confirmation, cancellation, and notification-summary behavior

Operational notes:

- configure `SUBSCRIBE_MESSAGE_TEMPLATE_IDS.activityNotice` in local-only runtime config before expecting the subscription prompt and real sends
- the sender is mapped to the approved `训练提醒` template fields: `time2` for appointment time, `thing3` for activity title, `thing6` for confirmation/cancellation note, and `thing7` for the location/reminder text
- deploy `recordNotificationSubscription`, `notifyActivityParticipants`, `createActivity`, and `ensureUserProfile` after running `npm run copy:cloud-shared`
- `notifyActivityParticipants` includes `config.json` OpenAPI permission for `subscribeMessage.send`
- no database permission broadening is required because reads/writes go through cloud functions

Verification:

- targeted red/green coverage was added for the new cloud functions, local mock behavior, notification service adapter, signup subscription request, and Activity Detail organizer actions.
- full regression suite passed: `50` test suites, `258` tests.

## 2026-05-02 - Subscription Template Field Mapping Updated

The notification sender was aligned to the approved WeChat `训练提醒` subscription template.

Template mapping:

- `time2`: activity start time
- `thing3`: activity title
- `thing6`: confirmation/cancellation note
- `thing7`: location and reminder text

Why it matters:

- the previous generic sender fields did not match the approved template detail
- using the exact template keyword names prevents send failures after the real template ID is configured

Verification:

- added coverage for `buildMessageData` so the sender mapping is locked to the approved template fields
- full regression suite passed: `50` test suites, `259` tests.

## 2026-05-02 - Confirmation Notification Reminder Field

Activity creation and editing added an optional notification reminder field.

Decision:

- organizers can enter a custom `notificationHint` when creating or editing an activity
- confirmation/proceeding notices use the custom reminder when it is present
- cancellation notices intentionally keep the default cancellation reminder text, so a reminder written for a normal activity is not reused for a cancellation

Why it mattered:

- lets organizers tailor the "activity will proceed" message without changing the WeChat subscription template
- keeps the first cancellation flow predictable and avoids sending inappropriate custom text after cancellation
- stores the reminder as normal activity data so notification sending can fill the approved template fields later

Related:

- `miniprogram/pages/activity-create/index.wxml`
- `miniprogram/utils/activity-draft.js`
- `cloudfunctions/createActivity/index.js`
- `cloudfunctions/updateActivity/index.js`
- `cloudfunctions/notifyActivityParticipants/index.js`

Verification:

- targeted red/green coverage was added for draft payloads, Create page rendering, create/update cloud functions, local mock storage, and notification message text.
- full regression suite passed: `50` test suites, `261` tests.

## 2026-05-02 - Real-Device Subscription and Cover Fallback Fixes

Two real-device issues were addressed after testing an uploaded build.

Findings:

- the subscription prompt was being requested only after the signup cloud call finished; on real devices this can fall outside WeChat's user-tap requirement, so no prompt appears
- the failed subscription request was intentionally swallowed so signup could still succeed, which made the missing prompt easy to miss
- activity cards and the detail hero only rendered the resolved temporary HTTPS cover URL; if that URL failed on a real device, the UI fell straight to a gray placeholder

Delivered behavior:

- signup now requests subscription consent immediately in the submit tap flow, before avatar upload and the `joinActivity` cloud call
- the accepted or declined subscription result is recorded only after signup succeeds
- activity cards and Activity Detail keep multiple cover candidates, including resolved temporary URLs and direct CloudBase file IDs, and move to the next candidate when image loading fails
- when a direct CloudBase file ID is the fallback candidate, the frontend now downloads it with `wx.cloud.downloadFile` and renders the local temporary file path
- if that download fails, the frontend still tries the original `cloud://` file ID before giving up
- no cloud function code change is required for this fix, but the frontend must be uploaded again; `recordNotificationSubscription` still needs to exist in CloudBase

Verification:

- targeted red/green coverage was added for consent-before-signup order and cover-image fallback candidates.
- full regression suite passed: `50` test suites, `264` tests.

## 2026-05-02 - Mobile Temp Cover Upload Fix

Real-device testing showed that newer activities had cover fields in the database but no matching files in CloudBase storage.

Root cause:

- mobile crop output can use `http://tmp/...` temporary file paths
- the create/edit upload path treated all `http(s)://` values as already-persistent images and skipped CloudBase upload
- the activity document was still created, leaving later devices with a temporary cover path that cannot be loaded

Delivered behavior:

- only `cloud://` file IDs are treated as already uploaded
- `http://tmp/...`, `https://tmp/...`, and `wxfile://...` cover paths are uploaded to CloudBase before `createActivity` or `updateActivity`
- this prevents new activities from being created with non-persistent temporary cover paths
- old affected activities need their cover image reselected or their database cover fields repaired manually, because the files were never uploaded

Verification:

- added coverage for mobile HTTP temp cover paths.
- full regression suite passed: `50` test suites, `265` tests.

## 2026-05-02 - Notification Collection Bootstrap Fix

Confirming an activity exposed an old-environment CloudBase setup gap.

Root cause:

- the notification feature added two new collections: `notification_subscriptions` and `notification_logs`
- existing CloudBase environments already had the original `users` collection, so `ensureUserProfile` did not run the full first-time collection bootstrap again
- `recordNotificationSubscription` attempted to write to `notification_subscriptions` before that collection existed, causing `DATABASE_COLLECTION_NOT_EXIST`

Delivered behavior:

- `recordNotificationSubscription` now ensures `notification_subscriptions` exists before recording a subscription choice
- `notifyActivityParticipants` now ensures `notification_subscriptions` and `notification_logs` exist before confirmation/cancellation notification work
- the fix keeps database permissions restricted; no client-side database read/write broadening is required

Operational notes:

- run `npm run copy:cloud-shared`, then deploy `recordNotificationSubscription` and `notifyActivityParticipants`
- manual CloudBase recovery is still simple: create `notification_subscriptions` and `notification_logs` in the database if an already-deployed function fails before the new code is uploaded

Verification:

- targeted red/green coverage was added for both notification cloud functions.
- full regression suite passed: `50` test suites, `265` tests.

## 2026-05-02 - Subscription Notification Timezone Fix

Real-device notification testing showed the subscription-message appointment time was eight hours early.

Root cause:

- activity times are stored as ISO timestamps converted from China local time
- the CloudBase cloud function runtime formatted `Date` values with the server timezone
- in the UTC runtime, a China-time activity at `20:00` was formatted as `12:00`

Delivered behavior:

- `notifyActivityParticipants` now formats subscription-message time fields in China local time explicitly
- the fix only changes the notification payload; stored activity times and signup/deadline checks remain unchanged

Verification:

- added a UTC-runtime regression test that expects `2026-05-03T12:00:00.000Z` to render as `2026-05-03 20:00`.
- full regression suite passed: `50` test suites, `266` tests.

## 2026-05-02 - Activity Description Displayed on Detail Page

Activity descriptions are now visible to participants.

Delivered behavior:

- Activity Detail trims `activities.description` and stores it as `activityDescriptionText`
- a description card is shown below the main activity hero only when the trimmed text is non-empty
- empty descriptions do not add an empty section to the page

Verification:

- added page coverage for trimming the description and rendering the description card binding.
- full regression suite passed: `50` test suites, `268` tests.

## 2026-05-02 - Participant Preferred Positions

Signup now captures optional preferred playing positions.

Delivered behavior:

- Activity Join lets a participant select up to two preferred positions, or leave the field empty
- supported positions are forward, midfield, wing, defensive midfield, center back, fullback, and goalkeeper, shown in Chinese in the UI
- `joinActivity` validates the submitted positions and stores them on the registration document as `preferredPositions`
- local mock mode mirrors the cloud-function behavior
- Activity Detail exposes member preferred positions only to organizers/admins through the manager-only member view model
- regular participants do not see other members' preferred positions in the team list

Operational notes:

- deploy `joinActivity` and `getActivityDetail` after running `npm run copy:cloud-shared`
- upload a new mini program build so the Activity Join selector and Activity Detail display are available

Verification:

- added coverage for join-page selection, cloud validation/storage, local mock storage, detail member visibility, and team-list rendering.
- full regression suite passed: `50` test suites, `273` tests.

## 2026-05-02 - Preferred Position Profile Prefill

The signup flow now remembers a participant's previous preferred position choices.

Delivered behavior:

- `joinActivity` saves the latest selected `preferredPositions` to the user's profile document.
- Activity Join reads `users.preferredPositions` through `ensureUserProfile` and preselects those positions on future signups.
- participants can still manually change or clear the prefilled positions before submitting.
- if profile loading finishes after the participant has already edited positions, the async profile result does not overwrite the manual choice.
- local mock mode mirrors the same user-profile persistence and prefill behavior.

Why it matters:

- repeat participants do not need to choose the same positions every time.
- organizers still receive an activity-specific snapshot on each registration.
- the behavior keeps the signup profile loop consistent with saved name and avatar prefill.

Operational notes:

- deploy `joinActivity` after running `npm run copy:cloud-shared` so CloudBase saves the latest position choices to `users.preferredPositions`.
- upload a new mini program frontend build so Activity Join can prefill and protect manually edited position choices.
- `ensureUserProfile` does not need a code change for this behavior because it already returns the user document.

Verification:

- targeted red/green coverage was added for Activity Join prefill, delayed-profile non-overwrite behavior, CloudBase profile updates, and local mock profile updates.
- full regression suite passed: `50` test suites, `273` tests.

## 2026-05-02 - Participant Copy List Includes Positions

Organizer roster copying now includes preferred position choices when they are available.

Delivered behavior:

- `Copy participant names` still copies one participant per line in the current team/member order.
- participants with preferred positions are copied as `Name (Position / Position)`.
- participants without preferred positions are copied as plain names.
- position text remains manager-only because the copy action is available only to organizers/admins, and regular participant detail data does not expose other members' positions.

Why it matters:

- organizers can paste a useful roster into WeChat groups or spreadsheets without manually retyping each player's position preferences.
- the feature uses the already-loaded Activity Detail team view model and does not require a cloud-function change.

Verification:

- targeted red/green coverage was added for copied roster text with preferred positions.
- full regression suite passed: `50` test suites, `273` tests.

## 2026-05-02 - Home List and Creation UX Polish

Several real-device UI issues were addressed after organizer testing.

Delivered behavior:

- Home now keeps only joinable activities in the public list.
- Home sorts visible activities by activity creation time, newest first.
- Home filters before resolving cover display URLs, so hidden closed/cancelled activities do not spend list-image work.
- Create/Edit Activity now uses the cover preview frame itself as the image chooser entry point; the separate `Choose and crop image` / `Replace image` button was removed.
- compact member action buttons remove the native mini program button pseudo-border and use explicit borders, so `Move` and `Remove` render as complete pills on real devices.

Why it matters:

- participants see only activities they can actually join on Home.
- the image upload flow is less redundant because the visible `+` target is the action.
- organizer member-management controls look stable in the narrow roster layout.

Verification:

- targeted red/green coverage was added for Home filtering/sorting, the cover-frame image chooser, and compact member action button borders.
- full regression suite passed: `50` test suites, `277` tests.

## 2026-05-02 - Team Editor Row Polish

Activity creation team setup was adjusted to make team actions easier to read on mobile.

Delivered behavior:

- new activity forms default to one team named `队伍1` with `12` slots.
- newly added teams continue the same naming pattern, such as `队伍2`.
- the team editor keeps each team's `Remove` action on the same row as that team's name and capacity fields.
- the final remaining team still cannot be removed.

Why it matters:

- organizers can immediately understand which team a remove button belongs to.
- the default team name is neutral and works better for one-list signup activities than `White`.

Verification:

- targeted red/green coverage was added for default team naming and same-row remove controls.
- full regression suite passed: `50` test suites, `278` tests.

## 2026-05-02 - Proxy Signup Header Placement

Activity Detail team cards were adjusted so the organizer proxy-signup action is visually attached to the target team.

Delivered behavior:

- the manager-only `Proxy signup` / `代人报名` action now appears beside the team name in the team header.
- the action keeps the existing organizer/admin visibility and team identity payload.
- the large proxy-signup button was removed from the bottom of each team card.

Why it matters:

- organizers can tell immediately which team the proxy-signup action belongs to.
- the roster area stays focused on participants and member-level actions.

Verification:

- targeted red/green coverage was added for the team-list template structure and compact header-button styling.
- full regression suite passed: `50` test suites, `279` tests.

## 2026-05-02 - Detail Team Action Layout Polish

Activity Detail team and organizer actions were tightened for mobile readability.

Delivered behavior:

- the regular `Join` / `报名` action now appears in the team header beside the team name and manager proxy-signup action.
- the old full-width per-team `Joinable` / `Joined` button below each roster was removed.
- once the current user has joined the activity, header join actions are hidden instead of showing disabled joined buttons.
- organizer actions are ordered from top to bottom as: copy participant names, edit activity, confirm activity, cancel activity.

Why it matters:

- participants can see the team-level signup action without scrolling past roster content.
- after signup, the current user's state is represented by the member-row cancel action rather than a duplicate disabled team button.
- organizer controls now follow a stable operation order from lower-risk to destructive action.

Verification:

- targeted red/green coverage was added for header join rendering, joined-state join hiding, and organizer action ordering.
- full regression suite passed: `50` test suites, `282` tests.

## 2026-05-02 - Join Position Button Border Fix

Activity Join preferred-position chips were adjusted for real-device button rendering.

Delivered behavior:

- preferred-position options now remove the native mini program `button::after` pseudo-border.
- the chips use an explicit transparent border in the normal state and a complete green border when selected.
- chip sizing uses `box-sizing: border-box`, so border rendering does not change the layout.

Why it matters:

- WeChat's native button pseudo-border could show as a partial outline on rounded position chips.
- participants get stable, complete-looking position buttons on the signup page.

Verification:

- targeted red/green coverage was added for preferred-position chip border styling.
- full regression suite passed: `50` test suites, `283` tests.

## 2026-05-02 - Invite Code UI Hidden

The reserved invite-code field was hidden until the real invite-code flow is implemented.

Delivered behavior:

- Create/Edit Activity no longer shows the invite-code input.
- existing invite-code draft/payload/storage mapping remains in place as a future extension point.
- TODO: implement invite-code enforcement before showing the field again.

Future invite-code scope:

- require invite-code entry before signup when an activity has an invite code.
- validate the submitted code inside `joinActivity`, not only in the frontend.
- decide later whether invite-code activities should still appear on Home.

Verification:

- targeted red/green coverage was added to ensure the Create/Edit Activity template does not render the reserved invite-code input.
- full regression suite passed: `50` test suites, `284` tests.

## 2026-05-02 - Cancelled Activity Confirmation Banner Fix

Activity Detail now suppresses the confirmed-state banner after a confirmed activity is cancelled.

Delivered behavior:

- the `Confirmed` / `已确认举行` banner is shown only when the activity is still `published` and `confirmStatus` is `confirmed`.
- cancelled activities no longer show the confirmed-state banner even if their historical confirmation metadata remains in the document.
- no cloud-function data migration is required for existing activities.

Why it matters:

- activity status presentation now prioritizes cancellation over a previous confirmation.
- organizers can confirm and later cancel an activity without leaving contradictory detail-page messaging.

Verification:

- targeted red/green coverage was added for the Activity Detail confirmed-banner condition.
- full regression suite passed: `50` test suites, `285` tests.

## 2026-05-02 - Activity List Pagination TODO

The project captured a future pagination/infinite-scroll TODO for activity lists.

Current behavior:

- Home and My activity pages load one batch of activities.
- the frontend can only sort and filter the activities returned by the current `listActivities` call.
- if activity volume grows beyond the cloud function's single-query return range, older activities may not appear.

TODO:

- update `listActivities` to support explicit pagination with `limit` plus `skip` or a cursor.
- apply stable cloud-side sorting for each scope before pagination, for example `startAt` descending for My and the selected Home sort key for Home.
- add page-level `onReachBottom` loading for Home and My.
- preserve current Home filtering to joinable activities and My filtering tabs while loading additional pages.

Verification:

- documentation-only change; no runtime behavior changed.

## 2026-05-02 - Signup Name Normalization

Signup names now have consistent lightweight cleanup before storage.

Delivered behavior:

- signup names trim leading and trailing whitespace.
- internal line breaks and repeated whitespace are collapsed into a single space.
- names are limited to 16 Unicode code points.
- emoji, Chinese names, English names, numbers, and common symbols remain allowed.
- the active participant signup flow, organizer proxy signup flow, and local mock use the same normalization behavior.

Why it matters:

- participant names with emoji or common symbols remain usable.
- copied rosters no longer get broken by embedded line breaks.
- extremely long names are kept from pushing the roster layout too far.

Verification:

- targeted red/green coverage was added for the signup-name utility, Activity Join submit payload, `joinActivity`, `addProxyRegistration`, and the local mock.
- full regression suite passed: `51` test suites, `294` tests.
