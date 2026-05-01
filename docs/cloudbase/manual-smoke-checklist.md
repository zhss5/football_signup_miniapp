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
- Confirm join flow writes `registrations._id = activityId_openid`
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
- Confirm organizer cancel changes activity status to `cancelled`
- Confirm organizer soft delete is allowed only when `joinedCount = 0`
- Confirm deleted activities remain visible to the organizer in Created history only

## Access and Sharing

- Confirm organizer stats reject non-organizer access
- Confirm the share link opens the correct detail page
- Confirm a non-organizer cannot see `Cancel Activity`
