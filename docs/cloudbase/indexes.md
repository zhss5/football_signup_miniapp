# CloudBase Index Checklist

Create the following indexes in each target CloudBase environment before
deploying query paths that use the matching filters. Use ascending direction
unless a different direction is explicitly shown.

## Core Business Queries

- activities: status + startAt
- activities: organizerOpenId + startAt
- activity_teams: activityId + sort
- registrations: activityId + status
- registrations: userOpenId + status
- registrations: userOpenId + updatedAt
- activity_logs: activityId + createdAt
- notification_subscriptions: activityId + templateKey + status
- notification_logs: activityId + notificationType + recipientOpenId + status

## Filtered Cursor Queries

The 2026-08-04 query hardening uses `_id` ascending keyset pagination after
permission and business filters. Add these compound indexes for the filter
combinations used by the deployed functions:

- users: roles + `_id`
- activities: status + startAt + `_id`
- activities: organizerOpenId + status + startAt + `_id`
- activities: status + activityType + startAt + `_id`
- activities: organizerOpenId + status + activityType + startAt + `_id`
- activity_teams: activityId + `_id`
- registrations: activityId + `_id`
- registrations: activityId + status + teamId + `_id`
- registrations: userOpenId + `_id`
- registrations: userOpenId + status + `_id`
- activity_logs: activityId + `_id`
- activity_logs: activityId + action + `_id`
- activity_logs: activityId + action + targetOpenId + `_id`
- activity_logs: activityId + action + userOpenId + `_id`
- notification_subscriptions: activityId + templateKey + status + `_id`
- notification_logs: activityId + status + `_id`
- notification_logs: activityId + notificationType + status + `_id`
- notification_logs: activityId + type + status + `_id`

CloudBase may report a missing-index link for an optional-filter combination
that omits one middle field from a longer index. Create that exact suggested
variant rather than weakening the database filter or returning to a full
collection scan. Smoke-test default and filtered Web Admin queries after index
creation.
