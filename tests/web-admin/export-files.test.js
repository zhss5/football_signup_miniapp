const path = require('path');

const exportFiles = require('../../web-admin/src/export-files');
const XLSX = require('../../web-admin/vendor/xlsx.full.min.js');

function createDownloadRoot() {
  const link = {
    click: jest.fn(),
    parentNode: {
      removeChild: jest.fn()
    }
  };
  const appendChild = jest.fn();
  const createObjectURL = jest.fn().mockReturnValue('blob:export');
  const revokeObjectURL = jest.fn();
  const BlobCtor = jest.fn(function Blob(parts, options) {
    this.parts = parts;
    this.options = options;
  });

  return {
    appendChild,
    createObjectURL,
    link,
    revokeObjectURL,
    root: {
      Blob: BlobCtor,
      URL: {
        createObjectURL,
        revokeObjectURL
      },
      document: {
        body: {
          appendChild
        },
        createElement: jest.fn().mockReturnValue(link)
      }
    },
    BlobCtor
  };
}

test('rowsToCsv serializes stable headers and escapes spreadsheet values', () => {
  expect(
    exportFiles.rowsToCsv([
      {
        姓名: 'Alex, Jr',
        备注: '他说"会来"',
        状态: '出勤'
      }
    ])
  ).toBe('姓名,备注,状态\r\n"Alex, Jr","他说""会来""",出勤');
});

test('downloadCsv writes a UTF-8 BOM file and returns the generated text', () => {
  const download = createDownloadRoot();

  const csv = exportFiles.downloadCsv({
    browserRoot: download.root,
    filename: 'roster.csv',
    rows: [{ 姓名: '张虹生', 状态: '出勤' }]
  });

  expect(csv).toBe('姓名,状态\r\n张虹生,出勤');
  expect(download.BlobCtor).toHaveBeenCalledWith(
    ['\uFEFF姓名,状态\r\n张虹生,出勤'],
    { type: 'text/csv;charset=utf-8' }
  );
  expect(download.link.download).toBe('roster.csv');
  expect(download.link.click).toHaveBeenCalledTimes(1);
  expect(download.revokeObjectURL).toHaveBeenCalledWith('blob:export');
});

test('createXlsxWorkbook preserves Chinese headers and values in a valid workbook', () => {
  const workbook = exportFiles.createXlsxWorkbook({
    rows: [
      {
        姓名: '张虹生',
        队伍: '队伍1',
        状态: '出勤'
      }
    ],
    sheetName: '报名名单',
    xlsx: XLSX
  });
  const bytes = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'buffer'
  });
  const parsed = XLSX.read(bytes, { type: 'buffer' });

  expect(parsed.SheetNames).toEqual(['报名名单']);
  expect(XLSX.utils.sheet_to_json(parsed.Sheets['报名名单'])).toEqual([
    {
      姓名: '张虹生',
      队伍: '队伍1',
      状态: '出勤'
    }
  ]);
  expect(workbook.Sheets['报名名单']['!cols']).toEqual([
    { wch: 10 },
    { wch: 10 },
    { wch: 10 }
  ]);
});

test('downloadXlsx delegates the workbook to SheetJS with compression', () => {
  const writeFile = jest.fn();
  const xlsx = {
    ...XLSX,
    writeFile
  };

  const workbook = exportFiles.downloadXlsx({
    filename: 'activity-roster.xlsx',
    rows: [{ 姓名: '张虹生' }],
    sheetName: '报名名单',
    xlsx
  });

  expect(workbook.SheetNames).toEqual(['报名名单']);
  expect(writeFile).toHaveBeenCalledWith(
    workbook,
    'activity-roster.xlsx',
    { compression: true }
  );
});

test('XLSX export reports a readable error when the runtime is unavailable', () => {
  expect(() =>
    exportFiles.createXlsxWorkbook({
      rows: [],
      sheetName: '报名名单',
      xlsx: null
    })
  ).toThrow('Excel 导出组件未加载，请刷新页面后重试。');
});

test('the vendored SheetJS runtime is loaded from the expected local path', () => {
  expect(path.basename(require.resolve('../../web-admin/vendor/xlsx.full.min.js')))
    .toBe('xlsx.full.min.js');
});
