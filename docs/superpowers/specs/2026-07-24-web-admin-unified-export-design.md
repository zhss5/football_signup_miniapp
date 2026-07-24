# Web Admin Unified Export Design

## Context

Web Admin currently exposes three CSV-only export controls:

- activity roster export;
- activity operation-log export;
- statistics export, which switches between attendance and cancellation data.

CSV remains useful for integrations, but directly opening the current comma-delimited file in some Windows Excel installations can place every value in one column. Operators also need a native Excel workbook option.

## Confirmed Scope

All existing Web Admin export controls will use one consistent `导出` menu with:

- `CSV 格式 (.csv)`;
- `Excel 格式 (.xlsx)`.

The change covers four datasets:

- activity roster;
- activity operation logs;
- attendance statistics;
- cancellation statistics.

It does not add exports to views that currently have no export control.

## User Experience

Each current export button becomes a compact menu trigger labelled `导出`.

Selecting a format immediately downloads the currently visible dataset:

- roster and activity-log exports respect their current keyword filters;
- statistics export uses the active attendance or cancellation tab and the currently loaded date/type query;
- CSV and XLSX use identical rows and Chinese column headers.

Only one export menu can be open at a time. Selecting an option, clicking elsewhere, switching statistics tabs, or pressing `Escape` closes the menu. Existing empty-statistics feedback remains unchanged.

## Architecture

### Export utility

Create `web-admin/src/export-files.js` as a UI-independent export utility. It owns:

- CSV escaping and serialization;
- UTF-8 BOM browser downloads;
- XLSX workbook creation;
- conservative worksheet column widths;
- browser XLSX downloads.

The utility consumes arrays of plain row objects. It does not know about activities, statistics, page filters, CloudBase, or Web Admin roles.

### Page integration

`web-admin/src/app.js` continues to map each current view into export rows. A single export descriptor contains:

- the current rows;
- the base filename;
- the worksheet name;
- the existing empty-state behavior where applicable.

The selected format is then passed to the export utility. This keeps CSV and XLSX field order identical and prevents separate format-specific mappings from drifting.

### XLSX dependency

Vendor the fixed SheetJS Community Edition `xlsx.full.min.js` browser build under `web-admin/vendor/`. Load it before `export-files.js` and `app.js`.

The hosted page must not fetch SheetJS from a third-party CDN at runtime. The vendored version and source URL are recorded beside the asset.

## Data Contracts

No backend contract changes are required.

- Cloud functions continue returning CSV/XLSX-ready rows.
- Web Admin continues generating files in the browser.
- No CloudBase collection, field, role, API input, or API output changes.
- No runtime MySQL migration, dual-write, or self-hosted HTTP API switch.

## File Names And Worksheets

| Dataset | Base filename | Worksheet |
| --- | --- | --- |
| Attendance statistics | `attendance-stats` | `出勤统计` |
| Cancellation statistics | `cancellation-stats` | `取消统计` |
| Activity roster | `activity-roster-{activityId}` | `报名名单` |
| Activity logs | `activity-logs-{activityId}` | `活动流水` |

The chosen extension is appended at export time.

## Error Handling

- Missing statistics rows retain the existing Chinese guidance and do not download a file.
- If the vendored XLSX runtime is unavailable, Web Admin surfaces a readable error instead of silently doing nothing.
- CSV export remains available independently of the XLSX runtime.
- Export failures do not mutate page data or backend state.

## Testing

TDD coverage will verify:

- CSV escaping and UTF-8 download content;
- XLSX workbook sheet name, headers, values, and column metadata;
- the vendored SheetJS asset and script order;
- consistent menu markup for all existing export controls;
- one-menu-at-a-time, outside-click, selection, and `Escape` behavior;
- CSV and XLSX export for all four datasets;
- existing filter and active-statistics-tab behavior;
- unchanged empty-statistics feedback.

## Deployment

Only Web Admin static hosting needs redeployment. No cloud function or database deployment is required.
