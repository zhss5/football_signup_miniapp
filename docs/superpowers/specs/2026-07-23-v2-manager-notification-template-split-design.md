# V2 Manager Notification Template Split Design

## Goal

Prevent the registration-threshold notice and the late-cancellation notice from consuming the same WeChat subscription grant. Keep both notification paths on CloudBase while preserving API and data boundaries that can later move to MySQL 8.x and a self-hosted server.

## Confirmed Product Rules

- The registration-threshold notice keeps the existing `managerRegistrationNotice` configuration and `manager_registration_notice` template key for backward compatibility.
- The late-cancellation notice uses a separate local configuration entry named `managerLateCancellationNotice`.
- The late-cancellation subscription uses the stable template key `manager_late_cancellation_notice`.
- Real WeChat template IDs remain in `miniprogram/config/env.local.js` or deployment-only configuration and must not be committed.
- A successful send consumes only the subscription record for that notification purpose.
- WeChat subscription delivery remains best effort. The application cannot send when the organizer declines, has no accepted grant, or when WeChat rejects the send.

## Late-Cancellation Template Contract

The selected template title is `预约取消通知` and has this field contract:

| Template field | Template label | Value |
| --- | --- | --- |
| `time2` | `预约时间` | Activity start time formatted in the activity's current China-time convention |
| `thing3` | `预约项目` | Activity title |
| `thing6` | `预约备注` | `取消后剩余 {joinedCountAfter}/{signupLimitTotal} 人` |
| `thing8` | `预约人` | Manager alias when present, otherwise the registration signup name |

Example rendered content:

```text
预约取消通知
预约时间：2026-07-25 20:00
预约项目：周五足球训练
预约备注：取消后剩余 12/15 人
预约人：老张-左后卫
```

The message links to:

```text
pages/activity-detail/index?activityId={activityId}
```

Text values must be trimmed and clipped to the selected template field limits. The participant-name priority is:

```text
users.managerAlias -> registrations.signupName -> 队员
```

`managerAlias` is manager-only operational data. It is sent only to the activity organizer through this manager notification and is not exposed in ordinary-user activity payloads.

## Trigger Rules

The existing late-cancellation window remains authoritative:

- `activities.lateCancellationNoticeWindowHours` defaults to `6`.
- `0` disables late-cancellation notices.
- A self-cancellation is eligible only before the activity starts and within the configured window.
- The activity organizer does not receive a notification for cancelling their own registration.
- The current cancellation transaction remains the source of `joinedCountAfter` and `signupLimitTotal`.

This milestone does not change the existing registration-threshold trigger calculation. It only prevents threshold and late-cancellation notices from sharing one subscription record.

## Subscription Flow

### Activity Creation

The create flow requests the two distinct manager template IDs in one user-triggered `wx.requestSubscribeMessage` call:

- existing registration-threshold template ID;
- new late-cancellation template ID.

After `createActivity` succeeds, each returned template result is recorded independently:

```text
{activityId}_{organizerOpenId}_manager_registration_notice
{activityId}_{organizerOpenId}_manager_late_cancellation_notice
```

If one template is missing from local configuration, rejected, or filtered, the other result is still recorded normally.

### Activity Detail Renewal

`getActivityDetail` returns independent manager-only subscription state for:

- registration-threshold notifications;
- late-cancellation notifications.

The existing manager notification action becomes a combined renewal action:

- request only configured notification purposes that do not currently have an accepted grant;
- record every returned result independently;
- show the fully subscribed state only when all configured manager notification purposes are accepted.

After either grant is consumed, reopening or refreshing Activity Detail exposes the renewal action again for that missing purpose.

## Backend Changes

`cancelRegistration` must:

1. Keep cancellation state mutation, bench promotion, audit logging, and late-window evaluation unchanged.
2. Read the cancelling real user's current `users.managerAlias`.
3. Build the selected cancellation-template data contract.
4. Query only the organizer's accepted `manager_late_cancellation_notice` subscription.
5. Send with that subscription's template ID.
6. Consume only that subscription record.
7. Write `notification_logs` with:
   - `notificationType: registration_cancelled`;
   - `templateKey: manager_late_cancellation_notice`;
   - the actual template ID and send status.

The registration-threshold path continues using `manager_registration_notice` and does not consume the late-cancellation grant.

## Compatibility

- Existing activities and existing `manager_registration_notice` subscriptions remain valid for threshold notifications.
- Historical activities without a late-cancellation subscription skip that notice with `no-accepted-subscription`.
- No existing CloudBase collection is replaced.
- No runtime MySQL migration, dual-write, or self-hosted HTTP API is introduced.
- Future SQL storage continues to use the existing notification-subscription and notification-log tables; only the stable `template_key` enum set gains `manager_late_cancellation_notice`.
- No new participant remark field is added. The design reuses `users.managerAlias`.

## Testing

Implementation must follow TDD and cover:

- notification service requests both distinct configured template IDs and maps results to separate template keys;
- create flow records both subscription results after activity creation;
- activity detail exposes and renews each missing manager subscription independently;
- cancellation uses the late-cancellation template field keys;
- cancellation displays `managerAlias` first and falls back to `signupName`;
- cancellation formats the remaining count as `{joinedCountAfter}/{signupLimitTotal}`;
- cancellation consumes only `manager_late_cancellation_notice`;
- threshold notification continues consuming only `manager_registration_notice`;
- missing configuration or declined consent does not break activity creation;
- local CloudBase mock mirrors the two-purpose subscription behavior.

## Deployment

Implementation rollout will require:

- adding the real late-cancellation template ID to local/deployment-only mini-program configuration;
- uploading a new mini-program build;
- redeploying `cancelRegistration`;
- redeploying `getActivityDetail` if its manager subscription payload changes;
- redeploying `recordNotificationSubscription` only if its API contract changes;
- no Web Admin static-hosting deployment unless the implementation changes Web Admin notification UI.
