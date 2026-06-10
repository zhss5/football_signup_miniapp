# V2 SQL Migration Readiness Design

## Purpose

Version 2 still runs on CloudBase document database. This document prepares the data model for a later self-hosted backend by defining the target MySQL 8.x schema, the CloudBase-to-SQL mapping, compatibility rules, and migration validation checks.

This is a readiness artifact, not a runtime migration plan.

## Non-Goals For Version 2

Version 2 must not:

- move live traffic from CloudBase to MySQL.
- dual-write CloudBase and MySQL.
- replace cloud functions with self-hosted HTTP APIs.
- move WeChat `openid` auth, CloudBase storage, or subscription-message sending to a self-hosted service.
- remove existing CloudBase fields only because the SQL model has a cleaner shape.

## Design Principles

- Use MySQL 8.x as the target engine.
- Treat WeChat `openid` as the stable user key until a later account system exists.
- Keep current state and history separate. Current signup state belongs in `registrations`; audit history belongs in `activity_logs` and `user_role_logs`.
- Keep CloudBase document IDs during migration by storing them as string primary keys or unique keys.
- Prefer explicit scalar columns for queryable fields.
- Use JSON only for low-query, structured data such as image arrays, locations, preferred positions, and log payloads.
- Use additive schema changes for V2. Add fields first, keep old fields, migrate data, then remove old fields in a later version only after all clients stop using them.

## Target Schema

### `users`

Stores one real WeChat mini-program user per `openid`. Proxy signups are not real users in V2 and remain represented by registration rows.

```sql
CREATE TABLE users (
  openid VARCHAR(128) NOT NULL,
  preferred_name VARCHAR(128) NOT NULL DEFAULT '',
  display_name VARCHAR(128) NOT NULL DEFAULT '',
  nickname VARCHAR(128) NOT NULL DEFAULT '',
  avatar_url VARCHAR(512) NOT NULL DEFAULT '',
  profile_source VARCHAR(32) NOT NULL DEFAULT '',
  preferred_positions JSON NULL,
  phone_number VARCHAR(32) NOT NULL DEFAULT '',
  phone_source VARCHAR(32) NOT NULL DEFAULT '',
  manager_alias VARCHAR(128) NOT NULL DEFAULT '',
  manager_alias_updated_at DATETIME(3) NULL,
  manager_alias_updated_by VARCHAR(128) NOT NULL DEFAULT '',
  roles_updated_at DATETIME(3) NULL,
  roles_updated_by VARCHAR(128) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NULL,
  last_active_at DATETIME(3) NOT NULL,
  PRIMARY KEY (openid),
  KEY idx_users_preferred_name (preferred_name),
  KEY idx_users_manager_alias (manager_alias),
  KEY idx_users_last_active_at (last_active_at)
);
```

### `user_roles`

Normalizes the current CloudBase `users.roles` array. Every user must have a `user` role row. Elevated rows add `organizer`, `admin`, or `super_admin`.

```sql
CREATE TABLE user_roles (
  openid VARCHAR(128) NOT NULL,
  role VARCHAR(32) NOT NULL,
  granted_at DATETIME(3) NULL,
  granted_by VARCHAR(128) NOT NULL DEFAULT '',
  PRIMARY KEY (openid, role),
  KEY idx_user_roles_role (role),
  CONSTRAINT fk_user_roles_user
    FOREIGN KEY (openid) REFERENCES users (openid)
);
```

Allowed `role` values: `user`, `organizer`, `admin`, `super_admin`.

### `activities`

Stores the activity master record.

