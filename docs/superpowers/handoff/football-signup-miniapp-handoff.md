# Football Signup Mini Program Handoff

- Date: 2026-05-02
- Branch: `main`
- Workspace: `D:/workspaces/football_signup_miniapp`
- Remote: `origin` -> `git@github.com:zhss5/football_signup_miniapp.git`

## 1. Current State

The repository is on `main`.

`origin/main` may be behind the local branch. Push local commits when they are ready to share.

Recent local work includes role-gated activity creation, dynamic default activity dates, highlighted activity signup status, activity editing, media optimization, organizer roster tools, insurance links, and the first activity confirmation/notification implementation.

The codebase supports:

- local mock mode in WeChat DevTools
- real CloudBase runtime switching via local-only `env.local.js`
- cloud function packages with per-function `package.json`
- shared cloud helper copying through `npm run copy:cloud-shared`
- cover image upload to CloudBase storage with persistent `fileID`
- automatic cover thumbnail upload to `coverThumbImage` for new/edited covers
- real-device `http://tmp/...` crop outputs are uploaded to CloudBase and are not treated as persistent URLs
- list pages prefer `coverThumbImage` and detail pages prefer `coverImage`, with mutual fallback when one display URL cannot be resolved
- list cards and Activity Detail can retry direct CloudBase file IDs when temporary HTTPS cover URLs fail to load on real devices
- fallback CloudBase file IDs are downloaded with `wx.cloud.downloadFile` and rendered from local temporary file paths
- if fallback download fails, the original `cloud://` file ID is still attempted before the placeholder is shown
- automatic CloudBase collection bootstrap from `ensureUserProfile`
- organizer cancellation and soft delete
- role-gated activity creation for `organizer` and `admin` users
- organizer/admin activity editing through the `updateActivity` cloud function
- organizer/admin one-tap participant name copy from Activity Detail
- organizer/admin proxy signup through the `addProxyRegistration` cloud function
- organizer/admin-only proxy participant badge in Activity Detail rosters
- organizer/admin team reassignment through the `moveRegistration` cloud function
- one-team activity creation default with add/remove team controls up to four named teams
- optional activity insurance link creation, editing, and Activity Detail web-view opening
- optional activity notification reminder creation and editing
- activity confirmation state with organizer/admin-triggered `Confirm Activity`
- signup subscription opt-in and cloud-function-backed notification records
- signup subscription consent is requested inside the submit tap flow before the signup cloud call, then recorded after signup succeeds
- organizer/admin-triggered proceeding and cancellation notices for subscribed active participants
- copyable user ID on My page for manual CloudBase role grants
- highlighted activity signup status on activity cards
- simplified signup without participant phone collection
- signup profile prefill from saved `users.preferredName/avatarUrl/preferredPositions`
- dedicated activity creation, detail, signup, and `My` page flows
- multi-language UI support

## 2. CloudBase Deployment Status

Deployable cloud functions currently include:

- `ensureUserProfile`
- `listActivities`
- `getActivityDetail`
- `createActivity`
- `updateActivity`
- `joinActivity`
- `addProxyRegistration`
- `cancelRegistration`
- `cancelActivity`
- `deleteActivity`
- `getActivityStats`
- `removeRegistration`
- `moveRegistration`
- `recordNotificationSubscription`
- `notifyActivityParticipants`

Legacy note:

- `resolvePhoneNumber` still exists in the repository, and the service/local-mock adapters are intentionally retained for future extension. The active signup flow no longer calls it and it is not required for normal deployment.

Some functions were deployed successfully during earlier rollout, but the target CloudBase environment should be treated as needing a fresh full-function deployment after `npm run copy:cloud-shared` before the next real-device smoke pass.

Latest proxy-badge change:

- `getActivityDetail` now returns `proxyRegistration` on roster members only for viewers with registration-management permission, so redeploy `getActivityDetail` before validating the badge on CloudBase.
- upload a new mini program frontend build so the `team-list` template/style changes are available on device.

Latest insurance-link change:

