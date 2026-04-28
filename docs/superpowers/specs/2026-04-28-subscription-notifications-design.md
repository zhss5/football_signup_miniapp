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

Recommended first flow:

1. User signs up successfully.
2. The mini program asks the user to subscribe to activity notifications.
3. The user accepts or declines the WeChat subscription prompt.
4. The app records the subscription intent/result for that activity and user.
5. On Activity Detail, the organizer taps a notification action.
6. A cloud function sends the message only to active registrations that have subscribed.
7. The cloud function records send results for audit and duplicate-prevention.

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

Activity Detail:

- show organizer-only notification actions
- first action: `Notify participants`
- optionally expose two notification types:
  - `Activity will proceed`
  - `Activity cancelled`

Cancellation flow:

- after an organizer cancels an activity, offer to notify subscribed participants
- do not send cancellation notifications automatically in the first version unless the organizer confirms

## 8. Deferred Scope

Do not implement these in the first version:

- automatic scheduled reminders
- free-form organizer message bodies
- unlimited custom notification templates
- SMS or non-WeChat notification channels
- full notification preference center

Potential second version:

- an automatic reminder toggle on activity creation
- reminder timing such as two hours before start
- short organizer note with strict length limits
- resend controls with clear send history

## 9. Testing Direction

Cover these paths:

- user accepts subscription after signup
- user declines subscription after signup
- organizer notification sends only to active subscribed registrations
- regular user cannot send organizer notifications
- cancelled/deleted activity handling
- send failures are logged without failing the whole batch
- duplicate send protection for the same activity and notification type