```sql
CREATE TABLE activities (
  activity_id VARCHAR(128) NOT NULL,
  title VARCHAR(200) NOT NULL,
  organizer_openid VARCHAR(128) NOT NULL,
  org_id VARCHAR(128) NOT NULL DEFAULT '',
  start_at DATETIME(3) NOT NULL,
  end_at DATETIME(3) NOT NULL,
  signup_deadline_at DATETIME(3) NOT NULL,
  address_text VARCHAR(255) NOT NULL DEFAULT '',
  address_name VARCHAR(255) NOT NULL DEFAULT '',
  location JSON NULL,
  description TEXT NULL,
  insurance_link VARCHAR(512) NOT NULL DEFAULT '',
  notification_hint VARCHAR(512) NOT NULL DEFAULT '',
  registration_notice_threshold INT NOT NULL DEFAULT 0,
  cover_image VARCHAR(512) NOT NULL DEFAULT '',
  cover_thumb_image VARCHAR(512) NOT NULL DEFAULT '',
  share_image VARCHAR(512) NOT NULL DEFAULT '',
  image_list JSON NULL,
  detail_images JSON NULL,
  signup_limit_total INT NOT NULL DEFAULT 0,
  joined_count INT NOT NULL DEFAULT 0,
  require_phone TINYINT(1) NOT NULL DEFAULT 0,
  invite_code VARCHAR(64) NOT NULL DEFAULT '',
  fee_mode VARCHAR(32) NOT NULL DEFAULT 'free',
  fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL,
  confirm_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  confirmed_at DATETIME(3) NULL,
  confirmed_by_openid VARCHAR(128) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (activity_id),
  KEY idx_activities_status_start_at (status, start_at),
  KEY idx_activities_organizer_start_at (organizer_openid, start_at),
  KEY idx_activities_confirm_status_end_at (confirm_status, end_at)
);
```

Allowed `status` values: `draft`, `published`, `closed`, `finished`, `cancelled`, `deleted`.

Allowed `confirm_status` values: `pending`, `confirmed`.

### `activity_teams`

Stores teams under each activity.

```sql
CREATE TABLE activity_teams (
  team_id VARCHAR(128) NOT NULL,
  activity_id VARCHAR(128) NOT NULL,
  team_name VARCHAR(128) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  max_members INT NOT NULL DEFAULT 0,
  joined_count INT NOT NULL DEFAULT 0,
  color_key VARCHAR(32) NOT NULL DEFAULT '',
  team_type VARCHAR(32) NOT NULL DEFAULT 'regular',
  auto_generated TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NULL,
  PRIMARY KEY (team_id),
  KEY idx_activity_teams_activity_sort (activity_id, sort_order),
  KEY idx_activity_teams_activity_status (activity_id, status),
  CONSTRAINT fk_activity_teams_activity
    FOREIGN KEY (activity_id) REFERENCES activities (activity_id)
);
```

Allowed `team_type` values: `regular`, `bench`.

Allowed `status` values: `active`, `inactive`.

### `registrations`

Stores the current signup state for one participant in one activity. Historical signup/cancel/rejoin/remove/move events stay in `activity_logs`.

```sql
CREATE TABLE registrations (
  registration_id VARCHAR(160) NOT NULL,
  activity_id VARCHAR(128) NOT NULL,
  team_id VARCHAR(128) NOT NULL,
  user_openid VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  signup_name VARCHAR(128) NOT NULL,
  avatar_url VARCHAR(512) NOT NULL DEFAULT '',
  profile_source VARCHAR(32) NOT NULL DEFAULT '',
  preferred_positions JSON NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'direct',
  phone_snapshot VARCHAR(32) NOT NULL DEFAULT '',
  phone_source VARCHAR(32) NOT NULL DEFAULT '',
  proxy_registration TINYINT(1) NOT NULL DEFAULT 0,
  created_by_openid VARCHAR(128) NOT NULL DEFAULT '',
  moved_by_openid VARCHAR(128) NOT NULL DEFAULT '',
  moved_at DATETIME(3) NULL,
  cancel_count INT NOT NULL DEFAULT 0,
  removed_count INT NOT NULL DEFAULT 0,
  attendance_status VARCHAR(32) NOT NULL DEFAULT '',
  attendance_marked_at DATETIME(3) NULL,
  attendance_marked_by VARCHAR(128) NOT NULL DEFAULT '',
  pay_status VARCHAR(32) NOT NULL DEFAULT '',
  order_id VARCHAR(128) NOT NULL DEFAULT '',
  joined_at DATETIME(3) NULL,
  cancelled_at DATETIME(3) NULL,
  removed_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (registration_id),
  KEY idx_registrations_activity_status (activity_id, status),
  KEY idx_registrations_user_status (user_openid, status),
  KEY idx_registrations_user_updated_at (user_openid, updated_at),
  KEY idx_registrations_team_status (team_id, status),
  CONSTRAINT fk_registrations_activity
    FOREIGN KEY (activity_id) REFERENCES activities (activity_id),
  CONSTRAINT fk_registrations_team
    FOREIGN KEY (team_id) REFERENCES activity_teams (team_id)
);
```

Allowed `status` values: `joined`, `cancelled`, `removed`.