- `createActivity` and `updateActivity` now persist the optional trimmed `insuranceLink`.
- upload a new mini program frontend build so the Create/Edit field and the Activity Detail share-card insurance purchase link are available.
- redeploy `createActivity` and `updateActivity` after running `npm run copy:cloud-shared` before testing this feature on CloudBase.
- configure the insurance URL domain in the mini program business-domain settings before expecting the external page to open on real devices.

Latest activity-notification change:

- `createActivity` now initializes `confirmStatus: pending`, `confirmedAt: ''`, and `confirmedByOpenId: ''`.
- successful signup requests the configured activity-notice subscription template and records the user choice through `recordNotificationSubscription`.
- Activity Detail now shows `Confirm Activity` to organizers/admins for unconfirmed published activities.
- Create/Edit Activity now stores an optional `notificationHint` for confirmation notices.
- `notifyActivityParticipants` confirms or cancels the activity, sends subscribed active participants the relevant WeChat subscription message, and writes per-recipient logs.
- proceeding notices use `notificationHint` when present; cancellation notices keep the default cancellation reminder text.
- duplicate sends are skipped per `activityId + notificationType + recipientOpenId`.
- configure `SUBSCRIBE_MESSAGE_TEMPLATE_IDS.activityNotice` in local-only config before expecting real subscription prompts or sends.
- deploy `recordNotificationSubscription`, `notifyActivityParticipants`, `createActivity`, `updateActivity`, and `ensureUserProfile` after running `npm run copy:cloud-shared`.
- upload a new mini program frontend build so the subscription prompt, confirmed banner, and organizer action are available on device.

Latest real-device subscription and cover-display fix:

- no cloud function code changed for this fix.
- upload a new mini program frontend build so signup requests subscription consent before the `joinActivity` cloud call.
- upload a new mini program frontend build so list cards and Activity Detail can download fallback CloudBase cover sources when the first image URL fails.
- keep `recordNotificationSubscription` deployed; the frontend still records accepted/declined subscription choices through that function after signup succeeds.

Latest preferred-position prefill change:

- `joinActivity` now saves the latest selected positions to `users.preferredPositions`.
- Activity Join now preselects saved positions on future signups and preserves manual edits if profile loading finishes late.
- redeploy `joinActivity` after running `npm run copy:cloud-shared`.
- upload a new mini program frontend build so the prefill behavior is available on devices.
- `ensureUserProfile` does not require a code change for this behavior because it already returns the user document.

Latest mobile cover-upload fix:

- mobile crop output may be `http://tmp/...`; it must be treated as a temporary local file, not a persistent cover URL.
- only `cloud://` cover values are skipped as already uploaded.
- upload a new mini program frontend build before creating more activities with covers.
- affected existing activities whose cover fields point to temporary paths need manual repair or reselecting/reuploading the cover image, because their files were never uploaded to CloudBase.

Earlier rollout reference:

- `5587bf0` `Bootstrap CloudBase collections on startup`

`ensureUserProfile` was redeployed after that change and reported:

- `success: true`
- `filesCount: 8`
- runtime status: `Active`

The current CloudBase environment ID is intentionally not recorded in this handoff. It should stay in local configuration only.

## 3. Issues Fixed During Rollout

The following CloudBase rollout issues were fixed:

- Missing cloud functions caused `FunctionName parameter could not be found`.
- Shared helper imports failed because each cloud function package is uploaded independently.
- CloudBase deployment with nested `_shared` folders caused packaging problems, so shared helpers are now copied flat into each function package.
- `context.OPENID` was empty in some real CloudBase calls, so functions now resolve openid from the wx cloud context fallback.
- CloudBase rejected writes that included `_id` inside `doc(id).set({ data })`; `_id` is now used only as the document id.
- Cover images are uploaded to CloudBase storage before activity creation, so shared activity cards do not depend on temporary local file paths.
- Missing database collections are now bootstrapped by `ensureUserProfile`.

## 4. Current Watch Items

The latest visible client-side issues were:

