# Web Admin Unified Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every existing Web Admin CSV-only export control with a consistent format menu that downloads the same filtered rows as CSV or XLSX.

**Architecture:** Add a UI-independent browser export utility for CSV and XLSX generation, backed by a fixed local SheetJS browser bundle. Keep dataset selection and Chinese column mapping in `app.js`, then route one export descriptor through the selected file format.

**Tech Stack:** Vanilla browser JavaScript, Jest, static HTML/CSS, SheetJS Community Edition 0.20.3.

## Global Constraints

- Preserve all current CloudBase function inputs and outputs.
- Generate CSV and XLSX files only in Web Admin.
- Do not change CloudBase collections or current runtime storage.
- Do not implement runtime MySQL migration, dual-write, or a self-hosted HTTP API switch.
- Preserve unrelated local changes and commit only files owned by each task.
- Follow TDD: verify each new behavior fails before adding its implementation.
- Bump every Web Admin static asset query string before hosted deployment.

---

### Task 1: Add The Client-Side Export Utility

**Files:**
- Create: `tests/web-admin/export-files.test.js`
- Create: `web-admin/src/export-files.js`
- Create: `web-admin/vendor/xlsx.full.min.js`
- Create: `web-admin/vendor/SHEETJS.md`
- Modify: `web-admin/index.html`
- Modify: `tests/web-admin/static.test.js`

**Interfaces:**
- Consumes: plain arrays of row objects and the browser `XLSX` global.
- Produces: `rowsToCsv(rows)`, `downloadCsv(options)`, `createXlsxWorkbook(options)`, and `downloadXlsx(options)`.

- [ ] **Step 1: Write failing export utility tests**

Add tests that require `web-admin/src/export-files.js` and assert:

```javascript
expect(rowsToCsv([{ 姓名: 'Alex, Jr', 状态: '出勤' }]))
  .toBe('姓名,状态\r\n"Alex, Jr",出勤');

const workbook = createXlsxWorkbook({
  rows: [{ 姓名: '张虹生', 状态: '出勤' }],
  sheetName: '报名名单',
  xlsx: XLSX
});
const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
const parsed = XLSX.read(bytes, { type: 'buffer' });
expect(XLSX.utils.sheet_to_json(parsed.Sheets['报名名单'])).toEqual([
  { 姓名: '张虹生', 状态: '出勤' }
]);
```

Update the static shell test to require a local SheetJS script before `export-files.js` and `app.js`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npx jest --runInBand tests/web-admin/export-files.test.js tests/web-admin/static.test.js
```

Expected: FAIL because `export-files.js`, the vendored asset, and the new script tags do not exist.

- [ ] **Step 3: Implement the minimal export utility**

Implement a UMD module with:

```javascript
function createXlsxWorkbook({ rows = [], sheetName = '数据', xlsx }) {
  if (!xlsx || !xlsx.utils) {
    throw new Error('Excel 导出组件未加载，请刷新页面后重试。');
  }

  const worksheet = xlsx.utils.json_to_sheet(rows);
  worksheet['!cols'] = buildColumnWidths(rows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
  return workbook;
}
```

Vendor the fixed official SheetJS 0.20.3 standalone browser build, record its source and SHA-256 in `SHEETJS.md`, and load it locally before `export-files.js`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
npx jest --runInBand tests/web-admin/export-files.test.js tests/web-admin/static.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add tests/web-admin/export-files.test.js tests/web-admin/static.test.js web-admin/src/export-files.js web-admin/vendor/xlsx.full.min.js web-admin/vendor/SHEETJS.md web-admin/index.html
git commit -m "feat: add web admin xlsx export utility"
```

### Task 2: Add The Shared Export Menu And Connect Every Dataset

**Files:**
- Modify: `tests/web-admin/app-layout.test.js`
- Modify: `tests/web-admin/static.test.js`
- Modify: `web-admin/index.html`
- Modify: `web-admin/styles.css`
- Modify: `web-admin/src/app.js`

**Interfaces:**
- Consumes: `WebAdminExportFiles`, active page filters, active statistics tab, and current view rows.
- Produces: one `导出` trigger with CSV/XLSX choices for roster, activity logs, and statistics.

- [ ] **Step 1: Write failing menu and integration tests**

Assert the static shell contains three menu triggers and each menu contains:

```html
<button data-action="export-file" data-export-format="csv">CSV 格式 (.csv)</button>
<button data-action="export-file" data-export-format="xlsx">Excel 格式 (.xlsx)</button>
```

Add runtime tests that:

- open only the selected menu;
- close menus on outside click and `Escape`;
- export attendance and cancellation rows according to the active tab;
- export filtered roster and activity-log rows;
- call `XLSX.writeFile` with the expected `.xlsx` filename and worksheet.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npx jest --runInBand tests/web-admin/app-layout.test.js tests/web-admin/static.test.js
```

Expected: FAIL because the old CSV-only buttons and direct export actions are still present.

- [ ] **Step 3: Implement the shared menu and descriptor routing**

Add an export descriptor resolver equivalent to:

```javascript
function getExportDescriptor(source) {
  if (source === 'statistics') {
    return state.activeStatisticsTab === 'cancellation'
      ? buildCancellationExportDescriptor()
      : buildAttendanceExportDescriptor();
  }

  return source === 'activity-logs'
    ? buildActivityLogExportDescriptor()
    : buildRosterExportDescriptor();
}
```

Route the selected format through:

```javascript
function exportRows(descriptor, format) {
  if (format === 'xlsx') {
    exportFiles.downloadXlsx({
      ...descriptor,
      xlsx: runtimeBrowserRoot && runtimeBrowserRoot.XLSX
    });
    return;
  }

  exportFiles.downloadCsv(descriptor);
}
```

Use one open-menu state, update `aria-expanded`, close menus after selection/outside click/tab switch/`Escape`, and retain the current empty-statistics messages.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
npx jest --runInBand tests/web-admin/app-layout.test.js tests/web-admin/static.test.js tests/web-admin/export-files.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add tests/web-admin/app-layout.test.js tests/web-admin/static.test.js web-admin/index.html web-admin/styles.css web-admin/src/app.js
git commit -m "feat: unify web admin export format menus"
```

### Task 3: Record Deployment Scope And Run Regression

**Files:**
- Modify: `docs/development-log-v2.md`
- Modify: `docs/superpowers/progress/football-signup-miniapp-v2-progress.md`

**Interfaces:**
- Consumes: verified Task 1 and Task 2 behavior.
- Produces: current V2 implementation and deployment records.

- [ ] **Step 1: Update V2 documentation**

Record:

- all four datasets support CSV and XLSX;
- exports use current filters and active statistics tab;
- SheetJS is vendored locally;
- only Web Admin static hosting needs redeployment;
- no cloud function, database, runtime MySQL, dual-write, or self-hosted API change.

- [ ] **Step 2: Run Web Admin regression**

Run:

```powershell
npx jest --runInBand tests/web-admin
```

Expected: all Web Admin suites pass.

- [ ] **Step 3: Run full regression and diff checks**

Run:

```powershell
npm test
git diff --check
git status --short
```

Expected: all tests pass; scoped files have no whitespace errors; unrelated local files remain unstaged.

- [ ] **Step 4: Commit**

```powershell
git add docs/development-log-v2.md docs/superpowers/progress/football-signup-miniapp-v2-progress.md
git commit -m "docs: record unified web admin exports"
```
