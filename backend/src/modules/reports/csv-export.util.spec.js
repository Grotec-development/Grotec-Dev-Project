import { describe, expect, it } from 'vitest';
import {
  escapeCsvCell,
  formatCsvDate,
  generateCsv,
  sanitizeFormulaInjection,
  EXPORT_LIMITS,
} from './csv-export.util';

describe('CSV Export Utility (RFC 4180 & Security Bounds)', () => {
  describe('sanitizeFormulaInjection (CWE-1236 Defense)', () => {
    it('prepends single quote to cells starting with formula triggers', () => {
      expect(sanitizeFormulaInjection('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeFormulaInjection('+1234567890')).toBe("'+1234567890");
      expect(sanitizeFormulaInjection('-2000')).toBe("'-2000");
      expect(sanitizeFormulaInjection('@cmd|/C')).toBe("'@cmd|/C");
      expect(sanitizeFormulaInjection('\tcmd')).toBe("'\tcmd");
      expect(sanitizeFormulaInjection('\rcmd')).toBe("'\rcmd");
    });

    it('leaves harmless text, numbers, and null/undefined unchanged', () => {
      expect(sanitizeFormulaInjection('Ramesh Kumar')).toBe('Ramesh Kumar');
      expect(sanitizeFormulaInjection('Dharmapuri')).toBe('Dharmapuri');
      expect(sanitizeFormulaInjection(12345)).toBe(12345);
      expect(sanitizeFormulaInjection('')).toBe('');
      expect(sanitizeFormulaInjection(null)).toBe(null);
    });
  });

  describe('formatCsvDate', () => {
    it('formats date object to UTC YYYY-MM-DD HH:mm:ss', () => {
      const d = new Date(Date.UTC(2026, 8, 9, 14, 30, 15));
      expect(formatCsvDate(d)).toBe('2026-09-09 14:30:15');
    });

    it('formats ISO string to UTC YYYY-MM-DD HH:mm:ss', () => {
      expect(formatCsvDate('2026-09-09T14:30:15.000Z')).toBe('2026-09-09 14:30:15');
    });

    it('returns empty string for null, undefined, or invalid dates', () => {
      expect(formatCsvDate(null)).toBe('');
      expect(formatCsvDate(undefined)).toBe('');
      expect(formatCsvDate('invalid-date')).toBe('');
    });
  });

  describe('escapeCsvCell', () => {
    it('handles null and undefined as empty strings', () => {
      expect(escapeCsvCell(null)).toBe('');
      expect(escapeCsvCell(undefined)).toBe('');
    });

    it('converts numbers and booleans to string without quotes', () => {
      expect(escapeCsvCell(42)).toBe('42');
      expect(escapeCsvCell(true)).toBe('true');
      expect(escapeCsvCell(false)).toBe('false');
    });

    it('quotes strings containing commas', () => {
      expect(escapeCsvCell('Salem, Tamil Nadu')).toBe('"Salem, Tamil Nadu"');
    });

    it('escapes internal quotes by doubling them', () => {
      expect(escapeCsvCell('Farmer said "Interested"')).toBe('"Farmer said ""Interested"""');
    });

    it('quotes strings containing line breaks', () => {
      expect(escapeCsvCell('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
      expect(escapeCsvCell('Line 1\r\nLine 2')).toBe('"Line 1\r\nLine 2"');
    });

    it('quotes sanitized formula cells', () => {
      const sanitized = escapeCsvCell('=2+2');
      expect(sanitized).toBe('"\'=2+2"');
    });
  });

  describe('generateCsv', () => {
    const columns = [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Full Name' },
      { key: 'phone', header: 'Phone' },
      { key: 'amount', header: 'Amount', format: (v) => `₹${v}` },
    ];

    it('generates standard RFC 4180 CSV with UTF-8 BOM by default', () => {
      const rows = [
        { id: 1, name: 'Murugan', phone: '+919876543210', amount: 1500 },
        { id: 2, name: 'Suresh, V.', phone: '+919876543211', amount: 2000 },
      ];

      const csv = generateCsv(columns, rows);
      expect(csv.startsWith('\uFEFF')).toBe(true);

      const clean = csv.slice(1);
      const lines = clean.split('\r\n');
      expect(lines[0]).toBe('ID,Full Name,Phone,Amount');
      expect(lines[1]).toBe('1,Murugan,"\'+919876543210",₹1500');
      expect(lines[2]).toBe('2,"Suresh, V.","\'+919876543211",₹2000');
    });

    it('preserves deterministic column order even if row keys differ', () => {
      const rows = [
        { amount: 500, phone: '987', id: 99, name: 'Reverse Order' },
      ];
      const csv = generateCsv(columns, rows, { includeBom: false });
      const lines = csv.split('\r\n');
      expect(lines[0]).toBe('ID,Full Name,Phone,Amount');
      expect(lines[1]).toBe('99,Reverse Order,987,₹500');
    });

    it('generates header-only CSV when rows array is empty', () => {
      const csv = generateCsv(columns, [], { includeBom: false });
      expect(csv).toBe('ID,Full Name,Phone,Amount');
    });

    it('handles null values in data rows deterministically', () => {
      const rows = [{ id: 1, name: null, phone: undefined, amount: 0 }];
      const csv = generateCsv(columns, rows, { includeBom: false });
      const lines = csv.split('\r\n');
      expect(lines[1]).toBe('1,,,₹0');
    });

    it('throws when columns definition is empty or invalid', () => {
      expect(() => generateCsv([], [])).toThrow(/Columns definition must be a non-empty array/);
      expect(() => generateCsv(null, [])).toThrow(/Columns definition must be a non-empty array/);
    });

    it('throws when rows parameter is not an array', () => {
      expect(() => generateCsv(columns, null)).toThrow(/Rows must be an array/);
    });

    it('enforces maximum row export limit', () => {
      const oversized = new Array(EXPORT_LIMITS.MAX_ROWS + 1).fill({ id: 1, name: 'A', phone: '1', amount: 1 });
      expect(() => generateCsv(columns, oversized)).toThrow(/Export exceeds maximum permitted limit/);
    });
  });
});