- WeChat DevTools simulator may flicker when opening Activity Detail with the native `map` preview; real-device testing passed, so this is recorded as a non-blocking simulator issue.
- uploaded preview builds can load historical activity cover images slowly when the stored CloudBase file is large; new uploads now generate `coverThumbImage`, while old cover backfill is deferred.
- participant phone collection has been removed from the active signup flow; optional phone fields remain supported for future extensions.
- CloudBase storage returned `STORAGE_EXCEED_AUTHORITY` for an existing activity cover because the client-side storage rule does not allow mini-program reads for that file path.
- The CloudBase environment has been upgraded to a personal plan and storage reads were changed to allow client access; if covers return 403 again, verify both `activity-covers/` and `activity-cover-thumbs/` rules.
- CloudBase cost should be reviewed after the first real usage period; keep CloudBase for MVP unless cost, lock-in, or backend-control needs become materially higher than the benefit of integrated WeChat hosting.

Resolved/mitigated:

- WeChat verification has been completed, so real-device sharing should be validated through an uploaded experience version and experience members.
- the role-gated `createActivity` flow has been reported working in CloudBase after deployment
- local mock testing confirmed `organizer` can create activities and `user` cannot
- local automated tests cover organizer/admin `updateActivity`, edit-mode form loading, and capacity safeguards

If startup timeout appears again, recommended actions:

1. Recompile once and retry, because the first call may already have created some collections.
2. In CloudBase function settings, increase `ensureUserProfile` timeout from `3` seconds to `20-60` seconds.
3. Alternatively, create these collections manually in the CloudBase console:
   - `users`
   - `activities`
   - `activity_teams`
   - `registrations`
   - `activity_logs`
   - `notification_subscriptions`
   - `notification_logs`

WeChat verification note:

- Verification can be completed during development; it does not require the code to be finished.
- Verification is separate from CloudBase deployment, code review, public release, and filing/record registration.
- The current platform flow for this account showed a verification fee of RMB 30; confirm the final fee on the WeChat Official Accounts Platform payment page before paying.
- Adding experience members allows selected users to open an experience version, but it does not bypass verification-only restrictions such as real-device sharing.
- Before verification is complete, use the experience-version QR code for tester access instead of relying on in-app sharing.

## 5. Local-Only State

The following local state should not be committed unless there is a deliberate decision:

- `D:/workspaces/football_signup_miniapp/project.config.json`
- `D:/workspaces/football_signup_miniapp/miniprogram/config/env.local.js`

Current git status includes:

- `project.config.json` modified locally and intentionally uncommitted
- `miniprogram/config/env.local.js.example` deleted locally and intentionally uncommitted
- `miniprogram/config/env.local.js.sample` untracked locally and intentionally uncommitted

The local override file is ignored by git and should be recreated from:

- `D:/workspaces/football_signup_miniapp/miniprogram/config/env.local.js.example`

## 6. Deployment Commands

Before deploying cloud functions, always run:

```bash
npm run copy:cloud-shared
```

Deploy all cloud functions from PowerShell:

```powershell
$devtoolsCli = '<path-to-wechat-devtools>\cli.bat'
& $devtoolsCli cloud functions deploy `
  --env 'your-cloud-env-id' `
  --project 'D:\workspaces\football_signup_miniapp' `
  --remote-npm-install `
  --names ensureUserProfile listActivities getActivityDetail createActivity updateActivity joinActivity addProxyRegistration cancelRegistration removeRegistration moveRegistration recordNotificationSubscription notifyActivityParticipants cancelActivity deleteActivity getActivityStats `
  --lang zh
```

Check one function:

```powershell
$devtoolsCli = '<path-to-wechat-devtools>\cli.bat'
& $devtoolsCli cloud functions info `
  --env 'your-cloud-env-id' `
  --project 'D:\workspaces\football_signup_miniapp' `
  --names updateActivity `
  --lang zh
