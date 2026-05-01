# Manual Smoke Checklist

## Home and Listing

- Confirm the home page loads published activities from CloudBase
- Confirm deleted activities do not appear on Home
- Confirm created and joined lists load correctly on the `My` page

## Activity Creation

- Confirm activity creation writes one `activities` document
- Confirm activity creation writes the related `activity_teams` documents
- Confirm map-selected address fields are stored
- Confirm `signupDeadlineAt`, `startAt`, and `endAt` are stored correctly
- Confirm newly uploaded covers store both `coverImage` and `coverThumbImage`
- Confirm Home/My activity cards load the thumbnail without 403 image errors

## Signup Flow

- Confirm the activity detail page shows team counts and member names
- Confirm the join page does not show phone input or WeChat phone authorization
- Confirm join flow writes `registrations._id = activityId_openid`
- Confirm normal signup records created from the current UI do not contain `phoneSnapshot`
- Confirm only one active signup per activity is allowed
- Confirm signup is blocked after `signupDeadlineAt`

## Cancellation and Organizer Actions

- Confirm participant cancellation works before the deadline
- Confirm participant cancellation is blocked after the deadline
- Confirm organizer can open Activity Detail and navigate to `Edit`
- Confirm organizer edit updates title, time, deadline, location, description, cover image, and total capacity in place
- Confirm existing registrations remain attached to the same activity after edit
- Confirm capacity cannot be reduced below joined players or existing regular team slots
- Confirm regular users and non-owner organizers cannot edit another organizer's activity
- Confirm organizer/admin can add a proxy participant to a selected team
- Confirm regular users cannot see or use proxy signup
- Confirm organizer/admin can see the proxy badge on a proxy participant
- Confirm regular users can see the participant name but cannot see the proxy badge
- Confirm organizer/admin can move a participant to another non-full team
- Confirm regular users cannot see or use member move controls
- Confirm organizer/admin can remove a proxy participant after adding them
- Confirm organizer/admin can copy all active participant names
- Confirm organizer cancel changes activity status to `cancelled`
- Confirm organizer soft delete is allowed only when `joinedCount = 0`
- Confirm deleted activities remain visible to the organizer in Created history only

## Access and Sharing

- Confirm organizer stats reject non-organizer access
- Confirm the share link opens the correct detail page
- Confirm a non-organizer cannot see `Cancel Activity`
