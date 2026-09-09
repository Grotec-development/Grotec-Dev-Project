import { describe, expect, it } from 'vitest';
import { parseCsv, sanitizeFormulaInjection, CSV_LIMITS } from './csv-parser.util';

describe('CSV Parser (RFC 4180 & Security Bounds)', () => {
  it('parses standard comma-separated values with CRLF and LF', () => {
    const csv = 'Full Name,Phone,District\r\nKarthik,9876543210,Salem\nMurugan,9876543211,Trichy\r\n';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['Full Name', 'Phone', 'District']);
    expect(result.rowCount).toBe(2);
    expect(result.rows[0]).toEqual({
      'Full Name': 'Karthik',
      Phone: '9876543210',
      District: 'Salem',
    });
    expect(result.rows[1]).toEqual({
      'Full Name': 'Murugan',
      Phone: '9876543211',
      District: 'Trichy',
    });
  });

  it('handles quoted fields containing commas', () => {
    const csv = 'Name,Location\n"Ramasamy, M.","Lalgudi, Trichy"';
    const result = parseCsv(csv);

    expect(result.rowCount).toBe(1);
    expect(result.rows[0]['Name']).toBe('Ramasamy, M.');
    expect(result.rows[0]['Location']).toBe('Lalgudi, Trichy');
  });

  it('handles escaped quotes ("") inside quoted fields', () => {
    const csv = 'Name,Soil\n"Farmer ""Rajan""","Red ""loam"" soil"';
    const result = parseCsv(csv);

    expect(result.rows[0]['Name']).toBe('Farmer "Rajan"');
    expect(result.rows[0]['Soil']).toBe('Red "loam" soil');
  });

  it('handles multiline cell values across line breaks', () => {
    const csv = 'Name,Notes\n"Senthil","First line\nSecond line\nThird line"';
    const result = parseCsv(csv);

    expect(result.rowCount).toBe(1);
    expect(result.rows[0]['Notes']).toBe('First line\nSecond line\nThird line');
  });

  it('strips UTF-8 Byte Order Mark (BOM)', () => {
    const bomCsv = '\uFEFFName,Phone\nSuresh,9876543212';
    const result = parseCsv(bomCsv);

    expect(result.headers[0]).toBe('Name');
    expect(result.rowCount).toBe(1);
  });

  it('sanitizes Formula Injection triggers (=, +, -, @, \\t, \\r)', () => {
    expect(sanitizeFormulaInjection('=cmd|/C calc')).toBe("'=cmd|/C calc");
    expect(sanitizeFormulaInjection('+12345')).toBe("'+12345");
    expect(sanitizeFormulaInjection('-50')).toBe("'-50");
    expect(sanitizeFormulaInjection('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
    expect(sanitizeFormulaInjection('Safe Text')).toBe('Safe Text');

    const injectionCsv = 'Name,Formula\nAttacker,"=1+1"';
    const result = parseCsv(injectionCsv);
    expect(result.rows[0]['Formula']).toBe("'=1+1");
  });

  it('returns empty result for blank or empty CSV', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [], rawRows: [], rowCount: 0 });
    expect(parseCsv('   \r\n   ')).toEqual({ headers: [], rows: [], rawRows: [], rowCount: 0 });
  });

  it('throws a syntax error on unclosed quotes with line number', () => {
    const brokenCsv = 'Name,Phone\n"Unclosed text,9876543210';
    expect(() => parseCsv(brokenCsv)).toThrow(/Unclosed quote detected starting at line 2/);
  });

  it('throws an error on oversized cells exceeding limit', () => {
    const hugeCell = 'a'.repeat(CSV_LIMITS.MAX_CELL_LENGTH + 5);
    const csv = `Name,Phone\n${hugeCell},9876543210`;
    expect(() => parseCsv(csv)).toThrow(/exceeds maximum permitted limit/);
  });
});
