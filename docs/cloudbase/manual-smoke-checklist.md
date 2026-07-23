# Manual Smoke Checklist

## Home and Listing

- Confirm the home page loads only joinable activities from CloudBase
- Confirm cancelled, full, deleted, and signup-closed activities do not appear on Home
- Confirm Home activities are sorted by activity creation time, newest first
- Confirm created and joined lists load correctly on the `My` page
- Confirm the first batch of `My` created/joined activities appears quickly in the experience build after deploying `listActivities`
- If the account has more than 20 created or joined activities, confirm older activities may wait for the future pagination/load-more work

## Activity Creation

- Confirm a new activity starts with one default team named `队伍1`
- Confirm adding another team creates the next numbered team name and keeps each remove button on the same row as that team
- Confirm the final remaining team cannot be removed
- Confirm Create/Edit Activity does not show the reserved invite-code field
- Confirm activity creation writes one `activities` document
- Confirm activity creation writes the related `activity_teams` documents
- Confirm map-selected address fields are stored
- Confirm optional insurance link is stored when entered
- Confirm optional notification reminder is stored when entered
- Confirm `signupDeadlineAt`, `startAt`, and `endAt` are stored correctly
- Confirm tapping the cover `+` / preview frame opens image selection and crop without a separate choose button
- Confirm newly uploaded covers store both `coverImage` and `coverThumbImage`
- Confirm newly created real-device activities add new files under `activity-covers/` and `activity-cover-thumbs/`
- Confirm adding detail images uploads files under `activity-detail-images/` and stores them in `activities.detailImages`
- Confirm Activity Detail renders uploaded detail images below the description
- Confirm Home/My activity cards load the thumbnail without 403 image errors
- Confirm newly uploaded cover thumbnails display on a real device, not only in the DevTools simulator
- If a thumbnail URL fails on a real device, confirm the card/detail page downloads a fallback CloudBase cover source, then tries the original `cloud://` file ID before showing the placeholder

## Signup Flow

- Confirm the activity detail page shows team counts and member names
- Confirm available teams show a compact `Join` / `报名` action in the team header instead of a full-width team button below the roster
- Confirm the team header `Join` / `报名` action hides after the current user joins
- Confirm the activity detail share card shows the insurance purchase link only for activities with an insurance link
- Confirm tapping the insurance purchase link opens the insurance URL in the mini program web-view
- If the web-view page is blocked on a real device, confirm the insurance URL domain is configured as a mini program business domain
- Confirm the join page does not show phone input or WeChat phone authorization
- Confirm the join page lets participants choose zero, one, or two preferred positions and blocks a third choice
- Confirm preferred-position buttons render as complete rounded chips on a real device
- Confirm the same participant's latest preferred positions are prefilled on a later signup and can still be changed before submitting
- Confirm join flow writes `registrations._id = activityId_openid`
- Confirm join flow stores selected positions in `registrations.preferredPositions`
- Confirm the subscription prompt appears during signup on a real device when an activity-notice template ID is configured
- Confirm the signup still succeeds if the user declines the subscription prompt
- If signup subscription recording fails with `DATABASE_COLLECTION_NOT_EXIST`, confirm `recordNotificationSubscription` was redeployed and `notification_subscriptions` exists
- Confirm `notification_subscriptions` records the user's accepted or declined choice
- Confirm participant activity notices use `SUBSCRIBE_MESSAGE_TEMPLATE_IDS.activityNotice`
- Confirm normal signup records created from the current UI do not contain `phoneSnapshot`
- Confirm only one active signup per activity is allowed
- Confirm signup is blocked after `signupDeadlineAt`

## Cancellation and Organizer Actions

- Confirm participant cancellation works before the deadline
- Confirm participant cancellation is blocked after the deadline
- Confirm organizer can open Activity Detail and navigate to `Edit`
- Confirm organizer edit updates title, time, deadline, location, description, cover image, detail images, and total capacity in place
- Confirm organizer edit can add, change, and clear the optional insurance link
- Confirm existing registrations remain attached to the same activity after edit
- Confirm capacity cannot be reduced below joined players or existing regular team slots
- Confirm regular users and non-owner organizers cannot edit another organizer's activity
- Confirm organizer/admin can add a proxy participant from the selected team's header row
- Confirm regular users cannot see or use proxy signup
- Confirm organizer/admin can see the proxy badge on a proxy participant
- Confirm organizer/admin can see member preferred positions on Activity Detail
- Confirm regular users cannot see other members' preferred positions
- Confirm regular users can see the participant name but cannot see the proxy badge
- Confirm organizer/admin can move a participant to another non-full team
- Confirm move/remove member buttons render as complete pill buttons on a real device
- Confirm regular users cannot see or use member move controls
- Confirm organizer/admin can remove a proxy participant after adding them
- Confirm organizer/admin can copy all active participant names, including preferred positions when available
- Confirm organizer actions are ordered copy participant names, edit activity, confirm activity, cancel activity
- Confirm organizer/admin can subscribe to manager notices for the current activity
- Confirm the consent prompt includes the configured registration-threshold and late-cancellation templates in one request
- Confirm the manager-notification subscription button greys out only after every configured manager purpose is accepted and remains grey after reopening Activity Detail
- In `notification_subscriptions`, confirm separate rows use `templateKey: manager_registration_notice` and `templateKey: manager_late_cancellation_notice` with their corresponding local-only template IDs
- If either manager row has a stale template ID, redeploy `getActivityDetail`, upload the latest mini program frontend build, and confirm the action requests only the missing/stale purpose
- Confirm the activity has a `registrationNoticeThreshold`; Create/Edit defaults it to 80% of the total signup limit and lets organizer/admin users change it.
- After a regular participant joins and the post-join total reaches the threshold, confirm `notification_logs` records `registration_joined` with `templateKey: manager_registration_notice`.
- Confirm a non-creator participant cancelling inside `lateCancellationNoticeWindowHours` sends the activity creator a `registration_cancelled` notice with `templateKey: manager_late_cancellation_notice`.
- Confirm the late-cancellation message shows China-local activity time, activity title, `取消后剩余 current/total 人`, and `managerAlias` with `signupName` fallback.
- Confirm the late-cancellation send consumes only `manager_late_cancellation_notice`; the threshold subscription remains unchanged.
- Confirm cancellation outside the configured window, a disabled value of `0`, and the creator's own self-cancel do not send the late-cancellation notice.
- Confirm organizer/admin can tap `Confirm Activity` on a published activity
- Confirm the confirmed state appears on Activity Detail after confirmation
- Confirm a cancelled activity does not show the confirmed-state banner, even if it was confirmed before cancellation
- Confirm confirmation notices use the optional notification reminder when the activity has one
- Confirm the subscription notification appointment time matches the activity's China local start time
- If confirmation fails with `DATABASE_COLLECTION_NOT_EXIST`, confirm `notifyActivityParticipants` was redeployed and both `notification_subscriptions` and `notification_logs` exist
- Confirm `notification_logs` records proceeding notification send results for subscribed active participants
- Confirm organizer cancel changes activity status to `cancelled`
- Confirm cancellation notices use the default cancellation reminder instead of the confirmation reminder
- Confirm organizer cancellation sends cancellation notices to subscribed active participants and logs the results
- Confirm organizer soft delete is allowed only when `joinedCount = 0`
- Confirm deleted activities remain visible to the organizer in Created history only

## Access and Sharing

- Confirm organizer stats reject non-organizer access
- Confirm the share link opens the correct detail page
- Confirm a non-organizer cannot see `Cancel Activity`
