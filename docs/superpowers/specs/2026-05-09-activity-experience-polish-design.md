# Activity Experience Polish Design

Date: 2026-05-09

## Goal

Improve the real user experience around activity sharing, empty Home state, team readability, richer activity details, and organizer/admin awareness when registrations change.

This design covers these requested items:

1. Forwarded share cards should not crop the 2:1 activity cover in an awkward way.
2. Organizers/admins should be notified when participants join or leave.
3. Team names should have color labels, with default colors cycling green, white, red, blue, black, yellow.
4. Organizers should be able to manually change team colors by tapping the team name/color.
5. Activity Detail should support extra detail images in addition to the cover image, up to five images.
6. Home should show `暂无活动安排` when no joinable activities are available.

## Current Context

Relevant existing behavior:

- Activity covers are currently stored as `coverImage`, with `coverThumbImage` used for list/card performance.
- `imageList` exists but is currently capped by `MAX_ACTIVITY_IMAGES = 1` and is effectively cover-oriented.
- Activity Detail already displays `description` text.
- Activity Detail already has organizer/admin permissions in `viewer.canEditActivity` and `viewer.canManageRegistrations`.
- Notification V1 already exists for proceeding/cancellation notices to participants through subscription messages.
- Home currently filters to joinable activities and can leave a large blank page when the filtered list is empty.

## Phasing

### Phase 1: Small UX Loop

Implement first:

- Home empty state: show `暂无活动安排` centered in the available Home list area when `loading === false` and `items.length === 0`.
- Share image stabilization: add a share-specific image field so forwarded cards use a 5:4-safe image instead of the raw 2:1 cover.
- Team color display: add team color data and render team names with a small color chip or colored name accent.

Reasoning:

- These changes are user-visible, low risk, and validate the visual direction before expanding the data model further.
- Home empty state has no cloud-function dependency.
- Team color display can fall back to deterministic colors for historical teams, avoiding an immediate migration.

### Phase 2: Activity Detail Gallery

Implement next:

- Add a separate `detailImages` array to activities for non-cover images.
- Allow organizers to upload up to five detail images on Create/Edit Activity.
- Keep the existing cover image flow separate from detail images.
- Render detail images on Activity Detail below the text description.

Reasoning:

- The cover image has special behavior: crop, thumbnail, share card, list card, and hero display.
- Detail images are content images and should not be forced into the 2:1 cover crop flow.
- A separate `detailImages` field avoids overloading the existing cover-oriented `imageList`.

### Phase 3: Organizer/Admin Registration Notifications

Implement after the visual/content changes:

- Add manager-facing registration-change subscription support.
- Notify subscribed organizers/admins when a participant joins or self-cancels.
- Notification failures must not block signup/cancellation.

Reasoning:

- WeChat subscription messages require recipient opt-in, so the manager-notification UX needs explicit consent.
- This depends on real template IDs and real-device behavior, so it should be implemented after the visible MVP flow is stable.

## Share Image Design

Problem:

- The activity cover is intentionally cropped to `2:1`.
- WeChat share cards display a different ratio, commonly `5:4`, so a 2:1 image can be horizontally cropped or visually truncated after forwarding.

Decision:

- Add `shareImage` and `shareDisplayImage` to the activity display model.
- Generate a 5:4-safe share image from the selected cover during create/edit.
- The generated image should contain the full 2:1 cover without cutting it off, using padding/background around the cover.
- Optional title/address text can be added later, but the first version should prioritize not cropping the image.

Data:

- Store the durable CloudBase file ID in `activities.shareImage`.
- Upload generated share images under `activity-share-images/`.
- Resolve `shareImage` through the same file-ID display URL path as covers.

Fallback:

- `onShareAppMessage` and `onShareTimeline` should use:
  1. `activity.shareDisplayImage`
  2. `activity.coverDisplayImage`
  3. no custom `imageUrl`, letting WeChat fall back to a page screenshot

Testing:

- Unit-test share image fallback ordering.
- Manually verify forwarding on a real device because DevTools share previews are not fully representative.

## Team Color Design

Default color cycle:

1. Green
2. White
3. Red
4. Blue
5. Black
6. Yellow

Data:

- Store team color as a semantic token on `activity_teams`, for example `colorKey: 'green'`.
- Use semantic keys instead of raw hex values so future themes can adjust visual contrast safely.
- Existing teams without `colorKey` should derive color from their `sort` index.
- Bench teams should use a neutral gray by default, not the regular-team color cycle, unless a later requirement says otherwise.

Create flow:

- New teams receive default colors from the cycle by index.
- Team editor shows a color chip next to the team name.
- Tapping the color chip or team name opens a fixed palette selector.

Activity Detail flow:

