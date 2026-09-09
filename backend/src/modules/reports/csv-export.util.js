/**
 * Pure-JavaScript RFC 4180 compliant CSV generator with enterprise security bounds.
 * Zero external dependencies.
 *
 * Security & Defense bounds:
 * - Deterministic column order dictated strictly by columns configuration
 * - RFC 4180 quoting and character escaping for delimiters, quotes, and newlines
 * - Formula / CSV Injection (CWE-1236) sanitization for leading =, +, -, @, \t, \r
 * - Null / undefined coercion to empty string
 * - Deterministic date/time formatting (YYYY-MM-DD HH:mm:ss in UTC)
 * - UTF-8 Byte Order Mark (BOM) \uFEFF for seamless Microsoft Excel rendering
 * - Max row export bounds to protect server memory
 */

export const EXPORT_LIMITS = {
  MAX_ROWS: 10000,
  MAX_COLUMNS: 50,
};

const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);

/**
 * Sanitizes a cell string against Formula Injection (CWE-1236).
 * Prepends a single quote if the raw string begins with formula trigger characters,
 * instructing spreadsheet applications (Excel, LibreOffice Calc, Google Sheets) to treat it strictly as text.
 *
 * @param {string} value
 * @returns {string}
 */
export function sanitizeFormulaInjection(value) {
  if (typeof value !== 'string' || value.length === 0) return value;
  const firstChar = value.charAt(0);
  if (FORMULA_TRIGGERS.has(firstChar)) {
    return "'" + value;
  }
  return value;
}

/**
 * Formats a Date object or ISO string to deterministic 'YYYY-MM-DD HH:mm:ss' in UTC.
 *
 * @param {Date|string|number} dateInput
 * @returns {string}
 */
export function formatCsvDate(dateInput) {
  if (!dateInput) return '';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Escapes a single cell according to RFC 4180 and formula injection defenses.
 *
 * @param {any} rawVal
 * @returns {string}
 */
export function escapeCsvCell(rawVal) {
  if (rawVal === null || rawVal === undefined) {
    return '';
  }

  let str;
  if (rawVal instanceof Date) {
    str = formatCsvDate(rawVal);
  } else if (typeof rawVal === 'number' || typeof rawVal === 'boolean') {
    return String(rawVal);
  } else if (typeof rawVal === 'object') {
    str = JSON.stringify(rawVal);
  } else {
    str = String(rawVal);
  }

  // Sanitize formula injection
  str = sanitizeFormulaInjection(str);

  // If contains delimiter (,), double quote ("), newline (\n), carriage return (\r), or leading single quote from sanitization
  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r') ||
    str.startsWith("'")
  ) {
    return '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}

/**
 * Generates an RFC 4180 CSV string from columns definition and row records.
 *
 * @typedef {Object} CsvColumn
 * @property {string} key Property key in row object
 * @property {string} header Column header title
 * @property {(val: any, row: object) => any} [format] Optional transformation callback
 *
 * @param {CsvColumn[]} columns List of columns in deterministic order
 * @param {object[]} rows Data records
 * @param {object} [options]
 * @param {boolean} [options.includeBom=true] Whether to prepend UTF-8 BOM
 * @returns {string} RFC 4180 formatted CSV string
 */
export function generateCsv(columns, rows, options = {}) {
  const includeBom = options.includeBom !== false;

  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error('Columns definition must be a non-empty array');
  }
  if (!Array.isArray(rows)) {
    throw new Error('Rows must be an array');
  }
  if (rows.length > EXPORT_LIMITS.MAX_ROWS) {
    throw new Error(`Export exceeds maximum permitted limit of ${EXPORT_LIMITS.MAX_ROWS} rows`);
  }
  if (columns.length > EXPORT_LIMITS.MAX_COLUMNS) {
    throw new Error(`Export exceeds maximum permitted limit of ${EXPORT_LIMITS.MAX_COLUMNS} columns`);
  }

  // Deterministic header line
  const headerLine = columns.map((col) => escapeCsvCell(col.header)).join(',');
  const lines = [headerLine];

  // Data lines in deterministic order
  for (const row of rows) {
    const rowValues = columns.map((col) => {
      let val = row[col.key];
      if (typeof col.format === 'function') {
        val = col.format(val, row);
      }
      return escapeCsvCell(val);
    });
    lines.push(rowValues.join(','));
  }

  const csvContent = lines.join('\r\n');
  return includeBom ? '\uFEFF' + csvContent : csvContent;
}