Allowed `attendance_status` values: empty string, `present`, `absent`. Empty string means present for confirmed activity statistics.

### `activity_logs`

Stores activity and participant operation history.

```sql
CREATE TABLE activity_logs (
  log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cloudbase_id VARCHAR(128) NOT NULL DEFAULT '',
  activity_id VARCHAR(128) NOT NULL,
  registration_id VARCHAR(160) NOT NULL DEFAULT '',
  user_openid VARCHAR(128) NOT NULL DEFAULT '',
  operator_openid VARCHAR(128) NOT NULL DEFAULT '',
  action VARCHAR(64) NOT NULL,
  payload JSON NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (log_id),
  UNIQUE KEY uk_activity_logs_cloudbase_id (cloudbase_id),
  KEY idx_activity_logs_activity_created_at (activity_id, created_at),
  KEY idx_activity_logs_registration_created_at (registration_id, created_at),
  KEY idx_activity_logs_user_created_at (user_openid, created_at),
  KEY idx_activity_logs_action_created_at (action, created_at)
);
```

Expected V2 `action` values include: `activity_update`, `signup_joined`, `signup_cancelled`, `signup_rejoined`, `proxy_signup_created`, `registration_removed`, `registration_moved`, `attendance_update`, `manager_alias_update`.

### `user_role_logs`

Stores role mutation history.

```sql
CREATE TABLE user_role_logs (
  log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cloudbase_id VARCHAR(128) NOT NULL DEFAULT '',
  action VARCHAR(64) NOT NULL,
  operator_openid VARCHAR(128) NOT NULL,
  target_openid VARCHAR(128) NOT NULL,
  previous_roles JSON NOT NULL,
  next_roles JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (log_id),
  UNIQUE KEY uk_user_role_logs_cloudbase_id (cloudbase_id),
  KEY idx_user_role_logs_target_created_at (target_openid, created_at),
  KEY idx_user_role_logs_operator_created_at (operator_openid, created_at)
);
```

### `notification_subscriptions`

Stores one subscription consent row per activity, user, and template key.

```sql
CREATE TABLE notification_subscriptions (
  subscription_id VARCHAR(320) NOT NULL,
  activity_id VARCHAR(128) NOT NULL,
  user_openid VARCHAR(128) NOT NULL,
  template_key VARCHAR(64) NOT NULL,
  template_id VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  subscribed TINYINT(1) NOT NULL DEFAULT 0,
  consumed_at DATETIME(3) NULL,
  last_send_status VARCHAR(32) NOT NULL DEFAULT '',
  last_error_message VARCHAR(255) NOT NULL DEFAULT '',
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (subscription_id),
  UNIQUE KEY uk_notification_subscriptions_identity (activity_id, user_openid, template_key),
  KEY idx_notification_subscriptions_activity_template_status (activity_id, template_key, status),
  KEY idx_notification_subscriptions_user_updated_at (user_openid, updated_at)
);
```

Allowed `status` values: `accepted`, `declined`, `consumed`.

### `notification_logs`

Stores notification send attempts.

```sql
CREATE TABLE notification_logs (
  notification_log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cloudbase_id VARCHAR(128) NOT NULL DEFAULT '',
  activity_id VARCHAR(128) NOT NULL,
  actor_openid VARCHAR(128) NOT NULL DEFAULT '',
  actor_name VARCHAR(128) NOT NULL DEFAULT '',
  recipient_openid VARCHAR(128) NOT NULL,
  notification_type VARCHAR(64) NOT NULL,
  template_key VARCHAR(64) NOT NULL DEFAULT '',
  template_id VARCHAR(128) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL,
  reason VARCHAR(255) NOT NULL DEFAULT '',
  error_message VARCHAR(512) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (notification_log_id),
  UNIQUE KEY uk_notification_logs_cloudbase_id (cloudbase_id),
  KEY idx_notification_logs_activity_type_recipient_status (
    activity_id,
    notification_type,
    recipient_openid,
    status
  ),
  KEY idx_notification_logs_recipient_created_at (recipient_openid, created_at)
);
```

Allowed `status` values: `sent`, `failed`, `skipped`.

## CloudBase-To-SQL Mapping

### Collection Mapping