- All users see team colors on team names.
- Organizers/admins can tap a team name/color to open the same fixed palette selector.
- Saving a color from Activity Detail should call a focused cloud function such as `updateTeamColor`, rather than reopening the whole activity-edit form.

Cloud function:

- `updateTeamColor(activityId, teamId, colorKey)`
- Allows only the activity organizer or users with `admin`.
- Validates `colorKey` against the allowed palette.
- Updates only `activity_teams.colorKey` and `updatedAt`.

Testing:

- Create/default color assignment.
- Historical team fallback by sort index.
- Organizer/admin permission for color updates.
- Regular user cannot update color.
- White/Yellow colors must have visible borders and readable text.

## Detail Images Design

Data:

- Add `activities.detailImages` as an array of CloudBase file IDs.
- Keep `coverImage`, `coverThumbImage`, and `shareImage` as separate purpose-built fields.
- Keep `imageList` as backward-compatible cover data for now; do not expand it into a mixed-content field.

Create/Edit UI:

- Keep the existing cover upload block for the activity cover.
- Add a separate `活动详情图片` block under `活动说明`.
- Allow selecting up to five images.
- Show selected images as a compact grid with remove controls.
- No cropping is required for detail images in the first version.
- Detail images should upload to `activity-detail-images/`.

Activity Detail UI:

- Render description text first when present.
- Render detail images below the description as a vertical gallery or compact grid.
- Tapping a detail image should open `wx.previewImage`.

Limits:

- Maximum detail images: five.
- The cover image does not count toward the five detail images.

Testing:

- Create activity with zero, one, and five detail images.
- Edit activity to add/remove detail images.
- Ensure cover replacement does not delete detail images.
- Ensure detail images display on Activity Detail and open preview.

## Registration Change Notifications

Scope:

- Notify subscribed managers when a real participant joins.
- Notify subscribed managers when a real participant self-cancels signup.
- Do not send manager notifications for organizer/admin removal or proxy signup in the first version unless explicitly requested later.

Recipients:

- Always include the activity organizer if they opted in.
- Include admins only if they explicitly opted in for that activity or for manager registration notices.
- Do not attempt to notify users who have not granted a subscription.

Subscription UX:

- On Activity Detail, show organizer/admin action `接收报名通知` or similar.
- The button requests the configured manager-notification subscription template.
- Store the accepted/declined result in `notification_subscriptions` with a separate template key, for example `manager_registration_notice`.

Cloud behavior:

- Add a manager notification path that can be called after successful `joinActivity` and `cancelRegistration`.
- Notification send failure should be logged but must not roll back the signup/cancellation transaction.
- Notification content should include:
  - activity title
  - participant name
  - action: joined or cancelled
  - activity start time or location

Testing:

- Signup succeeds even if manager notification sending fails.
- Manager notification is sent only to accepted subscriptions.
- No duplicate notification is sent for the same registration event.
- Regular participants cannot subscribe as managers unless they are organizer/admin.

## Home Empty State

Behavior:

- If Home finishes loading and the visible joinable activity list is empty, show:
  - title: `暂无活动安排`
  - optional subtitle: `有新活动时会显示在这里`
- Keep the Create Activity button visible for organizers above the empty state.
- Do not show the empty state while loading.

Testing:

- Home with no returned activities.
- Home with only closed/full/cancelled/deadline-past activities after filtering.
- Home with at least one joinable activity.
- Organizer still sees the Create Activity button.

## Deployment Notes

Cloud functions likely affected:

- `createActivity`
- `updateActivity`
- `getActivityDetail`
- new `updateTeamColor`
- `joinActivity`
- `cancelRegistration`
- notification-related functions if manager notification reuse is possible

Mini program pages/components likely affected:

- `pages/home`
- `pages/activity-create`
- `pages/activity-detail`
- `components/team-editor`
- `components/team-list`
- `services/activity-service`
- `services/notification-service`
- `utils/activity-draft`
- `utils/formatters`

Operational prerequisites:

- CloudBase storage read rules should include:
  - `activity-covers/`
  - `activity-cover-thumbs/`
  - `activity-share-images/`
  - `activity-detail-images/`
- Real WeChat subscription message template ID must be configured locally before real-device manager notification testing.

## Recommended Implementation Order

1. Home empty state.
2. Share image field and fallback ordering.
3. Team color default/display without manual update.
4. `updateTeamColor` and organizer/admin palette update.
5. Detail image data model and create/edit upload UI.
6. Detail image display and preview.
7. Manager registration notification subscription UX.
8. Manager registration notification send path from join/cancel.
9. Real-device smoke test and CloudBase deployment doc update.

## Open Decisions

- Whether the share image should be a pure padded cover or a designed share card with title/location text.
- Whether admins need a global notification preference or only per-activity opt-in.
- Whether organizer/admin removal should also notify the removed participant or other managers.
- Whether detail images should support manual ordering in the first version.
