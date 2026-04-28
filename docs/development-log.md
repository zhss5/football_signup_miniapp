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