```

## 7. Verification Snapshot

Latest verified command:

```bash
npm test
```

Latest result:

- `50` test suites passed
- `278` tests passed

The latest verification includes the role-gated create flow, default-tomorrow activity dates, one-team default activity setup, default team naming and same-row team remove controls, highlighted signup status view models, Home joinable filtering and newest-created sorting, local mock behavior, `createActivity` authorization, `updateActivity` organizer/admin editing behavior, organizer/admin registration removal, organizer participant-name copy, organizer proxy signup, manager-only proxy participant badge behavior, organizer team reassignment, compact member action button border rendering, signup profile fields without phone collection, signup profile prefill including preferred positions, optional insurance-link persistence and detail-page web-view opening, direct cover-frame image choosing, activity confirmation and notification V1 behavior, notification reminder persistence and confirmation-message reminder behavior, real-device subscription prompt timing, CloudBase cover display URL resolution, and cover source fallback behavior.

## 8. Current Implementation Snapshot

Current cover-display progress:

- CloudBase cover file IDs are now resolved into display URLs before rendering on Home, My, and Activity Detail.
- Activity card and detail templates render managed cover candidates instead of directly binding stored `cloud://` fields.
- Home/My list cards resolve `coverThumbImage` first and fall back to `coverImage`.
- Activity Detail resolves `coverImage` first and falls back to `coverThumbImage`.
- If a resolved temporary HTTPS URL fails to load on a real device, list cards and Activity Detail download the fallback CloudBase file ID and render the returned local temporary file path; if the download fails, they still try the original `cloud://` file ID before showing the placeholder.
- The map preview markup was adjusted so the native `map` is wrapped by a normal `view`, with only the tap `cover-view` nested inside the map.
- Documentation records the CloudBase storage permission investigation and the CloudBase cost review checkpoint.

Current cover-thumbnail progress:

- the cover crop page exports both the detail cover and a smaller thumbnail file
- create/edit activity uploads thumbnails to `activity-cover-thumbs/`
- create/edit activity uploads mobile `http://tmp/...` crop outputs instead of storing them directly
- `createActivity`, `updateActivity`, and the local mock persist `coverThumbImage`
- Create/Edit Activity opens image selection from the cover preview frame itself; there is no separate choose/replace button
- historical backfill is paused; do not deploy a backfill function for now

Current permission conclusion:

- database collections can stay restricted because the mini program reads business data through cloud functions
- storage rules must allow client reads for `activity-covers/` and `activity-cover-thumbs/` because covers are rendered by the client `<image>` component after resolving file IDs to temporary HTTPS URLs
- if images fail with `403` or `STORAGE_EXCEED_AUTHORITY`, check storage rules before database permissions

Current signup simplification:

- Create/Edit Activity no longer exposes `requirePhone`
- `createActivity` and `updateActivity` force `requirePhone: false`
- Join Activity no longer renders phone input or WeChat phone authorization
- `joinActivity` accepts signups without `phone`, and still preserves optional phone fields if a future flow sends them
- keep phone fields as optional extension fields; no immediate migration is required

Current activity creation team defaults:

- New activity forms start with one editable team.
- The default team uses `队伍1` in the Chinese UI and `12` slots.
- Organizers can add teams up to the existing four-team maximum.
- Added teams continue the numbered team-name pattern.
- Team rows keep their remove action on the same row as the team name and capacity fields.
- Team rows can be removed down to one team; the final remaining team cannot be removed.

Current signup profile behavior:

- Activity Join loads the current user profile through `ensureUserProfile`.
- saved `users.preferredName` prefills the signup name field.
- saved `users.avatarUrl` prefills the avatar preview without re-uploading the existing CloudBase file.
- saved `users.preferredPositions` prefills the optional playing-position selector.
- manual name/avatar/position edits made before profile loading finishes are preserved.
- `joinActivity` updates both the registration snapshot and `users.preferredName/avatarUrl/preferredPositions` after signup.
- Activity Join lets participants optionally select up to two preferred positions from `前锋`, `中场`, `边锋`, `后腰`, `中卫`, `边卫`, and `门将`.
- `joinActivity` validates and stores selected positions as `registrations.preferredPositions`.

Current organizer roster behavior:

