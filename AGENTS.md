# Repository Conventions

## Documentation Language

- Write documentation in English by default.
- If a document must target Chinese-speaking end users, user-facing examples and UI copy may remain in Chinese when appropriate.

## Architecture Constraints

- For Version 2 and later data, API, auth, and logging changes, keep designs compatible with a future MySQL 8.x and self-hosted server migration.
- Prefer explicit IDs, stable enum values, clear timestamp fields, and API-shaped cloud function inputs and outputs.
- Keep current business state separate from audit and history logs.
- Avoid coupling backend data contracts directly to mini-program or web-admin UI structures.
- Do not implement runtime MySQL migration, dual-write, or self-hosted HTTP API migration unless explicitly requested.

## Git Workflow

- Commit every change. Do not leave completed modifications uncommitted at the end of a task.
