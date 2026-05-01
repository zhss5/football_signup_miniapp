# Football Signup Mini Program

A WeChat mini program MVP for organizing football match signups.

The project is built for a fast MVP launch first, while keeping room for future payments, analytics, and multi-organization support.

## Features

- Create football signup activities
- Configure activity date, start time, end time, and signup deadline
- Select activity location with WeChat map
- Add an optional insurance signup link and let participants copy it from Activity Detail
- Upload one cover image and crop it to a shared `2:1` ratio
- Start from one default team and configure up to four named teams
- Auto-generate a bench team when total capacity exceeds named-team capacity
- Join exactly one team per activity
- Cancel signup before the signup deadline
- Cancel or soft-delete activities as the organizer
- Let organizers/admins copy participant names, add proxy participants, and move participants between teams
- View created and joined activities from the `My` page
- Run the app in local mock mode inside WeChat DevTools without a real CloudBase environment
- Run against a real CloudBase environment through deployed cloud functions

## Tech Stack

- Native WeChat Mini Program
- WeChat CloudBase style cloud functions
- JavaScript
- Jest for tests

## Repository Structure

```text
cloudfunctions/      Cloud function entrypoints and shared server helpers
docs/                Design, plan, progress, and CloudBase setup docs
miniprogram/         Mini program pages, components, services, and utils
scripts/             Local development helper scripts
tests/               Jest test suites
package.json         Root scripts
project.config.json  WeChat DevTools project config
README.md
```

## Main Pages

- `Home`
  Activity list, status, and create entry
- `Create Activity`
  Organizer form for activity setup
- `Activity Cover Crop`
  Cover-image crop flow with a shared `2:1` output ratio
- `Activity Detail`
  Team list, signup, cancellation, and organizer actions
- `My`
  `Created` and `Joined` activity tabs

## Development Modes

The project supports two modes:

1. `Local mock mode`
   Recommended for UI and flow testing in WeChat DevTools.
2. `CloudBase mode`
   Use this after you have a real mini program AppID and CloudBase environment.

Current runtime config lives in:

- `miniprogram/config/env.js`
- optional local-only override: `miniprogram/config/env.local.js`

## Local Development

### Install dependencies

```bash
npm ci
```

### Run tests

```bash
npm test -- --runInBand
```

### Open in WeChat DevTools

1. Open WeChat DevTools
2. Import the repository root:
   `D:/workspaces/football_signup_miniapp`
3. Keep the default mini program settings
4. Start in local mock mode

Detailed setup instructions:

- [WeChat DevTools Setup](docs/cloudbase/wechat-devtools-setup.md)

## CloudBase Notes

When moving from local mock mode to a real CloudBase environment, also review:

- [real-cloudbase-rollout.md](docs/cloudbase/real-cloudbase-rollout.md)
- [indexes.md](docs/cloudbase/indexes.md)
- [security-rules.json](docs/cloudbase/security-rules.json)
- [manual-smoke-checklist.md](docs/cloudbase/manual-smoke-checklist.md)
- [seed-sample.json](docs/cloudbase/seed-sample.json)

CloudBase deployment reminders:

- Each cloud function directory has its own `package.json` because remote dependency installation reads dependencies from the uploaded function package.
- Run `npm run copy:cloud-shared` before deploying cloud functions. CloudBase uploads each function directory independently, so shared helper files must be present inside each function package.
- The cover image upload flow stores CloudBase `fileID` values instead of temporary local file paths.
- `ensureUserProfile` bootstraps the required database collections on first real-cloud startup. If the first launch times out, increase that cloud function timeout in CloudBase or create the collections manually, then retry.

## Project Documents

- Design: [football-signup-miniapp-design.md](docs/superpowers/specs/football-signup-miniapp-design.md)
- Plan: [football-signup-miniapp-mvp-implementation.md](docs/superpowers/plans/football-signup-miniapp-mvp-implementation.md)
- Progress: [football-signup-miniapp-progress.md](docs/superpowers/progress/football-signup-miniapp-progress.md)

## Current Status

The repository already contains a runnable MVP implementation in local mock mode, including:

- activity creation
- team signup
- deadline enforcement
- organizer cancellation
- soft delete
- `My` page tabs and created-history filters
- cover-image crop flow
- CloudBase deployment packaging and real-cloud function wiring
- organizer/admin roster operations for copying names, proxy signup, removal, and team reassignment
- one-team default activity setup with optional additional teams
- optional insurance link support for activity creation, editing, and detail-page copying

## Next Recommended Work

- complete the production CloudBase smoke pass on a real device
- apply and verify production database indexes and security rules
- add a dedicated bench-promotion workflow if manual team reassignment becomes insufficient
- implement preferred playing position selection
- replace slider-based crop controls with gesture-based interaction
- prepare payment-related data and flows