- Activity Detail shows `Copy participant names` to viewers with registration-management permission.
- copied text is one participant per line in the current team/member display order, with preferred positions appended as `Name (Position / Position)` when available.
- empty rosters show a toast and do not write an empty clipboard value.
- compact move/remove/cancel member action buttons remove the native mini program pseudo-border and use explicit borders for complete pill rendering.
- Activity Detail also lets organizers/admins add proxy participants to a selected team.
- proxy participants use generated `proxy_...` user IDs and can be removed through the existing organizer/admin removal flow.
- proxy participants show a small proxy badge only to organizers/admins; regular users see the same member name without the badge.
- Activity Detail lets organizers/admins move active participants to another non-full team.
- moving a participant keeps the activity joined count unchanged while updating source and target team counts.
- organizers/admins can see each member's preferred positions on Activity Detail; regular participants cannot see other members' position choices.

Current insurance-link behavior:

- Create/Edit Activity has an optional insurance signup link field.
- Activity Detail shows the insurance purchase link at the top of the share card only when the activity has a link.
- tapping the insurance purchase link opens the URL through `pages/insurance-webview/index`.
- the external insurance domain must be configured as a mini program business domain; otherwise WeChat can block the web-view page on real devices.

Current activity notification behavior:

- new activities carry a separate confirmation state: `confirmStatus: pending/confirmed`.
- signup requests a subscription only when `SUBSCRIBE_MESSAGE_TEMPLATE_IDS.activityNotice` is configured.
- signup requests subscription consent before the signup cloud call to preserve WeChat's user-tap requirement; recording the choice still happens after signup succeeds.
- subscription choices are stored in `notification_subscriptions`; declined choices are stored too, but only accepted active registrations are notified.
- `recordNotificationSubscription` self-creates `notification_subscriptions` when possible so older CloudBase environments can recover from missing notification collections.
- organizers/admins can confirm a published activity from Activity Detail.
- confirming does not close signup; late joiners see the in-app confirmed state but do not receive the already-sent proceeding notice.
- cancellation closes signup and attempts to send cancellation notices to subscribed active participants.
- notification attempts are logged in `notification_logs`; duplicate sends for the same notification type and recipient are skipped.
- `notifyActivityParticipants` self-creates `notification_subscriptions` and `notification_logs` when possible before sending or logging notifications.
- Create/Edit Activity can store a custom `notificationHint`; proceeding notices use it in the reminder field when present, while cancellation notices still use the default cancellation reminder.
- real sends use the approved `训练提醒` template mapping: `time2` appointment time, `thing3` activity title, `thing6` confirmation/cancellation note, and `thing7` location/reminder text.
- `time2` is formatted explicitly as China local time so UTC CloudBase runtimes do not send activity times eight hours early.

Current Home list behavior:

- Home shows only activities whose card state is joinable.
- Home sorts visible activities by `createdAt`, newest first.
- hidden closed/cancelled/full/deadline-past activities are filtered before cover image URL resolution.

Problems encountered during cover-display testing:

- The mini-program renderer tried to load raw CloudBase file IDs as local component resources.
- `wx.cloud.getTempFileURL` returned top-level `ok`, but the file item returned `STORAGE_EXCEED_AUTHORITY`.
- `wx.cloud.downloadFile` also failed with `-403003 internal server error: empty download url`.
- CloudBase console preview worked because console/server-side access does not prove mini-program client read access.

Sensitive-file check before push:

- committed changes should not include `project.config.json`
- committed changes should not include `miniprogram/config/env.local.js`
- committed changes should not include AppSecret values, tokens, private keys, or the real CloudBase environment ID
- local-only config files are still present only in the working tree and should remain uncommitted

## 9. Next Steps

Continue in this order:

1. Confirm CloudBase storage permissions allow mini-program client reads for both `activity-covers/` and `activity-cover-thumbs/`.
2. Confirm the database collections exist; notification functions can now create `notification_subscriptions` and `notification_logs`, but manual creation remains a valid recovery path.
3. Grant organizer access manually by editing the target `users.roles` array in CloudBase to include `organizer`.
4. Run `npm run copy:cloud-shared`, then deploy all active cloud functions listed in section 6.
5. Apply indexes from:
   - `D:/workspaces/football_signup_miniapp/docs/cloudbase/indexes.md`
6. Apply database rules from:
   - `D:/workspaces/football_signup_miniapp/docs/cloudbase/security-rules.json`