| CloudBase collection | Target SQL table | Notes |
| --- | --- | --- |
| `users` | `users`, `user_roles` | `users.roles` becomes one row per role in `user_roles`. |
| `activities` | `activities` | CloudBase `_id` maps to `activity_id`. |
| `activity_teams` | `activity_teams` | CloudBase `_id` maps to `team_id`. |
| `registrations` | `registrations` | CloudBase `_id` maps to `registration_id`. |
| `activity_logs` | `activity_logs` | CloudBase `_id` maps to `cloudbase_id`; new SQL `log_id` is internal. |
| `user_role_logs` | `user_role_logs` | CloudBase `_id` maps to `cloudbase_id`. |
| `notification_subscriptions` | `notification_subscriptions` | CloudBase `_id` maps to `subscription_id`. |
| `notification_logs` | `notification_logs` | CloudBase `_id` maps to `cloudbase_id`; new SQL ID is internal. |

### Field Mapping

| CloudBase field | SQL field | Notes |
| --- | --- | --- |
| `users._id` | `users.openid` | Stable WeChat identity. |
| `users.preferredName` | `users.preferred_name` | Empty string allowed. |
| `users.displayName` | `users.display_name` | Optional V2 admin display field. |
| `users.nickName` / `users.nickname` | `users.nickname` | Preserve whichever exists during export. |
| `users.avatarUrl` | `users.avatar_url` | CloudBase file ID or URL-like value. |
| `users.profileSource` | `users.profile_source` | Usually `manual`, `wechat`, or `proxy`. |
| `users.preferredPositions` | `users.preferred_positions` | JSON array. |
| `users.phoneNumber` | `users.phone_number` | Dormant compatibility field. |
| `users.phoneSource` | `users.phone_source` | Dormant compatibility field. |
| `users.managerAlias` | `users.manager_alias` | V2 management-only alias. |
| `users.managerAliasUpdatedAt` | `users.manager_alias_updated_at` | Parse ISO string to `DATETIME(3)`. |
| `users.managerAliasUpdatedBy` | `users.manager_alias_updated_by` | Openid of last manager alias editor. |
| `users.roles` | `user_roles.role` | Normalize and always include `user`. |
| `users.createdAt` | `users.created_at` | Parse ISO string to `DATETIME(3)`. |
| `users.updatedAt` | `users.updated_at` | Nullable. |
| `users.lastActiveAt` | `users.last_active_at` | Parse ISO string to `DATETIME(3)`. |
| `activities._id` | `activities.activity_id` | Preserve CloudBase ID. |
| `activities.organizerOpenId` | `activities.organizer_openid` | Openid reference. |
| `activities.startAt` | `activities.start_at` | Parse ISO string to `DATETIME(3)`. |
| `activities.endAt` | `activities.end_at` | Parse ISO string to `DATETIME(3)`. |
| `activities.signupDeadlineAt` | `activities.signup_deadline_at` | Parse ISO string to `DATETIME(3)`. |
| `activities.location` | `activities.location` | JSON object. |
| `activities.imageList` | `activities.image_list` | JSON array. |
| `activities.detailImages` | `activities.detail_images` | JSON array. |
| `activities.confirmStatus` | `activities.confirm_status` | `pending` or `confirmed`. |
| `activities.confirmedAt` | `activities.confirmed_at` | Empty string becomes `NULL`. |
| `activities.confirmedByOpenId` | `activities.confirmed_by_openid` | Empty string allowed. |
| `activity_teams._id` | `activity_teams.team_id` | Preserve CloudBase ID. |
| `activity_teams.sort` | `activity_teams.sort_order` | Avoid SQL keyword ambiguity. |
| `activity_teams.colorKey` | `activity_teams.color_key` | Optional legacy rows may be empty. |
| `registrations._id` | `registrations.registration_id` | Preserve CloudBase ID. |
| `registrations.userOpenId` | `registrations.user_openid` | Real openid or generated proxy openid. |
| `registrations.preferredPositions` | `registrations.preferred_positions` | JSON array. |
| `registrations.phoneSnapshot` | `registrations.phone_snapshot` | Dormant compatibility field. |
| `registrations.proxyRegistration` | `registrations.proxy_registration` | Boolean. |
| `registrations.createdByOpenId` | `registrations.created_by_openid` | Proxy creator. |
| `registrations.attendanceStatus` | `registrations.attendance_status` | Empty means present in confirmed activities. |
| `registrations.attendanceMarkedAt` | `registrations.attendance_marked_at` | Nullable. |
| `registrations.attendanceMarkedBy` | `registrations.attendance_marked_by` | Empty string allowed. |
| `activity_logs.payload` | `activity_logs.payload` | JSON object for before/after details. |
| `notification_subscriptions.templateKey` | `notification_subscriptions.template_key` | Example: `activity_notice`, `manager_registration_notice`. |
| `notification_logs.notificationType` | `notification_logs.notification_type` | Example: `proceeding`, `cancelled`, `registration_joined`. |

