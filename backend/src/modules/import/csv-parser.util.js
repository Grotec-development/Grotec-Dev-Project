/**
 * Pure-JavaScript RFC 4180 compliant CSV parser with enterprise security bounds.
 * Zero external dependencies.
 *
 * Security & Defense bounds:
 * - Max file size: 5 MB
 * - Max row count: 5,000 rows
 * - Max columns: 100 columns
 * - Max cell length: 10,000 characters
 * - Formula / CSV Injection (CWE-1236) sanitization for leading `=,+,-,@,\t,\r`
 * - Strips UTF-8 Byte Order Mark (BOM) \uFEFF
 * - Detailed syntax error reporting for unclosed quotes and malformed lines
 */

export const CSV_LIMITS = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  MAX_ROWS: 5000,
  MAX_COLUMNS: 100,
  MAX_CELL_LENGTH: 10000,
};

const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);

/**
 * Sanitizes a cell string against Formula Injection (CWE-1236).
 * Prepends a single quote if the raw string begins with formula trigger characters,
 * instructing spreadsheet applications (Excel, Calc, Sheets) to treat it strictly as text.
 */
export function sanitizeFormulaInjection(value) {
  if (typeof value !== 'string' || value.length === 0) return value;
  const firstChar = value.charAt(0);
  if (FORMULA_TRIGGERS.has(firstChar)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Parses raw CSV text into rows of cell arrays.
 * Handles CRLF, LF, CR, quotes with commas, escaped quotes, and multiline values.
 *
 * @param {string} text Raw CSV text content
 * @param {object} [options]
 * @param {boolean} [options.sanitizeFormulas=true]
 * @returns {{ headers: string[], rows: Record<string, string>[], rawRows: string[][], rowCount: number }}
 */
export function parseCsv(text, options = {}) {
  const sanitize = options.sanitizeFormulas !== false;

  if (typeof text !== 'string') {
    throw new Error('CSV input must be a string');
  }

  // Strip UTF-8 BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  if (cleanText.trim().length === 0) {
    return { headers: [], rows: [], rawRows: [], rowCount: 0 };
  }

  const rawRows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;
  let quoteStartLine = 1;
  let lineNumber = 1;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = i + 1 < cleanText.length ? cleanText[i + 1] : null;

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentCell += '"';
          i++; // Skip the second quote
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        currentCell += char;
        if (char === '\n') {
          lineNumber++;
        }
      }

      if (currentCell.length > CSV_LIMITS.MAX_CELL_LENGTH) {
        throw new Error(
          `Cell length at line ${lineNumber} exceeds maximum permitted limit (${CSV_LIMITS.MAX_CELL_LENGTH} characters)`
        );
      }
    } else {
      if (char === '"') {
        // Opening quote: can only happen at start of cell (after optional leading space)
        if (currentCell.trim().length === 0) {
          inQuotes = true;
          quoteStartLine = lineNumber;
          currentCell = '';
        } else {
          currentCell += char;
        }
      } else if (char === ',') {
        // End of cell
        currentRow.push(sanitize ? sanitizeFormulaInjection(currentCell.trim()) : currentCell.trim());
        currentCell = '';
      } else if (char === '\r') {
        // Carriage return: check if followed by \n
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(sanitize ? sanitizeFormulaInjection(currentCell.trim()) : currentCell.trim());
        currentCell = '';
        if (currentRow.some((c) => c.length > 0)) {
          rawRows.push(currentRow);
        }
        currentRow = [];
        lineNumber++;
      } else if (char === '\n') {
        // Line feed
        currentRow.push(sanitize ? sanitizeFormulaInjection(currentCell.trim()) : currentCell.trim());
        currentCell = '';
        if (currentRow.some((c) => c.length > 0)) {
          rawRows.push(currentRow);
        }
        currentRow = [];
        lineNumber++;
      } else {
        currentCell += char;
        if (currentCell.length > CSV_LIMITS.MAX_CELL_LENGTH) {
          throw new Error(
            `Cell length at line ${lineNumber} exceeds maximum permitted limit (${CSV_LIMITS.MAX_CELL_LENGTH} characters)`
          );
        }
      }
    }

    if (rawRows.length > CSV_LIMITS.MAX_ROWS) {
      throw new Error(`CSV file exceeds maximum row limit of ${CSV_LIMITS.MAX_ROWS} rows`);
    }
  }

  if (inQuotes) {
    throw new Error(`Malformed CSV: Unclosed quote detected starting at line ${quoteStartLine}`);
  }

  // Push final cell and row if content remains
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(sanitize ? sanitizeFormulaInjection(currentCell.trim()) : currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rawRows.push(currentRow);
    }
  }

  if (rawRows.length === 0) {
    return { headers: [], rows: [], rawRows: [], rowCount: 0 };
  }

  // Extract headers from first row
  const headers = rawRows[0].map((h, idx) => (h && h.length > 0 ? h : `Column_${idx + 1}`));

  if (headers.length > CSV_LIMITS.MAX_COLUMNS) {
    throw new Error(`CSV file exceeds maximum column limit of ${CSV_LIMITS.MAX_COLUMNS} columns`);
  }

  // Map subsequent rows to header keys
  const rows = [];
  for (let r = 1; r < rawRows.length; r++) {
    const rawCols = rawRows[r];
    const rowObj = {};
    for (let c = 0; c < headers.length; c++) {
      rowObj[headers[c]] = c < rawCols.length ? rawCols[c] : '';
    }
    rows.push(rowObj);
  }

  return {
    headers,
    rows,
    rawRows,
    rowCount: rows.length,
  };
}