7. Run the smoke checklist on DevTools and a real device:
   - `D:/workspaces/football_signup_miniapp/docs/cloudbase/manual-smoke-checklist.md`
8. Add experience members and distribute the experience-version QR code for temporary tester access.
9. Validate cover image loading, sharing, signup profile entry without phone, organizer/admin activity editing, organizer/admin member removal, organizer proxy signup, and organizer team reassignment after CloudBase deployment.
10. Validate repeat signup profile behavior: sign up with preferred positions, cancel or use another activity, confirm the same user's positions are prefilled and still editable.
11. Configure and validate participant notification subscriptions using:
   - `D:/workspaces/football_signup_miniapp/docs/superpowers/specs/2026-04-28-subscription-notifications-design.md`
   - add the real template ID to local-only config as `SUBSCRIBE_MESSAGE_TEMPLATE_IDS.activityNotice`
   - deploy `recordNotificationSubscription`, `notifyActivityParticipants`, `createActivity`, and `updateActivity`
   - validate signup subscription prompt, custom confirmation reminder, cancellation notice, and duplicate-send skipping on a real device
12. Keep `resolvePhoneNumber` as a dormant extension point; only deploy or reconnect it when a future phone-number feature is deliberately added.
13. Keep historical cover-thumbnail backfill deferred until CloudBase image processing is available or a non-CloudInfinite implementation is chosen.
14. Keep the future operations/backend backlog visible but deferred:
   - export participant rosters
   - calculate attendance rate
   - calculate activity fees
15. Revisit CloudBase monthly cost after the first real usage period and decide whether to stay on CloudBase or plan an HTTP API/backend migration checkpoint.
16. Push local commits if they should be shared:
   - `git push origin main`

## 10. Key Files To Read First

For the next session, these files are the fastest orientation points:

- `D:/workspaces/football_signup_miniapp/README.md`
- `D:/workspaces/football_signup_miniapp/miniprogram/services/cloud.js`
- `D:/workspaces/football_signup_miniapp/miniprogram/services/activity-service.js`
- `D:/workspaces/football_signup_miniapp/miniprogram/services/notification-service.js`
- `D:/workspaces/football_signup_miniapp/miniprogram/pages/activity-create/index.js`
- `D:/workspaces/football_signup_miniapp/miniprogram/pages/activity-detail/index.js`
- `D:/workspaces/football_signup_miniapp/miniprogram/config/env.js`
- `D:/workspaces/football_signup_miniapp/cloudfunctions/ensureUserProfile/index.js`
- `D:/workspaces/football_signup_miniapp/cloudfunctions/createActivity/index.js`
- `D:/workspaces/football_signup_miniapp/cloudfunctions/updateActivity/index.js`
- `D:/workspaces/football_signup_miniapp/cloudfunctions/recordNotificationSubscription/index.js`
- `D:/workspaces/football_signup_miniapp/cloudfunctions/notifyActivityParticipants/index.js`
- `D:/workspaces/football_signup_miniapp/cloudfunctions/_shared/database.js`
- `D:/workspaces/football_signup_miniapp/cloudfunctions/_shared/roles.js`
- `D:/workspaces/football_signup_miniapp/miniprogram/utils/roles.js`
- `D:/workspaces/football_signup_miniapp/scripts/copy-cloud-shared.mjs`
- `D:/workspaces/football_signup_miniapp/docs/cloudbase/real-cloudbase-rollout.md`
- `D:/workspaces/football_signup_miniapp/docs/cloudbase/wechat-devtools-setup.md`
- `D:/workspaces/football_signup_miniapp/docs/superpowers/specs/2026-04-28-activity-editing-design.md`
- `D:/workspaces/football_signup_miniapp/docs/superpowers/specs/2026-04-28-subscription-notifications-design.md`

## 11. Important Notes

- Do not commit real CloudBase environment IDs, AppSecret values, tokens, or local `env.local.js` contents.
- The documented deployment commands use placeholders such as `your-cloud-env-id`.
- `project.config.json` is still modified locally and intentionally uncommitted.
- The repo's committed docs do not contain known secrets or tokens as of this handoff.
