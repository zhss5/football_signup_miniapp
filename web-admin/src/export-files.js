(function initExportFiles(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }

  root.WebAdminExportFiles = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function exportFilesFactory() {
  const XLSX_RUNTIME_ERROR = 'Excel 导出组件未加载，请刷新页面后重试。';

  function stringifyCell(value) {
    if (Array.isArray(value)) {
      return value.join(' / ');
    }

    return String(value ?? '');
  }

  function escapeCsvValue(value) {
    const text = stringifyCell(value);
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  }

  function rowsToCsv(rows = []) {
    if (!rows.length) {
      return '';
    }

    const headers = Object.keys(rows[0]);
    return [
      headers.join(','),
      ...rows.map(row => headers.map(header => escapeCsvValue(row[header])).join(','))
    ].join('\r\n');
  }

  function triggerBlobDownload({ browserRoot, content, filename, mimeType }) {
    const doc = browserRoot && browserRoot.document;
    const BlobCtor = browserRoot && browserRoot.Blob;
    const urlApi = browserRoot && (browserRoot.URL || browserRoot.webkitURL);

    if (
      !doc ||
      typeof doc.createElement !== 'function' ||
      !BlobCtor ||
      !urlApi ||
      typeof urlApi.createObjectURL !== 'function'
    ) {
      return;
    }

    const blob = new BlobCtor([content], { type: mimeType });
    const url = urlApi.createObjectURL(blob);
    const link = doc.createElement('a');
    link.href = url;
    link.download = filename;

    if (doc.body && typeof doc.body.appendChild === 'function') {
      doc.body.appendChild(link);
    }

    if (typeof link.click === 'function') {
      link.click();
    }

    if (link.parentNode && typeof link.parentNode.removeChild === 'function') {
      link.parentNode.removeChild(link);
    }

    if (typeof urlApi.revokeObjectURL === 'function') {
      urlApi.revokeObjectURL(url);
    }
  }

  function downloadCsv({ browserRoot, filename, rows = [] }) {
    const csv = rowsToCsv(rows);
    triggerBlobDownload({
      browserRoot,
      content: `\uFEFF${csv}`,
      filename,
      mimeType: 'text/csv;charset=utf-8'
    });
    return csv;
  }

  function measureCellWidth(value) {
    return Array.from(stringifyCell(value)).reduce(
      (width, character) => width + (character.codePointAt(0) > 255 ? 2 : 1),
      0
    );
  }

  function buildColumnWidths(rows = []) {
    if (!rows.length) {
      return [];
    }

    const headers = Object.keys(rows[0]);
    return headers.map(header => {
      const maxWidth = rows.reduce(
        (width, row) => Math.max(width, measureCellWidth(row[header])),
        measureCellWidth(header)
      );
      return {
        wch: Math.min(48, Math.max(10, maxWidth + 2))
      };
    });
  }

  function normalizeSheetName(value) {
    const name = String(value || '数据')
      .replace(/[\\/?*[\]:]/g, ' ')
      .trim();
    return (name || '数据').slice(0, 31);
  }

  function createXlsxWorkbook({ rows = [], sheetName = '数据', xlsx }) {
    if (!xlsx || !xlsx.utils) {
      throw new Error(XLSX_RUNTIME_ERROR);
    }

    const normalizedSheetName = normalizeSheetName(sheetName);
    const worksheet = xlsx.utils.json_to_sheet(rows);
    worksheet['!cols'] = buildColumnWidths(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, normalizedSheetName);
    return workbook;
  }

  function downloadXlsx({ filename, rows = [], sheetName = '数据', xlsx }) {
    const workbook = createXlsxWorkbook({
      rows,
      sheetName,
      xlsx
    });

    if (typeof xlsx.writeFile !== 'function') {
      throw new Error(XLSX_RUNTIME_ERROR);
    }

    xlsx.writeFile(workbook, filename, { compression: true });
    return workbook;
  }

  return {
    createXlsxWorkbook,
    downloadCsv,
    downloadXlsx,
    rowsToCsv
  };
});
