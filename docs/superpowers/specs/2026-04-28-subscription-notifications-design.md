# Subscription Notifications Design

- Date: 2026-04-28
- Status: Proposed backlog design
- Scope: WeChat subscription opt-in plus organizer-triggered participant notifications

## 1. Goal

Let participants opt in to activity notifications, then let an organizer manually notify subscribed participants about important activity state changes.

The first supported use cases are:

- activity will proceed as planned
- activity has been cancelled

Automatic reminders are intentionally out of scope for the first version.

## 2. Product Decision

The first version should be manual, not automatic.

Organizer-triggered sending is safer because the organizer is the person who knows whether weather, venue availability, attendance, or other real-world conditions have changed. A fully automatic "activity will proceed" message can easily become wrong.

Implementation must be sequenced in two steps:

1. Build subscription opt-in first.
2. Build organizer-triggered activity notifications after subscription state is available.

Recommended first subscription flow:

1. User signs up successfully.
2. The mini program asks the user to subscribe to activity notifications.
3. The user accepts or declines the WeChat subscription prompt.
4. The app records the subscription intent/result for that activity and user.

Recommended first notification flow:

1. On Activity Detail, the organizer confirms that the activity will proceed or cancels the activity.
2. A cloud function sends the matching message only to active registrations that have subscribed.
3. The cloud function records send results for audit and duplicate-prevention.
4. Participants who join after the proceeding notification do not receive that already-sent notification in the first version.
5. Participants who join after confirmation can still subscribe for later cancellation notices or other future notifications.

## 3. WeChat Constraints

WeChat subscription messages are not automatic broadcast messages.

Important constraints:

- the user must explicitly grant subscription permission through `wx.requestSubscribeMessage`
- each sent message must use a template configured in the WeChat Official Accounts Platform
- message fields must match the selected template keywords and field rules
- users who decline subscription cannot be reached through this feature
- backend sending should use `subscribeMessage.send` from a cloud function
- the sending cloud function needs the corresponding openapi permission in its `config.json`

Official references:

- `https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message.html`
- `https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html`
- `https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/subscribe-message/subscribeMessage.send.html`

## 4. Template Strategy

Prefer one generic activity-notification template if the WeChat template library provides a suitable option.

Suggested fields:

- activity name
- activity time
- activity location
- notification content

With one generic template, the app can send both:

- "The activity will proceed as planned. Please arrive on time."
- "The activity has been cancelled. Please watch for later arrangements."

If a generic template is not available or does not pass template review, use two templates:

- activity reminder template
- activity cancellation template

The trade-off is that multiple templates require users to subscribe to multiple template IDs.

## 5. Data Model Direction

Add notification tracking without changing the core registration model too much.

Extend `activities` with confirmation metadata while keeping the existing lifecycle status simple:

- `status`: keep existing `published/cancelled/deleted`
- `confirmStatus`: `pending/confirmed`
- `confirmedAt`
- `confirmedByOpenId`

Recommended state combinations:

- `published + pending`: activity is published but not explicitly confirmed as proceeding
- `published + confirmed`: activity has been confirmed as proceeding and can still accept signups until normal signup rules close it
- `cancelled`: activity is cancelled and cannot accept signups
- `deleted`: activity is hidden from normal participant flows

Do not replace `status: published` with `status: confirmed`; too much existing signup, edit, cancel, and list behavior already depends on `published` meaning the activity is active.

Potential collection:

- `notification_subscriptions`

Suggested fields:

- `_id`: `${activityId}_${openid}_${templateKey}`
- `activityId`
- `openid`
- `templateKey`: `activity_notice` or a specific template alias
- `templateId`
- `status`: `accepted/declined/unknown`
- `requestedAt`
- `updatedAt`

Potential send log collection:

- `notification_logs`

Suggested fields:

- `activityId`
- `templateKey`
- `notificationType`: `proceeding/cancelled`
- `operatorOpenId`
- `recipientOpenId`
- `registrationId`
- `status`: `sent/failed/skipped`
- `errorCode`
- `errorMessage`
- `sentAt`

## 6. Cloud Function Direction

Add a dedicated cloud function such as:

- `notifyActivityParticipants`

Responsibilities:

- verify the caller is the activity organizer or has `admin`
- verify the activity exists and is not deleted
- for proceeding notifications, set `confirmStatus` to `confirmed` and record `confirmedAt`/`confirmedByOpenId`
- for cancellation notifications, integrate with the cancel flow so `status` becomes `cancelled`
- select active registrations for the activity
- filter recipients by subscription status/template
- send WeChat subscription messages
- record per-recipient results
- return summary counts to the organizer

The function should be idempotent per notification type where practical, so repeated taps do not spam participants.

## 7. Frontend Direction

Signup success:

- ask the participant to subscribe after a successful join
- keep signup successful even if the user declines notification subscription
- show a non-blocking hint if subscription is declined
- if the activity already has `confirmStatus: confirmed`, show a page-level hint such as "Activity confirmed. Please arrive on time."
- do not send a backfilled proceeding notification to someone who joins after the proceeding notification was already sent in the first version

Activity Detail:

- show organizer-only notification actions
- first organizer notification action: `Confirm activity will proceed`
- confirmed activities should show a visible confirmed state to later viewers and late joiners
- confirmation does not close signup; normal signup deadline, capacity, and cancellation rules still decide whether joining is allowed

Cancellation flow:

- after an organizer cancels an activity, offer to notify subscribed participants
- do not send cancellation notifications automatically in the first version unless the organizer confirms
- cancelled activities cannot accept new signups

## 8. Deferred Scope

Do not implement these in the first version:

- automatic scheduled reminders
- automatic backfill of the proceeding notification to users who join after confirmation
- free-form organizer message bodies
- unlimited custom notification templates
- SMS or non-WeChat notification channels
- full notification preference center

Potential second version:

- an automatic reminder toggle on activity creation
- reminder timing such as two hours before start
- short organizer note with strict length limits
- automatic proceeding-notification backfill for late joiners who subscribe during signup
- resend controls with clear send history

## 9. Testing Direction

Cover these paths:

- user accepts subscription after signup
- user declines subscription after signup
- organizer confirmation sets `confirmStatus: confirmed`
- proceeding notification sends only to active subscribed registrations at confirmation time
- confirmed activity remains joinable until signup deadline, capacity, or cancellation closes signup
- late joiners after confirmation do not receive the already-sent proceeding notification in the first version
- cancelled activity sends cancellation notices to active subscribed registrations and blocks new signups
- regular user cannot send organizer notifications
- cancelled/deleted activity handling
- send failures are logged without failing the whole batch
- duplicate send protection for the same activity and notification type