All timestamp fields should be stored in UTC. The current CloudBase values are ISO strings and should be parsed during export or migration rehearsal.

## Compatibility Rules For V2 Changes

1. Add new CloudBase fields before any client reads them.
2. Treat missing new fields as default values in backend code.
3. Keep old fields alive for all released and under-review mini-program builds.
4. Never repurpose an existing field with a different meaning.
5. Use stable enum strings and document each new value before writing it.
6. Keep manager-only fields server-filtered. Do not rely on the client to hide `managerAlias`, attendance controls, or audit details.
7. Route `managerAlias` edits from both the mini program and web admin through the same backend permission checks; do not let either client write the field directly.
8. Add audit rows for state-changing operations instead of overwriting the only copy of historical information.
9. Avoid broad nested objects in new fields unless the data is low-query and belongs in JSON later.
10. Use nullable SQL columns only when the current CloudBase data can genuinely be absent.
11. Remove fields only in a later compatibility cleanup after live, trial, and review builds no longer read them.

## Migration Validation Checklist

Run these checks during a future rehearsal after exporting CloudBase data and importing it into MySQL.

### Count Checks

- `users` row count equals CloudBase `users` document count.
- `activities` row count equals CloudBase `activities` document count.
- `activity_teams` row count equals CloudBase `activity_teams` document count.
- `registrations` row count equals CloudBase `registrations` document count.
- `activity_logs` row count equals CloudBase `activity_logs` document count.
- `user_role_logs` row count equals CloudBase `user_role_logs` document count.
- `notification_subscriptions` row count equals CloudBase `notification_subscriptions` document count.
- `notification_logs` row count equals CloudBase `notification_logs` document count.

### Referential Checks

- Every `activity_teams.activity_id` exists in `activities.activity_id`.
- Every `registrations.activity_id` exists in `activities.activity_id`.
- Every non-proxy `registrations.user_openid` exists in `users.openid`.
- Every `registrations.team_id` exists in `activity_teams.team_id`.
- Every `activity_logs.activity_id` exists in `activities.activity_id` unless the source activity was intentionally deleted before log export.
- Every `user_roles.openid` exists in `users.openid`.

### Business Checks

- For each activity, `activities.joined_count` equals joined registrations unless historical data is known to be inconsistent.
- For each team, `activity_teams.joined_count` equals joined registrations for that team unless historical data is known to be inconsistent.
- No user loses the base `user` role.
- At least one `super_admin` exists before enabling the self-hosted admin path.
- Attendance stats in MySQL match CloudBase `getAttendanceStats` for the same date range.
- Empty `registrations.attendance_status` is counted as present only for confirmed activities.
- Cancelled, deleted, and pending-confirmation activities are excluded from attendance statistics.
- Notification-log status counts match CloudBase for `sent`, `failed`, and `skipped`.

### Spot Checks

- Pick several real users and verify preferred name, avatar, manager alias, roles, and last active time.
- Pick several activities and verify teams, capacity, cover/detail images, confirmation state, and joined counts.
- Pick several registrations and verify signup name, proxy flag, preferred positions, attendance state, and current status.
- Pick several activity logs and verify operator, target participant, action, timestamp, and payload.
- Pick several notification subscriptions and logs and verify template key, template ID, recipient, status, and consumed state.

## Future Migration Phases

1. Export CloudBase data to a neutral JSON snapshot.
2. Transform the snapshot into SQL-ready rows.
3. Import into a staging MySQL 8.x database.
4. Run the validation checklist.
5. Compare selected CloudBase cloud-function responses with equivalent SQL-backed API responses.
6. Decide whether to build self-hosted HTTP APIs.
7. If a self-hosted backend is approved, migrate auth/session, storage URL handling, subscription messages, request-domain configuration, monitoring, backup, and rollback as a separate project.

The final migration decision belongs outside V2. The V2 requirement is to keep the data model ready enough that a later migration can be planned with concrete table and field targets.
