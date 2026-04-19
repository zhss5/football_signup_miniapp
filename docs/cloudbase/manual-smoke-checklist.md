# Manual Smoke Checklist

- Confirm the home page loads published activities
- Confirm activity creation writes both activity and team documents
- Confirm the activity detail page shows team counts
- Confirm join flow writes `registrations._id = activityId_openid`
- Confirm cancel flow changes status to `cancelled`
- Confirm organizer stats reject non-organizer access
- Confirm the share link opens the correct detail page
