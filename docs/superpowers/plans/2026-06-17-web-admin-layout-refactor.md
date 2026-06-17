# Web Admin Layout Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the V2 Web Admin into a conventional sidebar plus content layout with role-aware navigation and independent operational views.

**Architecture:** Keep the no-build static Web Admin and existing CloudBase API calls. Change only the hosted HTML/CSS/app state layer so login, role gating, navigation, and view visibility are explicit and testable.

**Tech Stack:** Static HTML, CSS, browser JavaScript, Jest tests, CloudBase static hosting.

---

### Task 1: Add failing static layout tests

**Files:**
- Modify: `tests/web-admin/static.test.js`
- Verify: `npm test -- tests/web-admin/static.test.js --runInBand`

- [ ] Assert `web-admin/index.html` contains a workspace layout with `data-admin-layout`, `data-admin-sidebar`, and `data-admin-content`.
- [ ] Assert role-aware navigation buttons exist for users, activities, attendance stats, roster export, and logs.
- [ ] Assert the user, activity, attendance, export, and logs sections are independent `data-admin-view` regions.
- [ ] Verify the test fails before changing `web-admin/index.html`.

### Task 2: Add failing runtime view tests

**Files:**
- Modify: `tests/web-admin/app-login.test.js`
- Create or modify: `tests/web-admin/app-layout.test.js`
- Verify: `npm test -- tests/web-admin/app-login.test.js tests/web-admin/app-layout.test.js --runInBand`

- [ ] Assert confirmed QR login hides the login view and shows the workspace shell.
- [ ] Assert admins see user management navigation while organizers do not.
- [ ] Assert regular users remain forbidden.
- [ ] Assert clicking a sidebar item activates only that content view.
- [ ] Verify these tests fail before changing app runtime code.

### Task 3: Refactor HTML shell and CSS

**Files:**
- Modify: `web-admin/index.html`
- Modify: `web-admin/styles.css`

- [ ] Replace the single scrolling workspace with `aside` sidebar and right content area.
- [ ] Split the current sections into independent `data-admin-view` containers.
- [ ] Keep existing form names, table hooks, and `data-action` attributes so API calls remain unchanged.
- [ ] Update the static asset version to a new cache-busting value.

### Task 4: Add app navigation state

**Files:**
- Modify: `web-admin/src/app.js`

- [ ] Add a small navigation model that derives allowed menu items from the current user's roles.
- [ ] Render sidebar visibility and active state from that model.
- [ ] Default allowed users to the activities view after login.
- [ ] Keep existing API methods and data rendering functions.
- [ ] Ensure QR login view is hidden after access is granted.

### Task 5: Verify and deploy

**Files:**
- Modify if needed: `docs/development-log-v2.md`
- Modify if needed: `docs/superpowers/handoff/football-signup-miniapp-handoff.md`

- [ ] Run Web Admin tests.
- [ ] Run `git diff --check`.
- [ ] Deploy `web-admin` to the test CloudBase static hosting `/admin/`.
- [ ] Confirm the hosted page loads the refactored layout.
- [ ] Commit only this goal's files and leave unrelated local config changes untouched.
